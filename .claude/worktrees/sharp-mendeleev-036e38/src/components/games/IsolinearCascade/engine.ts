export type CellState = boolean; // true = lit, false = dark

export const GRID_SIZE = 5; // default puzzle grid side-length

// ── Board generation ──────────────────────────────────────────────────────────

/**
 * Returns the flat indices of a cell and its orthogonal neighbours
 * within a grid of `size` columns/rows.
 */
export function getAffectedCells(idx: number, size: number): number[] {
  const cells: number[] = [idx];
  const r = Math.floor(idx / size);
  const c = idx % size;
  if (r > 0)        cells.push(idx - size); // up
  if (r < size - 1) cells.push(idx + size); // down
  if (c > 0)        cells.push(idx - 1);    // left
  if (c < size - 1) cells.push(idx + 1);    // right
  return cells;
}

/**
 * Returns a new board with the clicked cell and all orthogonal neighbours toggled.
 */
export function applyToggle(board: CellState[], idx: number, size: number): CellState[] {
  const next = [...board];
  for (const i of getAffectedCells(idx, size)) {
    next[i] = !next[i];
  }
  return next;
}

/**
 * A puzzle is solved when every cell is dark.
 */
export function checkWin(board: CellState[]): boolean {
  return board.every(cell => !cell);
}

/**
 * Counts the number of lit cells.
 */
export function countLit(board: CellState[]): number {
  return board.filter(Boolean).length;
}

/**
 * Serialises a board to a compact string for storage / comparison.
 * e.g. [true, false, true] → "101"
 */
export function boardToString(board: CellState[]): string {
  return board.map(c => (c ? '1' : '0')).join('');
}

/**
 * Deserialises a board string back to a CellState array.
 */
export function stringToBoard(str: string): CellState[] {
  return str.split('').map(c => c === '1');
}
