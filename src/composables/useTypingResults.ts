// composables/useTypingResults.ts
//
// Handles all Firestore reads and writes for typing session results.
//
// Usage — save a completed session:
//   const { saveResult } = useTypingResults()
//   await saveResult('speed-test', engineResult)
//
// Usage — fetch student's own history:
//   const { fetchMyHistory, myHistory } = useTypingResults()
//   await fetchMyHistory()
//
// Usage — fetch best WPM for personal-best comparison:
//   const { fetchMyBestWpm } = useTypingResults()
//   const best = await fetchMyBestWpm('speed-test')

import { ref } from 'vue'
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useActivityLog } from '@/composables/useActivityLog.js'
import type { TypingResult } from '@/composables/useTypingEngine'

export type TypingMode = 'speed-test' | 'lesson' | 'custom' | 'weakness-drill'

export interface TypingResultDoc extends TypingResult {
  uid:            string
  displayName:    string
  periodId:       string
  schoolYearId:   string
  teacherEmail:   string
  mode:           TypingMode
  lessonId?:      string    // set when mode === 'lesson'
  lessonType?:    string    // 'keys' | 'review' | 'practice' | 'play' | 'drill' | 'lesson' | 'test' | 'placement-test'
  textId?:        string    // set when mode === 'custom'
  passed?:        boolean   // true if WPM + accuracy both met targets (tutorial/lesson)
  score?:         number    // 0–100 computed grade (tests only)
  completedAt:    ReturnType<typeof serverTimestamp>
}

export interface TypingHistoryEntry extends TypingResult {
  id:           string
  mode:         TypingMode
  completedAt:  Date | null
}

