/**
 * Deployment Zones — calculates and draws deployment zone rectangles or corner arcs.
 */

/**
 * Calculates two deployment zones based on deployment style.
 * @param {string} style — 'top-bottom' | 'side-side' | 'corners'
 * @param {number} boardW — board width in inches
 * @param {number} boardH — board height in inches
 * @param {number} depth — deployment zone depth in inches
 * @returns {{ p1: Object, p2: Object }}
 */
export function calcDeploymentZones(style, boardW, boardH, depth) {
  switch (style) {
    case 'top-bottom':
      return {
        p1: { type: 'rect', x: 0, y: 0, w: boardW, h: depth },
        p2: { type: 'rect', x: 0, y: boardH - depth, w: boardW, h: depth },
      };
    case 'side-side':
      return {
        p1: { type: 'rect', x: 0, y: 0, w: depth, h: boardH },
        p2: { type: 'rect', x: boardW - depth, y: 0, w: depth, h: boardH },
      };
    case 'corners': {
      // Semi-circle / quarter-circle arc from corners
      // Corner radius is proportioned to give ample room for 5 models (~11-12 inches on 48x48)
      const radius = Math.max(10, Math.min(boardW, boardH) * 0.24);
      return {
        p1: { type: 'corner-arc', corner: 'top-left', cx: 0, cy: 0, radius },
        p2: { type: 'corner-arc', corner: 'bottom-right', cx: boardW, cy: boardH, radius },
      };
    }
    default:
      return calcDeploymentZones('top-bottom', boardW, boardH, depth);
  }
}

/**
 * Draw deployment zones on the canvas.
 */
export function drawDeploymentZones(ctx, zones, scale) {
  // Player 1 zone — blue tint
  ctx.fillStyle = 'rgba(74, 158, 255, 0.12)';
  ctx.strokeStyle = 'rgba(74, 158, 255, 0.4)';
  ctx.lineWidth = 1.5;
  drawZone(ctx, zones.p1, scale, '#4a9eff');

  // Player 2 zone — red tint
  ctx.fillStyle = 'rgba(255, 92, 92, 0.12)';
  ctx.strokeStyle = 'rgba(255, 92, 92, 0.4)';
  ctx.lineWidth = 1.5;
  drawZone(ctx, zones.p2, scale, '#ff5c5c');
}

function drawZone(ctx, zone, scale, strokeColor) {
  if (zone.type === 'corner-arc') {
    drawZoneArc(ctx, zone, scale, strokeColor);
  } else {
    drawZoneRect(ctx, zone, scale, strokeColor);
  }
}

function drawZoneRect(ctx, zone, scale, strokeColor) {
  const x = zone.x * scale;
  const y = zone.y * scale;
  const w = zone.w * scale;
  const h = zone.h * scale;

  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();

  // Hatch lines
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;

  const spacing = 14;
  for (let i = -Math.max(w, h); i < Math.max(w, h) * 2; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
    ctx.stroke();
  }

  ctx.restore();
}

function drawZoneArc(ctx, zone, scale, strokeColor) {
  const cx = zone.cx * scale;
  const cy = zone.cy * scale;
  const r = zone.radius * scale;

  let startAngle = 0;
  let endAngle = Math.PI / 2;

  if (zone.corner === 'bottom-right') {
    startAngle = Math.PI;
    endAngle = 3 * Math.PI / 2;
  }

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hatch lines inside arc
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.closePath();
  ctx.clip();

  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;

  const spacing = 14;
  const bound = r * 2;
  for (let i = -bound; i < bound * 2; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(cx - r + i, cy - r);
    ctx.lineTo(cx - r + i + bound, cy - r + bound);
    ctx.stroke();
  }

  ctx.restore();
}
