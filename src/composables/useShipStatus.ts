// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useShipStatus.ts
//
// Calculates and persists per-period ship health scores to Firestore.
//
// Health formula (per period, at time of calculation):
//   — 'graded' or 'returned' submissions: contribute pointsEarned / pointsPossible
//   — 'assigned' submissions past their effective due date: contribute 0 / pointsPossible
//   — 'assigned' not yet due, and 'submitted' (awaiting grading): excluded entirely
//   — No countable work yet → health = 100 (nothing to judge)
//
// Triggered by: teacher grading or returning a submission in GradingView.
// Written to:   shipStatus/{periodId}  in Firestore.
// Read by:      Systems.vue  (real-time onSnapshot).
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import type { Ref } from 'vue'
import {
  collection, query, where, getDocs,
  setDoc, doc, onSnapshot, serverTimestamp,
  documentId,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID } from '@/config/schoolYear'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ShipStatusDoc {
  /** 0–100, one decimal place. 100 = no countable work yet OR perfect score. */
  health:       number
  /** Submissions counted with a real score (graded / returned). */
  gradedCount:  number
  /** Submissions counted as zero — past due and still 'assigned'. */
  overdueCount: number
  /** Total points earned across all counted submissions. */
  totalEarned:  number
  /** Total points possible across all counted submissions. */
  totalPossible: number
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Returns today's date as a YYYY-MM-DD string for due-date comparisons. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Batch-fetches mission docs and returns a Map<missionId, pointsPossible>. */
async function fetchPointsPossible(missionIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (missionIds.length === 0) return result

  // Firestore 'in' queries are capped at 30 — chunk if needed
  for (let i = 0; i < missionIds.length; i += 30) {
    const chunk = missionIds.slice(i, i + 30)
    const snap = await getDocs(
      query(collection(db, 'missions'), where(documentId(), 'in', chunk))
    )
    snap.forEach(d => result.set(d.id, (d.data().pointsPossible as number) ?? 0))
  }
  return result
}

// ── Core calculation ──────────────────────────────────────────────────────────

/**
 * Recomputes health for one period and writes the result to shipStatus/{periodId}.
 * Call this immediately after grading or returning a submission.
 */
export async function recalculateShipHealth(periodId: string): Promise<void> {
  const today = todayStr()

  // ── 1. Fetch all submissions for this period / school year ──────────────
  const subsSnap = await getDocs(
    query(
      collection(db, 'submissions'),
      where('periodId',     '==', periodId),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    )
  )

  // ── 2. Fetch all assignments for this period (needed for due dates) ──────
  const assignSnap = await getDocs(
    query(
      collection(db, 'assignments'),
      where('periodId',     '==', periodId),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    )
  )
  const assignmentDueDates = new Map<string, string | null>()
  assignSnap.forEach(d => {
    assignmentDueDates.set(d.id, (d.data().dueDate as string | null) ?? null)
  })

  // ── 3. Collect every missionId we might need pointsPossible for ──────────
  const missionIdSet = new Set<string>()
  subsSnap.forEach(d => missionIdSet.add(d.data().missionId as string))
  const pointsPossibleMap = await fetchPointsPossible(Array.from(missionIdSet))

  // ── 4. Walk every submission and apply the inclusion rules ───────────────
  let totalEarned   = 0
  let totalPossible = 0
  let gradedCount   = 0
  let overdueCount  = 0

  subsSnap.forEach(d => {
    const sub             = d.data()
    const status          = sub.status as string
    const pointsPossible  = pointsPossibleMap.get(sub.missionId as string) ?? 0

    if (status === 'graded' || status === 'returned') {
      // Teacher has evaluated this — count the actual score
      totalEarned   += (sub.pointsEarned as number) ?? 0
      totalPossible += pointsPossible
      gradedCount++
      return
    }

    if (status === 'assigned') {
      // Resolve the effective due date (student override wins over assignment date)
      const effectiveDue: string | null =
        (sub.dueDateOverride as string | null) ??
        assignmentDueDates.get(sub.assignmentId as string) ??
        null

      if (effectiveDue && effectiveDue < today) {
        // Past due and never touched — counts as a zero
        totalEarned   += 0
        totalPossible += pointsPossible
        overdueCount++
      }
      // Not yet due → exclude entirely
      return
    }

    // status === 'submitted': turned in but teacher hasn't graded yet → exclude
  })

  // ── 5. Compute the final health score ────────────────────────────────────
  const health: number = totalPossible === 0
    ? 100
    : Math.round((totalEarned / totalPossible) * 1000) / 10  // one decimal

  // ── 6. Persist to Firestore ───────────────────────────────────────────────
  await setDoc(doc(db, 'shipStatus', periodId), {
    health,
    gradedCount,
    overdueCount,
    totalEarned,
    totalPossible,
    lastUpdated: serverTimestamp(),
  })
}

// ── Vue composable — singleton ────────────────────────────────────────────────

/**
 * Subscribes to the shipStatus collection in real time.
 * Returns a reactive Map<periodId, ShipStatusDoc> shared across all callers.
 *
 * Singleton: the onSnapshot listener is opened exactly once for the entire
 * app session, no matter how many components call useShipStatus(). Previously
 * each caller (Systems, AdminDashboard, AdminReports) opened its own parallel
 * subscription to the same collection.
 */

const _statusByPeriod = ref(new Map<string, ShipStatusDoc>())
let _shipStatusInitialized = false

function _initShipStatus() {
  if (_shipStatusInitialized) return
  _shipStatusInitialized = true

  onSnapshot(collection(db, 'shipStatus'), snap => {
    const m = new Map<string, ShipStatusDoc>()
    snap.forEach(d => {
      const data = d.data()
      m.set(d.id, {
        health:        data.health        ?? 100,
        gradedCount:   data.gradedCount   ?? 0,
        overdueCount:  data.overdueCount  ?? 0,
        totalEarned:   data.totalEarned   ?? 0,
        totalPossible: data.totalPossible ?? 0,
      })
    })
    _statusByPeriod.value = m
  })
}

export function useShipStatus(): { statusByPeriod: Ref<Map<string, ShipStatusDoc>> } {
  _initShipStatus()
  return { statusByPeriod: _statusByPeriod }
}
