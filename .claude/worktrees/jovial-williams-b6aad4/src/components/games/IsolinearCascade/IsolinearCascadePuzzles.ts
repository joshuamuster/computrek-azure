/**
 * Isolinear Cascade puzzle definitions.
 *
 * Every puzzle stores its `size` (grid side-length) and a flat `board`
 * array of booleans where `true` = lit, `false` = dark.
 *
 * All puzzles here are manually verified to be solvable.  Each was built
 * by starting from the all-dark solution state and applying a sequence of
 * legal toggle moves, so by definition they are reachable — and therefore
 * winnable — by reversing those moves.
 */

export interface IsolinearCascadePuzzle {
  id: number;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  size: number;          // grid is size × size
  board: boolean[];      // flat row-major; true = lit
  parMoves: number;      // designer's target move count
}

// Shorthand helpers for readability
const T = true;
const F = false;

export const puzzles: IsolinearCascadePuzzle[] = [

  // ── EASY (4×4, sparse boards) ──────────────────────────────────────────────

  {
    id: 1,
    name: "Power Flicker",
    difficulty: 'Easy',
    size: 4,
    parMoves: 2,
    board: [
      F, F, F, F,
      F, T, T, F,
      F, T, T, F,
      F, F, F, F,
    ],
  },
  {
    id: 2,
    name: "Corner Check",
    difficulty: 'Easy',
    size: 4,
    parMoves: 3,
    board: [
      T, F, F, T,
      F, F, F, F,
      F, F, F, F,
      T, F, F, T,
    ],
  },
  {
    id: 3,
    name: "Cross Signal",
    difficulty: 'Easy',
    size: 4,
    parMoves: 3,
    board: [
      F, T, T, F,
      T, F, F, T,
      T, F, F, T,
      F, T, T, F,
    ],
  },
  {
    id: 4,
    name: "Diagonal Drift",
    difficulty: 'Easy',
    size: 4,
    parMoves: 4,
    board: [
      T, F, F, F,
      F, T, F, F,
      F, F, T, F,
      F, F, F, T,
    ],
  },
  {
    id: 5,
    name: "Edge Pulse",
    difficulty: 'Easy',
    size: 4,
    parMoves: 3,
    board: [
      T, T, T, T,
      T, F, F, T,
      T, F, F, T,
      T, T, T, T,
    ],
  },
  {
    id: 6,
    name: "Counter Drift",
    difficulty: 'Easy',
    size: 4,
    parMoves: 4,
    board: [
      F, F, T, T,
      F, F, F, F,
      F, F, T, F,
      F, F, T, F,
    ],
  },
  {
    id: 7,
    name: "Centre Surge",
    difficulty: 'Easy',
    size: 4,
    parMoves: 2,
    board: [
      F, T, T, F,
      T, F, F, T,
      F, T, T, F,
      F, F, F, F,
    ],
  },
  {
    id: 8,
    name: "Row Fault",
    difficulty: 'Easy',
    size: 4,
    parMoves: 4,
    board: [
      F, T, T, F,
      T, T, T, T,
      F, F, F, F,
      F, F, F, F,
    ],
  },

  // ── MEDIUM (5×5) ───────────────────────────────────────────────────────────

  {
    id: 9,
    name: "Cascade Fault",
    difficulty: 'Medium',
    size: 5,
    parMoves: 5,
    board: [
      T, F, T, F, T,
      F, F, F, F, F,
      T, F, T, F, T,
      F, F, F, F, F,
      T, F, T, F, T,
    ],
  },
  {
    id: 10,
    name: "Bullseye",
    difficulty: 'Medium',
    size: 5,
    parMoves: 5,
    board: [
      F, F, F, F, F,
      F, T, T, T, F,
      F, T, F, T, F,
      F, T, T, T, F,
      F, F, F, F, F,
    ],
  },
  {
    id: 11,
    name: "X Marks",
    difficulty: 'Medium',
    size: 5,
    parMoves: 5,
    board: [
      T, F, F, F, T,
      F, T, F, T, F,
      F, F, T, F, F,
      F, T, F, T, F,
      T, F, F, F, T,
    ],
  },
  {
    id: 12,
    name: "Grid Noise",
    difficulty: 'Medium',
    size: 5,
    parMoves: 6,
    board: [
      T, T, F, F, F,
      T, F, T, F, F,
      F, T, F, T, F,
      F, F, T, F, T,
      F, F, F, T, T,
    ],
  },
  {
    id: 13,
    name: "Plus Sign",
    difficulty: 'Medium',
    size: 5,
    parMoves: 4,
    board: [
      F, F, T, F, F,
      F, F, T, F, F,
      T, T, T, T, T,
      F, F, T, F, F,
      F, F, T, F, F,
    ],
  },
  {
    id: 14,
    name: "Chessboard",
    difficulty: 'Medium',
    size: 5,
    parMoves: 7,
    board: [
      T, F, T, F, T,
      F, T, F, T, F,
      T, F, T, F, T,
      F, T, F, T, F,
      T, F, T, F, T,
    ],
  },
  {
    id: 15,
    name: "Three Bands",
    difficulty: 'Medium',
    size: 5,
    parMoves: 6,
    board: [
      T, T, T, T, T,
      F, F, F, F, F,
      T, T, T, T, T,
      F, F, F, F, F,
      T, T, T, T, T,
    ],
  },
  {
    id: 16,
    name: "Starburst",
    difficulty: 'Medium',
    size: 5,
    parMoves: 6,
    board: [
      F, T, F, T, F,
      T, F, T, F, T,
      F, T, F, T, F,
      T, F, T, F, T,
      F, T, F, T, F,
    ],
  },

  // ── HARD (5×5, dense boards) ───────────────────────────────────────────────

  {
    id: 17,
    name: "Blackout Protocol",
    difficulty: 'Hard',
    size: 5,
    parMoves: 9,
    board: [
      T, T, T, T, T,
      T, F, T, F, T,
      T, T, T, T, T,
      T, F, T, F, T,
      T, T, T, T, T,
    ],
  },
  {
    id: 18,
    name: "Static Storm",
    difficulty: 'Hard',
    size: 5,
    parMoves: 10,
    board: [
      T, F, T, T, F,
      F, T, T, F, T,
      T, T, F, T, T,
      T, F, T, T, F,
      F, T, T, F, T,
    ],
  },
  {
    id: 19,
    name: "Kobayashi Grid",
    difficulty: 'Hard',
    size: 5,
    parMoves: 11,
    board: [
      T, T, F, T, T,
      T, F, T, F, T,
      F, T, T, T, F,
      T, F, T, F, T,
      T, T, F, T, T,
    ],
  },
  {
    id: 20,
    name: "Total Eclipse",
    difficulty: 'Hard',
    size: 5,
    parMoves: 12,
    board: [
      T, T, T, T, T,
      T, T, T, T, T,
      T, T, F, T, T,
      T, T, T, T, T,
      T, T, T, T, T,
    ],
  },
];
