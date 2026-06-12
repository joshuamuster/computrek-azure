// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useConductLog.ts
//
// Two Firestore collections:
//
//   conductEntries  — anecdotal mid-class notes (positive | negative + text)
//   conductRatings  — end-of-period structured ratings (4 categories, 1–5)
//
// The "conduct score" displayed on the student detail page is computed from
// conductRatings averages per quarter. conductEntries are narrative context only.
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
  collection, addDoc, query, where, orderBy,
  getDocs, serverTimestamp, limit,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID, QUARTERS, getQuarterIdForDate } from '@/config/schoolYear'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConductEntry {
  id:           string
  studentId:    string
  studentName:  string
  teacherEmail: string
  periodId:     string
  schoolYearId: string
  quarterId:    string
  type:         'positive' | 'negative'
  reason:       string    // which of the 4 categories drove the change
  scoreDelta:   number    // +1 or -1
  note:         string
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
      entries.value = snap.docs.map(d => ({
        id:           d.id,
        studentId:    d.data().studentId,
        studentName:  d.data().studentName,
        teacherEmail: d.data().teacherEmail,
        periodId:     d.data().periodId,
        schoolYearId: d.data().schoolYearId,
        quarterId:    d.data().quarterId,
        type:         d.data().type,
        reason:       d.data().reason       ?? '',
        scoreDelta:   d.data().scoreDelta   ?? (d.data().type === 'positive' ? 1 : -1),
        note:         d.data().note         ?? '',
        loggedAt:     d.data().loggedAt?.toDate?.() ?? null,
      }))
    } catch (e) {
      console.error('[useConductLog] fetchEntries error:', e)
    } finally {
      loading.value = false
    }
  }

  // ── Log a new conduct entry ───────────────────────────────────────────────

  const logEntry = async (params: {
    studentId:    string
    studentName:  string
    teacherEmail: string
    periodId:     string
    type:         'positive' | 'negative'
    reason:       string   // which of the 4 categories drove the change
    scoreDelta:   number   // +1 or -1
    note:         string
  }) => {
    saving.value = true
    try {
      await addDoc(collection(db, 'conductEntries'), {
        ...params,
        schoolYearId: SCHOOL_YEAR_ID,
        quarterId:    currentQuarterId(),
        loggedAt:     serverTimestamp(),
      })
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
    fetchRatings,
    logEntry,
    saveRating,
    averages,
    currentQuarterId,
    todayISO,
    computeAverages,
  }
}
