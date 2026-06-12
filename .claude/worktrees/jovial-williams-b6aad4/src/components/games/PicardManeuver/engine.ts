export type PieceColor = 0 | 1 | 2; // 0: empty, 1: white, 2: black

export interface Position {
  x: number;
  y: number;
}

export const BOARD_SIZE = 8;

export const directions = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 },                  { x: 1, y: 0 },
  { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 },
];

export function getInitialBoard(): PieceColor[][] {
  const board: PieceColor[][] = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
  // Initial setup:
  // (3,3) = White (1), (4,4) = White (1)
  // (3,4) = Black (2), (4,3) = Black (2)
  board[3][3] = 1;
  board[4][4] = 1;
  board[3][4] = 2;
  board[4][3] = 2;
  return board;
}

export function isValidMove(board: PieceColor[][], x: number, y: number, color: PieceColor): boolean {
  if (board[y][x] !== 0) return false;

  const opponent = color === 1 ? 2 : 1;

  for (const dir of directions) {
    let curX = x + dir.x;
    let curY = y + dir.y;
    let hasOpponentBetween = false;

    while (curX >= 0 && curX < BOARD_SIZE && curY >= 0 && curY < BOARD_SIZE) {
      if (board[curY][curX] === opponent) {
        hasOpponentBetween = true;
      } else if (board[curY][curX] === color) {
        if (hasOpponentBetween) return true;
        break;
      } else {
        break;
      }
      curX += dir.x;
      curY += dir.y;
    }
  }

  return false;
}

export function getAllValidMoves(board: PieceColor[][], color: PieceColor): Position[] {
  const moves: Position[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (isValidMove(board, x, y, color)) {
        moves.push({ x, y });
      }
    }
  }
  return moves;
}

export function makeMove(board: PieceColor[][], x: number, y: number, color: PieceColor): PieceColor[][] | null {
  if (!isValidMove(board, x, y, color)) return null;

  const newBoard = board.map(row => [...row]);
  newBoard[y][x] = color;
  const opponent = color === 1 ? 2 : 1;

  for (const dir of directions) {
    let curX = x + dir.x;
    let curY = y + dir.y;
    const toFlip: Position[] = [];

    while (curX >= 0 && curX < BOARD_SIZE && curY >= 0 && curY < BOARD_SIZE) {
      if (newBoard[curY][curX] === opponent) {
        toFlip.push({ x: curX, y: curY });
      } else if (newBoard[curY][curX] === color) {
        for (const pos of toFlip) {
          newBoard[pos.y][pos.x] = color;
        }
        break;
      } else {
        break;
      }
      curX += dir.x;
      curY += dir.y;
    }
  }

  return newBoard;
}

export function countDiscs(board: PieceColor[][]): { white: number; black: number } {
  let white = 0;
  let black = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 1) white++;
      if (cell === 2) black++;
    }
  }
  return { white, black };
}

export function boardToString(board: PieceColor[][]): string {
  return board.flat().join('');
}

export function stringToBoard(str: string): PieceColor[][] {
  const board: PieceColor[][] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const row = str.substring(i * BOARD_SIZE, (i + 1) * BOARD_SIZE)
                   .split('')
                   .map(c => parseInt(c) as PieceColor);
    board.push(row);
  }
  return board;
}
