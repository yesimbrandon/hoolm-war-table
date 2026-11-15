/**
 * SidePanel — model inspector with stats, abilities, threshold, and buffs/debuffs.
 */

import { getGlossary } from '../data/data-loader.js';
import { executeAbility, ejectDreadnoughtToBravo1, transformModelInto } from '../abilities/character-abilities.js';
import { network } from '../network/network-manager.js';

export class SidePanel {
  constructor() {
    this.panel = document.getElementById('side-panel');
    this.content = document.getElementById('panel-content');
    this.currentModel = null;
    this.boardCanvas = null;
    this.onModelUpdated = null; // callback when HP/AP/activation changes

    // Listen for remote model updates
    network.on('model_updated_remote', (data) => {
      if (!this.boardCanvas) return;
      const models = this.boardCanvas.getModels();
      const target = models.find(m => m.id === data.modelId);
      if (target) {
        if (data.hp !== undefined) target.hp = data.hp;
        if (data.ap !== undefined) target.ap = data.ap;
        if (data.activated !== undefined) target.activated = data.activated;
        if (data.buffs !== undefined) target.buffs = data.buffs;
        if (data.debuffs !== undefined) target.debuffs = data.debuffs;
        if (data.thresholdUsed !== undefined) target.thresholdUsed = data.thresholdUsed;
        if (data.alive !== undefined) target.alive = data.alive;

        if (this.currentModel?.id === data.modelId) {
          this.refresh();
        }
      }
    });
  }

  /**
   * Open the panel and display a model's details.
   * @param {import('../models/model-entity.js').ModelEntity} model
   */
  show(model) {
    this.currentModel = model;
    this.panel.classList.remove('panel-closed');
    this.panel.classList.add('panel-open');
    this._renderContent();
  }

  /** Close the panel */
  hide() {
    this.currentModel = null;
    this.panel.classList.remove('panel-open');
    this.panel.classList.add('panel-closed');
    this.content.innerHTML = `<div id="panel-placeholder"><p>Select a model on the board to inspect</p></div>`;
  }

  /** Refresh the panel if currently showing a model */
  refresh() {
    if (this.currentModel) {
      this._renderContent();
    }
  }

