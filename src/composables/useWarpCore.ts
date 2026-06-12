// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useWarpCore.ts
//
// Calculates live Warp Core Energy for a single class period.
//
// How energy is derived:
//   1. Find all assignments due TODAY for this period that have a `category` tag.
//   2. Count how many students in the period have submitted/graded/returned work
//      for each category (warmUp / lesson / extension).
//   3. Divide each count by total students to get a progress fraction (0–1).
//
// Energy weights (match WarpCorePanel display):
//   warmUp    → up to 20% of total energy
//   lesson    → up to 60% of total energy
//   extension → up to 20% of total energy
//
// Polling:
//   Recalculates every POLL_INTERVAL_MS. Suitable for a live classroom display
//   without the complexity of chaining multiple onSnapshot listeners.
//
// "Today" is determined at mount time and refreshes on each poll tick, so the
// composable handles midnight classroom sessions correctly.
// ─────────────────────────────────────────────────────────────────────────────

import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import {
  collection, query, where, getDocs,
} from '@/data/db'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID } from '@/config/schoolYear'
import type { WarpPhase } from '@/composables/useAssignments'

// ── Public types ──────────────────────────────────────────────────────────────

export interface WarpCoreState {
  /** Fraction of warm-up completed (0.0 – 1.0). */
  warmUpProgress:    number
  /** Fraction of lesson completed (0.0 – 1.0). */
  lessonProgress:    number
  /** Fraction of extension completed (0.0 – 1.0). */
  extensionProgress: number
  /** Total number of cadets enrolled in this period. */
  totalStudents:     number
  /**
   * True while the first fetch is running.
   * Subsequent poll refreshes do not reset this to avoid flickering.
   */
  loading:           boolean
  /**
   * True when today has no categorised assignments for this period.
   * The panel can show a "no active session" state instead of empty bars.
   */
  noSession:         boolean
}

// ── Internal config ───────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000   // refresh every 60 seconds
const ACTIVE_STATUSES  = new Set(['submitted', 'graded', 'returned'])

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Core calculation ──────────────────────────────────────────────────────────

/**
 * Fetches the number of cadets enrolled in a period.
 * This is called once per composable instance and cached — rosters don't
 * change during a class period, so there is no need to re-query on every poll.
 */
async function fetchStudentCount(periodId: string): Promise<number> {
  const snap = await getDocs(
    query(
      collection(db, 'approvedUsers'),
      where('role',         '==', 'cadet'),
      where('periodId',     '==', periodId),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    )
  )
  return snap.size
}

/**
 * Recalculates warp state for the given period.
 * Accepts a pre-cached totalStudents count so the roster is not re-fetched
 * on every poll tick.
 */
async function fetchWarpState(
  periodId: string,
  totalStudents: number,
): Promise<Omit<WarpCoreState, 'loading'>> {
  const today = todayStr()

  // ── 1. Assignments due today for this period ────────────────────────────
  const assignSnap = await getDocs(
    query(
      collection(db, 'assignments'),
      where('periodId',     '==', periodId),
      where('dueDate',      '==', today),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    )
  )

  // Filter to only those with a category tag (warmUp / lesson / extension)
  const byPhase = new Map<WarpPhase, string[]>()
  assignSnap.forEach(d => {
    const cat = d.data().category as WarpPhase | undefined
    if (!cat) return
    if (!byPhase.has(cat)) byPhase.set(cat, [])
    byPhase.get(cat)!.push(d.id)
  })

  // No categorised work today → no active session
  if (byPhase.size === 0) {
    return {
      warmUpProgress: 0, lessonProgress: 0, extensionProgress: 0,
      totalStudents, noSession: true,
    }
  }

  if (totalStudents === 0) {
    return {
      warmUpProgress: 0, lessonProgress: 0, extensionProgress: 0,
      totalStudents: 0, noSession: false,
    }
  }

  // ── 2. Count unique submitters per phase ───────────────────────────────
  async function progressForPhase(phase: WarpPhase): Promise<number> {
    const ids = byPhase.get(phase)
    if (!ids || ids.length === 0) return 0

    const completedStudents = new Set<string>()

    // Firestore 'in' queries cap at 30; chunk if a period somehow has many
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30)
      const subSnap = await getDocs(
        query(
          collection(db, 'submissions'),
          where('assignmentId', 'in', chunk),
          where('periodId',     '==', periodId),
        )
      )
      subSnap.forEach(d => {
        const status = d.data().status as string
        if (ACTIVE_STATUSES.has(status)) {
          completedStudents.add(d.data().studentId as string)
        }
      })
    }

    // Cap at 1.0 in case a student has multiple submissions for the same phase
    return Math.min(completedStudents.size / totalStudents, 1)
  }

  const [warmUpProgress, lessonProgress, extensionProgress] = await Promise.all([
    progressForPhase('warmUp'),
    progressForPhase('lesson'),
    progressForPhase('extension'),
  ])

  return {
    warmUpProgress,
    lessonProgress,
    extensionProgress,
    totalStudents,
    noSession: false,
  }
}

// ── Vue composable ────────────────────────────────────────────────────────────

/**
 * Subscribes to live Warp Core Energy for a single period.
 * Polls Firestore every 30 seconds and recalculates.
 * Automatically stops polling when the calling component unmounts.
 *
 * @param periodId  The period to track (e.g. 'period-1').
 */
export function useWarpCore(periodId: string): { warpCore: Ref<WarpCoreState> } {
  const warpCore = ref<WarpCoreState>({
    warmUpProgress:    0,
    lessonProgress:    0,
    extensionProgress: 0,
    totalStudents:     0,
    loading:           true,
    noSession:         false,
  })

  // Cached student count — fetched once at mount, reused on every poll tick.
  // Class rosters do not change mid-period, so this is safe to hold for the
  // lifetime of the composable instance.
  let cachedStudentCount: number | null = null

  async function refresh() {
    try {
      // Fetch the roster count only on the first call; reuse the cached value
      // on all subsequent polls to avoid a redundant Firestore read each minute.
      if (cachedStudentCount === null) {
        cachedStudentCount = await fetchStudentCount(periodId)
      }
      const result = await fetchWarpState(periodId, cachedStudentCount)
      warpCore.value = { ...result, loading: false }
    } catch (e) {
      console.error(`useWarpCore(${periodId}):`, e)
      warpCore.value = { ...warpCore.value, loading: false }
    }
  }

  // Run immediately, then once per minute
  refresh()
  const timer = setInterval(refresh, POLL_INTERVAL_MS)

  onUnmounted(() => clearInterval(timer))

  return { warpCore }
}
