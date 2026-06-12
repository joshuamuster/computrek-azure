/**
 * useConductScore.ts
 * ──────────────────
 * Helpers for the per-student conduct score (integer 0–4) stored on the
 * student's approvedUsers document.
 *
 * Score scale:
 *   4  ████  green          Full marks — great behaviour
 *   3  ███░  yellow-green   Minor issue
 *   2  ██░░  yellow-orange  Ongoing concern
 *   1  █░░░  red            Significant concern
 *   0  ████  all-red        Critical — removed from class perks
 *
 * Note: score 0 renders ALL FOUR pips red (not zero filled + four dim).
 * Use pipFilled(score, pipIndex) to get the per-pip fill decision.
 */

import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'

// ── Colors (indexed by score 0–4) ─────────────────────────────────────────────
const PIP_COLORS = [
  '#f44336',  // 0 — red
  '#f44336',  // 1 — red      (same hue as 0; visual difference is pip count)
  '#ff9800',  // 2 — orange
  '#cddc39',  // 3 — yellow-green
  '#4caf50',  // 4 — green
] as const

export function pipColor(score: number): string {
  return PIP_COLORS[Math.max(0, Math.min(4, Math.round(score)))]
}

export function pipLabel(score: number): string {
  const labels = ['Critical', 'Needs Attention', 'Caution', 'Good', 'Excellent'] as const
  return labels[Math.max(0, Math.min(4, Math.round(score)))]
}

/**
 * Whether pip i (1-indexed, 1–4) should be filled for the given score.
 *
 * Normal behaviour: pip i fills when score >= i.
 * Score 0 special case: all four pips fill red (maximum visual alarm).
 */
export function pipFilled(score: number, pipIndex: number): boolean {
  if (score === 0) return true       // all-red alarm state
  return score >= pipIndex
}

/**
 * Clamp a raw value to the 0–4 integer range.
 */
export function clampScore(value: number): number {
  return Math.max(0, Math.min(4, Math.round(value)))
}

/**
 * Persist a conduct-score change to Firestore.
 *
 * @param studentDocId  The approvedUsers document ID (= the student's email)
 * @param newScore      New score value; will be clamped to 0–4
 */
export async function updateConductScore(
  studentDocId: string,
  newScore: number,
): Promise<void> {
  if (!studentDocId) return
  await updateDoc(doc(db, 'approvedUsers', studentDocId), {
    conductScore: clampScore(newScore),
  })
}
