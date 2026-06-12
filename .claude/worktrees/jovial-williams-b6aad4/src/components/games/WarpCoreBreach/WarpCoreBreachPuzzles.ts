/**
 * WarpCoreBreach puzzle definitions.
 *
 * Every puzzle has a `start` cell (where flow originates) and an `exit` cell
 * (where the flow must arrive to complete the puzzle).  Both are rendered
 * distinctly on the board so the player always knows the target.
 *
 * Grid coordinates are [row, col] zero-indexed from the top-left.
 * `startDir` = direction water *leaves* the start cell.
 * `exitDir`  = direction water must *enter* the exit cell from
 *              (i.e. the open side of the exit mouth facing the board).
 */

import type { PipeType, Direction } from '@/components/games/WarpCoreBreach/engine';

export interface PrePlacedPipe {
  r: number;
  c: number;
  type: PipeType;
}

export interface WarpCoreBreachPuzzle {
  id: number;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  cols: number;
  rows: number;
  startR: number;
  startC: number;
  startDir: Direction;
  exitR: number;
  exitC: number;
  /** Direction water enters the exit cell (the open mouth faces into the board) */
  exitDir: Direction;
  prePlaced: PrePlacedPipe[];
  parLength: number;
  countdown?: number;
}

export const puzzles: WarpCoreBreachPuzzle[] = [
  
  // ── EASY (7×7) ────────────────────────────────────────────────────────────
  
  {
    id: 1, name: "First Contact", difficulty: 'Easy',
    cols: 7, rows: 7,
    startR: 3, startC: 0, startDir: 'E',
    exitR:  6, exitC:  4, exitDir:  'S',
    parLength: 5, countdown: 35000,
    prePlaced: [
      { r: 3, c: 2, type: 'EW' },
      { r: 3, c: 4, type: 'SE' },
      { r: 5, c: 4, type: 'NS' },
    ],
  },
  {
    id: 2, name: "Conduit Alpha", difficulty: 'Easy',
    cols: 7, rows: 7,
    startR: 0, startC: 3, startDir: 'S',
    exitR:  6, exitC:  1, exitDir:  'S',
    parLength: 6, countdown: 33000,
    prePlaced: [
      { r: 2, c: 3, type: 'SW' },
      { r: 2, c: 1, type: 'EW' },
      { r: 4, c: 1, type: 'NS' },
    ],
  },
  {
    id: 3, name: "Junction Beta", difficulty: 'Easy',
    cols: 7, rows: 7,
    startR: 6, startC: 6, startDir: 'N',
    exitR:  0, exitC:  3, exitDir:  'N',
    parLength: 6, countdown: 33000,
    prePlaced: [
      { r: 4, c: 6, type: 'NW' },
      { r: 4, c: 3, type: 'EW' },
      { r: 2, c: 3, type: 'NS' },
    ],
  },
  {
    id: 4, name: "Relay Station", difficulty: 'Easy',
    cols: 7, rows: 7,
    startR: 0, startC: 0, startDir: 'E',
    exitR:  4, exitC:  6, exitDir:  'E',
    parLength: 7, countdown: 32000,
    prePlaced: [
      { r: 0, c: 2, type: 'SE' },
      { r: 2, c: 2, type: 'NS' },
      { r: 2, c: 5, type: 'EW' },
      { r: 4, c: 5, type: 'NW' },
    ],
  },
  
  // ── MEDIUM (9×9) ──────────────────────────────────────────────────────────
  
  {
    id: 5, name: "Duotronic Loop", difficulty: 'Medium',
    cols: 9, rows: 9,
    startR: 4, startC: 0, startDir: 'E',
    exitR:  6, exitC:  8, exitDir:  'E',
    parLength: 9, countdown: 30000,
    prePlaced: [
      { r: 4, c: 2, type: 'NE' },
      { r: 2, c: 2, type: 'SE' },
      { r: 2, c: 5, type: 'SW' },
      { r: 6, c: 5, type: 'NS' },
      { r: 6, c: 7, type: 'EW' },
    ],
  },
  {
    id: 6, name: "Plasma Serpent", difficulty: 'Medium',
    cols: 9, rows: 9,
    startR: 0, startC: 4, startDir: 'S',
    exitR:  8, exitC:  1, exitDir:  'S',
    parLength: 10, countdown: 30000,
    prePlaced: [
      { r: 2, c: 4, type: 'SW' },
      { r: 2, c: 1, type: 'SE' },
      { r: 5, c: 1, type: 'NE' },
      { r: 5, c: 6, type: 'NW' },
      { r: 3, c: 6, type: 'NS' },
    ],
  },
  {
    id: 7, name: "Cross-Circuit", difficulty: 'Medium',
    cols: 9, rows: 9,
    startR: 8, startC: 0, startDir: 'N',
    exitR:  0, exitC:  3, exitDir:  'N',
    parLength: 10, countdown: 28000,
    prePlaced: [
      { r: 6, c: 0, type: 'NE' },
      { r: 6, c: 4, type: 'CROSS' },
      { r: 6, c: 7, type: 'SW' },
      { r: 3, c: 7, type: 'NW' },
      { r: 3, c: 3, type: 'EW' },
    ],
  },
  {
    id: 8, name: "Bifurcation", difficulty: 'Medium',
    cols: 9, rows: 9,
    startR: 4, startC: 8, startDir: 'W',
    exitR:  6, exitC:  0, exitDir:  'W',
    parLength: 11, countdown: 28000,
    prePlaced: [
      { r: 4, c: 6, type: 'NW' },
      { r: 2, c: 6, type: 'SW' },
      { r: 2, c: 3, type: 'SE' },
      { r: 6, c: 3, type: 'NE' },
      { r: 6, c: 6, type: 'EW' },
    ],
  },
  
  // ── HARD (11×11) ──────────────────────────────────────────────────────────
  
  {
    id: 9, name: "Cascade Fault", difficulty: 'Hard',
    cols: 11, rows: 11,
    startR: 5, startC: 0,  startDir: 'E',
    exitR:  5, exitC:  10, exitDir:  'E',
    parLength: 15, countdown: 25000,
    prePlaced: [
      { r: 5, c: 2, type: 'NE' },
      { r: 3, c: 2, type: 'SE' },
      { r: 3, c: 5, type: 'SW' },
      { r: 7, c: 5, type: 'NW' },
      { r: 7, c: 8, type: 'NE' },
      { r: 5, c: 8, type: 'CROSS' },
    ],
  },
  {
    id: 10, name: "Labyrinth Core", difficulty: 'Hard',
    cols: 11, rows: 11,
    startR: 0,  startC: 5, startDir: 'S',
    exitR:  10, exitC:  9, exitDir:  'S',
    parLength: 16, countdown: 25000,
    prePlaced: [
      { r: 2, c: 5, type: 'SE' },
      { r: 2, c: 8, type: 'SW' },
      { r: 5, c: 8, type: 'NW' },
      { r: 5, c: 3, type: 'EW' },
      { r: 8, c: 3, type: 'NE' },
      { r: 8, c: 7, type: 'NS' },
      { r: 8, c: 9, type: 'CROSS' },
    ],
  },
  {
    id: 11, name: "Kobayashi Conduit", difficulty: 'Hard',
    cols: 11, rows: 11,
    startR: 10, startC: 10, startDir: 'N',
    exitR:  0,  exitC:  0,  exitDir:  'W',
    parLength: 17, countdown: 23000,
    prePlaced: [
      { r: 8, c: 10, type: 'NW' },
      { r: 8, c: 7,  type: 'SE' },
      { r: 5, c: 7,  type: 'NW' },
      { r: 5, c: 4,  type: 'SE' },
      { r: 2, c: 4,  type: 'NE' },
      { r: 2, c: 8,  type: 'CROSS' },
      { r: 0, c: 8,  type: 'NS' },
    ],
  },
  {
    id: 12, name: "Total Blackout", difficulty: 'Hard',
    cols: 11, rows: 11,
    startR: 5, startC: 5,  startDir: 'N',
    exitR:  10, exitC: 1,  exitDir:  'S',
    parLength: 18, countdown: 22000,
    prePlaced: [
      { r: 3, c: 5,  type: 'NE' },
      { r: 3, c: 8,  type: 'SW' },
      { r: 6, c: 8,  type: 'NW' },
      { r: 6, c: 2,  type: 'EW' },
      { r: 9, c: 2,  type: 'NE' },
      { r: 9, c: 9,  type: 'NS' },
      { r: 1, c: 9,  type: 'SW' },
      { r: 1, c: 1,  type: 'CROSS' },
    ],
  },
];