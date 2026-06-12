// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useTypingDashboard.ts
//
// Fetches and aggregates class-wide typing results for the teacher dashboard.
//
// Query strategy: fetch all typingResults for this teacherEmail + schoolYearId,
// then group and compute stats client-side. For a 7th-grade class (4-6 periods
// × ~30 students × ~20 sessions each = ~3,600 docs max) this is totally fine.
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import { collection, query, where, orderBy, getDocs } from '@/data/db'
import { db } from '@/firebase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentStat {
  uid:         string
  displayName: string
  periodId:    string
  sessions:    number
  avgWpm:      number
  bestWpm:     number
  avgAccuracy: number
  lastActive:  Date | null  // timestamp of most recent session
}

export interface PeriodStat {
  periodId:    string
  sessions:    number
  students:    number
  avgWpm:      number
  bestWpm:     number
  avgAccuracy: number
}

export interface DashboardData {
  periods:       PeriodStat[]
  allStudents:   StudentStat[]      // every student with at least one session
  topStudents:   StudentStat[]      // top 10 by bestWpm across all periods
  missedKeys:    { key: string; count: number }[]  // top 10 most-missed keys class-wide
  totalSessions: number
  lastUpdated:   Date
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useTypingDashboard() {
  const data      = ref<DashboardData | null>(null)
  const isLoading = ref(false)
  const error     = ref('')

  const fetchDashboard = async (teacherEmail: string, schoolYearId = '2025-2026') => {
    if (!teacherEmail) return
    isLoading.value = true
    error.value     = ''

    try {
      const q = query(
        collection(db, 'typingResults'),
        where('teacherEmail', '==', teacherEmail),
        where('schoolYearId', '==', schoolYearId),
        orderBy('completedAt', 'desc'),
      )
      const snap = await getDocs(q)
      const docs = snap.docs.map(d => d.data())

      if (docs.length === 0) {
        data.value = {
          periods:       [],
          allStudents:   [],
          topStudents:   [],
          missedKeys:    [],
          totalSessions: 0,
          lastUpdated:   new Date(),
        }
        return
      }

      // ── Aggregate by student ─────────────────────────────────────────────
      const studentMap: Record<string, {
        uid: string; displayName: string; periodId: string;
        wpms: number[]; accuracies: number[]; lastActive: Date | null
      }> = {}

      const periodMap: Record<string, {
        wpms: number[]; accuracies: number[]; studentUids: Set<string>
      }> = {}

      const globalKeyErrors: Record<string, number> = {}

      for (const doc of docs) {
        const uid = doc.uid as string
        const pid = doc.periodId as string

        // Student aggregation
        // Results are ordered by completedAt desc, so the first doc per uid is the most recent
        if (!studentMap[uid]) {
          studentMap[uid] = {
            uid,
            displayName: doc.displayName ?? 'Unknown Cadet',
            periodId:    pid,
            wpms:        [],
            accuracies:  [],
            lastActive:  doc.completedAt?.toDate?.() ?? null,
          }
        }
        studentMap[uid].wpms.push(doc.wpm ?? 0)
        studentMap[uid].accuracies.push(doc.accuracy ?? 0)

        // Period aggregation
        if (!periodMap[pid]) {
          periodMap[pid] = { wpms: [], accuracies: [], studentUids: new Set() }
        }
        periodMap[pid].wpms.push(doc.wpm ?? 0)
        periodMap[pid].accuracies.push(doc.accuracy ?? 0)
        periodMap[pid].studentUids.add(uid)

        // Key error aggregation
        const keyErrors = doc.keyErrors as Record<string, number> ?? {}
        for (const [k, count] of Object.entries(keyErrors)) {
          globalKeyErrors[k] = (globalKeyErrors[k] ?? 0) + (count as number)
        }
      }

      // ── Build period stats ───────────────────────────────────────────────
      const avg  = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
      const best = (arr: number[]) => arr.length ? Math.max(...arr) : 0

      const periods: PeriodStat[] = Object.entries(periodMap)
        .map(([periodId, p]) => ({
          periodId,
          sessions:    p.wpms.length,
          students:    p.studentUids.size,
          avgWpm:      avg(p.wpms),
          bestWpm:     best(p.wpms),
          avgAccuracy: avg(p.accuracies),
        }))
        .sort((a, b) => a.periodId.localeCompare(b.periodId))

      // ── Build student stats ──────────────────────────────────────────────
      const allStudents: StudentStat[] = Object.values(studentMap)
        .map(s => ({
          uid:         s.uid,
          displayName: s.displayName,
          periodId:    s.periodId,
          sessions:    s.wpms.length,
          avgWpm:      avg(s.wpms),
          bestWpm:     best(s.wpms),
          avgAccuracy: avg(s.accuracies),
          lastActive:  s.lastActive,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))

      const topStudents = [...allStudents]
        .sort((a, b) => b.bestWpm - a.bestWpm)
        .slice(0, 10)

      // ── Build missed key ranking ─────────────────────────────────────────
      const missedKeys = Object.entries(globalKeyErrors)
        .filter(([k]) => k.length === 1)   // only real character keys
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => ({ key, count }))

      data.value = {
        periods,
        allStudents,
        topStudents,
        missedKeys,
        totalSessions: docs.length,
        lastUpdated:   new Date(),
      }

    } catch (e: any) {
      console.error('fetchDashboard:', e)
      error.value = 'Failed to load dashboard data.'
    } finally {
      isLoading.value = false
    }
  }

  return { data, isLoading, error, fetchDashboard }
}
