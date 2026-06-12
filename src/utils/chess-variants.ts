/**
 * chess-variants.ts
 *
 * Chessops-based variant utilities for CompuTrek's chess game.
 * Handles position creation, move generation, game-over detection, and
 * Crazyhouse pocket management for all 8 supported variants.
 *
 * Replaces the chess.js layer — no chess.js dependency anywhere in this file.
 */

import { defaultPosition, setupPosition } from 'chessops/variant';
import { parseFen, makeFen, INITIAL_FEN } from 'chessops/fen';
import {
  parseSquare,
  makeSquare,
  parseUci,
  makeUci,
  charToRole,
  roleToChar,
  opposite,
  squareRank,
  squareFile,
} from 'chessops/util';
import { chessgroundDests } from 'chessops/compat';
import type { Rules, SquareName } from 'chessops/types';
import { Material, MaterialSide } from 'chessops/setup';
import type { Pocket, PocketStore } from './crazyhouse';
import { emptyPocketStore } from './crazyhouse';

// Re-export Position type so callers don't need to import from chessops directly
export type { Position } from 'chessops/chess';
export type { Move, NormalMove, DropMove, Color, Role, Outcome } from 'chessops/types';
export { chessgroundDests, parseSquare, makeSquare, parseUci, makeUci, charToRole, roleToChar, opposite, squareRank, squareFile };
export { parseFen, makeFen, INITIAL_FEN };
export { Material, MaterialSide };

// ── Variant types ──────────────────────────────────────────────────────────

export type ChessVariant =
  | 'standard'
  | '960'
  | 'crazyhouse'
  | 'koth'
  | 'threecheck'
  | 'antichess'
  | 'horde'
  | 'racingkings';

/** Maps our variant identifiers to chessops Rules strings */
export const VARIANT_RULES: Record<ChessVariant, Rules> = {
  standard:    'chess',
  '960':       'chess',
  crazyhouse:  'crazyhouse',
  koth:        'kingofthehill',
  threecheck:  '3check',
  antichess:   'antichess',
  horde:       'horde',
  racingkings: 'racingkings',
};

/** Full display labels */
export const VARIANT_LABELS: Record<ChessVariant, string> = {
  standard:    'STANDARD',
  '960':       'CHESS 960',
  crazyhouse:  'CRAZYHOUSE',
  koth:        'KING OF THE HILL',
  threecheck:  'THREE-CHECK',
  antichess:   'ANTICHESS',
  horde:       'HORDE',
  racingkings: 'RACING KINGS',
};

/** Short badge labels for the in-game status column */
export const VARIANT_BADGES: Record<ChessVariant, string> = {
  standard:    '',
  '960':       '960',
  crazyhouse:  'CZH',
  koth:        'KOTH',
  threecheck:  '3CHK',
  antichess:   'ANTI',
  horde:       'HRDE',
  racingkings: 'RACE',
};

/** Accent colors for variant badges (CSS hex) */
export const VARIANT_BADGE_COLORS: Record<ChessVariant, string> = {
  standard:    '',
  '960':       '#ffc400',
  crazyhouse:  '#ff6b6b',
  koth:        '#4caf50',
  threecheck:  '#ff9800',
  antichess:   '#ab47bc',
  horde:       '#f06292',
  racingkings: '#29b6f6',
};

/** Horde chess starting FEN (white = pawns only, black = standard pieces) */
export const HORDE_FEN = 'rnbqkbnr/pppppppp/8/1PP2PP1/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP w kq - 0 1';

// ── Position factory ───────────────────────────────────────────────────────

/**
 * Creates a chessops Position for the given variant.
 *
 * Pass `fen` to load from a specific position (e.g. a saved game or Chess 960
 * starting setup). For Crazyhouse, the FEN may include pocket notation in
 * brackets: `rnbqkbnr/.../PPPPPPPP[Qq] w KQkq - 0 1`.
 *
 * If no FEN is supplied the variant's default starting position is used.
 * Horde has a non-standard starting position that is handled here.
 */
