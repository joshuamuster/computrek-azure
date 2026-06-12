import { PieceData } from './puzzles';

export const GRID_SIZE = 6;

/**
 * Checks if a move is valid and returns the new position if it is.
 * In Rush Hour, pieces move along their axis.
 */
export function isColliding(x: number, y: number, length: number, orientation: 'horizontal' | 'vertical', other: PieceData): boolean {
  const p1Cells = [];
  for (let i = 0; i < length; i++) {
    p1Cells.push(orientation === 'horizontal' ? { x: x + i, y } : { x, y: y + i });
  }

  const p2Cells = [];
  for (let i = 0; i < other.length; i++) {
    p2Cells.push(other.orientation === 'horizontal' ? { x: other.x + i, y: other.y } : { x: other.x, y: other.y + i });
  }

  return p1Cells.some(c1 => p2Cells.some(c2 => c1.x === c2.x && c1.y === c2.y));
}

export function getValidMoveRange(piece: PieceData, allPieces: PieceData[]) {
  let min = 0;
  let max = GRID_SIZE - piece.length;

  if (piece.orientation === 'horizontal') {
    // Check left
    for (let x = piece.x - 1; x >= 0; x--) {
      if (allPieces.some(other => other.id !== piece.id && isColliding(x, piece.y, piece.length, 'horizontal', other))) {
        min = x + 1;
        break;
      }
    }
    // Check right
    for (let x = piece.x + 1; x <= GRID_SIZE - piece.length; x++) {
      if (allPieces.some(other => other.id !== piece.id && isColliding(x, piece.y, piece.length, 'horizontal', other))) {
        max = x - 1;
        break;
      }
    }
    return { min, max };
  } else {
    // Check up
    for (let y = piece.y - 1; y >= 0; y--) {
      if (allPieces.some(other => other.id !== piece.id && isColliding(piece.x, y, piece.length, 'vertical', other))) {
        min = y + 1;
        break;
      }
    }
    // Check down
    for (let y = piece.y + 1; y <= GRID_SIZE - piece.length; y++) {
      if (allPieces.some(other => other.id !== piece.id && isColliding(piece.x, y, piece.length, 'vertical', other))) {
        max = y - 1;
        break;
      }
    }
    return { min, max };
  }
}

export function checkWin(pieces: PieceData[]): boolean {
  const shuttle = pieces.find(p => p.type === 'shuttle');
  if (!shuttle) return false;
  return shuttle.x + shuttle.length === GRID_SIZE;
}
