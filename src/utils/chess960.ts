/**
 * Chess 960 (Fischer Random Chess) utilities.
 *
 * NOTE: chess.js v1.x does not implement Chess 960 castling — it only
 * correctly handles castling when the king starts on e1 and rooks on a1/h1.
 * For 960 positions with a differently-placed king the library would either
 * reject the castle or execute it incorrectly (king moves 2 squares instead
 * of landing on g1/c1 as the rules require).
 *
 * We therefore generate valid 960 starting positions but omit castling rights
 * ('-' in the FEN). This is the standard workaround used by implementations
 * that sit on top of a non-960-aware engine.
 */

export const STANDARD_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Generates a random, legal Chess 960 starting position.
 * Returns a complete FEN string with castling set to '-'.
 */
export function generateChess960FEN(): string {
  const rank: (string | null)[] = Array(8).fill(null);

  // 1. Light-square bishop — one of b,d,f,h (indices 1,3,5,7)
  const lightSqs = [1, 3, 5, 7];
  rank[lightSqs[Math.floor(Math.random() * 4)]] = 'B';

  // 2. Dark-square bishop — one of a,c,e,g (indices 0,2,4,6)
  const darkSqs = [0, 2, 4, 6];
  rank[darkSqs[Math.floor(Math.random() * 4)]] = 'B';

  // 3. Queen — any remaining square
  let empty = rank.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0);
  rank[empty[Math.floor(Math.random() * empty.length)]] = 'Q';

  // 4. First knight — any remaining square
  empty = rank.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0);
  rank[empty[Math.floor(Math.random() * empty.length)]] = 'N';

  // 5. Second knight — any remaining square
  empty = rank.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0);
  rank[empty[Math.floor(Math.random() * empty.length)]] = 'N';

  // 6. Last 3 squares: rook–king–rook (left-to-right, so king is always
  //    between the two rooks — the core Chess 960 requirement)
  const last = rank
    .map((v, i) => (v === null ? i : -1))
    .filter(i => i >= 0)
    .sort((a, b) => a - b);
  rank[last[0]] = 'R';
  rank[last[1]] = 'K';
  rank[last[2]] = 'R';

  const whiteRow = rank.join('');          // e.g. "QRBNKBNR"
  const blackRow = whiteRow.toLowerCase(); // e.g. "qrbnkbnr"

  // Castling rights are '-' — see module comment above.
  return `${blackRow}/pppppppp/8/8/8/8/PPPPPPPP/${whiteRow} w - - 0 1`;
}

/** Returns true when the given FEN is the Chess 960 marker (differs from standard). */
export function is960FEN(fen: string): boolean {
  // Compare only the piece-placement field (first token) to the standard.
  const placement = fen.split(' ')[0];
  const standardPlacement = STANDARD_FEN.split(' ')[0];
  return placement !== standardPlacement;
}
