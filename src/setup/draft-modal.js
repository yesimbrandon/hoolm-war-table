/**
 * DraftModal — Competitive Pick/Ban sequence for Roster Draft & Global Open Draft.
 * Features:
 * - Rich hero cards with class badges, stats, base size, and primary ability snippets
 * - Interactive Class Filter tabs (ALL, DPS, TANK, SUPPORT)
 * - Global Bans & Exclusive Unique Picks
 */

import { getHeroes } from '../data/data-loader.js';
import { network } from '../network/network-manager.js';

const ROSTER_DRAFT_STEPS = [
  { team: 1, action: 'ban', count: 1, label: 'Team 1: Ban 1 Model' },
  { team: 2, action: 'ban', count: 1, label: 'Team 2: Ban 1 Model' },

  { team: 1, action: 'pick', count: 1, label: 'Team 1: Pick 1 Model' },
  { team: 2, action: 'pick', count: 2, label: 'Team 2: Pick 2 Models' },
  { team: 1, action: 'pick', count: 2, label: 'Team 1: Pick 2 Models' },
  { team: 2, action: 'pick', count: 1, label: 'Team 2: Pick 1 Model' },
  { team: 1, action: 'pick', count: 2, label: 'Team 1: Pick 2 Models' },
  { team: 2, action: 'pick', count: 2, label: 'Team 2: Pick 2 Models' },
];

const OPEN_DRAFT_STEPS = [
  { team: 1, action: 'ban', count: 1, label: 'Team 1: Ban 1 Model' },
  { team: 2, action: 'ban', count: 1, label: 'Team 2: Ban 1 Model' },

  { team: 1, action: 'pick', count: 1, label: 'Team 1: Pick 1 Model' },
  { team: 2, action: 'pick', count: 2, label: 'Team 2: Pick 2 Models' },
  { team: 1, action: 'pick', count: 2, label: 'Team 1: Pick 2 Models' },
  { team: 2, action: 'pick', count: 1, label: 'Team 2: Pick 1 Model' },

  { team: 1, action: 'ban', count: 1, label: 'Team 1: Ban 1 Model' },
  { team: 2, action: 'ban', count: 1, label: 'Team 2: Ban 1 Model' },

  { team: 2, action: 'pick', count: 1, label: 'Team 2: Pick 1 Model' },
  { team: 1, action: 'pick', count: 2, label: 'Team 1: Pick 2 Models' },
  { team: 2, action: 'pick', count: 1, label: 'Team 2: Pick 1 Model' },
];

export class DraftModal {
  /**
   * @param {Object} options — { p1RosterNames, p2RosterNames, gameMode, onComplete }
   */
  constructor(options) {
    this.gameMode = options.gameMode || 'roster-draft';
    this.p1Roster = options.p1RosterNames || [];
    this.p2Roster = options.p2RosterNames || [];
    this.onComplete = options.onComplete;

    this.steps = this.gameMode === 'open-draft' ? OPEN_DRAFT_STEPS : ROSTER_DRAFT_STEPS;
    this.classFilter = 'ALL'; // 'ALL' | 'DPS' | 'TANK' | 'SUPPORT'

    // 🎲 Coin toss to assign Team 1 & Team 2
    this.p1IsTeam1 = Math.random() < 0.5;

    // Global draft state
    this.p1Picked = [];
    this.p2Picked = [];
    this.globalBanned = [];

    // Step state
    this.stepIndex = 0;
    this.stepRemaining = this.steps[0].count;

    this.container = null;

    // Listen for remote draft actions
    network.on('draft_step_synced', (data) => {
      this._applyRemoteDraftAction(data);
    });
  }

  start() {
    this.container = document.createElement('div');
    this.container.id = 'draft-screen';
    document.body.appendChild(this.container);
    this._render();
  }

  _getActivePlayer() {
    const currentStep = this.steps[this.stepIndex];
    if (!currentStep) return 1;
    const targetTeam = currentStep.team;
    return this.p1IsTeam1 ? (targetTeam === 1 ? 1 : 2) : (targetTeam === 1 ? 2 : 1);
  }

