/**
 * useActivityLog
 *
 * Writes cadet activity events to the `activityLogs` Firestore collection.
 * Non-blocking — errors are swallowed so logging never breaks the user experience.
 *
 * Usage:
 *   const { logEvent } = useActivityLog()
 *   await logEvent('sign_in', {})
 *   await logEvent('game_complete',   { gameId: 'chess', score: 5 })
 *   await logEvent('typing_complete', { mode: 'lesson', lessonId: 'L03', wpm: 62, accuracy: 97 })
 */
import { addDoc, collection, serverTimestamp } from '@/data/db'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { SCHOOL_YEAR_ID } from '@/config/schoolYear'

export function useActivityLog() {
  const { userInfo, userRole } = useAuth()

  /**
   * @param {string} event  - 'sign_in' | 'game_complete' | 'typing_complete'
   * @param {object} detail - event-specific metadata
   * @param {object|null} explicitUser - pass a user object directly on sign-in
   *                                     (before reactive userInfo is populated)
   */
  const logEvent = async (event, detail = {}, explicitUser = null) => {
    // Only log for cadets
    const role = userRole.value
    if (!explicitUser && role !== 'cadet') return

    const user = explicitUser ?? userInfo.value
    if (!user?.uid) return

    try {
      await addDoc(collection(db, 'activityLogs'), {
        uid:           user.uid,
        displayName:   user.displayName  ?? 'Unknown Cadet',
        teacherEmail:  user.teacherEmail ?? null,
        periodId:      user.periodId     ?? null,
        schoolYearId:  user.schoolYearId ?? SCHOOL_YEAR_ID,
        event,
        detail,
        timestamp:     serverTimestamp(),
      })
    } catch (e) {
      // Non-fatal — logging failure must never break the app
      console.warn('[useActivityLog] logEvent error:', e)
    }
  }

  return { logEvent }
}
