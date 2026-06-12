// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useEndOfPeriodReport.ts
//
// Fetches class-level stats for a specific period and date for AdminReports.
//
// Three metric areas:
//   typing   — WPM/accuracy for typingResults completed on the selected date
//   missions — submission stats for assignments due on the selected date
//   conduct  — average conductRatings logged on the selected date
//
// Also provides fetchRoster() for the "By Student" tab — loads the student
// list for a period with aggregated conduct score, latest WPM, and Q turn-in rate.
//
// Data strategy:
//   All queries use existing index patterns from useTypingStats / useConductLog.
//   Date filtering for typing is done client-side to avoid needing new indexes.
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
  collection, query, where, orderBy, limit,
  getDocs, Timestamp,
} from '@/data/db'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID, QUARTERS, getQuarterIdForDate } from '@/config/schoolYear'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TypingSnapshot {
  sessionCount:      number         // typing sessions logged today for this period
  participantCount:  number         // distinct students who typed today
  avgWpm:            number | null
  avgAccuracy:       number | null
  topWpm:            number | null
}

export interface MissionSnapshot {
  assignments: {
    id:             string
    title:          string
    totalStudents:  number
    submittedCount: number          // submitted + graded + returned
    gradedCount:    number          // graded only
    avgScore:       number | null   // avg pointsEarned among graded docs
    pointsPossible: number | null
  }[]
  // Rolled-up totals across all due assignments
  totalStudents:  number
  submittedCount: number
  gradedCount:    number
}

export interface ConductSnapshot {
  ratingCount:     number           // how many students were rated today
  totalStudents:   number           // total students in the period
  avgOverall:      number | null    // 1–5
  avgParticipation: number | null
  avgRespect:       number | null
  avgOnTask:        number | null
  avgEffort:        number | null
}

