/**
 * ModelEntity — represents a single model placed on the board.
 */

import { baseSizeToInches } from '../data/data-loader.js';

let _nextId = 1;

export class ModelEntity {
  /**
   * @param {Object} charData — raw character JSON object
   * @param {string} team — 'player1' | 'player2' | 'titan'
   * @param {number} x — board position in inches (center)
   * @param {number} y — board position in inches (center)
   */
  constructor(charData, team, x = 0, y = 0) {
    this.id = _nextId++;
    this.name = charData.name || 'Unknown';
    this.team = team;
    this.charData = charData;

    // Position (inches, center of circle)
    this.x = x;
    this.y = y;

    // Base size
    this.baseStr = charData.base || '50mm';
    this.radiusInches = baseSizeToInches(this.baseStr) / 2;

    // Classes & attributes
    this.classes = charData.class || ['DPS'];
    this.attributes = charData.attributes || [];
    this.primaryClass = this.classes[0] || 'DPS';
    this.isTitan = this.classes.some(c => c.toUpperCase() === 'TITAN');

    // Mutable stats (current)
    this.hp = charData.health || 20;
    this.maxHp = charData.health || 20;
    this.ap = charData.actionPoints || 6;
    this.maxAp = charData.actionPoints || 6;

    // Immutable base stats
    this.defense = charData.defense || 10;
    this.speed = charData.speed || 5;
    this.armor = charData.armor || 0;
    this.magicResist = charData.magicResist || 0;
    this.recovery = charData.recovery || 3;

    // Abilities
    this.abilities = charData.abilities || [];

    // Threshold
    this.threshold = charData.threshold || null;
    this.thresholdUsed = false;

    // Linked character (transforms)
    this.linkedCharacter = charData.linkedCharacter || null;
    this.isTransformOnly = charData.isTransformOnly || false;

    // Slaying reward
    this.slayingReward = charData.slayingReward || null;

    // Custom ability state (illusions, tokens, transforms)
    this.isIllusion = charData.isIllusion || false;
    this.parentModelId = charData.parentModelId || null;
    this.secretToken = charData.secretToken || null; // 'real' | 'fake' | null
    this.tokenRevealed = charData.tokenRevealed || false;

    // Game state
    this.activated = false;
    this.alive = true;
    this.buffs = [];   // Array of { name, description, type: 'buff'|'debuff' }
    this.debuffs = [];

    // Movement tracking (transient)
    this.moveOriginX = x;
    this.moveOriginY = y;
  }

  /** Diameter in inches */
  get diameterInches() {
    return this.radiusInches * 2;
  }

  /** Edge-to-edge distance to another model (in inches) */
  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const centerDist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, centerDist - this.radiusInches - other.radiusInches);
  }

  /** Reset activation for next round */
  resetForNewRound() {
    this.activated = false;
    // Recover AP
    this.ap = Math.min(this.maxAp, this.ap + this.recovery);
    // Clear regulated thresholds
    if (this.threshold) {
      const thresholdType = this._getThresholdType();
      if (thresholdType === 'regulated') {
        this.thresholdUsed = false;
      }
    }
  }

  /** Save the current position as the move origin (before starting a move) */
  saveMoveOrigin() {
    this.moveOriginX = this.x;
    this.moveOriginY = this.y;
  }

  /** Snap back to origin (cancel move) */
  cancelMove() {
    this.x = this.moveOriginX;
    this.y = this.moveOriginY;
  }

  /** Get the color for this model's team */
  getTeamColor() {
    if (this.team === 'player1') return '#4a9eff';
    if (this.team === 'player2') return '#ff5c5c';
    if (this.team === 'titan') return '#FFC107';
    return '#888';
  }

  getTeamFill() {
    if (this.team === 'player1') return 'rgba(74, 158, 255, 0.18)';
    if (this.team === 'player2') return 'rgba(255, 92, 92, 0.18)';
    if (this.team === 'titan') return 'rgba(255, 193, 7, 0.18)';
    return 'rgba(136, 136, 136, 0.18)';
  }

  /** Detect threshold type from data */
  _getThresholdType() {
    if (!this.threshold) return 'regulated';
    const t = this.threshold;
    if (t.type) {
      const ts = t.type.toLowerCase();
      if (ts.includes('restricted')) return 'restricted';
      if (ts.includes('repeatable')) return 'repeatable';
      return 'regulated';
    }
    // Auto-detect from text
    const val = (t.value || '').toLowerCase();
    const name = (t.name || '').toLowerCase();
    if (val.includes('[restricted]') || val.includes('once per game') ||
        val.includes('when this model dies') || val.includes('if this model dies') ||
        name.includes('even the odds')) {
      return 'restricted';
    }
    if (val.includes('[repeatable]')) return 'repeatable';
    return 'regulated';
  }

  getThresholdTypeLabel() {
    const t = this._getThresholdType();
    switch (t) {
      case 'regulated': return 'REGULATED (1/ROUND)';
      case 'restricted': return 'RESTRICTED (1/GAME)';
      case 'repeatable': return 'REPEATABLE';
      default: return 'REGULATED (1/ROUND)';
    }
  }
}
