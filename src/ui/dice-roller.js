/**
 * DiceRoller — keyboard-triggered dice rolling with visual feedback and multiplayer sync.
 */

import { network } from '../network/network-manager.js';

export class DiceRoller {
  constructor() {
    this.overlay = document.getElementById('dice-overlay');
    this.hideTimeout = null;
    this.isRolling = false;
    this._bindEvents();

    // Listen for remote dice rolls
    network.on('dice_rolled_remote', ({ count, results, total }) => {
      this.displayRemoteRoll(count, results, total);
    });
  }

  _bindEvents() {
    // Keyboard: 1-9 rolls that many D6
    window.addEventListener('keydown', (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        this.roll(num);
      }
    });

    // Dice button in toolbar
    const btn = document.getElementById('btn-dice');
    if (btn) {
      btn.addEventListener('click', () => {
        this.roll(1);
      });
    }
  }

  /**
   * Roll n D6 dice with animated results and network broadcast.
   * @param {number} count — number of dice to roll
   */
  async roll(count) {
    if (this.isRolling) return;

    // Generate final results
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(Math.floor(Math.random() * 6) + 1);
    }
    const total = results.reduce((a, b) => a + b, 0);

    // Broadcast to remote player
    network.emit('dice_roll', { count, results, total });

    await this._animateRoll(count, results, total);
  }

  async displayRemoteRoll(count, results, total) {
    await this._animateRoll(count, results, total);
  }

  async _animateRoll(count, results, total) {
    this.isRolling = true;

    // Clear any pending hide
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Animate: show shuffling dice for ~300ms
    this.overlay.classList.remove('hidden');

    for (let frame = 0; frame < 4; frame++) {
      this._renderDice(count, null);
      await this._sleep(60);
    }

    // Reveal final results
    this._renderDice(count, results, total);
    this.isRolling = false;

    // Auto-hide after 4 seconds
    this.hideTimeout = setTimeout(() => {
      this.overlay.classList.add('hidden');
    }, 4000);
  }

  _renderDice(count, finalResults, total) {
    let html = '';
    for (let i = 0; i < count; i++) {
      const face = finalResults ? finalResults[i] : (Math.floor(Math.random() * 6) + 1);
      const pip = this._diceFace(face);
      html += `<div class="dice-face">${pip}</div>`;
    }
    if (total !== undefined && count > 1) {
      html += `<span class="dice-total">= ${total}</span>`;
    }
    this.overlay.innerHTML = html;
  }

  _diceFace(n) {
    return n;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
