// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useTypingStats.ts
//
// Fetches and exposes typing stats for the student HUD (TypingReport.vue).
//
// Personal stats query:  typingResults where uid == currentUser.uid
// Class stats query:     typingResults where periodId + schoolYearId + teacherEmail
//
// The student's uid, periodId, schoolYearId, and teacherEmail all come from
// userInfo (set at login and persisted in localStorage).
// ─────────────────────────────────────────────────────────────────────────────

import { ref, computed, watch } from 'vue'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { usePeriodSelector } from '@/composables/usePeriodSelector'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TypingStats {
  // Personal
  personalBestWpm:  number | null   // all-time best WPM across all modes
  rollingAvgWpm:    number | null   // avg of last N sessions
  rollingAvgAccy:   number | null   // avg accuracy of last N sessions
  sessionCount:     number          // total sessions recorded for this student

  // Period / class
  classBestWpm:     number | null   // highest single-session WPM in the period
  classAvgWpm:      number | null   // avg WPM across all students in the period
  classAvgAccy:     number | null   // avg accuracy across all students in the period
}

const ROLLING_WINDOW = 5    // sessions used for rolling average
const PERIOD_LIMIT   = 300  // max docs fetched for period stats (plenty for a class)

// ── Composable ────────────────────────────────────────────────────────────────

export function useTypingStats() {
  const { userInfo, userRole, isStaff, effectiveTeacherEmail } = useAuth()
  const { effectivePeriodId, isActingAsTeacher } = usePeriodSelector()

  const stats     = ref<TypingStats>({
    personalBestWpm: null,
    rollingAvgWpm:   null,
    rollingAvgAccy:  null,
    sessionCount:    0,
    classBestWpm:    null,
    classAvgWpm:     null,
    classAvgAccy:    null,
  })
  const isLoading = ref(false)
  const error     = ref<string | null>(null)

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  const max = (arr: number[]) =>
    arr.length ? Math.max(...arr) : null

  // ── Main fetch ───────────────────────────────────────────────────────────────

  const fetchStats = async () => {
    const uid          = userInfo.value?.uid
    const periodId     = effectivePeriodId.value
    const schoolYearId = userInfo.value?.schoolYearId ?? '2025-2026'
    const teacherEmail = userInfo.value?.teacherEmail || effectiveTeacherEmail.value

    // Staff/admin see the HUD too. Cadets see personal and class stats.
    // Teachers (Staff) or emulating Admins see class stats for the selected period.
    const role = (userRole.value ?? '').toLowerCase()
    const isCadet = !['staff', 'admin', 'audit', 'civilian'].includes(role)
    const showClassStats = isCadet || (isActingAsTeacher.value && periodId)

    if (!uid) {
      error.value = 'No user loaded'
      return
    }

    isLoading.value = true
    error.value     = null

    try {
      // ── 1. Personal best WPM (single doc, fastest possible query) ────────────
      const bestQ = query(
        collection(db, 'typingResults'),
        where('uid', '==', uid),
        orderBy('wpm', 'desc'),
        limit(1),
      )
      const bestSnap = await getDocs(bestQ)
      const personalBestWpm = bestSnap.empty
        ? null
        : (bestSnap.docs[0].data().wpm as number) ?? null

      // ── 2. Recent sessions for rolling avg ───────────────────────────────────
      const recentQ = query(
        collection(db, 'typingResults'),
        where('uid', '==', uid),
        orderBy('completedAt', 'desc'),
        limit(ROLLING_WINDOW),
      )
      const recentSnap = await getDocs(recentQ)
      const recentDocs = recentSnap.docs.map(d => d.data())

      const rollingWpms  = recentDocs.map(d => d.wpm as number).filter(v => v != null)
      const rollingAccys = recentDocs.map(d => d.accuracy as number).filter(v => v != null)

      const rollingAvgWpm  = avg(rollingWpms)
      const rollingAvgAccy = avg(rollingAccys)
      const sessionCount   = recentDocs.length  // placeholder; could do a count query later

      // ── 3. Period/class stats (cadets only) ──────────────────────────────────
      let classBestWpm: number | null  = null
      let classAvgWpm:  number | null  = null
      let classAvgAccy: number | null  = null

      if (showClassStats && periodId && teacherEmail) {
        const periodQ = query(
          collection(db, 'typingResults'),
          where('periodId',     '==', periodId),
          where('schoolYearId', '==', schoolYearId),
          where('teacherEmail', '==', teacherEmail),
          orderBy('completedAt', 'desc'),
          limit(PERIOD_LIMIT),
        )
        const periodSnap = await getDocs(periodQ)
        const periodDocs = periodSnap.docs.map(d => d.data())

        const periodWpms  = periodDocs.map(d => d.wpm as number).filter(v => v != null)
        const periodAccys = periodDocs.map(d => d.accuracy as number).filter(v => v != null)

        classBestWpm = max(periodWpms)
        classAvgWpm  = avg(periodWpms)
        classAvgAccy = avg(periodAccys)
      }

      // ── 4. Commit ────────────────────────────────────────────────────────────
      stats.value = {
        personalBestWpm,
        rollingAvgWpm,
        rollingAvgAccy,
        sessionCount,
        classBestWpm,
        classAvgWpm,
        classAvgAccy,
      }

    } catch (e: any) {
      console.error('[useTypingStats] fetchStats error:', e)
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  // Convenience computed getters with safe fallbacks for the template
  const personalBestWpm = computed(() => stats.value.personalBestWpm ?? '—')
  const rollingAvgWpm   = computed(() => stats.value.rollingAvgWpm   ?? '—')
  const rollingAvgAccy  = computed(() => stats.value.rollingAvgAccy  ?? '—')
  const classBestWpm    = computed(() => stats.value.classBestWpm    ?? '—')
  const classAvgWpm     = computed(() => stats.value.classAvgWpm     ?? '—')
  const classAvgAccy    = computed(() => stats.value.classAvgAccy    ?? '—')

  // Re-fetch when the selected period changes (for Staff/Admin)
  watch(effectivePeriodId, () => {
    if (userInfo.value?.uid) fetchStats()
  })

  return {
    stats,
    isLoading,
    error,
    fetchStats,
    // convenience refs
    personalBestWpm,
    rollingAvgWpm,
    rollingAvgAccy,
    classBestWpm,
    classAvgWpm,
    classAvgAccy,
  }
}
