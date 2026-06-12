// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useStudentMissionStats.ts
//
// Provides mission turn-in and acceptance stats for the student HUD.
//
// Personal stats strategy:
//   Query the student's own submissions (max ~30 docs/year) on mount.
//   Cheap enough to always be fresh — no cache doc needed.
//
// Class stats strategy:
//   Read one periodStats counter doc on mount, then re-read every 5 minutes.
//   The doc is maintained by useMissionStatsWriter — one read per poll cycle,
//   regardless of how many students are in the class.
// ─────────────────────────────────────────────────────────────────────────────

import { ref, computed, onUnmounted, watch } from 'vue'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { usePeriodSelector } from '@/composables/usePeriodSelector'
import { SCHOOL_YEAR_ID } from '@/config/schoolYear'
import { periodStatsKey } from '@/composables/useMissionStatsWriter'

const CLASS_POLL_INTERVAL_MS = 5 * 60 * 1000  // 5 minutes

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PersonalMissionStats {
  assignedCount:  number
  submittedCount: number
  gradedCount:    number
  turnInRate:     number   // submittedCount / assignedCount * 100
  acceptanceRate: number   // gradedCount / submittedCount * 100
}

export interface ClassMissionStats {
  assignedCount:  number
  submittedCount: number
  gradedCount:    number
  turnInRate:     number
  acceptanceRate: number
  lastUpdated:    Date | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 100) : 0

// ── Composable ────────────────────────────────────────────────────────────────

export function useStudentMissionStats() {
  const { userInfo, userRole, isStaff, effectiveTeacherEmail } = useAuth()
  const { effectivePeriodId, isActingAsTeacher } = usePeriodSelector()

  const personal    = ref<PersonalMissionStats | null>(null)
  const classStat   = ref<ClassMissionStats    | null>(null)
  const isLoading   = ref(false)
  const error       = ref<string | null>(null)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  // ── Personal stats ─────────────────────────────────────────────────────────
  // Query the student's own submissions directly — cheap and always fresh.

  const fetchPersonal = async (): Promise<void> => {
    const uid = userInfo.value?.uid
    if (!uid) return

    try {
      const q    = query(
        collection(db, 'submissions'),
        where('studentId',    '==', uid),
        where('schoolYearId', '==', SCHOOL_YEAR_ID),
      )
      const snap = await getDocs(q)
      const docs = snap.docs.map(d => d.data())

      const assignedCount  = docs.length
      const submittedCount = docs.filter(d =>
        ['submitted', 'graded', 'returned'].includes(d.status)
      ).length
      const gradedCount    = docs.filter(d => d.status === 'graded').length

      personal.value = {
        assignedCount,
        submittedCount,
        gradedCount,
        turnInRate:     pct(submittedCount, assignedCount),
        acceptanceRate: pct(gradedCount,    submittedCount),
      }
    } catch (e: any) {
      console.error('[useStudentMissionStats] fetchPersonal:', e)
    }
  }

  // ── Class stats ────────────────────────────────────────────────────────────
  // One read from the periodStats counter doc.

  const fetchClass = async (): Promise<void> => {
    const role         = (userRole.value ?? '').toLowerCase()
    const periodId     = effectivePeriodId.value
    const teacherEmail = userInfo.value?.teacherEmail || effectiveTeacherEmail.value
    const schoolYearId = userInfo.value?.schoolYearId ?? SCHOOL_YEAR_ID

    // Teachers (Staff) or emulating Admins see class stats for the selected period.
    const isCadet = !['staff', 'admin', 'audit', 'civilian'].includes(role)
    const showClassStats = isCadet || (isActingAsTeacher.value && periodId)
    if (!showClassStats) return
    if (!periodId || !teacherEmail) return

    try {
      const key  = periodStatsKey(teacherEmail, periodId, schoolYearId)
      const snap = await getDoc(doc(db, 'periodStats', key))

      if (!snap.exists()) {
        classStat.value = {
          assignedCount: 0, submittedCount: 0, gradedCount: 0,
          turnInRate: 0, acceptanceRate: 0, lastUpdated: null,
        }
        return
      }

      const d = snap.data()
      const assignedCount  = d.assignedCount  ?? 0
      const submittedCount = d.submittedCount ?? 0
      const gradedCount    = d.gradedCount    ?? 0

      classStat.value = {
        assignedCount,
        submittedCount,
        gradedCount,
        turnInRate:     pct(submittedCount, assignedCount),
        acceptanceRate: pct(gradedCount,    submittedCount),
        lastUpdated:    d.lastUpdated?.toDate?.() ?? null,
      }
    } catch (e: any) {
      console.error('[useStudentMissionStats] fetchClass:', e)
    }
  }

  // ── Main fetch ─────────────────────────────────────────────────────────────

  const fetchAll = async (): Promise<void> => {
    isLoading.value = true
    error.value     = null
    try {
      await Promise.all([fetchPersonal(), fetchClass()])
    } catch (e: any) {
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  // ── Poll setup ─────────────────────────────────────────────────────────────
  // Personal stats fetch once on init (called by MissionReports onMounted).
  // Class stats are re-fetched every 5 minutes — they change when classmates submit.

  const startPolling = () => {
    stopPolling()
    pollTimer = setInterval(fetchClass, CLASS_POLL_INTERVAL_MS)
  }

  const stopPolling = () => {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  onUnmounted(stopPolling)

  // Re-fetch when the selected period changes (for Staff/Admin)
  watch(effectivePeriodId, () => {
    if (userInfo.value?.uid) fetchClass()
  })

  // ── Convenience computeds for the template ─────────────────────────────────

  const myTurnIn       = computed(() => personal.value?.turnInRate     ?? null)
  const myAcceptance   = computed(() => personal.value?.acceptanceRate ?? null)
  const classTurnIn    = computed(() => classStat.value?.turnInRate     ?? null)
  const classAcceptance = computed(() => classStat.value?.acceptanceRate ?? null)

  return {
    personal,
    classStat,
    isLoading,
    error,
    fetchAll,
    fetchPersonal,
    fetchClass,
    startPolling,
    stopPolling,
    // convenience
    myTurnIn,
    myAcceptance,
    classTurnIn,
    classAcceptance,
  }
}