export interface StudentRosterRow {
  uid:          string
  displayName:  string
  periodId:     string
  conductScore: number              // 0–4 integer from approvedUsers doc
  latestWpm:    number | null       // most recent typing session WPM this year
  turnInRate:   number | null       // % missions submitted this quarter (0–100)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const avg = (arr: number[]): number | null =>
  arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null

const pct = (num: number, den: number): number =>
  den > 0 ? Math.round((num / den) * 100) : 0

/** Returns [startOfDay, startOfNextDay] as Firestore Timestamps. */
function dayBounds(dateStr: string): [Timestamp, Timestamp] {
  const start = new Date(dateStr + 'T00:00:00')
  const end   = new Date(dateStr + 'T00:00:00')
  end.setDate(end.getDate() + 1)
  return [Timestamp.fromDate(start), Timestamp.fromDate(end)]
}

/** Chunk an array into groups of n. */
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useEndOfPeriodReport() {
  const typing   = ref<TypingSnapshot | null>(null)
  const missions = ref<MissionSnapshot | null>(null)
  const conduct  = ref<ConductSnapshot | null>(null)
  const roster   = ref<StudentRosterRow[]>([])

  const isLoading       = ref(false)
  const isRosterLoading = ref(false)
  const error           = ref<string | null>(null)

  // ── End of Period fetch ─────────────────────────────────────────────────────
  // Fetches all three metric areas for a specific period + date.

  const fetchEndOfPeriod = async (
    periodId:     string,
    teacherEmail: string | undefined,
    dateStr:      string,             // YYYY-MM-DD
  ) => {
    isLoading.value = true
    error.value     = null
    typing.value    = null
    missions.value  = null
    conduct.value   = null

    try {
      await Promise.all([
        _fetchTyping(periodId, teacherEmail, dateStr),
        _fetchMissions(periodId, teacherEmail, dateStr),
        _fetchConduct(periodId, teacherEmail, dateStr),
      ])
    } catch (e: any) {
      console.error('[useEndOfPeriodReport] fetchEndOfPeriod:', e)
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  // ── Typing ──────────────────────────────────────────────────────────────────

  const _fetchTyping = async (
    periodId:     string,
    teacherEmail: string | undefined,
    dateStr:      string,
  ) => {
    // Build query: period + teacher scoped, recent sessions (client-side date filter)
    const constraints: any[] = [
      where('periodId',     '==', periodId),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
      orderBy('completedAt', 'desc'),
      limit(500),
    ]
    if (teacherEmail) {
      constraints.splice(2, 0, where('teacherEmail', '==', teacherEmail))
    }

    const snap = await getDocs(query(collection(db, 'typingResults'), ...constraints))
    const [dayStart, dayEnd] = dayBounds(dateStr)

    // Filter to sessions completed on the selected date
    const docs = snap.docs
      .map(d => d.data())
      .filter(d => {
        const ts: Timestamp | null = d.completedAt ?? null
        if (!ts) return false
        return ts.toMillis() >= dayStart.toMillis() && ts.toMillis() < dayEnd.toMillis()
      })

    const wpms     = docs.map(d => d.wpm     as number).filter(v => v != null)
    const accys    = docs.map(d => d.accuracy as number).filter(v => v != null)
    const uids     = new Set(docs.map(d => d.uid as string).filter(Boolean))

    typing.value = {
      sessionCount:     docs.length,
      participantCount: uids.size,
      avgWpm:           avg(wpms),
      avgAccuracy:      avg(accys),
      topWpm:           wpms.length ? Math.max(...wpms) : null,
    }
  }

  // ── Missions ────────────────────────────────────────────────────────────────

  const _fetchMissions = async (
    periodId:     string,
    teacherEmail: string | undefined,
    dateStr:      string,
  ) => {
    // 1. Find assignments due on the selected date for this period
    const aConstraints: any[] = [
      where('periodId',     '==', periodId),
      where('dueDate',      '==', dateStr),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    ]
    if (teacherEmail) aConstraints.push(where('teacherEmail', '==', teacherEmail))

    const aSnap = await getDocs(query(collection(db, 'assignments'), ...aConstraints))
    if (aSnap.empty) {
      missions.value = { assignments: [], totalStudents: 0, submittedCount: 0, gradedCount: 0 }
      return
    }

    // 2. Fetch mission titles (for display) — one doc per unique missionId
    const missionIds = [...new Set(aSnap.docs.map(d => d.data().missionId as string))]
    const missionTitles: Record<string, string> = {}
    const missionPoints: Record<string, number | null> = {}
    if (missionIds.length) {
      for (const ch of chunk(missionIds, 30)) {
        const mSnap = await getDocs(query(
          collection(db, 'missions'),
          where('__name__', 'in', ch),
        ))
        mSnap.docs.forEach(d => {
          missionTitles[d.id] = d.data().title ?? '(Untitled Mission)'
          missionPoints[d.id] = d.data().pointsPossible ?? null
        })
      }
    }

    // 3. Fetch submissions for each assignment
    const assignmentRows: MissionSnapshot['assignments'] = []
    let totalStudents  = 0
    let totalSubmitted = 0
    let totalGraded    = 0

    for (const aDoc of aSnap.docs) {
      const aData = aDoc.data()
      const sSnap = await getDocs(query(
        collection(db, 'submissions'),
        where('assignmentId', '==', aDoc.id),
        where('periodId',     '==', periodId),
      ))

      const subs          = sSnap.docs.map(d => d.data())
      const allCount      = subs.length
      const submittedSubs = subs.filter(s => ['submitted', 'graded', 'returned'].includes(s.status))
      const gradedSubs    = subs.filter(s => s.status === 'graded')
      const scores        = gradedSubs.map(s => s.pointsEarned as number).filter(v => v != null)

      assignmentRows.push({
        id:             aDoc.id,
        title:          missionTitles[aData.missionId] ?? '(Untitled)',
        totalStudents:  allCount,
        submittedCount: submittedSubs.length,
        gradedCount:    gradedSubs.length,
        avgScore:       avg(scores),
        pointsPossible: missionPoints[aData.missionId] ?? null,
      })

      totalStudents  += allCount
      totalSubmitted += submittedSubs.length
      totalGraded    += gradedSubs.length
    }

    missions.value = {
      assignments:    assignmentRows,
      totalStudents,
      submittedCount: totalSubmitted,
      gradedCount:    totalGraded,
    }
  }

  // ── Conduct ─────────────────────────────────────────────────────────────────

  const _fetchConduct = async (
    periodId:     string,
    teacherEmail: string | undefined,
    dateStr:      string,
  ) => {
    // Fetch today's conduct ratings for this period
    const constraints: any[] = [
      where('periodId', '==', periodId),
      where('date',     '==', dateStr),
      limit(200),
    ]
    if (teacherEmail) constraints.push(where('teacherEmail', '==', teacherEmail))

    const snap = await getDocs(query(collection(db, 'conductRatings'), ...constraints))
    const docs = snap.docs.map(d => d.data())

    if (docs.length === 0) {
      // Also fetch total student count so we can show "0 of N rated"
      const total = await _fetchPeriodStudentCount(periodId, teacherEmail)
      conduct.value = {
        ratingCount: 0, totalStudents: total,
        avgOverall: null, avgParticipation: null,
        avgRespect: null, avgOnTask: null, avgEffort: null,
      }
      return
    }

    const participations = docs.map(d => d.ratings?.participation as number).filter(v => v != null)
    const respects       = docs.map(d => d.ratings?.respect       as number).filter(v => v != null)
    const onTasks        = docs.map(d => d.ratings?.onTask        as number).filter(v => v != null)
    const efforts        = docs.map(d => d.ratings?.effort        as number).filter(v => v != null)

    const avgP = avg(participations)
    const avgR = avg(respects)
    const avgO = avg(onTasks)
    const avgE = avg(efforts)

    const all4 = [avgP, avgR, avgO, avgE].filter(v => v != null) as number[]
    const total = await _fetchPeriodStudentCount(periodId, teacherEmail)

    conduct.value = {
      ratingCount:      docs.length,
      totalStudents:    total,
      avgOverall:       avg(all4),
      avgParticipation: avgP,
      avgRespect:       avgR,
      avgOnTask:        avgO,
      avgEffort:        avgE,
    }
  }

  // Helper: count students in a period
  const _fetchPeriodStudentCount = async (
    periodId:     string,
    teacherEmail: string | undefined,
  ): Promise<number> => {
    const constraints: any[] = [
      where('role',         '==', 'cadet'),
      where('periodId',     '==', periodId),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    ]
    if (teacherEmail) constraints.push(where('teacherEmail', '==', teacherEmail))
    const snap = await getDocs(query(collection(db, 'approvedUsers'), ...constraints))
    return snap.size
  }

  // ── By Student roster ───────────────────────────────────────────────────────
  // Loads all students in a period with aggregated stats:
  //   conductScore — live 0–4 from approvedUsers doc
  //   latestWpm    — most recent typingResults WPM
  //   turnInRate   — % missions submitted this quarter

  const fetchRoster = async (
    periodId:     string,
    teacherEmail: string | undefined,
  ) => {
    isRosterLoading.value = true
    error.value           = null
    roster.value          = []

    try {
      // 1. Student records (includes conductScore)
      const studentConstraints: any[] = [
        where('role',         '==', 'cadet'),
        where('periodId',     '==', periodId),
        where('schoolYearId', '==', SCHOOL_YEAR_ID),
      ]
      if (teacherEmail) studentConstraints.push(where('teacherEmail', '==', teacherEmail))

      const studentSnap = await getDocs(
        query(collection(db, 'approvedUsers'), ...studentConstraints),
      )
      if (studentSnap.empty) { roster.value = []; return }

      const studentDocs = studentSnap.docs.map(d => d.data())
      const uids = studentDocs.map(d => d.uid as string).filter(Boolean)

      // 2. Recent typing results for the period (all time — take most recent per student)
      const typingConstraints: any[] = [
        where('periodId',     '==', periodId),
        where('schoolYearId', '==', SCHOOL_YEAR_ID),
        orderBy('completedAt', 'desc'),
        limit(500),
      ]
      if (teacherEmail) typingConstraints.splice(2, 0, where('teacherEmail', '==', teacherEmail))

      const typingSnap = await getDocs(query(collection(db, 'typingResults'), ...typingConstraints))
      // Most recent WPM per student
      const latestWpmByUid: Record<string, number> = {}
      typingSnap.docs.forEach(d => {
        const data = d.data()
        if (!latestWpmByUid[data.uid] && data.wpm != null) {
          latestWpmByUid[data.uid] = data.wpm as number
        }
      })

      // 3. This quarter's submissions for the period
      const today     = new Date().toISOString().slice(0, 10)
      const quarterId = getQuarterIdForDate(today)
      const subConstraints: any[] = [
        where('periodId',     '==', periodId),
        where('schoolYearId', '==', SCHOOL_YEAR_ID),
      ]
      // Filter by quarterId only if we have a valid one
      if (quarterId !== 'unknown') {
        subConstraints.push(where('quarterId', '==', quarterId))
      }

      const subSnap = await getDocs(query(collection(db, 'submissions'), ...subConstraints))
      // Turn-in counts per student
      const subsByUid: Record<string, { assigned: number; submitted: number }> = {}
      subSnap.docs.forEach(d => {
        const data = d.data()
        const uid  = data.studentId as string
        if (!uid) return
        if (!subsByUid[uid]) subsByUid[uid] = { assigned: 0, submitted: 0 }
        subsByUid[uid].assigned++
        if (['submitted', 'graded', 'returned'].includes(data.status)) {
          subsByUid[uid].submitted++
        }
      })

      // 4. Assemble rows
      roster.value = studentDocs.map(s => {
        const uid   = s.uid as string
        const sData = subsByUid[uid]
        return {
          uid,
          displayName:  s.displayName  ?? '—',
          periodId:     s.periodId     ?? periodId,
          conductScore: s.conductScore ?? 4,
          latestWpm:    latestWpmByUid[uid] ?? null,
          turnInRate:   sData ? pct(sData.submitted, sData.assigned) : null,
        }
      }).sort((a, b) => a.displayName.localeCompare(b.displayName))

    } catch (e: any) {
      console.error('[useEndOfPeriodReport] fetchRoster:', e)
      error.value = e.message
    } finally {
      isRosterLoading.value = false
    }
  }

  return {
    // State
    typing,
    missions,
    conduct,
    roster,
    isLoading,
    isRosterLoading,
    error,
    // Actions
    fetchEndOfPeriod,
    fetchRoster,
  }
}