  _render() {
    const allHeroes = getHeroes();
    const currentStep = this.steps[this.stepIndex];
    const activePlayer = this._getActivePlayer();
    const isDone = this.stepIndex >= this.steps.length;

    const team1PlayerName = this.p1IsTeam1 ? 'Player 1' : 'Player 2';
    const team2PlayerName = this.p1IsTeam1 ? 'Player 2' : 'Player 1';

    let actionPrompt = '';
    if (isDone) {
      actionPrompt = '✨ Draft Complete! Deploying teams...';
    } else {
      const pName = activePlayer === 1 ? 'Player 1' : 'Player 2';
      const actionText = currentStep.action.toUpperCase();
      const countText = `${this.stepRemaining} ${currentStep.action === 'ban' ? 'BAN' : 'PICK'}${this.stepRemaining > 1 ? 'S' : ''}`;
      actionPrompt = `${activePlayer === 1 ? '🟦' : '🟥'} ${pName} — ${actionText} ${countText} REMAINING`;
    }

    const isOpenDraft = this.gameMode === 'open-draft';

    let html = `
      <div class="draft-header">
        <h2 class="draft-title">${isOpenDraft ? '🏛️ Global Open Pick / Ban Draft' : '⚔️ 12-Model Roster Pick / Ban Draft'}</h2>
        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          🎲 Coin Flip Result: <span style="color:var(--gold); font-weight:700;">${team1PlayerName}</span> is <b>Team 1</b> • <span style="color:var(--text-secondary); font-weight:700;">${team2PlayerName}</span> is <b>Team 2</b>
          <span style="margin-left:12px; color:var(--secondary); font-weight:700;">🔒 Bans & Picks are Global & Unique</span>
        </div>
        <div class="draft-turn-indicator">${actionPrompt}</div>

        <!-- Sequence Progress -->
        <div class="draft-progress-bar">
          ${this.steps.map((s, idx) => {
            const isCurrent = idx === this.stepIndex;
            const isFinished = idx < this.stepIndex;
            const chipCls = isCurrent ? 'active' : (isFinished ? 'done' : '');
            return `<span class="draft-step-chip ${chipCls}">S${idx+1}: T${s.team} ${s.action.toUpperCase()} (${s.count})</span>`;
          }).join('')}
        </div>

        <!-- Class Filter Bar -->
        <div class="draft-class-filter-bar">
          ${['ALL', 'DPS', 'TANK', 'SUPPORT'].map(cat => `
            <button class="draft-filter-btn ${this.classFilter === cat ? 'active' : ''}" data-filter-class="${cat}">
              ${cat === 'ALL' ? '🌟 All Heroes' : cat === 'DPS' ? '⚔️ DPS' : cat === 'TANK' ? '🛡️ Tank' : '💚 Support'}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    if (isOpenDraft) {
      const filteredHeroes = allHeroes.filter(c => {
        if (this.classFilter === 'ALL') return true;
        const mainClass = (c.class?.[0] || 'DPS').toUpperCase();
        return mainClass === this.classFilter;
      });

      html += `
        <div class="draft-pools-container" style="display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-elevated); padding:12px 18px; border-radius:10px; border:1px solid var(--border);">
            <div style="color:var(--team-p1); font-weight:700; font-size:14px;">🟦 Player 1 Team: <span style="color:#fff;">${this.p1Picked.join(', ') || 'None'}</span> (${this.p1Picked.length}/5)</div>
            <div style="color:var(--team-p2); font-weight:700; font-size:14px;">🟥 Player 2 Team: <span style="color:#fff;">${this.p2Picked.join(', ') || 'None'}</span> (${this.p2Picked.length}/5)</div>
          </div>

          <div class="draft-pool-box active-turn" style="width:100%;">
            <div class="draft-cards-grid">
              ${filteredHeroes.map(char => this._renderHeroCard(char, currentStep, activePlayer, isDone)).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      const filterFn = (name) => {
        if (this.classFilter === 'ALL') return true;
        const char = allHeroes.find(c => c.name === name);
        if (!char) return true;
        const mainClass = (char.class?.[0] || 'DPS').toUpperCase();
        return mainClass === this.classFilter;
      };

      const p1List = this.p1Roster.filter(filterFn);
      const p2List = this.p2Roster.filter(filterFn);

      html += `
        <div class="draft-pools-container">
          <!-- P1 Pool -->
          <div class="draft-pool-box ${activePlayer === 1 ? 'active-turn' : ''}">
            <div class="draft-pool-title" style="color:var(--team-p1)">
              <span>Player 1 Roster Pool ${this.p1IsTeam1 ? '(Team 1)' : '(Team 2)'}</span>
              <span>${this.p1Picked.length}/5 Picked</span>
            </div>
            <div class="draft-cards-grid">
              ${p1List.map(name => {
                const char = allHeroes.find(c => c.name === name) || { name, health: 20, speed: 5 };
                return this._renderHeroCard(char, currentStep, activePlayer, isDone);
              }).join('')}
            </div>
          </div>

          <!-- P2 Pool -->
          <div class="draft-pool-box ${activePlayer === 2 ? 'active-turn' : ''}">
            <div class="draft-pool-title" style="color:var(--team-p2)">
              <span>Player 2 Roster Pool ${!this.p1IsTeam1 ? '(Team 1)' : '(Team 2)'}</span>
              <span>${this.p2Picked.length}/5 Picked</span>
            </div>
            <div class="draft-cards-grid">
              ${p2List.map(name => {
                const char = allHeroes.find(c => c.name === name) || { name, health: 20, speed: 5 };
                return this._renderHeroCard(char, currentStep, activePlayer, isDone);
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }

    this.container.innerHTML = html;
    this._bindEvents();
  }

  _renderHeroCard(char, currentStep, activePlayer, isDone) {
    const name = char.name;
    const isP1Picked = this.p1Picked.includes(name);
    const isP2Picked = this.p2Picked.includes(name);
    const isBanned = this.globalBanned.includes(name);
    const isPickedAny = isP1Picked || isP2Picked;

    const mainClass = (char.class?.[0] || 'DPS').toUpperCase();
    const classIcon = mainClass === 'DPS' ? '⚔️' : mainClass === 'TANK' ? '🛡️' : '💚';
    const classColor = mainClass === 'DPS' ? 'var(--class-dps)' :
                       mainClass === 'TANK' ? 'var(--class-tank)' :
                       mainClass === 'SUPPORT' ? 'var(--class-support)' : 'var(--text-secondary)';

    let badgeText = '';
    let cardCls = '';

    if (isBanned) {
      cardCls = 'banned';
      badgeText = '🚫 BANNED (GLOBAL)';
    } else if (isP1Picked) {
      cardCls = 'drafted';
      badgeText = '✓ PICKED (P1)';
    } else if (isP2Picked) {
      cardCls = 'drafted';
      badgeText = '✓ PICKED (P2)';
    } else if (!isDone && currentStep) {
      if (currentStep.action === 'pick') {
        badgeText = activePlayer === 1 ? '🟦 CLICK TO PICK' : '🟥 CLICK TO PICK';
      } else if (currentStep.action === 'ban') {
        badgeText = '🚫 CLICK TO BAN';
      }
    }

    const primaryAbility = char.abilities?.[0];
    const abilitySnippet = primaryAbility ? `⚡ ${primaryAbility.name}: ${primaryAbility.description.slice(0, 55)}...` : '';

    return `
      <div class="draft-card ${cardCls}" data-hero-card="${name}">
        <div class="draft-card-header">
          <div class="draft-card-name">${name}</div>
          <div class="draft-card-badges">
            <span class="draft-class-tag" style="color:${classColor}; background:${classColor}18; border-color:${classColor}40;">
              ${classIcon} ${mainClass}
            </span>
            <span class="draft-base-tag">${char.base || '50mm'}</span>
          </div>
        </div>

        <!-- Rich Stat Grid -->
        <div class="draft-stat-grid">
          <div class="draft-stat-pill"><span style="color:#FF4757;">🩸 HP</span> <b>${char.health}</b></div>
          <div class="draft-stat-pill"><span style="color:#2ED573;">🏃 SPD</span> <b>${char.speed}"</b></div>
          <div class="draft-stat-pill"><span style="color:#FFA502;">⚡ AP</span> <b>${char.ap || 3}</b></div>
          <div class="draft-stat-pill"><span style="color:#1E90FF;">🛡️ DEF</span> <b>${char.defense || char.armor || 0}</b></div>
        </div>

        ${abilitySnippet ? `<div class="draft-card-ability-snippet">${abilitySnippet}</div>` : ''}

        <div class="draft-card-action-badge ${isBanned ? 'badge-banned' : (isPickedAny ? 'badge-picked' : '')}">
          ${badgeText}
        </div>
      </div>
    `;
  }

  _bindEvents() {
    // Class filter tabs
    this.container.querySelectorAll('[data-filter-class]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.classFilter = e.currentTarget.dataset.filterClass;
        this._render();
      });
    });

    if (this.stepIndex >= this.steps.length) return;

    const currentStep = this.steps[this.stepIndex];
    const activePlayer = this._getActivePlayer();

    this.container.querySelectorAll('[data-hero-card]').forEach(card => {
      card.addEventListener('click', () => {
        const name = card.dataset.heroCard;

        if (this.globalBanned.includes(name) || this.p1Picked.includes(name) || this.p2Picked.includes(name)) return;

        if (currentStep.action === 'ban') {
          this.globalBanned.push(name);
          network.emit('draft_step_action', { heroName: name, action: 'ban', player: activePlayer });
          this._advanceStep();
        } else if (currentStep.action === 'pick') {
          if (activePlayer === 1) {
            this.p1Picked.push(name);
          } else {
            this.p2Picked.push(name);
          }
          network.emit('draft_step_action', { heroName: name, action: 'pick', player: activePlayer });
          this._advanceStep();
        }
      });
    });
  }

  _applyRemoteDraftAction(data) {
    const { heroName, action, player } = data;
    if (action === 'ban') {
      if (!this.globalBanned.includes(heroName)) this.globalBanned.push(heroName);
    } else if (action === 'pick') {
      if (player === 1 && !this.p1Picked.includes(heroName)) this.p1Picked.push(heroName);
      if (player === 2 && !this.p2Picked.includes(heroName)) this.p2Picked.push(heroName);
    }
    this._advanceStep();
  }

  _advanceStep() {
    this.stepRemaining--;

    if (this.stepRemaining <= 0) {
      this.stepIndex++;
      if (this.stepIndex < this.steps.length) {
        this.stepRemaining = this.steps[this.stepIndex].count;
      }
    }

    if (this.stepIndex >= this.steps.length) {
      this._render();
      setTimeout(() => {
        this.container?.remove();
        this.onComplete({
          p1Drafted: this.p1Picked,
          p2Drafted: this.p2Picked,
        });
      }, 1200);
      return;
    }

    this._render();
  }
}
