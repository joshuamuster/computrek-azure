/**
 * Crazyhouse chess variant — shared constants and types.
 *
 * Drop validation, game-over detection, and pocket management are now
 * handled by chessops (see chess-variants.ts). This file keeps only the
 * display constants that are shared between the game component and the
 * chess-variants utility.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PocketPieceType = 'p' | 'n' | 'b' | 'r' | 'q';
export type Pocket = Record<PocketPieceType, number>;
export type PocketStore = { white: Pocket; black: Pocket };

// ── Display constants ─────────────────────────────────────────────────────────

/** Render order for pocket / captured-piece lists (most valuable first). */
export const POCKET_PIECE_ORDER: PocketPieceType[] = ['q', 'r', 'b', 'n', 'p'];

/**
 * Unicode chess symbols per piece type and color.
 *
 * On the dark hologram board:
 *  - `.w` symbols (hollow outline) appear DARK — used for pieces captured
 *    by White (Black's pieces go to White's column).
 *  - `.b` symbols (filled) appear LIGHT/SALMON — used for pieces captured
 *    by Black (White's pieces go to Black's column).
 */
export const PIECE_UNICODE: Record<PocketPieceType, { w: string; b: string }> = {
  q: { w: '♕', b: '♛' },
  r: { w: '♖', b: '♜' },
  b: { w: '♗', b: '♝' },
  n: { w: '♘', b: '♞' },
  p: { w: '♙', b: '♟' },
};

// ── Factory helpers ───────────────────────────────────────────────────────────

export function emptyPocket(): Pocket {
  return { p: 0, n: 0, b: 0, r: 0, q: 0 };
}

export function emptyPocketStore(): PocketStore {
  return { white: emptyPocket(), black: emptyPocket() };
}
