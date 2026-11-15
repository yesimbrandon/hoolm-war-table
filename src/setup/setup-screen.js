/**
 * SetupScreen — pre-game wizard for online multiplayer, game mode, board size, deployment, team selection, and titans.
 */

import { getHeroes, getTitans } from '../data/data-loader.js';
import { network } from '../network/network-manager.js';

export class SetupScreen {
  /**
   * @param {HTMLElement} container
   * @param {Function} onStart — callback(config) when game starts
   */
  constructor(container, onStart) {
    this.container = container;
    this.onStart = onStart;

    // Defaults
    this.gameMode = 'free-play'; // 'free-play' | 'draft'
    this.playType = 'local'; // 'local' | 'online'
    this.boardW = 48;
    this.boardH = 48;
    this.deployStyle = 'top-bottom';
    this.deployDepth = 7;
    this.selectedP1 = new Set();
    this.selectedP2 = new Set();
    this.selectedTitans = new Set();

    // Online Room State
    this.onlineRoomId = `GAME-${Math.floor(1000 + Math.random() * 9000)}`;
    this.onlinePassword = '';
    this.isRoomCreated = false;
    this.isP2Connected = false;

    this._checkUrlRoomParam();
  }

  get targetTeamSize() {
    if (this.gameMode === 'roster-draft') return 12;
    if (this.gameMode === 'free-play') return 5;
    return 0;
  }

