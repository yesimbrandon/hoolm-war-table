/**
 * Measurement — draws distance lines from a selected model to all others.
 */

/**
 * Draw measurement lines from the selected model to all other models.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../models/model-entity.js').ModelEntity} selected
 * @param {import('../models/model-entity.js').ModelEntity[]} allModels
 * @param {number} scale — pixels per inch
 */
export function drawMeasurementLines(ctx, selected, allModels, scale) {
  for (const other of allModels) {
    if (other.id === selected.id) continue;
    if (!other.alive) continue;

    const dist = selected.distanceTo(other);

    // Calculate edge points for the line
    const dx = other.x - selected.x;
    const dy = other.y - selected.y;
    const centerDist = Math.sqrt(dx * dx + dy * dy);
    if (centerDist < 0.01) continue;

    const nx = dx / centerDist;
    const ny = dy / centerDist;

    // Start from selected model's edge, end at other model's edge
    const sx = (selected.x + nx * selected.radiusInches) * scale;
    const sy = (selected.y + ny * selected.radiusInches) * scale;
    const ex = (other.x - nx * other.radiusInches) * scale;
    const ey = (other.y - ny * other.radiusInches) * scale;

    // Color: green if within speed, orange if within 2x speed, white otherwise
    const speed = selected.speed;
    let color = 'rgba(255, 255, 255, 0.35)';
    let textColor = '#A4B0BE';
    if (typeof speed === 'number') {
      if (dist <= speed) {
        color = 'rgba(46, 213, 115, 0.5)';
        textColor = '#2ED573';
      } else if (dist <= speed * 2) {
        color = 'rgba(255, 193, 7, 0.4)';
        textColor = '#FFC107';
      }
    }

    // Draw dashed line
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Draw distance label at midpoint
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const label = dist.toFixed(1) + '"';

    ctx.save();
    ctx.font = '600 10px Inter, sans-serif';
    const textWidth = ctx.measureText(label).width;
    
    // Background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    const pillPad = 4;
    const pillH = 14;
    ctx.beginPath();
    roundRect(ctx, mx - textWidth / 2 - pillPad, my - pillH / 2, textWidth + pillPad * 2, pillH, 4);
    ctx.fill();

    // Text
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, mx, my);
    ctx.restore();
  }
}

/** Helper: draw a rounded rectangle path */
function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}
