// src/composables/useStruggleDetection.ts
//
// Computes per-student "at-risk" scores for a given period.
//
// Risk signals (additive):
//   +2  ≥2 overdue assignments (status 'assigned' past due date)
//   +1  Turn-in rate < 70%
//   +1  Rolling avg WPM < 20
//   +1  Conduct score ≤ 1 (out of 4)
//
// Risk levels:  1–2 → low, 3–4 → medium, 5 → high
//
// Also computes wpmTrend and turnInTrend direction from recent data.

import { ref } from 'vue'
import {
  collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID } from '@/config/schoolYear'

// ── Thresholds ────────────────────────────────────────────────────────────────
const WPM_LOW       = 20
const TURN_IN_LOW   = 70   // percent (0–100)
const CONDUCT_LOW   = 1    // 0–4 scale
const OVERDUE_MIN   = 2    // count

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'
export type TrendDir  = 'up' | 'down' | 'flat' | null

export interface StudentAlert {
  uid:         string
  displayName: string
  riskLevel:   RiskLevel
  riskScore:   number
  factors:     string[]       // human-readable labels
  wpmTrend:    TrendDir       // based on last 10 typing sessions
  turnInTrend: TrendDir       // this week vs last week submitted count
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const avg = (arr: number[]): number =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

function toRiskLevel(score: number): RiskLevel {
  if (score >= 5) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

function trendDir(early: number, late: number): TrendDir {
  const diff = late - early
  if (diff > 2)  return 'up'
  if (diff < -2) return 'down'
  return 'flat'
}

function conductLabel(score: number): string {
  const labels = ['Critical', 'Low', 'Fair', 'Good', 'Exemplary']
  return labels[Math.max(0, Math.min(4, Math.round(score)))] ?? '?'
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useStruggleDetection() {
  const alerts  = ref<StudentAlert[]>([])
  const loading = ref(false)

  const fetchAlerts = async (
    periodId:     string,
    teacherEmail: string | undefined,
  ): Promise<void> => {
    loading.value = true
    alerts.value  = []

    const today = new Date().toISOString().slice(0, 10)
    const now   = Date.now()
    const WEEK  = 7 * 24 * 60 * 60 * 1000
    const weekAgoMs     = now - WEEK
    const twoWeeksAgoMs = now - 2 * WEEK

    try {
      // ── 1. Student roster ───────────────────────────────────────────────────
      const sConstraints: any[] = [
        where('role',         '==', 'cadet'),
        where('periodId',     '==', periodId),
        where('schoolYearId', '==', SCHOOL_YEAR_ID),
      ]
      if (teacherEmail) sConstraints.push(where('teacherEmail', '==', teacherEmail))
      const studentSnap = await getDocs(query(collection(db, 'approvedUsers'), ...sConstraints))
      if (studentSnap.empty) return

      const students   = studentSnap.docs.map(d => d.data())
      const uidSet     = new Set(students.map(s => s.uid as string).filter(Boolean))

      // ── 2. Assignments for the period (to resolve due dates) ────────────────
      const aConstraints: any[] = [
        where('periodId',     '==', periodId),
        where('schoolYearId', '==', SCHOOL_YEAR_ID),
      ]
      if (teacherEmail) aConstraints.push(where('teacherEmail', '==', teacherEmail))
      const assignSnap = await getDocs(query(collection(db, 'assignments'), ...aConstraints))
      const dueDateById = new Map<string, string | null>()
      assignSnap.docs.forEach(d => dueDateById.set(d.id, d.data().dueDate ?? null))

      // ── 3. Submissions for the period ────────────────────────────────────────
      const subConstraints: any[] = [
        where('periodId',     '==', periodId),
        where('schoolYearId', '==', SCHOOL_YEAR_ID),
      ]
      const subSnap = await getDocs(query(collection(db, 'submissions'), ...subConstraints))

      type SubStats = {
        assigned:       number
        submitted:      number
        overdue:        number
        thisWeekIn:     number
        lastWeekIn:     number
      }
      const subsByUid = new Map<string, SubStats>()

      for (const doc of subSnap.docs) {
        const sub = doc.data()
        const uid = sub.studentId as string
        if (!uid || !uidSet.has(uid)) continue
        if (!subsByUid.has(uid)) subsByUid.set(uid, { assigned: 0, submitted: 0, overdue: 0, thisWeekIn: 0, lastWeekIn: 0 })
        const entry = subsByUid.get(uid)!
        entry.assigned++

        const isIn = ['submitted', 'graded', 'returned'].includes(sub.status as string)
        if (isIn) {
          entry.submitted++
          const ts = sub.submittedAt?.toMillis?.() ?? 0
          if (ts >= weekAgoMs)     entry.thisWeekIn++
          else if (ts >= twoWeeksAgoMs) entry.lastWeekIn++
        }

        if (sub.status === 'assigned') {
          const assignDue    = dueDateById.get(sub.assignmentId as string) ?? null
          const effectiveDue = (sub.dueDateOverride as string | null) ?? assignDue
          if (effectiveDue && effectiveDue < today) entry.overdue++
        }
      }

      // ── 4. Recent typing sessions for trend (newest first, up to 20 per uid) ─
      const tConstraints: any[] = [
        where('periodId',     '==', periodId),
        where('schoolYearId', '==', SCHOOL_YEAR_ID),
        orderBy('completedAt', 'desc'),
        limit(400),
      ]
      if (teacherEmail) tConstraints.splice(2, 0, where('teacherEmail', '==', teacherEmail))
      const typingSnap = await getDocs(query(collection(db, 'typingResults'), ...tConstraints))

      // newest-first wpm list per student, capped at 10 sessions each
      const typingByUid = new Map<string, number[]>()
      typingSnap.docs.forEach(d => {
        const data = d.data()
        const uid  = data.uid as string
        if (!uid || !uidSet.has(uid)) return
        const list = typingByUid.get(uid) ?? []
        if (list.length < 10) list.push(data.wpm as number ?? 0)
        typingByUid.set(uid, list)
      })

      // ── 5. Assemble alerts ──────────────────────────────────────────────────
      const result: StudentAlert[] = []

      for (const s of students) {
        const uid = s.uid as string
        if (!uid) continue

        const subData = subsByUid.get(uid)
        const turnInRate = subData && subData.assigned > 0
          ? Math.round((subData.submitted / subData.assigned) * 100)
          : null
        const overdueCount = subData?.overdue ?? 0

        const sessions = typingByUid.get(uid) ?? []
        const avgWpm   = sessions.length ? avg(sessions) : null

        const conductScore = typeof s.conductScore === 'number' ? s.conductScore : 4

        // Risk scoring
        let   score   = 0
        const factors: string[] = []

        if (overdueCount >= OVERDUE_MIN) {
          score += 2
          factors.push(`${overdueCount} overdue assignment${overdueCount !== 1 ? 's' : ''}`)
        }
        if (turnInRate !== null && turnInRate < TURN_IN_LOW) {
          score += 1
          factors.push(`${turnInRate}% turn-in rate`)
        }
        if (avgWpm !== null && avgWpm < WPM_LOW) {
          score += 1
          factors.push(`Avg ${Math.round(avgWpm)} WPM`)
        }
        if (conductScore <= CONDUCT_LOW) {
          score += 1
          factors.push(`Conduct: ${conductLabel(conductScore)}`)
        }

        if (score === 0) continue

        // Typing WPM trend: sessions[5..9] = older, sessions[0..4] = newer
        let wpmTrend: TrendDir = null
        if (sessions.length >= 6) {
          const late  = avg(sessions.slice(0, 5))
          const early = avg(sessions.slice(5))
          wpmTrend = trendDir(early, late)
        }

        // Turn-in trend: this-week vs last-week submitted count
        let turnInTrend: TrendDir = null
        if (subData) {
          const diff = subData.thisWeekIn - subData.lastWeekIn
          if (diff > 0)                         turnInTrend = 'up'
          else if (diff < 0)                    turnInTrend = 'down'
          else if (subData.thisWeekIn === 0 && subData.lastWeekIn === 0) turnInTrend = null
          else                                  turnInTrend = 'flat'
        }

        result.push({
          uid,
          displayName: s.displayName ?? '—',
          riskLevel:   toRiskLevel(score),
          riskScore:   score,
          factors,
          wpmTrend,
          turnInTrend,
        })
      }

      alerts.value = result.sort((a, b) => b.riskScore - a.riskScore)

    } catch (e) {
      console.error('[useStruggleDetection]', e)
    } finally {
      loading.value = false
    }
  }

  return { alerts, loading, fetchAlerts }
}
