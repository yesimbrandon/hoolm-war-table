/**
 * BoardRenderer — handles all canvas draw calls.
 */

/**
 * Draw the board background and inch grid.
 */
export function drawGrid(ctx, boardW, boardH, scale, panX, panY) {
  const w = boardW * scale;
  const h = boardH * scale;

  // Board background
  ctx.fillStyle = '#1a1d2e';
  ctx.fillRect(0, 0, w, h);

  // Board border
  ctx.strokeStyle = '#3a4268';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);

  // Minor grid (1-inch)
  ctx.strokeStyle = 'rgba(58, 66, 104, 0.3)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= boardW; x++) {
    ctx.beginPath();
    ctx.moveTo(x * scale, 0);
    ctx.lineTo(x * scale, h);
    ctx.stroke();
  }
  for (let y = 0; y <= boardH; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * scale);
    ctx.lineTo(w, y * scale);
    ctx.stroke();
  }

  // Major grid (6-inch) — slightly brighter
  ctx.strokeStyle = 'rgba(58, 66, 104, 0.55)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= boardW; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x * scale, 0);
    ctx.lineTo(x * scale, h);
    ctx.stroke();
  }
  for (let y = 0; y <= boardH; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y * scale);
    ctx.lineTo(w, y * scale);
    ctx.stroke();
  }

  // Edge inch markers
  ctx.fillStyle = 'rgba(164, 176, 190, 0.3)';
  ctx.font = '500 8px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = 0; x <= boardW; x += 6) {
    ctx.fillText(x + '"', x * scale, 3);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let y = 6; y <= boardH; y += 6) {
    ctx.fillText(y + '"', 3, y * scale);
  }
}

/**
 * Draw a single model on the canvas.
 */
export function drawModel(ctx, model, scale, isSelected, isHovered) {
  const cx = model.x * scale;
  const cy = model.y * scale;
  const r = model.radiusInches * scale;

  // Outer glow if selected
  if (isSelected) {
    ctx.save();
    ctx.shadowColor = model.getTeamColor();
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = model.getTeamColor();
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Fill
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = model.getTeamFill();
  ctx.fill();

  // Ring
  ctx.strokeStyle = isSelected
    ? model.getTeamColor()
    : (isHovered ? model.getTeamColor() : adjustAlpha(model.getTeamColor(), 0.5));
  ctx.lineWidth = isSelected ? 2.5 : (isHovered ? 2 : 1.5);
  ctx.stroke();

  // HP arc (around the outside of the ring)
  if (model.maxHp > 0 && !model.isTitan) {
    const hpFrac = Math.max(0, model.hp / model.maxHp);
    const hpAngle = hpFrac * Math.PI * 2;
    const hpColor = hpFrac > 0.6 ? '#2ED573' : (hpFrac > 0.3 ? '#FFC107' : '#FF4757');

    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + hpAngle);
    ctx.strokeStyle = hpColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // Titan HP bar (thicker)
  if (model.isTitan && model.maxHp > 0) {
    const hpFrac = Math.max(0, model.hp / model.maxHp);
    const hpAngle = hpFrac * Math.PI * 2;
    const hpColor = hpFrac > 0.6 ? '#2ED573' : (hpFrac > 0.3 ? '#FFC107' : '#FF4757');

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // HP arc
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, -Math.PI / 2, -Math.PI / 2 + hpAngle);
    ctx.strokeStyle = hpColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // Model name
  ctx.save();
  ctx.fillStyle = '#F1F2F6';
  const fontSize = Math.max(7, Math.min(11, r * 0.6));
  ctx.font = `700 ${fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Truncate long names
  let displayName = model.name;
  if (ctx.measureText(displayName).width > r * 1.6) {
    // Try first name / abbreviation
    const parts = displayName.split(' ');
    if (parts.length > 1) {
      displayName = parts[0].length > 8 ? parts[0].substring(0, 7) + '…' : parts[0];
    } else {
      displayName = displayName.substring(0, 7) + '…';
    }
  }
  ctx.fillText(displayName, cx, cy);
  ctx.restore();

  // Activation icon
  if (model.activated) {
    const iconR = Math.max(6, r * 0.25);
    const iconX = cx + r * 0.7;
    const iconY = cy - r * 0.7;

    ctx.beginPath();
    ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
    ctx.fillStyle = '#00ADB5';
    ctx.fill();
    ctx.strokeStyle = '#0D0F17';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `700 ${iconR}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', iconX, iconY + 0.5);
  }

  // Token Badge (Secret Token / Illusion Token)
  if (model.secretToken) {
    const tokenR = Math.max(7, r * 0.28);
    const tokenX = cx - r * 0.7;
    const tokenY = cy - r * 0.7;

    ctx.beginPath();
    ctx.arc(tokenX, tokenY, tokenR, 0, Math.PI * 2);
    ctx.fillStyle = model.tokenRevealed
      ? (model.secretToken === 'real' ? '#2ED573' : '#FF4757')
      : '#FFC107';
    ctx.fill();
    ctx.strokeStyle = '#0D0F17';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#0D0F17';
    ctx.font = `700 ${Math.max(9, tokenR * 1.1)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = !model.tokenRevealed ? '?' : (model.secretToken === 'real' ? '★' : '✗');
    ctx.fillText(label, tokenX, tokenY + 0.5);
  }

  // Illusion dashed outline ring indicator
  if (model.isIllusion) {
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#FFC107';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Dead overlay
  if (!model.alive) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();

    // X mark
    ctx.strokeStyle = '#FF4757';
    ctx.lineWidth = 2;
    const xSize = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - xSize, cy - xSize);
    ctx.lineTo(cx + xSize, cy + xSize);
    ctx.moveTo(cx + xSize, cy - xSize);
    ctx.lineTo(cx - xSize, cy + xSize);
    ctx.stroke();
  }
}

/**
 * Adjust color alpha (simple approach for hex colors).
 */
function adjustAlpha(hexColor, alpha) {
  if (hexColor.startsWith('rgba')) return hexColor;
  // Convert hex to rgba
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
