// ─── Warp Core Breach Engine ──────────────────────────────────────────────────

export type Direction = 'N' | 'E' | 'S' | 'W';

/** Every pipe has exactly two openings.  The pair is canonically sorted. */
export type PipeType =
  | 'NS'   // straight vertical
  | 'EW'   // straight horizontal
  | 'NE'   // curve
  | 'NW'   // curve
  | 'SE'   // curve
  | 'SW'   // curve
  | 'CROSS'; // cross (water can flow both ways simultaneously)

export type CellContent =
  | { kind: 'empty' }
  | { kind: 'pipe'; type: PipeType; filled: boolean; fillPct: number }
  | { kind: 'start'; openings: [Direction, Direction]; filled: boolean }
  | { kind: 'wall' };

export interface GridCell {
  content: CellContent;
}

export interface GameState {
  cols: number;
  rows: number;
  cells: GridCell[];
  startIdx: number;
  startDir: Direction;
  queue: PipeType[];
  flowCountdown: number;
  flowing: boolean;
  flowIdx: number;
  flowPct: number;
  score: number;
  gameOver: boolean;
  victory: boolean;
}

// ── Pipe geometry ─────────────────────────────────────────────────────────────

const PIPE_OPENINGS: Record<PipeType, [Direction, Direction]> = {
  NS:    ['N', 'S'],
  EW:    ['E', 'W'],
  NE:    ['N', 'E'],
  NW:    ['N', 'W'],
  SE:    ['S', 'E'],
  SW:    ['S', 'W'],
  CROSS: ['N', 'S'],
};

const OPPOSITE: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };

export function getOpposite(d: Direction): Direction {
  return OPPOSITE[d];
}

export function getExit(type: PipeType, enterFrom: Direction): Direction | null {
  if (type === 'CROSS') {
    return OPPOSITE[enterFrom];
  }
  const [a, b] = PIPE_OPENINGS[type];
  if (enterFrom === a) return b;
  if (enterFrom === b) return a;
  return null;
}

export function hasOpening(type: PipeType, dir: Direction): boolean {
  if (type === 'CROSS') return true;
  const [a, b] = PIPE_OPENINGS[type];
  return a === dir || b === dir;
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

export function idxToRC(idx: number, cols: number): { r: number; c: number } {
  return { r: Math.floor(idx / cols), c: idx % cols };
}

export function rcToIdx(r: number, c: number, cols: number): number {
  return r * cols + c;
}

export function neighbourIdx(idx: number, dir: Direction, cols: number, rows: number): number | null {
  const { r, c } = idxToRC(idx, cols);
  const nr = r + (dir === 'S' ? 1 : dir === 'N' ? -1 : 0);
  const nc = c + (dir === 'E' ? 1 : dir === 'W' ? -1 : 0);
  if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return null;
  return rcToIdx(nr, nc, cols);
}

// ── Queue generation ──────────────────────────────────────────────────────────

const PIPE_POOL: PipeType[] = [
  'NE', 'NE', 'NW', 'NW', 'SE', 'SE', 'SW', 'SW',
  'NS', 'NS', 'EW', 'EW',
  'CROSS',
];

export function randomPipe(rng: () => number = Math.random): PipeType {
  return PIPE_POOL[Math.floor(rng() * PIPE_POOL.length)];
}

export function generateQueue(length: number, rng?: () => number): PipeType[] {
  return Array.from({ length }, () => randomPipe(rng));
}

// ── State construction ────────────────────────────────────────────────────────

export function makeEmptyGrid(cols: number, rows: number): GridCell[] {
  return Array.from({ length: cols * rows }, () => ({ content: { kind: 'empty' } as CellContent }));
}

export function placePipe(
  cells: GridCell[],
  idx: number,
  type: PipeType,
): GridCell[] {
  const next = cells.map(c => ({ ...c, content: { ...c.content } as CellContent }));
  next[idx] = { content: { kind: 'pipe', type, filled: false, fillPct: 0 } };
  return next;
}

// ── Flow logic ────────────────────────────────────────────────────────────────

export interface FlowStep {
  cellIdx: number;
  enteredFrom: Direction;
  exitDir: Direction;
}

export function advanceFlow(
  state: GameState,
  currentIdx: number,
  exitDir: Direction,
): { next: FlowStep; escaped: false } | { next: null; escaped: boolean } {
  const { cols, rows, cells } = state;
  const neighbourI = neighbourIdx(currentIdx, exitDir, cols, rows);
  
  if (neighbourI === null) return { next: null, escaped: true };
  
  const neighbour = cells[neighbourI].content;
  
  if (neighbour.kind === 'wall')  return { next: null, escaped: true };
  if (neighbour.kind === 'empty') return { next: null, escaped: true };
  
  if (neighbour.kind === 'pipe') {
    const enterFrom = getOpposite(exitDir);
    const nextExit = getExit(neighbour.type, enterFrom);
    if (nextExit === null)    return { next: null, escaped: true };
    if (neighbour.filled)     return { next: null, escaped: true };
    return {
      next: { cellIdx: neighbourI, enteredFrom: enterFrom, exitDir: nextExit },
      escaped: false,
    };
  }
  
  return { next: null, escaped: true };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export const BASE_POINTS = 50;
export const SPEED_BONUS = 100;

export function scoreForPipe(speedy: boolean): number {
  return BASE_POINTS + (speedy ? SPEED_BONUS : 0);
}

// ── Serialise / deserialise ───────────────────────────────────────────────────

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(raw: string): GameState {
  return JSON.parse(raw) as GameState;
}