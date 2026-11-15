/**
 * Character Ability System — custom rules & active logic for unique heroes.
 */

import { getCharacters } from '../data/data-loader.js';
import { ModelEntity } from '../models/model-entity.js';

export function hasCustomAbilities(model) {
  if (!model) return false;
  const name = model.name.toLowerCase();
  return name.includes('beau') || name.includes('dukahn') || name.includes('bravo') || name.includes('dreadnought');
}

/**
 * Executes a custom active ability for a hero.
 * @param {string} abilityName
 * @param {ModelEntity} model
 * @param {import('../board/board-canvas.js').BoardCanvas} boardCanvas
 * @param {Function} onRefreshSidePanel
 */
export function executeAbility(abilityName, model, boardCanvas, onRefreshSidePanel) {
  const name = abilityName.toLowerCase();

  if (abilityName.startsWith('transform_to:')) {
    const targetName = abilityName.slice('transform_to:'.length).trim();
    transformModelInto(model, targetName, boardCanvas, onRefreshSidePanel);
  } else if (name === 'revert_transform') {
    revertTransformedModel(model, boardCanvas, onRefreshSidePanel);
  } else if (name.includes('next illusion')) {
    castAndForMyNextIllusion(model, boardCanvas, onRefreshSidePanel);
  } else if (name.includes('assign token') || name.includes('house of mirrors') || name.includes('reveal token')) {
    openTokenAssignmentModal(model, boardCanvas, onRefreshSidePanel);
  } else if (name.includes('prestige')) {
    activateThePrestige(model, boardCanvas, onRefreshSidePanel);
  } else if (name.includes('even the odds') || name.includes('suit up') || name.includes('transform')) {
    transformBravo1ToDreadnought(model, boardCanvas, onRefreshSidePanel);
  } else if (name.includes('eject') || name.includes('revert')) {
    ejectDreadnoughtToBravo1(model, boardCanvas, onRefreshSidePanel);
  }
}

/**
 * Generic character transformation into any linkedCharacter / linkedCharacters form
 * (e.g., Bravo 1 -> Dreadnought, or Gemini Twins -> Twin Form A / Twin Form B)
 */
export function transformModelInto(sourceModel, targetCharName, boardCanvas, onRefreshSidePanel) {
  const allChars = getCharacters();
  const targetData = allChars.find(c => c.name.toLowerCase() === targetCharName.toLowerCase());

  if (!targetData) {
    alert(`Transform character "${targetCharName}" not found in characters.json!`);
    return;
  }

  sourceModel.thresholdUsed = true;
  const savedHp = sourceModel.hp;
  const savedX = sourceModel.x;
  const savedY = sourceModel.y;

  boardCanvas.removeModel(sourceModel.id);

  const transformed = new ModelEntity(targetData, sourceModel.team, savedX, savedY);
  transformed.ap = transformed.maxAp;
  transformed.activated = false;
  // Preserve root original model so multi-form or revert always remembers the original hero
  transformed.storedOriginalModel = sourceModel.storedOriginalModel || sourceModel;
  transformed.savedOriginalHp = sourceModel.savedOriginalHp ?? (savedHp > 0 ? savedHp : sourceModel.maxHp);
  // Keep Bravo 1 properties for backwards compatibility
  transformed.storedBravoModel = transformed.storedOriginalModel;
  transformed.savedBravoHp = transformed.savedOriginalHp;

  boardCanvas.addModel(transformed);
  boardCanvas.selectModel(transformed);

  onRefreshSidePanel?.();
}

export function revertTransformedModel(currentModel, boardCanvas, onRefreshSidePanel) {
  const orig = currentModel.storedOriginalModel || currentModel.storedBravoModel;
  if (!orig) return;

  boardCanvas.removeModel(currentModel.id);
  orig.x = currentModel.x;
  orig.y = currentModel.y;
  orig.hp = currentModel.savedOriginalHp || currentModel.savedBravoHp || orig.maxHp;
  orig.alive = true;

  boardCanvas.addModel(orig);
  boardCanvas.selectModel(orig);
  onRefreshSidePanel?.();
}

