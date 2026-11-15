/**
 * Movement System — handles multi-segment drag movement with confirm/cancel.
 *
 * State machine:
 *   IDLE → click model → SELECTED
 *   SELECTED → drag → MOVING
 *   MOVING → release → AWAITING_CONFIRM
 *   AWAITING_CONFIRM → ✓ → IDLE (confirmed)
 *   AWAITING_CONFIRM → ✗ → IDLE (cancelled, snap back)
 *   AWAITING_CONFIRM → drag again → MOVING (cumulative)
 */

export class MovementSystem {
  constructor() {
    this.state = 'IDLE';       // IDLE | SELECTED | MOVING | AWAITING_CONFIRM
    this.model = null;         // The model being moved
    this.totalDistance = 0;    // Cumulative distance across all segments
    this.segmentStartX = 0;   // Where the current drag segment started
    this.segmentStartY = 0;
    this.pathPoints = [];     // Array of {x, y} for the trail
    this.originX = 0;         // Original position before any movement
    this.originY = 0;
    this._currentSegmentDist = 0;
  }

  /**
   * Begin a move for a model. Called when user starts dragging a selected model.
   */
  startMove(model) {
    if (this.state === 'AWAITING_CONFIRM' && this.model && this.model.id === model.id) {
      // Resuming an existing move — continue accumulating
      this.state = 'MOVING';
      this.segmentStartX = model.x;
      this.segmentStartY = model.y;
      this.pathPoints.push({ x: model.x, y: model.y });
      return;
    }

    // Fresh move
    this.model = model;
    this.totalDistance = 0;
    this._currentSegmentDist = 0;
    this.originX = model.x;
    this.originY = model.y;
    this.segmentStartX = model.x;
    this.segmentStartY = model.y;
    this.pathPoints = [{ x: model.x, y: model.y }];
    this.state = 'MOVING';
    model.saveMoveOrigin();
  }

  /**
   * Update during drag — call each frame while dragging.
   * @param {number} newX — new position in inches
   * @param {number} newY — new position in inches
   */
  updateDrag(newX, newY) {
    if (this.state !== 'MOVING' || !this.model) return;

    this.model.x = newX;
    this.model.y = newY;

    // Calculate segment distance
    const dx = newX - this.segmentStartX;
    const dy = newY - this.segmentStartY;
    this._currentSegmentDist = Math.sqrt(dx * dx + dy * dy);

    // Track path
    const last = this.pathPoints[this.pathPoints.length - 1];
    if (last) {
      const pdx = newX - last.x;
      const pdy = newY - last.y;
      if (Math.sqrt(pdx * pdx + pdy * pdy) > 0.1) {
        this.pathPoints.push({ x: newX, y: newY });
      }
    }
  }

  /**
   * End the current drag segment (mouse up).
   */
  endDrag() {
    if (this.state !== 'MOVING' || !this.model) return;

    // Finalize segment
    this.totalDistance += this._currentSegmentDist;
    this._currentSegmentDist = 0;
    this.segmentStartX = this.model.x;
    this.segmentStartY = this.model.y;
    this.state = 'AWAITING_CONFIRM';
  }

  /**
   * Confirm the move — model stays in place.
   */
  confirmMove() {
    if (!this.model) return;
    this.state = 'IDLE';
    this.totalDistance = 0;
    this._currentSegmentDist = 0;
    this.pathPoints = [];
    this.model = null;
  }

  /**
   * Cancel the move — model snaps back to original position.
   */
  cancelMove() {
    if (!this.model) return;
    this.model.x = this.originX;
    this.model.y = this.originY;
    this.state = 'IDLE';
    this.totalDistance = 0;
    this._currentSegmentDist = 0;
    this.pathPoints = [];
    this.model = null;
  }

  /** Get total distance including current segment being dragged */
  getCurrentTotalDistance() {
    return this.totalDistance + this._currentSegmentDist;
  }

  /** Is this system actively tracking a move? */
  isActive() {
    return this.state === 'MOVING' || this.state === 'AWAITING_CONFIRM';
  }

  /** Is the confirm/cancel UI needed? */
  needsConfirmUI() {
    return this.state === 'AWAITING_CONFIRM';
  }

  /**
   * Draw the movement trail on the canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} scale — pixels per inch
   */
  drawTrail(ctx, scale) {
    if (this.pathPoints.length < 2) return;

    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(255, 193, 7, 0.5)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(this.pathPoints[0].x * scale, this.pathPoints[0].y * scale);
    for (let i = 1; i < this.pathPoints.length; i++) {
      ctx.lineTo(this.pathPoints[i].x * scale, this.pathPoints[i].y * scale);
    }
    // Also draw to current model position
    if (this.model) {
      ctx.lineTo(this.model.x * scale, this.model.y * scale);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Draw origin marker
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 193, 7, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(this.originX * scale, this.originY * scale, (this.model?.radiusInches || 1) * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}
