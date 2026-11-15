/**
 * HOOLM War Table — Main Entry Point
 * Orchestrates: Setup → Draft (optional) → Board → Gameplay
 */

import './style.css';
import { loadCharacters, loadGlossary, getCharacters } from './data/data-loader.js';
import { SetupScreen } from './setup/setup-screen.js';
import { DraftModal } from './setup/draft-modal.js';
import { BoardCanvas } from './board/board-canvas.js';
import { ModelEntity } from './models/model-entity.js';
import { calcDeploymentZones } from './board/deployment-zones.js';
import { calcTitanPositions } from './board/titan-placement.js';
import { SidePanel } from './ui/side-panel.js';
import { DiceRoller } from './ui/dice-roller.js';

// ============================================================
// APP STATE
// ============================================================
let boardCanvas = null;
let sidePanel = null;
let diceRoller = null;
let currentRound = 1;

// ============================================================
// INIT
// ============================================================
async function init() {
  // Load game data
  await Promise.all([loadCharacters(), loadGlossary()]);

  // Show setup screen
  const setupContainer = document.getElementById('setup-screen');
  const setup = new SetupScreen(setupContainer, handleSetupStart);
  setup.render();
}

// ============================================================
// SETUP START HANDLER
// ============================================================
function handleSetupStart(config) {
  if (config.gameMode !== 'free-play') {
    // Hide setup screen
    document.getElementById('setup-screen').classList.add('hidden');

    // Launch Draft Modal
    const draft = new DraftModal({
      p1RosterNames: config.p1Names,
      p2RosterNames: config.p2Names,
      gameMode: config.gameMode,
      onComplete: ({ p1Drafted, p2Drafted }) => {
        launchBoard({
          ...config,
          p1Names: p1Drafted,
          p2Names: p2Drafted,
        });
      },
    });
    draft.start();
  } else {
    // Free Play mode directly launches board
    document.getElementById('setup-screen').classList.add('hidden');
    launchBoard(config);
  }
}

// ============================================================
// LAUNCH BOARD & START GAME
// ============================================================
function launchBoard(config) {
  const {
    boardW, boardH, deployStyle, deployDepth,
    p1Names, p2Names, titanNames,
  } = config;

  // Show game container
  document.getElementById('game-container').classList.remove('hidden');

  // Calculate deployment zones
  const deployZones = calcDeploymentZones(deployStyle, boardW, boardH, deployDepth);

  // Create model entities
  const allChars = getCharacters();
  const models = [];

  // Place Player 1 models in their deployment zone
  const p1Chars = p1Names.map(n => allChars.find(c => c.name === n)).filter(Boolean);
  const p1Positions = distributeInZone(deployZones.p1, p1Chars, boardW, boardH);
  p1Chars.forEach((charData, i) => {
    const model = new ModelEntity(charData, 'player1', p1Positions[i].x, p1Positions[i].y);
    models.push(model);
  });

  // Place Player 2 models in their deployment zone
  const p2Chars = p2Names.map(n => allChars.find(c => c.name === n)).filter(Boolean);
  const p2Positions = distributeInZone(deployZones.p2, p2Chars, boardW, boardH);
  p2Chars.forEach((charData, i) => {
    const model = new ModelEntity(charData, 'player2', p2Positions[i].x, p2Positions[i].y);
    models.push(model);
  });

  // Place Titans
  const titanChars = titanNames.map(n => allChars.find(c => c.name === n)).filter(Boolean);
  const titanPositions = calcTitanPositions(deployStyle, boardW, boardH, deployDepth, titanChars.length);
  titanChars.forEach((charData, i) => {
    const pos = titanPositions[i] || { x: boardW / 2, y: boardH / 2 };
    const model = new ModelEntity(charData, 'titan', pos.x, pos.y);
    models.push(model);
  });

  // Initialize side panel
  sidePanel = new SidePanel();
  sidePanel.onModelUpdated = () => {
    sidePanel.refresh();
  };

  // Initialize board canvas
  const canvasEl = document.getElementById('game-board');
  boardCanvas = new BoardCanvas(canvasEl, {
    boardW,
    boardH,
    deployZones,
    models,
  }, {
    onSelectModel: (model) => {
      sidePanel.show(model);
    },
    onDeselectModel: () => {
      sidePanel.hide();
    },
  });

  sidePanel.boardCanvas = boardCanvas;

  // Initialize dice roller
  diceRoller = new DiceRoller();

  // Next round button
  document.getElementById('btn-next-round')?.addEventListener('click', nextRound);

  // Update round display
  updateRoundDisplay();
}

