/**
 * NetworkManager — handles Socket.IO connection, room creation/joining, shareable links, and event syncing.
 */

import { io } from 'socket.io-client';

class NetworkManager {
  constructor() {
    this.socket = null;
    this.roomId = null;
    this.role = 'local'; // 'local' | 'player1' | 'player2' | 'spectator'
    this.connected = false;
    this.listeners = new Map();
  }

  init() {
    if (this.socket) return;

    // Connect to backend server (port 3001 or window.location.hostname:3001)
    const serverUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
    this.socket = io(serverUrl, { autoConnect: true });

    this.socket.on('connect', () => {
      console.log('[Network] Connected to server:', this.socket.id);
      this.connected = true;
      this._emitLocal('connected', { socketId: this.socket.id });
    });

    this.socket.on('disconnect', () => {
      console.log('[Network] Disconnected from server');
      this.connected = false;
      this._emitLocal('disconnected');
    });

    // Forward remote socket events to local subscribers
    const forwardEvents = [
      'player_joined', 'player_left', 'setup_updated',
      'draft_started', 'draft_step_synced', 'battle_started',
      'model_moved_remote', 'model_updated_remote', 'ability_executed_remote',
      'dice_rolled_remote', 'next_round_remote'
    ];

    for (const evt of forwardEvents) {
      this.socket.on(evt, (data) => {
        this._emitLocal(evt, data);
      });
    }
  }

  /** Create a new online game room */
  createRoom({ roomId, password, config }) {
    return new Promise((resolve) => {
      this.init();
      this.socket.emit('create_room', { roomId, password, config }, (response) => {
        if (response.success) {
          this.roomId = response.roomId;
          this.role = 'player1';
        }
        resolve(response);
      });
    });
  }

  /** Join an existing online game room */
  joinRoom({ roomId, password }) {
    return new Promise((resolve) => {
      this.init();
      this.socket.emit('join_room', { roomId, password }, (response) => {
        if (response.success) {
          this.roomId = response.roomId;
          this.role = response.role;
        }
        resolve(response);
      });
    });
  }

  /** Emit event to server */
  emit(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    }
  }

  /** Subscribe to local/remote network events */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  _emitLocal(event, data) {
    const list = this.listeners.get(event);
    if (list) {
      for (const cb of list) cb(data);
    }
  }

  /** Generate shareable URL e.g. http://localhost:5173/?room=GAME-8472 */
  getShareableLink() {
    if (!this.roomId) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('room', this.roomId);
    return url.toString();
  }
}

export const network = new NetworkManager();
