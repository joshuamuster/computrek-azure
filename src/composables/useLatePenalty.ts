// src/composables/useLatePenalty.ts
//
// Pure late-penalty calculator — no Firestore, no Vue reactivity.
//
// Usage in GradingView:
//   import { computeLatePenalty } from '@/composables/useLatePenalty'
//   const penalty = computeLatePenalty(sub.submittedAt, effectiveDue, pctPerDay, maxPct, ptsPossible)
//
// effectiveDueDate = sub.dueDateOverride ?? assignment.dueDate (YYYY-MM-DD).
// "Late" is defined as submitted AFTER 11:59 PM on the due date.

import type { Timestamp } from '@/data/db'

export interface LatePenaltyResult {
  daysLate:       number          // 0 if on time or no config
  penaltyPct:     number          // 0–100
  penaltyPoints:  number          // points deducted (floored)
  adjustedPoints: number | null   // null when pointsPossible is null
}

export function computeLatePenalty(
  submittedAt:      Timestamp | null,
  effectiveDueDate: string | null,     // YYYY-MM-DD
  penaltyPctPerDay: number,            // e.g. 10 for 10%/day; 0 = no penalty
  maxPenaltyPct:    number,            // cap, e.g. 30
  pointsPossible:   number | null,
): LatePenaltyResult {
  const none = (): LatePenaltyResult => ({
    daysLate: 0, penaltyPct: 0, penaltyPoints: 0, adjustedPoints: pointsPossible,
  })

  if (!submittedAt || !effectiveDueDate || !penaltyPctPerDay) return none()

  // Due at 11:59:59 PM on the due date (local time)
  const dueMs      = new Date(effectiveDueDate + 'T23:59:59').getTime()
  const submittedMs = submittedAt.toMillis()

  if (submittedMs <= dueMs) return none()

  const daysLate   = Math.ceil((submittedMs - dueMs) / (1000 * 60 * 60 * 24))
  const penaltyPct = maxPenaltyPct > 0
    ? Math.min(daysLate * penaltyPctPerDay, maxPenaltyPct)
    : daysLate * penaltyPctPerDay

  if (!pointsPossible) {
    return { daysLate, penaltyPct, penaltyPoints: 0, adjustedPoints: null }
  }

  const penaltyPoints  = Math.floor((penaltyPct / 100) * pointsPossible)
  const adjustedPoints = Math.max(0, pointsPossible - penaltyPoints)

  return { daysLate, penaltyPct, penaltyPoints, adjustedPoints }
}
