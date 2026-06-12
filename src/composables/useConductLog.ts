// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useConductLog.ts
//
// Two Firestore collections:
//
//   conductEntries  — anecdotal mid-class notes (positive | negative | neutral)
//                     neutral = auto "no change" entries created by Close Period
//   conductRatings  — end-of-period structured ratings (4 categories, 1–5)
//
// The "conduct score" displayed on the student detail page is stored on the
// student's approvedUsers document and updated with each entry.
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
  collection, addDoc, doc, query, where, orderBy,
  getDocs, serverTimestamp, limit, writeBatch,
} from '@/data/db'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID, QUARTERS, getQuarterIdForDate } from '@/config/schoolYear'
import { clampScore } from '@/composables/useConductScore'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConductEntry {
  id:           string
  studentId:    string
  studentName:  string
  teacherEmail: string
  periodId:     string
  schoolYearId: string
  quarterId:    string
  type:         'positive' | 'negative' | 'neutral'   // neutral = auto no-change
  source:       'teacher' | 'auto'                    // who created the entry
  reason:       string    // which of the 4 categories, or 'auto' for neutral entries
  scoreDelta:   number    // +1, -1, or 0
  scoreAfter:   number | null   // score after this entry was applied (0-4)
  note:         string
  date:         string | null   // YYYY-MM-DD of the class period
  loggedAt:     Date | null
}

export interface ConductRatingValues {
  participation: number   // 1–5
  respect:       number   // 1–5
  onTask:        number   // 1–5
  effort:        number   // 1–5
}

export interface ConductRating {
  id:           string
  studentId:    string
  studentName:  string
  teacherEmail: string
  periodId:     string
  schoolYearId: string
  quarterId:    string
  date:         string   // YYYY-MM-DD — the class period date
  ratings:      ConductRatingValues
  ratedAt:      Date | null
}

export interface ConductCategoryAverages {
  participation: number
  respect:       number
  onTask:        number
  effort:        number
  overall:       number   // average of all four categories
}

/** Lightweight reference used for bulk conduct operations */
export interface ConductStudentRef {
  uid:          string   // Firebase Auth UID = studentId in conductEntries
  displayName:  string
  docId:        string   // approvedUsers doc ID (= email) for score writes
  conductScore: number   // current score, used to compute scoreAfter
}

// ── Reason options (shared between CadetSlideOver and AdminSeatingChart) ──────

export const CONDUCT_REASONS = [
  { key: 'participation', label: 'Participation',   negLabel: 'Not Participating' },
  { key: 'respect',       label: 'Respect',         negLabel: 'Disruptive'        },
  { key: 'onTask',        label: 'On Task',         negLabel: 'Off Task'           },
  { key: 'effort',        label: 'Effort',          negLabel: 'Low Effort'         },
] as const

export type ConductReasonKey = typeof CONDUCT_REASONS[number]['key']

