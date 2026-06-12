// composables/useTestSessions.ts
//
// Manages "open test session" state so teachers can unlock a typing test
// for their period during class, and students see it as available or locked.
//
// Firestore schema:
//   activeTestSessions/{periodId} {
//     lessonId:     string   — which test lesson is open
//     openedAt:     Timestamp
//     openedBy:     string   — teacher email
//     schoolYearId: string
//     teacherEmail: string
//   }
//
// Usage (teacher admin):
//   const { openTestSession, closeTestSession } = useTestSessions()
//   await openTestSession('period-2', 'test-1')
//   await closeTestSession('period-2')
//
// Usage (student — reactive, real-time):
//   const { activeSession, watchTestSession, stopWatching } = useTestSessions()
//   watchTestSession('period-2')   // sets up onSnapshot listener
//   // activeSession.value is null when locked, or { lessonId, ... } when open

import { ref } from 'vue'
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'

export interface ActiveTestSession {
  lessonId:     string
  openedBy:     string
  schoolYearId: string
  teacherEmail: string
  openedAt:     Date | null
}

export function useTestSessions() {
  const { userInfo } = useAuth()

  const activeSession = ref<ActiveTestSession | null>(null)
  const isLoading     = ref(false)
  const error         = ref<string | null>(null)

  let unsubscribe: (() => void) | null = null

  // ── Teacher: open a test for a period ─────────────────────────────────────

  /**
   * Open a test session for the given period.
   * Overwrites any existing open session for that period.
   */
  const openTestSession = async (periodId: string, lessonId: string): Promise<boolean> => {
    error.value = null
    try {
      await setDoc(doc(db, 'activeTestSessions', periodId), {
        lessonId,
        openedBy:     userInfo.value?.email       ?? '',
        schoolYearId: userInfo.value?.schoolYearId ?? '2025-2026',
        teacherEmail: userInfo.value?.teacherEmail ?? userInfo.value?.email ?? '',
        openedAt:     serverTimestamp(),
      })
      return true
    } catch (e: any) {
      console.error('[useTestSessions] openTestSession error:', e)
      error.value = e.message
      return false
    }
  }

  // ── Teacher: close the test session for a period ───────────────────────────

  const closeTestSession = async (periodId: string): Promise<boolean> => {
    error.value = null
    try {
      await deleteDoc(doc(db, 'activeTestSessions', periodId))
      return true
    } catch (e: any) {
      console.error('[useTestSessions] closeTestSession error:', e)
      error.value = e.message
      return false
    }
  }

  // ── One-time fetch (admin use) ─────────────────────────────────────────────

  const fetchTestSession = async (periodId: string): Promise<ActiveTestSession | null> => {
    try {
      const snap = await getDoc(doc(db, 'activeTestSessions', periodId))
      if (!snap.exists()) return null
      const d = snap.data()
      return {
        lessonId:     d.lessonId,
        openedBy:     d.openedBy,
        schoolYearId: d.schoolYearId,
        teacherEmail: d.teacherEmail,
        openedAt:     d.openedAt?.toDate?.() ?? null,
      }
    } catch (e) {
      console.error('[useTestSessions] fetchTestSession error:', e)
      return null
    }
  }

  // ── Student: real-time listener ────────────────────────────────────────────

  /**
   * Subscribe to live updates for a period's test session.
   * Updates `activeSession` reactively — null when no test is open.
   * Call stopWatching() on component unmount.
   */
  const watchTestSession = (periodId: string) => {
    stopWatching()
    isLoading.value = true

    unsubscribe = onSnapshot(
      doc(db, 'activeTestSessions', periodId),
      (snap) => {
        isLoading.value = false
        if (!snap.exists()) {
          activeSession.value = null
          return
        }
        const d = snap.data()
        activeSession.value = {
          lessonId:     d.lessonId,
          openedBy:     d.openedBy,
          schoolYearId: d.schoolYearId,
          teacherEmail: d.teacherEmail,
          openedAt:     d.openedAt?.toDate?.() ?? null,
        }
      },
      (e) => {
        console.error('[useTestSessions] watchTestSession error:', e)
        isLoading.value = false
        activeSession.value = null
      }
    )
  }

  const stopWatching = () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  return {
    activeSession,
    isLoading,
    error,
    openTestSession,
    closeTestSession,
    fetchTestSession,
    watchTestSession,
    stopWatching,
  }
}
