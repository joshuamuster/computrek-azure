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
import type { TypingResult } from '@/composables/useTypingEngine'

export type TypingMode = 'speed-test' | 'lesson' | 'custom' | 'weakness-drill'

export interface TypingResultDoc extends TypingResult {
  uid:          string
  displayName:  string
  periodId:     string
  schoolYearId: string
  teacherEmail: string
  mode:         TypingMode
  lessonId?:    string   // set when mode === 'lesson'
  textId?:      string   // set when mode === 'custom'
  completedAt:  ReturnType<typeof serverTimestamp>
}

export interface TypingHistoryEntry extends TypingResult {
  id:           string
  mode:         TypingMode
  completedAt:  Date | null
}

export function useTypingResults() {
  const { userInfo, userRole } = useAuth()

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
   * @param extras   - optional { lessonId, textId } for lesson/custom modes
   * @returns        - the new document id, or null on error
   */
  const saveResult = async (
    mode: TypingMode,
    result: TypingResult,
    extras: { lessonId?: string; textId?: string } = {}
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
        displayName:  userInfo.value?.displayName  ?? 'Unknown Cadet',
        periodId:     resolvedPeriodId(),
        schoolYearId: userInfo.value?.schoolYearId ?? '2025-2026',
        teacherEmail: userInfo.value?.teacherEmail ?? '',
        mode,
        wpm:          result.wpm,
        accuracy:     result.accuracy,
        duration:     result.duration,
        charsTyped:   result.charsTyped,
        keyErrors:    result.keyErrors,
        completedAt:  serverTimestamp(),
        ...( extras.lessonId ? { lessonId: extras.lessonId } : {} ),
        ...( extras.textId   ? { textId:   extras.textId   } : {} ),
      }

      const ref = await addDoc(collection(db, 'typingResults'), doc)
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
    fetchPeriodResults,
  }
}