// ============================================================
// ROUND MANAGEMENT
// ============================================================
function nextRound() {
  if (currentRound >= 3) {
    if (confirm('End of Round 3. End the match?')) {
      alert('Match complete! Refresh to start a new game.');
    }
    return;
  }

  if (!confirm(`End Round ${currentRound} and advance to Round ${currentRound + 1}?`)) return;

  currentRound++;
  updateRoundDisplay();

  // Reset all model activations & recover AP
  if (boardCanvas) {
    for (const model of boardCanvas.getModels()) {
      if (!model.isTitan && model.alive) {
        model.resetForNewRound();
      }
    }
  }

  sidePanel?.refresh();
}

function updateRoundDisplay() {
  const el = document.getElementById('round-display');
  if (el) el.textContent = `Round ${currentRound}`;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Distribute N models evenly within a deployment zone (rect or corner arc).
 * @param {Object} zone
 * @param {number} count
 * @param {number} boardW
 * @param {number} boardH
 * @returns {Array<{x, y}>}
 */
/**
 * Distribute models within a deployment zone (rect or corner arc) with guaranteed non-overlapping base circles.
 * @param {Object} zone
 * @param {Array<Object>} chars — array of character data objects
 * @param {number} boardW
 * @param {number} boardH
 * @returns {Array<{x, y}>}
 */
function distributeInZone(zone, chars, boardW = 48, boardH = 48) {
  if (!chars || chars.length === 0) return [];

  const parseBaseRadiusInches = (baseStr) => {
    const mm = parseInt(baseStr) || 50;
    return (mm / 25.4) / 2;
  };

  const radii = chars.map(c => parseBaseRadiusInches(c.base));
  const count = chars.length;
  const positions = [];

  if (zone.type === 'corner-arc') {
    const isTopLeft = zone.corner === 'top-left';
    const cx = zone.cx;
    const cy = zone.cy;

    const startAngle = isTopLeft ? 0.2 : Math.PI + 0.2;
    const endAngle = isTopLeft ? 1.37 : Math.PI + 1.37;

    for (let i = 0; i < count; i++) {
      const r = radii[i];
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 50) {
        attempts++;
        const t = count === 1 ? 0.5 : (i + (attempts > 1 ? (Math.random() - 0.5) * 0.2 : 0)) / (count - 1);
        const angle = startAngle + Math.max(0, Math.min(1, t)) * (endAngle - startAngle);
        const rRatio = i % 2 === 0 ? 0.75 : 0.45;
        const dist = zone.radius * rRatio;

        const px = Math.max(r + 0.5, Math.min(boardW - r - 0.5, cx + dist * Math.cos(angle)));
        const py = Math.max(r + 0.5, Math.min(boardH - r - 0.5, cy + dist * Math.sin(angle)));

        let overlap = false;
        for (let j = 0; j < positions.length; j++) {
          const d = Math.hypot(px - positions[j].x, py - positions[j].y);
          if (d < r + radii[j] + 0.4) {
            overlap = true;
            break;
          }
        }

        if (!overlap || attempts === 50) {
          positions.push({ x: px, y: py });
          placed = true;
        }
      }
    }
    return positions;
  }

  // Rectangular zone (Top/Bottom or Side/Side)
  const isHorizontal = zone.w >= zone.h;

  if (isHorizontal) {
    // Top / Bottom deployment: spread horizontally across zone width
    const totalDiameter = radii.reduce((sum, r) => sum + r * 2, 0);
    const minPadding = 0.6; // inches between bases
    const availableWidth = zone.w - 2;
    const step = Math.min(availableWidth / count, (totalDiameter / count) + minPadding + 1.2);
    const startX = zone.x + (zone.w - (step * (count - 1))) / 2;
    const centerY = zone.y + zone.h / 2;

    for (let i = 0; i < count; i++) {
      positions.push({
        x: Math.max(radii[i] + 0.5, Math.min(boardW - radii[i] - 0.5, startX + i * step)),
        y: centerY,
      });
    }
  } else {
    // Side / Side deployment: spread vertically across zone height
    const totalDiameter = radii.reduce((sum, r) => sum + r * 2, 0);
    const minPadding = 0.6;
    const availableHeight = zone.h - 2;
    const step = Math.min(availableHeight / count, (totalDiameter / count) + minPadding + 1.2);
    const startY = zone.y + (zone.h - (step * (count - 1))) / 2;
    const centerX = zone.x + zone.w / 2;

    for (let i = 0; i < count; i++) {
      positions.push({
        x: centerX,
        y: Math.max(radii[i] + 0.5, Math.min(boardH - radii[i] - 0.5, startY + i * step)),
      });
    }
  }

  return positions;
}

// ============================================================
// BOOT
// ============================================================
init();