export function createPosition(variant: ChessVariant, fen?: string): import('chessops/chess').Position {
  const rules = VARIANT_RULES[variant];

  if (fen) {
    const setup = parseFen(fen).unwrap();
    return setupPosition(rules, setup).unwrap();
  }

  if (variant === 'horde') {
    const setup = parseFen(HORDE_FEN).unwrap();
    return setupPosition(rules, setup).unwrap();
  }

  return defaultPosition(rules);
}

// ── FEN helpers ────────────────────────────────────────────────────────────

/**
 * Returns the current FEN of a position.
 * For Crazyhouse, the FEN includes pocket notation in brackets.
 */
export function getFen(pos: import('chessops/chess').Position): string {
  return makeFen(pos.toSetup());
}

// ── Pocket conversion ──────────────────────────────────────────────────────

/** Converts a chessops Material to our PocketStore shape (for the UI + Firebase). */
export function pocketToStore(pockets: Material | undefined): PocketStore {
  if (!pockets) return emptyPocketStore();
  const convert = (ms: MaterialSide): Pocket => ({
    p: ms.pawn,
    n: ms.knight,
    b: ms.bishop,
    r: ms.rook,
    q: ms.queen,
  });
  return { white: convert(pockets.white), black: convert(pockets.black) };
}

/** Converts our PocketStore shape to a chessops Material (for Firebase→position). */
export function storeToPocket(store: PocketStore): Material {
  const makeMs = (p: Pocket): MaterialSide => {
    const ms = MaterialSide.empty();
    ms.pawn   = p.p;
    ms.knight = p.n;
    ms.bishop = p.b;
    ms.rook   = p.r;
    ms.queen  = p.q;
    ms.king   = 0;
    return ms;
  };
  return new Material(makeMs(store.white), makeMs(store.black));
}

// ── Drop destinations (Crazyhouse) ─────────────────────────────────────────

/**
 * Returns the squares where the given role can legally be dropped by the
 * side whose turn it currently is.
 *
 * Handles:
 *  - Pocket ownership check (player must have the piece)
 *  - Pawn back-rank restriction
 *  - Check constraint (must block the check with the drop)
 */
export function getDropDestsForPiece(
  pos: import('chessops/chess').Position,
  role: import('chessops/types').Role,
): SquareName[] {
  if (!pos.pockets) return [];
  if (pos.pockets[pos.turn][role] <= 0) return [];

  // dropDests() accounts for check constraints automatically
  const ctx = (pos as any).ctx();
  const generalDests: Iterable<number> = (pos as any).dropDests(ctx);

  const dests: SquareName[] = [];
  for (const sq of generalDests) {
    // Pawns cannot be dropped on the back ranks (rank 0 = a1..h1, rank 7 = a8..h8)
    if (role === 'pawn') {
      const rank = squareRank(sq);
      if (rank === 0 || rank === 7) continue;
    }
    dests.push(makeSquare(sq));
  }

  return dests;
}

// ── Capture detection ──────────────────────────────────────────────────────

/**
 * Returns the Role of the piece captured by a normal move, or undefined.
 * Must be called BEFORE pos.play(move) — once the move is played the
 * captured piece is removed from the board.
 *
 * Handles both regular captures and en-passant.
 */
export function detectCapture(
  pos: import('chessops/chess').Position,
  move: import('chessops/types').NormalMove,
): import('chessops/types').Role | undefined {
  const movingPiece = pos.board.get(move.from);
  if (!movingPiece) return undefined;

  // En-passant: pawn moves diagonally to an empty square
  if (
    movingPiece.role === 'pawn' &&
    squareFile(move.from) !== squareFile(move.to) &&
    !pos.board.has(move.to)
  ) {
    return 'pawn';
  }

  // Regular capture: destination square holds an opponent's piece
  const target = pos.board.get(move.to);
  if (target && target.color !== pos.turn) return target.role;

  return undefined;
}