export const AUTO_CLOSE_MESSAGE = 'All systems nominal. Conduct holding steady.'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function currentQuarterId(): string {
  const today = new Date().toISOString().slice(0, 10)
  return getQuarterIdForDate(today) === 'unknown'
    ? QUARTERS[QUARTERS.length - 1].id
    : getQuarterIdForDate(today)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Compute per-category and overall averages from a set of ratings */
export function computeAverages(ratings: ConductRating[]): ConductCategoryAverages | null {
  if (ratings.length === 0) return null
  const sum = { participation: 0, respect: 0, onTask: 0, effort: 0 }
  for (const r of ratings) {
    sum.participation += r.ratings.participation
    sum.respect       += r.ratings.respect
    sum.onTask        += r.ratings.onTask
    sum.effort        += r.ratings.effort
  }
  const n = ratings.length
  const participation = sum.participation / n
  const respect       = sum.respect       / n
  const onTask        = sum.onTask        / n
  const effort        = sum.effort        / n
  const overall       = (participation + respect + onTask + effort) / 4
  return { participation, respect, onTask, effort, overall }
}

// ── Entry mapper ──────────────────────────────────────────────────────────────

function mapEntry(d: any): ConductEntry {
  return {
    id:           d.id,
    studentId:    d.data().studentId,
    studentName:  d.data().studentName,
    teacherEmail: d.data().teacherEmail,
    periodId:     d.data().periodId,
    schoolYearId: d.data().schoolYearId,
    quarterId:    d.data().quarterId,
    type:         d.data().type        ?? 'positive',
    source:       d.data().source      ?? 'teacher',
    reason:       d.data().reason      ?? '',
    scoreDelta:   d.data().scoreDelta  ?? (d.data().type === 'positive' ? 1 : -1),
    scoreAfter:   d.data().scoreAfter  ?? null,
    note:         d.data().note        ?? '',
    date:         d.data().date        ?? null,
    loggedAt:     d.data().loggedAt?.toDate?.() ?? null,
  }
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useConductLog() {
  const entries  = ref<ConductEntry[]>([])
  const ratings  = ref<ConductRating[]>([])
  const loading  = ref(false)
  const saving   = ref(false)

  // ── Fetch entries (anecdotal notes) for a student + quarter ───────────────

  const fetchEntries = async (
    studentId:    string,
    teacherEmail: string,
    quarterId?:   string,
  ) => {
    loading.value = true
    try {
      const qid = quarterId ?? currentQuarterId()
      const q = query(
        collection(db, 'conductEntries'),
        where('studentId',    '==', studentId),
        where('teacherEmail', '==', teacherEmail),
        where('quarterId',    '==', qid),
        orderBy('loggedAt', 'desc'),
        limit(100),
      )
      const snap = await getDocs(q)
      entries.value = snap.docs.map(mapEntry)
    } catch (e) {
      console.error('[useConductLog] fetchEntries error:', e)
    } finally {
      loading.value = false
    }
  }

  // ── Fetch all entries for a cadet (student-facing feed) ───────────────────
  // Queries by studentId only — no teacher or quarter filter.
  // NOTE: Requires a Firestore composite index on conductEntries:
  //       studentId ASC, loggedAt DESC
  //       Firebase will provide a link to create it on first 403 error.

  const fetchEntriesForCadet = async (studentId: string) => {
    loading.value = true
    try {
      const q = query(
        collection(db, 'conductEntries'),
        where('studentId', '==', studentId),
        orderBy('loggedAt', 'desc'),
        limit(200),
      )
      const snap = await getDocs(q)
      entries.value = snap.docs.map(mapEntry)
    } catch (e) {
      console.error('[useConductLog] fetchEntriesForCadet error:', e)
    } finally {
      loading.value = false
    }
  }

  // ── Log a new conduct entry (single student) ──────────────────────────────

  const logEntry = async (params: {
    studentId:    string
    studentName:  string
    teacherEmail: string
    periodId:     string
    type:         'positive' | 'negative' | 'neutral'
    source?:      'teacher' | 'auto'
    reason:       string
    scoreDelta:   number
    scoreAfter?:  number
    note:         string
    date?:        string   // YYYY-MM-DD, defaults to today
  }) => {
    saving.value = true
    try {
      await addDoc(collection(db, 'conductEntries'), {
        studentId:    params.studentId,
        studentName:  params.studentName,
        teacherEmail: params.teacherEmail,
        periodId:     params.periodId,
        schoolYearId: SCHOOL_YEAR_ID,
        quarterId:    currentQuarterId(),
        type:         params.type,
        source:       params.source      ?? 'teacher',
        reason:       params.reason,
        scoreDelta:   params.scoreDelta,
        scoreAfter:   params.scoreAfter  ?? null,
        note:         params.note,
        date:         params.date        ?? todayISO(),
        loggedAt:     serverTimestamp(),
      })
    } finally {
      saving.value = false
    }
  }

  // ── Log conduct entries for multiple students at once ─────────────────────

  const logEntryBulk = async (
    students: ConductStudentRef[],
    params: {
      teacherEmail: string
      periodId:     string
      type:         'positive' | 'negative'
      source?:      'teacher' | 'auto'
      reason:       string
      scoreDelta:   number
      note:         string
      date?:        string
    },
  ) => {
    if (students.length === 0) return
    saving.value = true
    const date      = params.date ?? todayISO()
    const quarterId = currentQuarterId()

    try {
      const batch = writeBatch(db)

      for (const student of students) {
        const newScore  = clampScore(student.conductScore + params.scoreDelta)
        const entryRef  = doc(collection(db, 'conductEntries'))
        const userRef   = doc(db, 'approvedUsers', student.docId)

        batch.set(entryRef, {
          studentId:    student.uid,
          studentName:  student.displayName,
          teacherEmail: params.teacherEmail,
          periodId:     params.periodId,
          schoolYearId: SCHOOL_YEAR_ID,
          quarterId,
          type:         params.type,
          source:       params.source ?? 'teacher',
          reason:       params.reason,
          scoreDelta:   params.scoreDelta,
          scoreAfter:   newScore,
          note:         params.note,
          date,
          loggedAt:     serverTimestamp(),
        })

        batch.update(userRef, { conductScore: newScore })
      }

      await batch.commit()
    } finally {
      saving.value = false
    }
  }

  // ── Close Period — auto-log neutral entries for students with no entry today ─
  // Checks all students in the current period; skips those who already have
  // any entry for today + this period (teacher-authored or auto).
  // Returns { created, skipped } counts.

  const closePeriod = async (
    students:     ConductStudentRef[],
    periodId:     string,
    teacherEmail: string,
    date?:        string,
  ): Promise<{ created: number; skipped: number }> => {
    if (students.length === 0) return { created: 0, skipped: 0 }
    saving.value = true
    const today     = date ?? todayISO()
    const quarterId = currentQuarterId()

    try {
      // 1. Fetch all existing entries for today + period in one query
      const existingQ = query(
        collection(db, 'conductEntries'),
        where('teacherEmail', '==', teacherEmail),
        where('periodId',     '==', periodId),
        where('date',         '==', today),
      )
      const existingSnap  = await getDocs(existingQ)
      const alreadyLogged = new Set(existingSnap.docs.map(d => d.data().studentId as string))

      // 2. Filter to students who need an auto entry
      const needsEntry = students.filter(s => !alreadyLogged.has(s.uid))

      // 3. Batch-write neutral auto entries
      if (needsEntry.length > 0) {
        const batch = writeBatch(db)
        for (const student of needsEntry) {
          const ref = doc(collection(db, 'conductEntries'))
          batch.set(ref, {
            studentId:    student.uid,
            studentName:  student.displayName,
            teacherEmail,
            periodId,
            schoolYearId: SCHOOL_YEAR_ID,
            quarterId,
            type:         'neutral',
            source:       'auto',
            reason:       'auto',
            scoreDelta:   0,
            scoreAfter:   student.conductScore,
            note:         AUTO_CLOSE_MESSAGE,
            date:         today,
            loggedAt:     serverTimestamp(),
          })
        }
        await batch.commit()
      }

      return { created: needsEntry.length, skipped: alreadyLogged.size }
    } finally {
      saving.value = false
    }
  }

  // ── Fetch ratings for a student + quarter ─────────────────────────────────

  const fetchRatings = async (
    studentId:    string,
    teacherEmail: string,
    quarterId?:   string,
  ) => {
    loading.value = true
    try {
      const qid = quarterId ?? currentQuarterId()
      const q = query(
        collection(db, 'conductRatings'),
        where('studentId',    '==', studentId),
        where('teacherEmail', '==', teacherEmail),
        where('quarterId',    '==', qid),
        orderBy('date', 'desc'),
        limit(100),
      )
      const snap = await getDocs(q)
      ratings.value = snap.docs.map(d => ({
        id:           d.id,
        studentId:    d.data().studentId,
        studentName:  d.data().studentName,
        teacherEmail: d.data().teacherEmail,
        periodId:     d.data().periodId,
        schoolYearId: d.data().schoolYearId,
        quarterId:    d.data().quarterId,
        date:         d.data().date,
        ratings:      d.data().ratings,
        ratedAt:      d.data().ratedAt?.toDate?.() ?? null,
      }))
    } catch (e) {
      console.error('[useConductLog] fetchRatings error:', e)
    } finally {
      loading.value = false
    }
  }

  // ── Save an end-of-period rating ─────────────────────────────────────────

  const saveRating = async (params: {
    studentId:    string
    studentName:  string
    teacherEmail: string
    periodId:     string
    ratings:      ConductRatingValues
    date?:        string   // defaults to today
  }) => {
    saving.value = true
    try {
      await addDoc(collection(db, 'conductRatings'), {
        studentId:    params.studentId,
        studentName:  params.studentName,
        teacherEmail: params.teacherEmail,
        periodId:     params.periodId,
        schoolYearId: SCHOOL_YEAR_ID,
        quarterId:    currentQuarterId(),
        date:         params.date ?? todayISO(),
        ratings:      params.ratings,
        ratedAt:      serverTimestamp(),
      })
    } finally {
      saving.value = false
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const averages = () => computeAverages(ratings.value)

  return {
    entries,
    ratings,
    loading,
    saving,
    fetchEntries,
    fetchEntriesForCadet,
    fetchRatings,
    logEntry,
    logEntryBulk,
    closePeriod,
    saveRating,
    averages,
    currentQuarterId,
    todayISO,
    computeAverages,
  }
}