export function useTypingResults() {
  const { userInfo, userRole } = useAuth()
  const { logEvent } = useActivityLog()

  const isSaving  = ref(false)
  const saveError = ref<string | null>(null)

  // ── Helpers ────────────────────────────────────────────────────────────────

  const resolvedPeriodId = (): string => {
    const role = (userRole.value ?? '').toLowerCase()
    if (['staff', 'admin'].includes(role)) return 'staff'
    return userInfo.value?.periodId ?? 'staff'
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  /**
   * Save a completed typing session to Firestore.
   * Every session is a new document (addDoc, not setDoc).
   *
   * @param mode     - which mode was played
   * @param result   - output from engine.buildResult()
   * @param extras   - optional lesson metadata and grading fields
   * @returns        - the new document id, or null on error
   */
  const saveResult = async (
    mode: TypingMode,
    result: TypingResult,
    extras: {
      lessonId?:   string
      lessonType?: string
      textId?:     string
      passed?:     boolean
      score?:      number
    } = {}
  ): Promise<string | null> => {
    const uid = userInfo.value?.uid
    if (!uid) {
      console.warn('[useTypingResults] saveResult called before user loaded')
      return null
    }

    isSaving.value  = true
    saveError.value = null

    try {
      const doc: Omit<TypingResultDoc, 'completedAt'> & { completedAt: ReturnType<typeof serverTimestamp> } = {
        uid,
        displayName:   userInfo.value?.displayName  ?? 'Unknown Cadet',
        periodId:      resolvedPeriodId(),
        schoolYearId:  userInfo.value?.schoolYearId ?? '2025-2026',
        teacherEmail:  userInfo.value?.teacherEmail ?? '',
        mode,
        wpm:           result.accuracy >= 80 ? result.wpm : 0,
        accuracy:      result.accuracy,
        duration:      result.duration,
        activeSeconds: result.activeSeconds,
        charsTyped:    result.charsTyped,
        keyErrors:     result.keyErrors,
        completedAt:   serverTimestamp(),
        ...( extras.lessonId   !== undefined ? { lessonId:   extras.lessonId   } : {} ),
        ...( extras.lessonType !== undefined ? { lessonType: extras.lessonType } : {} ),
        ...( extras.textId     !== undefined ? { textId:     extras.textId     } : {} ),
        ...( extras.passed     !== undefined ? { passed:     extras.passed     } : {} ),
        ...( extras.score      !== undefined ? { score:      extras.score      } : {} ),
      }

      const ref = await addDoc(collection(db, 'typingResults'), doc)

      // Activity log — fire-and-forget, non-blocking
      logEvent('typing_complete', {
        mode,
        lessonId:  extras.lessonId  ?? null,
        wpm:       doc.wpm,
        accuracy:  doc.accuracy,
        passed:    extras.passed    ?? null,
      })

      return ref.id

    } catch (e: any) {
      console.error('[useTypingResults] saveResult error:', e)
      saveError.value = e.message
      return null

    } finally {
      isSaving.value = false
    }
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  const myHistory = ref<TypingHistoryEntry[]>([])
  const isLoading = ref(false)

  /**
   * Fetch the current user's most recent typing sessions.
   * Populates the `myHistory` ref and returns the array.
   */
  const fetchMyHistory = async (limitN = 20): Promise<TypingHistoryEntry[]> => {
    const uid = userInfo.value?.uid
    if (!uid) return []

    isLoading.value = true
    try {
      const q = query(
        collection(db, 'typingResults'),
        where('uid', '==', uid),
        orderBy('completedAt', 'desc'),
        limit(limitN)
      )
      const snap = await getDocs(q)
      myHistory.value = snap.docs.map(d => {
        const data = d.data()
        return {
          id:         d.id,
          mode:       data.mode,
          wpm:        data.wpm,
          accuracy:   data.accuracy,
          duration:   data.duration,
          charsTyped: data.charsTyped,
          keyErrors:  data.keyErrors ?? {},
          completedAt: data.completedAt?.toDate?.() ?? null,
        }
      })
      return myHistory.value

    } catch (e) {
      console.error('[useTypingResults] fetchMyHistory error:', e)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get the current user's best WPM for a given mode.
   * Used by TypingResultsCard to show "New personal record!" banners.
   */
  const fetchMyBestWpm = async (mode?: TypingMode): Promise<number | null> => {
    const uid = userInfo.value?.uid
    if (!uid) return null

    try {
      const constraints = [
        where('uid', '==', uid),
        orderBy('wpm', 'desc'),
        limit(1),
      ]
      if (mode) constraints.splice(1, 0, where('mode', '==', mode))

      const q    = query(collection(db, 'typingResults'), ...constraints)
      const snap = await getDocs(q)
      if (snap.empty) return null
      return snap.docs[0].data().wpm ?? null

    } catch (e) {
      console.error('[useTypingResults] fetchMyBestWpm error:', e)
      return null
    }
  }

  /** Get the current user's best attempt (by WPM) for one specific lesson. */
  const fetchMyBestWpmForLesson = async (lessonId: string): Promise<{ wpm: number; accuracy: number } | null> => {
    const uid = userInfo.value?.uid
    if (!uid) return null
    try {
      const q = query(
        collection(db, 'typingResults'),
        where('uid',      '==', uid),
        where('lessonId', '==', lessonId),
        orderBy('wpm', 'desc'),
        limit(1),
      )
      const snap = await getDocs(q)
      if (snap.empty) return null
      const d = snap.docs[0].data()
      const wpm      = typeof d.wpm      === 'number' ? d.wpm      : null
      const accuracy = typeof d.accuracy === 'number' ? d.accuracy : null
      if (wpm === null) return null
      return { wpm, accuracy: accuracy ?? 0 }
    } catch (e) {
      console.error('[useTypingResults] fetchMyBestWpmForLesson error:', e)
      return null
    }
  }

  /**
   * Admin: fetch all results for a period in the current school year.
   * Returns raw result docs sorted by completedAt desc.
   */
  const fetchPeriodResults = async (
    periodId: string,
    schoolYearId: string,
    teacherEmail: string,
    limitN = 200
  ) => {
    try {
      const q = query(
        collection(db, 'typingResults'),
        where('periodId',     '==', periodId),
        where('schoolYearId', '==', schoolYearId),
        where('teacherEmail', '==', teacherEmail),
        orderBy('completedAt', 'desc'),
        limit(limitN)
      )
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    } catch (e) {
      console.error('[useTypingResults] fetchPeriodResults error:', e)
      return []
    }
  }

  /**
   * Admin: fetch typing history for any student by uid.
   * Used by the student detail page to show a cadet's sessions.
   */
  const fetchResultsByStudent = async (uid: string, limitN = 50): Promise<TypingHistoryEntry[]> => {
    try {
      const q = query(
        collection(db, 'typingResults'),
        where('uid', '==', uid),
        orderBy('completedAt', 'desc'),
        limit(limitN),
      )
      const snap = await getDocs(q)
      return snap.docs.map(d => {
        const data = d.data()
        return {
          id:          d.id,
          mode:        data.mode,
          wpm:         data.wpm,
          accuracy:    data.accuracy,
          duration:    data.duration,
          charsTyped:  data.charsTyped,
          keyErrors:   data.keyErrors ?? {},
          completedAt: data.completedAt?.toDate?.() ?? null,
        }
      })
    } catch (e) {
      console.error('[useTypingResults] fetchResultsByStudent error:', e)
      return []
    }
  }

  return {
    // State
    isSaving,
    saveError,
    isLoading,
    myHistory,

    // Methods
    saveResult,
    fetchMyHistory,
    fetchMyBestWpm,
    fetchMyBestWpmForLesson,
    fetchPeriodResults,
    fetchResultsByStudent,
  }
}