  _renderContent() {
    const m = this.currentModel;
    if (!m) return;

    const classLower = m.isTitan ? 'titan' : m.primaryClass.toLowerCase();

    let html = '';

    // Header
    html += `
      <div class="panel-header">
        <span class="panel-model-name" style="color: ${m.getTeamColor()}">${m.name}</span>
        <span class="panel-class-badge ${classLower}">${m.classes.join(' / ')}</span>
      </div>
    `;

    // Transformed model banner (e.g. Dreadnought -> Bravo 1, or Gemini Twin Form -> Original)
    const origModel = m.storedOriginalModel || m.storedBravoModel;
    const savedHp = m.savedOriginalHp ?? m.savedBravoHp;
    if (origModel) {
      html += `
        <div style="margin-bottom:12px; padding:8px 12px; border-radius:8px; background:rgba(233,69,96,0.12); border:1px solid rgba(233,69,96,0.3); font-size:12px; font-weight:700; color:var(--primary); display:flex; justify-content:space-between; align-items:center;">
          <span>🔄 Transformed from ${origModel.name} (Saved HP: ${savedHp})</span>
          <button class="ability-action-btn" data-execute-ability="revert_transform" style="margin:0; padding:2px 8px; font-size:10px; border-color:var(--primary); color:var(--primary);">Revert</button>
        </div>
      `;
    }

    // Linked / Multi-Form Transform selector (e.g. Bravo 1 -> Dreadnought, or Gemini Twins -> 1 of 2 forms)
    const transformTargets = (m.linkedCharacters || []).filter(
      name => name.toLowerCase() !== m.name.toLowerCase()
    );
    if (transformTargets.length > 0) {
      html += `
        <div style="margin-bottom:12px; padding:10px 12px; border-radius:8px; background:rgba(255,193,7,0.1); border:1px solid rgba(255,193,7,0.35);">
          <div style="font-size:10px; font-weight:700; color:var(--gold); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:6px;">
            ${transformTargets.length > 1 ? '⚡ Choose Transform Form' : '⚡ Transform Available'}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${transformTargets.map(targetName => `
              <button class="ability-action-btn" data-execute-ability="transform_to:${targetName}" style="margin:0; padding:5px 10px; font-size:11px; border-color:var(--gold); color:var(--gold);">
                ⇄ Transform into ${targetName}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Secret Token / Illusion status
    if (m.secretToken) {
      const isRevealed = m.tokenRevealed;
      const statusText = !isRevealed
        ? '🔒 Face-Down Secret Token'
        : (m.secretToken === 'real' ? '🎭 REAL Monsieur Le Beau' : '💨 Fake Illusion');

      html += `
        <div style="margin-bottom:12px; padding:8px 12px; border-radius:8px; background:rgba(255,193,7,0.1); border:1px solid rgba(255,193,7,0.3); font-size:12px; font-weight:700; color:var(--gold); display:flex; justify-content:space-between; align-items:center;">
          <span>${statusText}</span>
          <button class="ability-action-btn" data-execute-ability="assign tokens" style="margin:0; padding:2px 8px; font-size:10px;">Token Info</button>
        </div>
      `;
    }

    // Attributes
    if (m.attributes.length > 0) {
      html += `<div style="margin-bottom:12px; display:flex; gap:6px; flex-wrap:wrap;">`;
      for (const attr of m.attributes) {
        html += `<span style="font-size:10px; font-weight:600; padding:2px 8px; border-radius:8px; background:rgba(255,255,255,0.06); color:var(--text-secondary); border:1px solid var(--border);">${attr}</span>`;
      }
      html += `</div>`;
    }

    // Stats
    html += `
      <div class="panel-section">
        <div class="panel-section-title">Stats</div>
        <div class="stat-grid">
          ${this._statItem('HP', m.hp, m.maxHp, '--hp', true)}
          ${this._statItem('AP', m.ap, m.maxAp, '--ap', true)}
          ${this._statItem('DEF', m.defense, null, '--def', false)}
          ${this._statItem('SPD', m.speed, null, '--spd', false)}
          ${this._statItem('AR', m.armor, null, '--ar', false)}
          ${this._statItem('MR', m.magicResist, null, '--mr', false)}
          ${this._statItem('REC', m.recovery, null, '--rec', false)}
          ${this._statItem('BASE', m.baseStr, null, '--text-muted', false)}
        </div>
      </div>
    `;

    // Threshold
    if (m.threshold) {
      const isPrestige = m.threshold.name.toLowerCase().includes('prestige');
      const isBravo1 = m.name.toLowerCase().includes('bravo');

      html += `
        <div class="panel-section">
          <div class="panel-section-title">Threshold</div>
          <div class="threshold-card">
            <div class="threshold-header">
              <span class="threshold-name">${m.threshold.name}</span>
              <span class="threshold-type">${m.getThresholdTypeLabel()}</span>
            </div>
            <div class="threshold-value">${m.threshold.value}</div>
            ${isPrestige ? `
              <button class="ability-action-btn" data-execute-ability="${m.threshold.name}" style="margin-top:8px;">
                ✨ Activate "The Prestige"
              </button>
            ` : ''}
            ${isBravo1 ? `
              <button class="ability-action-btn" data-execute-ability="even the odds" style="margin-top:8px; border-color:var(--primary); color:var(--primary);">
                🤖 Suit Up into Dreadnought
              </button>
            ` : ''}
            <div class="threshold-toggle">
              <input type="checkbox" id="threshold-toggle" ${m.thresholdUsed ? 'checked' : ''} />
              <label for="threshold-toggle">Used</label>
            </div>
          </div>
        </div>
      `;
    }

    // Abilities
    if (m.abilities.length > 0) {
      html += `<div class="panel-section"><div class="panel-section-title">Abilities</div>`;
      for (const ab of m.abilities) {
        html += this._abilityCard(ab);
      }
      html += `</div>`;
    }

    // Buffs/Debuffs
    html += `
      <div class="panel-section">
        <div class="panel-section-title">Buffs / Debuffs</div>
        <div class="buff-chips" id="buff-chips">
          ${this._renderBuffChips(m)}
        </div>
        <select class="buff-add-select" id="buff-select">
          <option value="">+ Add buff/debuff...</option>
          ${this._renderBuffOptions(m)}
        </select>
      </div>
    `;

    // Activation Button
    html += `
      <button class="activate-btn ${m.activated ? 'active' : 'inactive'}" id="activate-btn">
        ${m.activated ? '✓ ACTIVATED' : 'MARK ACTIVATED'}
      </button>
    `;

    // Slaying reward
    if (m.slayingReward) {
      html += `
        <div style="margin-top:12px; padding:8px 12px; border-radius:8px; background:rgba(233,69,96,0.08); border:1px solid rgba(233,69,96,0.2); font-size:12px; color:var(--text-secondary);">
          <span style="color:var(--primary); font-weight:700;">Slaying Reward:</span> ${m.slayingReward}
        </div>
      `;
    }

    this.content.innerHTML = html;

    // Bind events
    this._bindEvents();
  }

  _bindEvents() {
    const m = this.currentModel;
    if (!m) return;

    // Custom Ability Action Buttons
    this.content.querySelectorAll('[data-execute-ability]').forEach(btn => {
      btn.addEventListener('click', () => {
        const abilityName = btn.dataset.executeAbility;
        executeAbility(abilityName, m, this.boardCanvas, () => {
          this.refresh();
          this.onModelUpdated?.(m);
        });
      });
    });

    // HP +/- buttons
    this.content.querySelectorAll('[data-stat-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stat = e.currentTarget.dataset.stat;
        const action = e.currentTarget.dataset.statAction;
        if (stat === 'hp') {
          m.hp = action === 'inc' ? Math.min(m.maxHp, m.hp + 1) : Math.max(0, m.hp - 1);
          if (m.hp <= 0) {
            m.alive = false;
            // If Dreadnought dies, trigger ejection back to Bravo 1!
            if (m.storedBravoModel && m.name.toLowerCase().includes('dreadnought')) {
              ejectDreadnoughtToBravo1(m, this.boardCanvas, () => this.refresh());
              return;
            }
            // If a multi-form character (e.g. Gemini Twins) hits 0 HP, prompt which form to transform into!
            if (m.linkedCharacters && m.linkedCharacters.length > 1) {
              this._openMultiTransformModal(m);
              return;
            }
          } else {
            m.alive = true;
          }
        } else if (stat === 'ap') {
          m.ap = action === 'inc' ? Math.min(m.maxAp + 5, m.ap + 1) : Math.max(0, m.ap - 1);
        }
        this._renderContent();
        this._emitModelUpdate(m);
        this.onModelUpdated?.(m);
      });
    });

    // Threshold toggle
    const thToggle = document.getElementById('threshold-toggle');
    if (thToggle) {
      thToggle.addEventListener('change', () => {
        m.thresholdUsed = thToggle.checked;
        this._emitModelUpdate(m);
        this.onModelUpdated?.(m);
      });
    }

    // Buff select
    const buffSelect = document.getElementById('buff-select');
    if (buffSelect) {
      buffSelect.addEventListener('change', () => {
        const val = buffSelect.value;
        if (!val) return;
        const glossary = getGlossary();
        const entry = glossary.find(g => g.term === val);
        if (entry) {
          const isDebuff = this._isDebuff(entry);
          if (isDebuff) {
            if (!m.debuffs.find(d => d.name === entry.term)) {
              m.debuffs.push({ name: entry.term, description: entry.description, type: 'debuff' });
            }
          } else {
            if (!m.buffs.find(b => b.name === entry.term)) {
              m.buffs.push({ name: entry.term, description: entry.description, type: 'buff' });
            }
          }
          this._renderContent();
          this._emitModelUpdate(m);
          this.onModelUpdated?.(m);
        }
      });
    }

    // Remove buff chips
    this.content.querySelectorAll('[data-remove-buff]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const name = e.currentTarget.dataset.removeBuff;
        const type = e.currentTarget.dataset.buffType;
        if (type === 'debuff') {
          m.debuffs = m.debuffs.filter(d => d.name !== name);
        } else {
          m.buffs = m.buffs.filter(b => b.name !== name);
        }
        this._renderContent();
        this._emitModelUpdate(m);
        this.onModelUpdated?.(m);
      });
    });

    // Activation button
    const actBtn = document.getElementById('activate-btn');
    if (actBtn) {
      actBtn.addEventListener('click', () => {
        m.activated = !m.activated;
        this._renderContent();
        this._emitModelUpdate(m);
        this.onModelUpdated?.(m);
      });
    }
  }

  _emitModelUpdate(m) {
    network.emit('model_update', {
      modelId: m.id,
      hp: m.hp,
      ap: m.ap,
      activated: m.activated,
      buffs: m.buffs,
      debuffs: m.debuffs,
      thresholdUsed: m.thresholdUsed,
      alive: m.alive,
    });
  }

  _statItem(label, value, maxValue, colorVar, hasControls) {
    const displayVal = maxValue != null ? `${value}/${maxValue}` : value;
    let controlsHtml = '';
    if (hasControls) {
      const statKey = label.toLowerCase();
      controlsHtml = `
        <div class="stat-controls">
          <button class="stat-btn" data-stat="${statKey}" data-stat-action="dec">−</button>
          <button class="stat-btn" data-stat="${statKey}" data-stat-action="inc">+</button>
        </div>
      `;
    }
    return `
      <div class="stat-item">
        <span class="stat-label" style="color: var(${colorVar})">${label}</span>
        <span class="stat-value" style="color: var(${colorVar})">${displayVal}</span>
        ${controlsHtml}
      </div>
    `;
  }

  _abilityCard(ab) {
    const typeIcons = { 'Attack': '⚔️', 'Spell': '✨', 'Static': '🛡️' };
    const icon = typeIcons[ab.type] || '⚡';

    let badges = '';
    if (ab.rollRange) {
      badges += `<span class="ability-roll">🎲 D6: ${ab.rollRange}</span>`;
    }
    if (ab.cost) {
      badges += `<span class="ability-cost">${ab.cost}</span>`;
    }

    let stats = '';
    if (ab.range || ab.damage) {
      stats = `<div class="ability-stats">`;
      if (ab.range) stats += `<span class="rng">RNG: ${ab.range}</span>`;
      if (ab.damage) stats += `<span class="dmg">DMG: ${ab.damage}</span>`;
      stats += `</div>`;
    }

    let desc = '';
    if (ab.value) {
      desc = `<div class="ability-desc">${ab.value}</div>`;
    }

    // Custom active ability button check
    let actionBtn = '';
    const abNameLower = ab.name.toLowerCase();
    if (abNameLower.includes('next illusion')) {
      actionBtn = `<button class="ability-action-btn" data-execute-ability="${ab.name}">🎭 Cast "And for my next illusion..." (1 AP)</button>`;
    } else if (abNameLower.includes('assign token') || abNameLower.includes('house of mirrors')) {
      actionBtn = `<button class="ability-action-btn" data-execute-ability="${ab.name}">🔒 Assign / Reveal Secret Tokens</button>`;
    }

    return `
      <div class="ability-card">
        <div class="ability-header">
          <span class="ability-icon">${icon}</span>
          <span class="ability-name">${ab.name}</span>
          ${badges}
        </div>
        ${stats}
        ${desc}
        ${actionBtn}
      </div>
    `;
  }

  _renderBuffChips(m) {
    let html = '';
    for (const b of m.buffs) {
      html += `<span class="buff-chip buff" data-remove-buff="${b.name}" data-buff-type="buff" title="${b.description}">${b.name} <span class="remove-buff">×</span></span>`;
    }
    for (const d of m.debuffs) {
      html += `<span class="buff-chip debuff" data-remove-buff="${d.name}" data-buff-type="debuff" title="${d.description}">${d.name} <span class="remove-buff">×</span></span>`;
    }
    return html;
  }

  _renderBuffOptions(m) {
    const glossary = getGlossary();
    const applied = [...m.buffs.map(b => b.name), ...m.debuffs.map(d => d.name)];
    return glossary
      .filter(g => !applied.includes(g.term))
      .map(g => `<option value="${g.term}">${g.term} — ${g.description}</option>`)
      .join('');
  }

  _isDebuff(glossaryEntry) {
    const debuffTerms = ['fear', 'bleed', 'daze', 'poison', 'knockdown', 'slow', 'stun', 'stagger', 'grievous wounds'];
    return debuffTerms.includes(glossaryEntry.term.toLowerCase());
  }

  _openMultiTransformModal(model) {
    const targets = model.linkedCharacters || [];
    if (!targets.length) return;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px);
    `;
    modal.innerHTML = `
      <div style="background:var(--surface); border:1px solid var(--gold); border-radius:12px; padding:24px; width:440px; max-width:90vw; text-align:center;">
        <h3 style="font-family:var(--font-heading); font-size:20px; font-weight:800; color:var(--gold); margin-bottom:8px;">⚡ ${model.name} Defeated — Transform!</h3>
        <p style="color:var(--text-secondary); font-size:13px; margin-bottom:20px;">Choose which linked character form <b>${model.name}</b> transforms into (or leave defeated):</p>
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
          ${targets.map(tName => `
            <button class="multi-transform-btn" data-target="${tName}" style="padding:12px; border-radius:8px; border:2px solid var(--gold); background:var(--surface-elevated); color:var(--gold); font-family:var(--font-heading); font-size:14px; font-weight:700; cursor:pointer;">
              ⇄ Transform into ${tName}
            </button>
          `).join('')}
        </div>
        <button id="btn-skip-transform" style="padding:10px 18px; border-radius:8px; border:1px solid var(--border); background:var(--surface-elevated); color:var(--text-secondary); font-weight:600; cursor:pointer;">
          Stay Defeated (No Transform)
        </button>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.multi-transform-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetName = btn.dataset.target;
        modal.remove();
        transformModelInto(model, targetName, this.boardCanvas, () => {
          this.refresh();
          this.onModelUpdated?.(this.currentModel);
        });
      });
    });

    modal.querySelector('#btn-skip-transform')?.addEventListener('click', () => {
      modal.remove();
      this._renderContent();
      this._emitModelUpdate(model);
      this.onModelUpdated?.(model);
    });
  }
}
