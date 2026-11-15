/**
 * BoardCanvas — main canvas controller.
 * Handles pan, zoom, input events, render loop, and coordinates all board systems.
 */

import { drawGrid, drawModel } from './board-renderer.js';
import { drawDeploymentZones } from './deployment-zones.js';
import { drawMeasurementLines } from './measurement.js';
import { MovementSystem } from './movement.js';
import { network } from '../network/network-manager.js';

export class BoardCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} config — { boardW, boardH, deployZones, models }
   * @param {Object} callbacks — { onSelectModel, onDeselectModel }
   */
  constructor(canvas, config, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;
    this.callbacks = callbacks || {};

    // Board dimensions (inches)
    this.boardW = config.boardW;
    this.boardH = config.boardH;
    this.deployZones = config.deployZones;

    // All models on the board
    this.models = config.models || [];

    // Camera / view
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.scale = 1; // pixels per inch (computed)

    // Interaction state
    this.selectedModel = null;
    this.hoveredModel = null;
    this.isDragging = false;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // Movement system
    this.movement = new MovementSystem();

    // Space key for pan
    this.spaceHeld = false;

    // Confirm/cancel overlay elements
    this.moveConfirmEl = document.getElementById('move-confirm');
    this.moveDistLabel = document.getElementById('move-distance-label');

    this._bindEvents();
    this._resize();
    this._startRenderLoop();

    // Listen for remote model movement
    network.on('model_moved_remote', ({ modelId, x, y }) => {
      const target = this.models.find(m => m.id === modelId);
      if (target) {
        target.x = x;
        target.y = y;
      }
    });
  }

  // ============================================================
  // EVENTS
  // ============================================================

  _bindEvents() {
    // Resize
    window.addEventListener('resize', () => this._resize());

    // Mouse
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard (space for pan)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.spaceHeld = true;
        this.canvas.style.cursor = 'grab';
      }
      if (e.code === 'Escape') {
        if (this.movement.isActive()) {
          this.movement.cancelMove();
          this._hideConfirmUI();
        }
        this.selectedModel = null;
        this.callbacks.onDeselectModel?.();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceHeld = false;
        this.canvas.style.cursor = 'crosshair';
      }
    });

    // Confirm/cancel buttons
    document.getElementById('move-confirm-yes')?.addEventListener('click', () => {
      if (this.movement.model) {
        network.emit('model_move_confirm', {
          modelId: this.movement.model.id,
          x: this.movement.model.x,
          y: this.movement.model.y,
        });
      }
      this.movement.confirmMove();
      this._hideConfirmUI();
    });
    document.getElementById('move-confirm-no')?.addEventListener('click', () => {
      this.movement.cancelMove();
      this._hideConfirmUI();
    });
  }

  _onMouseDown(e) {
    const { inchX, inchY } = this._eventToInches(e);

    // Middle button or space+left = pan
    if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
      this.isPanning = true;
      this.panStartX = e.clientX - this.panX;
      this.panStartY = e.clientY - this.panY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // Left click
    if (e.button === 0) {
      const model = this._hitTestModel(inchX, inchY);

      if (model) {
        // Role permission check
        const canDrag = !model.isTitan && (
          network.role === 'local' ||
          (network.role === 'player1' && model.team === 'player1') ||
          (network.role === 'player2' && model.team === 'player2')
        );

        if (canDrag && this.movement.state === 'AWAITING_CONFIRM' && this.movement.model?.id === model.id) {
          this.isDragging = true;
          this.dragOffsetX = model.x - inchX;
          this.dragOffsetY = model.y - inchY;
          this.movement.startMove(model);
          this._hideConfirmUI();
          this.canvas.style.cursor = 'grabbing';
          return;
        }

        if (this.movement.isActive() && this.movement.model?.id !== model.id) {
          if (this.movement.model) {
            network.emit('model_move_confirm', {
              modelId: this.movement.model.id,
              x: this.movement.model.x,
              y: this.movement.model.y,
            });
          }
          this.movement.confirmMove();
          this._hideConfirmUI();
        }

        // Select the model (always allowed for inspection)
        this.selectedModel = model;
        this.callbacks.onSelectModel?.(model);

        // Start dragging if permitted
        if (canDrag) {
          this.isDragging = true;
          this.dragOffsetX = model.x - inchX;
          this.dragOffsetY = model.y - inchY;
          this.movement.startMove(model);
          this._hideConfirmUI();
          this.canvas.style.cursor = 'grabbing';
        }
      } else {
        if (this.movement.isActive()) {
          if (this.movement.state !== 'AWAITING_CONFIRM') {
            this.movement.cancelMove();
            this._hideConfirmUI();
          }
        } else {
          this.selectedModel = null;
          this.callbacks.onDeselectModel?.();
        }
      }
    }
  }

  _onMouseMove(e) {
    const { inchX, inchY } = this._eventToInches(e);

    // Panning
    if (this.isPanning) {
      this.panX = e.clientX - this.panStartX;
      this.panY = e.clientY - this.panStartY;
      return;
    }

    // Dragging a model
    if (this.isDragging && this.movement.state === 'MOVING') {
      const newX = inchX + this.dragOffsetX;
      const newY = inchY + this.dragOffsetY;
      // Clamp to board
      const clampedX = Math.max(this.movement.model.radiusInches, Math.min(this.boardW - this.movement.model.radiusInches, newX));
      const clampedY = Math.max(this.movement.model.radiusInches, Math.min(this.boardH - this.movement.model.radiusInches, newY));
      this.movement.updateDrag(clampedX, clampedY);

      // Update distance label position
      this._showDistanceLabel(e.clientX, e.clientY);
      return;
    }

    // Hover detection
    const model = this._hitTestModel(inchX, inchY);
    this.hoveredModel = model;
    if (model && !this.spaceHeld) {
      this.canvas.style.cursor = 'pointer';
    } else if (!this.spaceHeld) {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  _onMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.spaceHeld ? 'grab' : 'crosshair';
      return;
    }

    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.style.cursor = 'pointer';

      // Only transition to AWAITING_CONFIRM if we actually moved
      if (this.movement.state === 'MOVING') {
        const dist = this.movement.getCurrentTotalDistance();
        if (dist > 0.1) {
          this.movement.endDrag();
          this._showConfirmUI();
        } else {
          // Barely moved — just selecting, not moving
          this.movement.cancelMove();
          this._hideConfirmUI();
        }
      }
    }
  }

  _onWheel(e) {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldZoom = this.zoom;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(0.2, Math.min(5, this.zoom * delta));

    // Zoom towards mouse position
    const zoomRatio = this.zoom / oldZoom;
    this.panX = mouseX - (mouseX - this.panX) * zoomRatio;
    this.panY = mouseY - (mouseY - this.panY) * zoomRatio;
  }

  // ============================================================
  // HIT TESTING
  // ============================================================

  _hitTestModel(inchX, inchY) {
    // Test in reverse order so topmost model wins
    for (let i = this.models.length - 1; i >= 0; i--) {
      const m = this.models[i];
      if (!m.alive) continue;
      const dx = inchX - m.x;
      const dy = inchY - m.y;
      if (Math.sqrt(dx * dx + dy * dy) <= m.radiusInches) {
        return m;
      }
    }
    return null;
  }

  _eventToInches(e) {
    const rect = this.canvas.getBoundingClientRect();
    const pixelX = (e.clientX - rect.left - this.panX) / this.zoom;
    const pixelY = (e.clientY - rect.top - this.panY) / this.zoom;
    return {
      inchX: pixelX / this.scale,
      inchY: pixelY / this.scale,
    };
  }

  // ============================================================
  // CONFIRM/CANCEL UI
  // ============================================================

  _showConfirmUI() {
    if (!this.moveConfirmEl || !this.movement.model) return;
    this.moveConfirmEl.classList.remove('hidden');

    // Position near the model
    const rect = this.canvas.getBoundingClientRect();
    const px = this.movement.model.x * this.scale * this.zoom + this.panX + rect.left;
    const py = this.movement.model.y * this.scale * this.zoom + this.panY + rect.top;
    const r = this.movement.model.radiusInches * this.scale * this.zoom;

    this.moveConfirmEl.style.left = (px - rect.left - 36) + 'px';
    this.moveConfirmEl.style.top = (py - rect.top + r + 10) + 'px';

    // Also show final distance
    this._showDistanceLabelAtModel();
  }

  _hideConfirmUI() {
    this.moveConfirmEl?.classList.add('hidden');
    this.moveDistLabel?.classList.add('hidden');
  }

  _showDistanceLabel(mouseX, mouseY) {
    if (!this.moveDistLabel || !this.movement.model) return;
    const dist = this.movement.getCurrentTotalDistance();
    this.moveDistLabel.textContent = dist.toFixed(1) + '" moved';
    this.moveDistLabel.classList.remove('hidden');

    const rect = this.canvas.getBoundingClientRect();
    this.moveDistLabel.style.left = (mouseX - rect.left + 15) + 'px';
    this.moveDistLabel.style.top = (mouseY - rect.top - 10) + 'px';
  }

  _showDistanceLabelAtModel() {
    if (!this.moveDistLabel || !this.movement.model) return;
    const dist = this.movement.getCurrentTotalDistance();
    this.moveDistLabel.textContent = dist.toFixed(1) + '" moved';
    this.moveDistLabel.classList.remove('hidden');

    const px = this.movement.model.x * this.scale * this.zoom + this.panX;
    const py = this.movement.model.y * this.scale * this.zoom + this.panY;
    const r = this.movement.model.radiusInches * this.scale * this.zoom;

    this.moveDistLabel.style.left = (px + r + 10) + 'px';
    this.moveDistLabel.style.top = (py - 12) + 'px';
  }

  // ============================================================
  // RESIZE & SCALE
  // ============================================================

  _resize() {
    const wrapper = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    // Calculate scale to fit board in viewport with padding
    const padding = 40;
    const scaleX = (w - padding) / this.boardW;
    const scaleY = (h - padding) / this.boardH;
    this.scale = Math.min(scaleX, scaleY);

    // Center the board
    this.panX = (w - this.boardW * this.scale * this.zoom) / 2;
    this.panY = (h - this.boardH * this.scale * this.zoom) / 2;
  }

  // ============================================================
  // RENDER LOOP
  // ============================================================

  _startRenderLoop() {
    const render = () => {
      this._render();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  _render() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Apply DPR scaling
    ctx.save();
    ctx.scale(dpr, dpr);

    // Apply pan & zoom
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    const effectiveScale = this.scale;

    // Draw grid
    drawGrid(ctx, this.boardW, this.boardH, effectiveScale);

    // Draw deployment zones
    if (this.deployZones) {
      drawDeploymentZones(ctx, this.deployZones, effectiveScale);
    }

    // Draw movement trail
    if (this.movement.isActive()) {
      this.movement.drawTrail(ctx, effectiveScale);
    }

    // Draw measurement lines (when model selected but not being moved)
    if (this.selectedModel && !this.movement.isActive()) {
      drawMeasurementLines(ctx, this.selectedModel, this.models, effectiveScale);
    }

    // Draw all models
    for (const model of this.models) {
      const isSelected = this.selectedModel?.id === model.id;
      const isHovered = this.hoveredModel?.id === model.id && !isSelected;
      drawModel(ctx, model, effectiveScale, isSelected, isHovered);
    }

    ctx.restore(); // pan & zoom
    ctx.restore(); // dpr
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /** Add a model to the board */
  addModel(model) {
    this.models.push(model);
  }

  /** Remove a model from the board */
  removeModel(modelId) {
    this.models = this.models.filter(m => m.id !== modelId);
  }

  /** Select a specific model programmatically */
  selectModel(model) {
    this.selectedModel = model;
    this.callbacks.onSelectModel?.(model);
  }

  /** Get all models */
  getModels() {
    return this.models;
  }

  /** Center the view on the board */
  centerView() {
    const wrapper = this.canvas.parentElement;
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    this.zoom = 1;
    this.panX = (w - this.boardW * this.scale) / 2;
    this.panY = (h - this.boardH * this.scale) / 2;
  }
}
