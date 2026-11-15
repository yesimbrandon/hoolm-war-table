/**
 * Titan Placement — auto-places titans equidistant from both deployment zones.
 */

/**
 * Calculate titan placement positions.
 * @param {string} deployStyle — 'top-bottom' | 'side-side' | 'corners'
 * @param {number} boardW — board width in inches
 * @param {number} boardH — board height in inches
 * @param {number} depth — deployment zone depth in inches
 * @param {number} titanCount — number of titans (usually 2)
 * @returns {Array<{x: number, y: number}>} — array of positions (center of titan)
 */
export function calcTitanPositions(deployStyle, boardW, boardH, depth, titanCount = 2) {
  // The midline is equidistant from both deployment zone edges.
  // We then split that midline into equal segments, one titan per segment center.

  switch (deployStyle) {
    case 'top-bottom': {
      // Deployment zones at top (0 to depth) and bottom (boardH-depth to boardH)
      // Midline is horizontal at y = boardH / 2
      const midY = boardH / 2;
      // Divide the width into titanCount equal sections
      const positions = [];
      for (let i = 0; i < titanCount; i++) {
        const segWidth = boardW / titanCount;
        const x = segWidth * i + segWidth / 2;
        positions.push({ x, y: midY });
      }
      return positions;
    }

    case 'side-side': {
      // Deployment zones at left (0 to depth) and right (boardW-depth to boardW)
      // Midline is vertical at x = boardW / 2
      const midX = boardW / 2;
      const positions = [];
      for (let i = 0; i < titanCount; i++) {
        const segHeight = boardH / titanCount;
        const y = segHeight * i + segHeight / 2;
        positions.push({ x: midX, y });
      }
      return positions;
    }

    case 'corners': {
      // Deployment at top-left and bottom-right corners
      // Midline is the diagonal — but for practical placement,
      // we use the center of the board and offset titans along the anti-diagonal
      const cx = boardW / 2;
      const cy = boardH / 2;
      const offset = Math.min(boardW, boardH) * 0.18;
      return [
        { x: cx - offset, y: cy + offset },
        { x: cx + offset, y: cy - offset },
      ];
    }

    default:
      return calcTitanPositions('top-bottom', boardW, boardH, depth, titanCount);
  }
}