/**
 * Bravo 1 -> Dreadnought Transformation ("How about we even the odds")
 */
export function transformBravo1ToDreadnought(bravo1, boardCanvas, onRefreshSidePanel) {
  const allChars = getCharacters();
  const dreadData = allChars.find(c => c.name.toLowerCase() === 'dreadnought');

  if (!dreadData) {
    alert('Dreadnought character data not found!');
    return;
  }

  // 1. Save Bravo 1's HP and state
  bravo1.thresholdUsed = true;
  const savedBravoHp = bravo1.hp;
  const savedBravoAp = bravo1.ap;
  const savedX = bravo1.x;
  const savedY = bravo1.y;

  // 2. Remove Bravo 1 from board
  boardCanvas.removeModel(bravo1.id);

  // 3. Create Dreadnought at Bravo 1's position
  const dreadnought = new ModelEntity(dreadData, bravo1.team, savedX, savedY);
  dreadnought.ap = dreadnought.maxAp; // Enters with full AP value
  dreadnought.activated = false; // No activation token
  dreadnought.storedBravoModel = bravo1;
  dreadnought.savedBravoHp = savedBravoHp;

  boardCanvas.addModel(dreadnought);
  boardCanvas.selectModel(dreadnought);

  alert(`🤖 "How about we even the odds!" Bravo 1 suit up into Dreadnought! (Bravo 1 HP preserved at ${savedBravoHp})`);
  onRefreshSidePanel?.();
}

/**
 * Dreadnought Destruction -> Bravo 1 Ejection
 */
export function ejectDreadnoughtToBravo1(dreadnought, boardCanvas, onRefreshSidePanel) {
  const bravo1 = dreadnought.storedBravoModel;

  // Remove Dreadnought from board
  boardCanvas.removeModel(dreadnought.id);

  if (bravo1) {
    bravo1.x = dreadnought.x;
    bravo1.y = dreadnought.y;
    bravo1.hp = dreadnought.savedBravoHp || bravo1.hp;
    bravo1.alive = true;

    boardCanvas.addModel(bravo1);
    boardCanvas.selectModel(bravo1);
    alert(`💥 Dreadnought destroyed! Bravo 1 ejects back out at current position with ${bravo1.hp} HP!`);
  } else {
    alert('💥 Dreadnought destroyed!');
  }

  onRefreshSidePanel?.();
}

/**
 * Monsieur Le Beau — "And for my next illusion..."
 */
function castAndForMyNextIllusion(model, boardCanvas, onRefreshSidePanel) {
  if (model.ap < 1) {
    alert('Not enough AP! "And for my next illusion..." costs 1 AP.');
    return;
  }

  model.ap -= 1;

  // 1. Remove existing illusions for this Le Beau
  const allModels = boardCanvas.getModels();
  const existingIllusions = allModels.filter(m => m.parentModelId === model.id && m.isIllusion);
  for (const ill of existingIllusions) {
    boardCanvas.removeModel(ill.id);
  }

  // 2. Create 2 new illusion models positioned 2.5" to left and 2.5" to right
  const ill1Data = { ...model.charData, name: 'Le Beau (Illusion A)', isIllusion: true, parentModelId: model.id };
  const ill2Data = { ...model.charData, name: 'Le Beau (Illusion B)', isIllusion: true, parentModelId: model.id };

  const ill1 = new ModelEntity(ill1Data, model.team, Math.max(2, model.x - 2.5), model.y);
  const ill2 = new ModelEntity(ill2Data, model.team, Math.min(boardCanvas.boardW - 2, model.x + 2.5), model.y);

  ill1.isIllusion = true;
  ill1.parentModelId = model.id;
  ill2.isIllusion = true;
  ill2.parentModelId = model.id;

  boardCanvas.addModel(ill1);
  boardCanvas.addModel(ill2);

  // 3. Open Token Assignment Modal so player secretively picks which is the REAL Le Beau
  openTokenAssignmentModal(model, boardCanvas, onRefreshSidePanel, [model, ill1, ill2]);
}

