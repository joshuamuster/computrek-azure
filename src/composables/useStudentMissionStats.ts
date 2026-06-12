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
  documentId,
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
  onTimeCount:    number
  turnInRate:     number   // submittedCount / assignedCount * 100
  acceptanceRate: number   // gradedCount / submittedCount * 100
  onTimeRate:     number   // onTimeCount / submittedCount * 100
}

export interface ClassMissionStats {
  assignedCount:  number
  submittedCount: number
  gradedCount:    number
  onTimeCount:    number
  turnInRate:     number
  acceptanceRate: number
  onTimeRate:     number   // onTimeCount / submittedCount * 100
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
      const submittedDocs  = docs.filter(d =>
        ['submitted', 'graded', 'returned'].includes(d.status)
      )
      const submittedCount = submittedDocs.length
      const gradedCount    = docs.filter(d => d.status === 'graded').length

      // ── On-time calculation ─────────────────────────────────────────────────
      // Batch-fetch the assignment docs to get their due dates, then compare
      // each submission's submittedAt against effectiveDueDate (override ?? dueDate).
      // Firestore 'in' query supports up to 30 items; chunk if needed.
      let onTimeCount = 0
      const assignmentIds = [...new Set(submittedDocs.map((d: any) => d.assignmentId as string))]
      if (assignmentIds.length > 0) {
        const BATCH = 30
        const dueDateMap = new Map<string, string | null>()
        for (let i = 0; i < assignmentIds.length; i += BATCH) {
          const chunk = assignmentIds.slice(i, i + BATCH)
          const aSnap = await getDocs(
            query(collection(db, 'assignments'), where(documentId(), 'in', chunk))
          )
          aSnap.docs.forEach(d => dueDateMap.set(d.id, (d.data().dueDate as string | null) ?? null))
        }
        for (const sub of submittedDocs) {
          const s = sub as any
          const effectiveDue = (s.dueDateOverride as string | null) ?? dueDateMap.get(s.assignmentId) ?? null
          if (!effectiveDue || !s.submittedAt) continue
          const submittedDate = s.submittedAt.toDate?.() ?? new Date(s.submittedAt)
          const submittedIso  = submittedDate.toISOString().slice(0, 10)
          if (submittedIso <= effectiveDue) onTimeCount++
        }
      }

      personal.value = {
        assignedCount,
        submittedCount,
        gradedCount,
        onTimeCount,
        turnInRate:     pct(submittedCount, assignedCount),
        acceptanceRate: pct(gradedCount,    submittedCount),
        onTimeRate:     pct(onTimeCount,    submittedCount),
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
          assignedCount: 0, submittedCount: 0, gradedCount: 0, onTimeCount: 0,
          turnInRate: 0, acceptanceRate: 0, onTimeRate: 0, lastUpdated: null,
        }
        return
      }

      const d = snap.data()
      const assignedCount  = d.assignedCount  ?? 0
      const submittedCount = d.submittedCount ?? 0
      const gradedCount    = d.gradedCount    ?? 0
      const onTimeCount    = d.onTimeCount    ?? 0

      classStat.value = {
        assignedCount,
        submittedCount,
        gradedCount,
        onTimeCount,
        turnInRate:     pct(submittedCount, assignedCount),
        acceptanceRate: pct(gradedCount,    submittedCount),
        onTimeRate:     pct(onTimeCount,    submittedCount),
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

  const myTurnIn        = computed(() => personal.value?.turnInRate     ?? null)
  const myAcceptance    = computed(() => personal.value?.acceptanceRate ?? null)
  const myOnTime        = computed(() => personal.value?.onTimeRate     ?? null)
  const classTurnIn     = computed(() => classStat.value?.turnInRate     ?? null)
  const classAcceptance = computed(() => classStat.value?.acceptanceRate ?? null)
  const classOnTime     = computed(() => classStat.value?.onTimeRate     ?? null)

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
    myOnTime,
    classTurnIn,
    classAcceptance,
    classOnTime,
  }
}
