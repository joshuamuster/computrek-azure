/**
 * useConductScore.ts
 * ──────────────────
 * Helpers for the per-student conduct score (integer 0–4) stored on the
 * student's approvedUsers document.
 *
 * Score scale (Atlas / FUSD grading palette):
 *   4  ████  blue    A  Full marks — great behaviour
 *   3  ███░  green   B  Minor issue
 *   2  ██░░  yellow  C  Ongoing concern
 *   1  █░░░  orange  D  Significant concern
 *   0  ████  red     F  Critical — removed from class perks (all four pips fill)
 *
 * Note: score 0 renders ALL FOUR pips red (not zero filled + four dim).
 * Use pipFilled(score, pipIndex) to get the per-pip fill decision.
 *
 * To update the palette: change CONDUCT_COLORS below; the CSS custom properties
 * in classic.css :root must also be kept in sync for scoped-style rules.
 */

import { doc, updateDoc } from '@/data/db'
import { db } from '@/firebase'

// ── Color palette (single source of truth for JS / template :style bindings) ──
// CSS custom properties counterparts live in classic.css :root { --conduct-* }
export const CONDUCT_COLORS = {
  0:   '#b94a48',  // F — red
  1:   '#ff7f00',  // D — orange
  2:   '#f5c518',  // C — yellow (warm gold; readable on dark backgrounds)
  3:   '#468847',  // B — green
  4:   '#1f78b4',  // A — blue
  pos: '#1f78b4',  // positive action indicator (matches score-4 blue)
  neg: '#b94a48',  // negative action indicator (matches score-0 red)
} as const

/**
 * 5-step performance scale — mirrors CONDUCT_COLORS 0–4.
 * Use this (not raw hex) anywhere a feature rates something on a spectrum:
 * health tiers, WPM bands, turn-in rates, risk levels, etc.
 * CSS counterparts: --scale-excellent … --scale-critical in classic.css
 */
export const SCALE_COLORS = {
  excellent: CONDUCT_COLORS[4],  // #1f78b4 — blue   (A / best)
  good:      CONDUCT_COLORS[3],  // #468847 — green  (B / good)
  caution:   CONDUCT_COLORS[2],  // #f5c518 — yellow (C / watch out)
  concern:   CONDUCT_COLORS[1],  // #ff7f00 — orange (D / needs help)
  critical:  CONDUCT_COLORS[0],  // #b94a48 — red    (F / urgent)
} as const

const PIP_COLORS = [
  CONDUCT_COLORS[0],  // 0 — F / red
  CONDUCT_COLORS[1],  // 1 — D / orange
  CONDUCT_COLORS[2],  // 2 — C / yellow
  CONDUCT_COLORS[3],  // 3 — B / green
  CONDUCT_COLORS[4],  // 4 — A / blue
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
