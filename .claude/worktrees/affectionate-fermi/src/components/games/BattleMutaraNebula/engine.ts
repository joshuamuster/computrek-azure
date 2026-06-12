// Engine.ts
// Shared types and state factory for BattleMutaraNebula.
// Both BattleMutaraNebula.vue (lobby) and BattleMutaraNebulaGame.vue import from here.

export const COLS = ['A','B','C','D','E','F','G','H','I','J'];
export const ROWS = [1,2,3,4,5,6,7,8,9,10];

export type Cell = string; // e.g. "A1", "J10"

export interface ShipDef {
  id: string;
  label: string;
  size: number;
}

export const SHIP_DEFS: ShipDef[] = [
  { id: 'carrier',    label: 'Carrier',    size: 5 },
  { id: 'battleship', label: 'Battleship', size: 4 },
  { id: 'cruiser',    label: 'Cruiser',    size: 3 },
  { id: 'submarine',  label: 'Submarine',  size: 3 },
  { id: 'destroyer',  label: 'Destroyer',  size: 2 },
];

export interface PlacedShip {
  id: string;
  cells: Cell[];
  sunk: boolean;
}

export type Phase = 'placement' | 'battle' | 'over';
export type PlayerRole = 'host' | 'guest';

export interface Engine {
  phase: Phase;
  turn: PlayerRole;          // whose turn it is to fire
  winner: PlayerRole | null;
  hostShips: PlacedShip[];
  guestShips: PlacedShip[];
  hostShots: Cell[];         // shots fired BY host (at guest's grid)
  guestShots: Cell[];        // shots fired BY guest (at host's grid)
  hostReady: boolean;
  guestReady: boolean;
}

export function createInitialBattleshipState(): Engine {
  return {
    phase: 'placement',
    turn: 'host',
    winner: null,
    hostShips: [],
    guestShips: [],
    hostShots: [],
    guestShots: [],
    hostReady: false,
    guestReady: false,
  };
}

/** Given a starting cell, orientation, and size — return all cells or null if invalid */
export function getCells(startCol: string, startRow: number, size: number, horizontal: boolean): Cell[] | null {
  const cells: Cell[] = [];
  const colIdx = COLS.indexOf(startCol);
  if (colIdx === -1) return null;
  for (let i = 0; i < size; i++) {
    if (horizontal) {
      const c = COLS[colIdx + i];
      if (!c) return null;
      cells.push(`${c}${startRow}`);
    } else {
      const r = startRow + i;
      if (r > 10) return null;
      cells.push(`${startCol}${r}`);
    }
  }
  return cells;
}

/** Check whether a set of cells conflicts with already-placed ships */
export function hasConflict(cells: Cell[], placedShips: PlacedShip[]): boolean {
  const occupied = new Set(placedShips.flatMap(s => s.cells));
  return cells.some(c => occupied.has(c));
}

/** Determine if a ship is sunk given a set of shots */
export function isShipSunk(ship: PlacedShip, shots: Cell[]): boolean {
  const shotSet = new Set(shots);
  return ship.cells.every(c => shotSet.has(c));
}

/** Recompute sunk flags on all ships given the shots fired at them */
export function updateSunkFlags(ships: PlacedShip[], shotsAgainstThem: Cell[]): PlacedShip[] {
  return ships.map(ship => ({
    ...ship,
    sunk: isShipSunk(ship, shotsAgainstThem),
  }));
}

/** Check if all ships are sunk */
export function allSunk(ships: PlacedShip[], shots: Cell[]): boolean {
  return ships.length === SHIP_DEFS.length && ships.every(s => isShipSunk(s, shots));
}