  _checkUrlRoomParam() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      this.playType = 'online';
      this.onlineRoomId = roomParam.toUpperCase();
      setTimeout(() => this._promptJoinRoom(this.onlineRoomId), 300);
    }
  }

  render() {
    this._saveScrollPositions();

    const heroes = getHeroes();
    const titans = getTitans();
    const isDraft = this.gameMode !== 'free-play';
    const reqText = this.gameMode === 'roster-draft' ? 'Select 12 Roster Models' : 'Select 5 Active Team Models';

    let html = `
      <div class="setup-container">
        <h1 class="setup-title">HOOLM War Table</h1>
        <p class="setup-subtitle">Configure your match and deploy your forces</p>

        <!-- Match Type (Local vs Online) -->
        <div class="setup-section">
          <div class="setup-section-label">Match Type</div>
          <div class="mode-options">
            <div class="mode-option ${this.playType === 'local' ? 'selected' : ''}" data-playtype="local">
              <div class="mode-option-title">🖥️ Local Hotseat</div>
              <div class="mode-option-desc">Play both teams on the same computer screen</div>
            </div>
            <div class="mode-option ${this.playType === 'online' ? 'selected' : ''}" data-playtype="online">
              <div class="mode-option-title">🌐 Online Multiplayer</div>
              <div class="mode-option-desc">Create a room link for Player 2 to join remotely over network</div>
            </div>
          </div>
        </div>

        <!-- Online Room Settings -->
        ${this.playType === 'online' ? `
          <div class="setup-section" style="padding:16px; border-radius:12px; background:rgba(0,173,181,0.08); border:1px solid rgba(0,173,181,0.3);">
            <div class="setup-section-label" style="color:var(--secondary);">🌐 Online Room Configuration</div>
            
            ${!this.isRoomCreated ? `
              <div class="setup-row" style="margin-bottom:12px;">
                <div class="setup-input-group">
                  <label>Room Code</label>
                  <input type="text" class="setup-input" id="room-code-input" value="${this.onlineRoomId}" />
                </div>
                <div class="setup-input-group">
                  <label>Password (Optional)</label>
                  <input type="password" class="setup-input" id="room-pass-input" placeholder="Leave empty for no password" value="${this.onlinePassword}" />
                </div>
              </div>
              <div style="display:flex; gap:10px;">
                <button class="setup-start-btn" id="btn-create-room" style="background:var(--secondary); margin:0;">
                  Create Room & Get Share Link
                </button>
                <button class="toolbar-btn" id="btn-manual-join" style="padding:12px 16px;">
                  Join Room
                </button>
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                  <span style="font-weight:700; color:var(--gold);">Room Code: ${this.onlineRoomId}</span>
                  <span style="font-size:12px; color:${this.isP2Connected ? '#2ED573' : 'var(--text-muted)'}; font-weight:700;">
                    ${this.isP2Connected ? '✅ Player 2 Connected!' : '⏳ Waiting for Player 2...'}
                  </span>
                </div>
                <div style="display:flex; gap:8px;">
                  <input type="text" class="setup-input" id="share-link-input" readonly value="${network.getShareableLink()}" style="font-size:11px;" />
                  <button class="toolbar-btn" id="btn-copy-link" style="white-space:nowrap;">📋 Copy Link</button>
                </div>
              </div>
            `}
          </div>
        ` : ''}

        <!-- Game Mode Selection -->
        <div class="setup-section">
          <div class="setup-section-label">Game Mode</div>
          <div class="mode-options">
            <div class="mode-option ${this.gameMode === 'free-play' ? 'selected' : ''}" data-mode="free-play">
              <div class="mode-option-title">⚡ Free Play</div>
              <div class="mode-option-desc">Pick 5 models directly per team and deploy immediately</div>
            </div>
            <div class="mode-option ${this.gameMode === 'roster-draft' ? 'selected' : ''}" data-mode="roster-draft">
              <div class="mode-option-title">⚔️ Roster Draft</div>
              <div class="mode-option-desc">Bring 12 models each. 1 Ban each first, then draft 5 active models</div>
            </div>
            <div class="mode-option ${this.gameMode === 'open-draft' ? 'selected' : ''}" data-mode="open-draft">
              <div class="mode-option-title">🏛️ Global Open Draft</div>
              <div class="mode-option-desc">Full hero codex available. 11-step Pick/Ban draft (Ban 2, Ban 2, Pick 1...)</div>
            </div>
          </div>
        </div>

        <!-- Board Size -->
        <div class="setup-section">
          <div class="setup-section-label">Board Size (inches)</div>
          <div class="setup-row">
            <div class="setup-input-group">
              <label>Width</label>
              <input type="number" class="setup-input" id="board-w" value="${this.boardW}" min="12" max="96" />
            </div>
            <div class="setup-input-group">
              <label>Height</label>
              <input type="number" class="setup-input" id="board-h" value="${this.boardH}" min="12" max="96" />
            </div>
          </div>
        </div>

        <!-- Deployment Style -->
        <div class="setup-section">
          <div class="setup-section-label">Deployment Style</div>
          <div class="deploy-options">
            <div class="deploy-option ${this.deployStyle === 'top-bottom' ? 'selected' : ''}" data-deploy="top-bottom">
              <div class="deploy-option-icon">
                <div style="position:absolute;top:0;left:0;right:0;height:35%;background:rgba(74,158,255,0.25);"></div>
                <div style="position:absolute;bottom:0;left:0;right:0;height:35%;background:rgba(255,92,92,0.25);"></div>
              </div>
              <div class="deploy-option-label">Top / Bottom</div>
            </div>
            <div class="deploy-option ${this.deployStyle === 'side-side' ? 'selected' : ''}" data-deploy="side-side">
              <div class="deploy-option-icon">
                <div style="position:absolute;top:0;left:0;bottom:0;width:35%;background:rgba(74,158,255,0.25);"></div>
                <div style="position:absolute;top:0;right:0;bottom:0;width:35%;background:rgba(255,92,92,0.25);"></div>
              </div>
              <div class="deploy-option-label">Side / Side</div>
            </div>
            <div class="deploy-option ${this.deployStyle === 'corners' ? 'selected' : ''}" data-deploy="corners">
              <div class="deploy-option-icon">
                <div style="position:absolute;top:0;left:0;width:45%;height:45%;border-bottom-right-radius:100%;background:rgba(74,158,255,0.25);"></div>
                <div style="position:absolute;bottom:0;right:0;width:45%;height:45%;border-top-left-radius:100%;background:rgba(255,92,92,0.25);"></div>
              </div>
              <div class="deploy-option-label">Corners (Arcs)</div>
            </div>
          </div>
          <div class="setup-depth-row">
            <label>Deployment Zone Depth:</label>
            <input type="number" class="setup-input" id="deploy-depth" value="${this.deployDepth}" min="3" max="24" />
            <span style="color:var(--text-muted);font-size:12px;">inches</span>
          </div>
        </div>

        ${this.gameMode === 'open-draft' ? `
          <div class="setup-section" style="padding:16px; border-radius:12px; background:rgba(255,193,7,0.08); border:1px solid rgba(255,193,7,0.3); text-align:center;">
            <div style="font-weight:700; color:var(--gold); font-size:15px; margin-bottom:4px;">🏛️ Global Open Draft Mode</div>
            <div style="font-size:12px; color:var(--text-secondary);">All Codex Heroes are available during the Draft Phase. Team roster pre-selection is skipped.</div>
          </div>
        ` : `
          <!-- Player 1 Team -->
          <div class="setup-section">
            <div class="setup-section-label" style="color:var(--team-p1);">Player 1 Team (${reqText})</div>
            <div class="team-select-area" id="p1-select">
              ${heroes.map(c => this._charRow(c, 'p1')).join('')}
            </div>
            <div class="team-count" id="p1-count">${this.selectedP1.size} / ${this.targetTeamSize} selected</div>
          </div>

          <!-- Player 2 Team -->
          <div class="setup-section">
            <div class="setup-section-label" style="color:var(--team-p2);">Player 2 Team (${reqText})</div>
            <div class="team-select-area" id="p2-select">
              ${heroes.map(c => this._charRow(c, 'p2')).join('')}
            </div>
            <div class="team-count" id="p2-count">${this.selectedP2.size} / ${this.targetTeamSize} selected</div>
          </div>
        `}

        <!-- Titan Selection -->
        <div class="setup-section">
          <div class="setup-section-label" style="color:var(--gold);">Titans (select 2)</div>
          <div class="titan-options">
            ${titans.map(t => `
              <div class="titan-option ${this.selectedTitans.has(t.name) ? 'selected' : ''}" data-titan="${t.name}">
                <div class="titan-option-name">${t.name}</div>
                <div class="titan-option-hp">HP: ${t.health}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Start Button -->
        <button class="setup-start-btn" id="start-btn">${isDraft ? 'Proceed to Draft Phase ▶' : 'Deploy & Start Match'}</button>
      </div>
    `;

    this.container.innerHTML = html;
    this._bindEvents();
    this._restoreScrollPositions();
  }

  _saveScrollPositions() {
    const setupEl = this.container.querySelector('.setup-container');
    const p1El = this.container.querySelector('#p1-select');
    const p2El = this.container.querySelector('#p2-select');
    this._savedSetupScrollTop = setupEl ? setupEl.scrollTop : 0;
    this._savedP1ScrollTop = p1El ? p1El.scrollTop : 0;
    this._savedP2ScrollTop = p2El ? p2El.scrollTop : 0;
  }

  _restoreScrollPositions() {
    const setupEl = this.container.querySelector('.setup-container');
    const p1El = this.container.querySelector('#p1-select');
    const p2El = this.container.querySelector('#p2-select');
    if (setupEl && this._savedSetupScrollTop !== undefined) setupEl.scrollTop = this._savedSetupScrollTop;
    if (p1El && this._savedP1ScrollTop !== undefined) p1El.scrollTop = this._savedP1ScrollTop;
    if (p2El && this._savedP2ScrollTop !== undefined) p2El.scrollTop = this._savedP2ScrollTop;
  }

  _charRow(charData, team) {
    const name = charData.name;
    const selected = team === 'p1' ? this.selectedP1.has(name) : this.selectedP2.has(name);
    const cls = charData.class?.[0] || 'DPS';
    const classColor = cls.toUpperCase() === 'DPS' ? 'var(--class-dps)' :
                       cls.toUpperCase() === 'TANK' ? 'var(--class-tank)' :
                       cls.toUpperCase() === 'SUPPORT' ? 'var(--class-support)' : 'var(--text-secondary)';

    return `
      <div class="team-char-row ${selected ? (team === 'p1' ? 'selected' : 'selected-p2') : ''}" data-char="${name}" data-team="${team}">
        <div class="team-char-checkbox">${selected ? '✓' : ''}</div>
        <span class="team-char-name">${name}</span>
        <span class="team-char-class" style="color:${classColor};background:${classColor}15;border:1px solid ${classColor}30;">${cls}</span>
        <span class="team-char-base">${charData.base}</span>
      </div>
    `;
  }

  _bindEvents() {
    // Play type toggle (Local vs Online)
    this.container.querySelectorAll('[data-playtype]').forEach(opt => {
      opt.addEventListener('click', (e) => {
        const val = e.currentTarget.getAttribute('data-playtype');
        if (val) {
          this.playType = val;
          this.render();
        }
      });
    });

    // Create Room Button
    const createBtn = document.getElementById('btn-create-room');
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const codeInput = document.getElementById('room-code-input');
        const passInput = document.getElementById('room-pass-input');
        this.onlineRoomId = codeInput ? codeInput.value : this.onlineRoomId;
        this.onlinePassword = passInput ? passInput.value : '';

        const res = await network.createRoom({
          roomId: this.onlineRoomId,
          password: this.onlinePassword,
          config: {
            boardW: this.boardW,
            boardH: this.boardH,
            deployStyle: this.deployStyle,
            deployDepth: this.deployDepth,
            gameMode: this.gameMode,
          },
        });

        if (res.success) {
          this.isRoomCreated = true;
          this.onlineRoomId = res.roomId;
          this.render();

          // Subscribe to network events
          network.on('player_joined', ({ role }) => {
            if (role === 'player2') {
              this.isP2Connected = true;
              this.render();
              alert('🎉 Player 2 joined your game room!');
            }
          });
        } else {
          alert(`Error creating room: ${res.error}`);
        }
      });
    }

    // Manual Join Button
    const manualJoinBtn = document.getElementById('btn-manual-join');
    if (manualJoinBtn) {
      manualJoinBtn.addEventListener('click', () => {
        const code = prompt('Enter Room Code to Join:', this.onlineRoomId);
        if (code) this._promptJoinRoom(code);
      });
    }

    // Copy Link Button
    const copyLinkBtn = document.getElementById('btn-copy-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        const linkInput = document.getElementById('share-link-input');
        if (linkInput) {
          navigator.clipboard.writeText(linkInput.value);
          alert('📋 Shareable room link copied to clipboard!');
        }
      });
    }

    // Game mode option toggle
    this.container.querySelectorAll('.mode-option[data-mode]').forEach(opt => {
      opt.addEventListener('click', (e) => {
        const val = e.currentTarget.getAttribute('data-mode');
        if (val) {
          this.gameMode = val;
          this.render();
          if (this.isRoomCreated) {
            network.emit('update_setup', { gameMode: this.gameMode });
          }
        }
      });
    });

    // Board size inputs
    const boardWInput = document.getElementById('board-w');
    const boardHInput = document.getElementById('board-h');
    const depthInput = document.getElementById('deploy-depth');

    boardWInput?.addEventListener('change', () => {
      this.boardW = parseInt(boardWInput.value) || 48;
      if (this.isRoomCreated) network.emit('update_setup', { boardW: this.boardW });
    });
    boardHInput?.addEventListener('change', () => {
      this.boardH = parseInt(boardHInput.value) || 48;
      if (this.isRoomCreated) network.emit('update_setup', { boardH: this.boardH });
    });
    depthInput?.addEventListener('change', () => {
      this.deployDepth = parseInt(depthInput.value) || 7;
      if (this.isRoomCreated) network.emit('update_setup', { deployDepth: this.deployDepth });
    });

    // Deployment style
    this.container.querySelectorAll('.deploy-option').forEach(opt => {
      opt.addEventListener('click', () => {
        this.deployStyle = opt.dataset.deploy;
        this.container.querySelectorAll('.deploy-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        if (this.isRoomCreated) network.emit('update_setup', { deployStyle: this.deployStyle });
      });
    });

    // P1 team selection
    this.container.querySelectorAll('#p1-select .team-char-row').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.dataset.char;
        if (this.selectedP1.has(name)) {
          this.selectedP1.delete(name);
          row.classList.remove('selected');
          row.querySelector('.team-char-checkbox').textContent = '';
        } else {
          this.selectedP1.add(name);
          row.classList.add('selected');
          row.querySelector('.team-char-checkbox').textContent = '✓';
        }
        const countEl = document.getElementById('p1-count');
        if (countEl) countEl.textContent = `${this.selectedP1.size} / ${this.targetTeamSize} selected`;
      });
    });

    // P2 team selection
    this.container.querySelectorAll('#p2-select .team-char-row').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.dataset.char;
        if (this.selectedP2.has(name)) {
          this.selectedP2.delete(name);
          row.classList.remove('selected-p2');
          row.querySelector('.team-char-checkbox').textContent = '';
        } else {
          this.selectedP2.add(name);
          row.classList.add('selected-p2');
          row.querySelector('.team-char-checkbox').textContent = '✓';
        }
        const countEl = document.getElementById('p2-count');
        if (countEl) countEl.textContent = `${this.selectedP2.size} / ${this.targetTeamSize} selected`;
      });
    });

    // Titan selection
    this.container.querySelectorAll('.titan-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const name = opt.dataset.titan;
        if (this.selectedTitans.has(name)) {
          this.selectedTitans.delete(name);
          opt.classList.remove('selected');
        } else {
          if (this.selectedTitans.size >= 2) {
            const first = this.selectedTitans.values().next().value;
            this.selectedTitans.delete(first);
            const prevOpt = this.container.querySelector(`.titan-option[data-titan="${first}"]`);
            if (prevOpt) prevOpt.classList.remove('selected');
          }
          this.selectedTitans.add(name);
          opt.classList.add('selected');
        }
      });
    });

    // Start button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (this.gameMode !== 'open-draft' && (this.selectedP1.size === 0 || this.selectedP2.size === 0)) {
          alert(`Please select ${this.targetTeamSize} models for each player.`);
          return;
        }
        if (this.selectedTitans.size === 0) {
          alert('Please select at least 1 Titan.');
          return;
        }

        const config = {
          playType: this.playType,
          gameMode: this.gameMode,
          boardW: this.boardW,
          boardH: this.boardH,
          deployStyle: this.deployStyle,
          deployDepth: this.deployDepth,
          p1Names: [...this.selectedP1],
          p2Names: [...this.selectedP2],
          titanNames: [...this.selectedTitans],
        };

        if (this.isRoomCreated) {
          network.emit('update_setup', config);
        }

        this.onStart(config);
      });
    }
  }

  async _promptJoinRoom(roomId) {
    const password = prompt(`Joining Online Room ${roomId}.\nEnter Password (leave blank if none):`, '');
    const res = await network.joinRoom({ roomId, password });
    if (res.success) {
      alert(`✅ Joined Room ${roomId} as ${res.role.toUpperCase()}!`);
      this.playType = 'online';
      this.isRoomCreated = true;
      this.onlineRoomId = roomId;

      // Sync room config if present
      if (res.roomState && res.roomState.config) {
        const c = res.roomState.config;
        this.boardW = c.boardW || this.boardW;
        this.boardH = c.boardH || this.boardH;
        this.deployStyle = c.deployStyle || this.deployStyle;
        this.gameMode = c.gameMode || this.gameMode;
      }

      this.render();
    } else {
      alert(`Could not join room: ${res.error}`);
    }
  }
}
