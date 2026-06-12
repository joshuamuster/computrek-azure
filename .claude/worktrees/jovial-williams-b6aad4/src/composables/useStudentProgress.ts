// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useStudentProgress.ts
//
// Computes per-lesson unlock state for the student Typing page.
//
// Rules
//   • Lessons are sorted by their `order` field before the chain is evaluated.
//   • First lesson is always unlocked.
//   • Each subsequent lesson unlocks only when the previous lesson is passed.
//   • "Passed" means:
//       – test lessonType  → best score ≥ 70 (C grade or above)
//       – tutorial/lesson  → any attempt where passed === true
//   • Tests sit between sections in the order chain, so they act as natural
//     hard gates: a failed or un-taken test blocks the entire next section.
//   • This composable does NOT know or care whether a test is currently
//     "open" in class — that gate is handled separately by useTestSessions.
// ─────────────────────────────────────────────────────────────────────────────

import { ref, computed } from 'vue'
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import type { TypingLesson } from '@/composables/useTypingContent'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BestResult {
  lessonId:    string
  lessonType:  string
  passed:      boolean       // tutorials/lessons: met targetWpm + targetAccuracy
  score:       number | null // tests: 0–100 numeric grade; null for non-tests
  attempts:    number
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useStudentProgress() {
  const { userInfo } = useAuth()

  const isLoading  = ref(false)
  const fetchError = ref<string | null>(null)

  /**
   * Best result keyed by lessonId.
   * Populated by fetchProgress(); empty until then.
   */
  const bestResults = ref<Record<string, BestResult>>({})

  // ── Fetch ──────────────────────────────────────────────────────────────────

  /**
   * Load all typingResults for this student in the current school year,
   * then reduce them to a single BestResult per lessonId.
   *
   * Best is defined as:
   *   – for tests:             highest score
   *   – for tutorial/lesson:   any attempt with passed === true wins;
   *                            otherwise keep the one with the highest WPM
   */
  const fetchProgress = async (): Promise<void> => {
    const uid         = userInfo.value?.uid
    const schoolYearId = userInfo.value?.schoolYearId ?? '2025-2026'
    if (!uid) return

    isLoading.value  = true
    fetchError.value = null

    try {
      const q = query(
        collection(db, 'typingResults'),
        where('uid',          '==', uid),
        where('schoolYearId', '==', schoolYearId),
        where('mode',         '==', 'lesson'),   // only structured-lesson attempts matter
      )
      const snap = await getDocs(q)

      const acc: Record<string, BestResult> = {}

      for (const doc of snap.docs) {
        const d          = doc.data()
        const lessonId   = d.lessonId as string | undefined
        if (!lessonId) continue

        const lessonType = (d.lessonType as string) || 'lesson'
        const passed     = !!(d.passed)
        const score      = typeof d.score === 'number' ? d.score : null
        const wpm        = typeof d.wpm   === 'number' ? d.wpm   : 0

        const existing = acc[lessonId]

        if (!existing) {
          acc[lessonId] = { lessonId, lessonType, passed, score, attempts: 1 }
          continue
        }

        // Always increment attempts
        existing.attempts++

        if (lessonType === 'test') {
          // Keep the highest test score
          if (score !== null && (existing.score === null || score > existing.score)) {
            existing.score = score
            existing.passed = score >= 70
          }
        } else {
          // Once passed, always passed
          if (!existing.passed && passed) {
            existing.passed = true
          }
          // (We don't track WPM for unlock purposes, so no further merging needed)
        }
      }

      bestResults.value = acc

    } catch (e: any) {
      console.error('[useStudentProgress] fetchProgress error:', e)
      fetchError.value = e.message ?? 'Unknown error'
    } finally {
      isLoading.value = false
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * True if the student has "passed" this lesson for display purposes:
   *   – test    → best score ≥ 70
   *   – other   → any attempt recorded passed === true
   */
  const hasPassedLesson = (lesson: TypingLesson): boolean => {
    const r = bestResults.value[lesson.id]
    if (!r) return false
    if (lesson.lessonType === 'test') return (r.score ?? 0) >= 70
    return r.passed
  }

  /**
   * True if this lesson has been "cleared" for the purpose of unlocking
   * the next lesson in the chain:
   *   – test    → any attempt counts (score doesn't matter — teacher used
   *               it as a pace gate, not a hard pass requirement)
   *   – other   → must be passed (met WPM + accuracy targets)
   */
  const hasClearedForProgress = (lesson: TypingLesson): boolean => {
    const r = bestResults.value[lesson.id]
    if (!r) return false
    if (lesson.lessonType === 'test') return r.attempts > 0
    return r.passed
  }

  /**
   * Given the full sorted lesson array (ascending by order), returns the Set
   * of lesson IDs the student is currently allowed to access.
   *
   * Chain rule:
   *   – First lesson always unlocked.
   *   – Each subsequent lesson unlocks when the previous lesson is cleared.
   *   – Tests clear on any attempt (session gate enforces when they can be taken).
   *   – Regular lessons clear only when passed.
   */
  const computeUnlocked = (sortedLessons: TypingLesson[]): Set<string> => {
    const unlocked = new Set<string>()
    if (sortedLessons.length === 0) return unlocked

    unlocked.add(sortedLessons[0].id)

    for (let i = 1; i < sortedLessons.length; i++) {
      const prev = sortedLessons[i - 1]
      if (hasClearedForProgress(prev)) {
        unlocked.add(sortedLessons[i].id)
      } else {
        break   // chain is broken — nothing after this unlocks
      }
    }

    return unlocked
  }

  // ── Derived helpers ────────────────────────────────────────────────────────

  /** Best score (0–100) for a test lesson, or null if not yet attempted. */
  const bestScore = (lessonId: string): number | null =>
    bestResults.value[lessonId]?.score ?? null

  /** Number of attempts for any lesson, or 0 if never attempted. */
  const attemptCount = (lessonId: string): number =>
    bestResults.value[lessonId]?.attempts ?? 0

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    // State
    bestResults,
    isLoading,
    fetchError,

    // Methods
    fetchProgress,
    hasPassedLesson,
    computeUnlocked,
    bestScore,
    attemptCount,
  }
}