/**
 * Open Modal to secretly assign REAL vs FAKE tokens to Monsieur Le Beau & Illusions.
 */
function openTokenAssignmentModal(realLeBeau, boardCanvas, onRefreshSidePanel, unitsToAssign = null) {
  const allModels = boardCanvas.getModels();
  const units = unitsToAssign || [
    realLeBeau,
    ...allModels.filter(m => m.parentModelId === realLeBeau.id && m.isIllusion && m.alive),
  ];

  if (units.length === 0) return;

  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px);
  `;

  modal.innerHTML = `
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:24px; width:440px; max-width:90vw; text-align:center;">
      <h3 style="font-family:var(--font-heading); font-size:20px; font-weight:800; color:var(--gold); margin-bottom:8px;">🎭 Assign Secret Tokens</h3>
      <p style="color:var(--text-secondary); font-size:13px; margin-bottom:20px;">Choose secretly which model is the <b>REAL Monsieur Le Beau</b>. The other models will be assigned Fake Illusion tokens.</p>
      
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
        ${units.map(u => `
          <button class="token-assign-btn" data-model-id="${u.id}" style="padding:12px; border-radius:8px; border:2px solid var(--border); background:var(--surface-elevated); color:var(--text-primary); font-family:var(--font-heading); font-size:14px; font-weight:700; cursor:pointer; transition:all 150ms ease;">
            Target: ${u.name} (at X: ${u.x.toFixed(1)}", Y: ${u.y.toFixed(1)}")
          </button>
        `).join('')}
      </div>

      <div style="display:flex; justify-content:space-between; gap:10px;">
        <button id="btn-reveal-all" style="flex:1; padding:10px; border-radius:8px; border:1px solid #2ED573; background:rgba(46,213,115,0.15); color:#2ED573; font-weight:700; cursor:pointer;">
          👁️ Reveal Tokens
        </button>
        <button id="btn-close-modal" style="padding:10px 16px; border-radius:8px; border:1px solid var(--border); background:var(--surface-elevated); color:var(--text-secondary); font-weight:600; cursor:pointer;">
          Cancel
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll('.token-assign-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedId = parseInt(btn.dataset.modelId);
      for (const u of units) {
        u.secretToken = u.id === selectedId ? 'real' : 'fake';
        u.tokenRevealed = false;
      }
      alert('🔒 Secret Tokens assigned! Tokens are face-down (?). Opposing player does not know which is real.');
      modal.remove();
      onRefreshSidePanel?.();
    });
  });

  modal.querySelector('#btn-reveal-all')?.addEventListener('click', () => {
    for (const u of units) {
      u.tokenRevealed = true;
    }
    alert('👁️ All Monsieur Le Beau Tokens Revealed!');
    modal.remove();
    onRefreshSidePanel?.();
  });

  modal.querySelector('#btn-close-modal')?.addEventListener('click', () => {
    modal.remove();
  });
}

/**
 * Monsieur Le Beau — Threshold "The Prestige"
 */
function activateThePrestige(model, boardCanvas, onRefreshSidePanel) {
  const allModels = boardCanvas.getModels();
  const illusions = allModels.filter(m => m.parentModelId === model.id && m.isIllusion && m.alive);

  const count = illusions.length;
  if (count === 0) {
    alert('No active Illusion models in play to sacrifice for "The Prestige".');
    return;
  }

  // Remove illusions from board
  for (const ill of illusions) {
    boardCanvas.removeModel(ill.id);
  }

  // Apply buff to Le Beau
  model.buffs.push({
    name: 'The Prestige',
    description: `+${count} ATK on melee attacks for the rest of activation`,
    type: 'buff',
  });

  model.thresholdUsed = true;
  alert(`✨ "The Prestige" activated! ${count} illusion(s) removed. Gained +${count} ATK for rest of activation.`);
  onRefreshSidePanel?.();
}
