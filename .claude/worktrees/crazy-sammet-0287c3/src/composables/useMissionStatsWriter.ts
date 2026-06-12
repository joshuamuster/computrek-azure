// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useMissionStatsWriter.ts
//
// Atomic counter helpers for the periodStats collection.
//
// Document ID format: `${teacherEmail}__${periodId}__${schoolYearId}`
// Using __ as separator so email dots don't collide with the separator.
//
// Called from:
//   useAssignments.ts  — deployMission fan-out  → onAssigned(+n students)
//   StudentDashboard   — file/game submit        → onSubmitted()
//   useSubmissions.ts  — gradeSubmission         → onGraded(+1)
//                      — returnSubmission         → if prev was graded, onGraded(-1)
//                      — acceptGrade             → onGraded(+1)
//                      — ungradeSubmission       → onGraded(-1)
// ─────────────────────────────────────────────────────────────────────────────

import { doc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'

// ── Key helper ────────────────────────────────────────────────────────────────

export function periodStatsKey(
  teacherEmail: string,
  periodId:     string,
  schoolYearId: string,
): string {
  return `${teacherEmail}__${periodId}__${schoolYearId}`
}

// ── Ensure the doc exists before incrementing ─────────────────────────────────
// setDoc with merge:true creates the doc if missing without overwriting existing counters.

async function ensureDoc(key: string, teacherEmail: string, periodId: string, schoolYearId: string) {
  await setDoc(
    doc(db, 'periodStats', key),
    { teacherEmail, periodId, schoolYearId, assignedCount: 0, submittedCount: 0, gradedCount: 0 },
    { merge: true },
  )
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Called when a mission is deployed and N student submission docs are created.
 * Increments assignedCount by the number of students that received the assignment.
 */
export async function onAssigned(
  teacherEmail: string,
  periodId:     string,
  schoolYearId: string,
  studentCount: number,
): Promise<void> {
  if (studentCount <= 0) return
  const key = periodStatsKey(teacherEmail, periodId, schoolYearId)
  try {
    await ensureDoc(key, teacherEmail, periodId, schoolYearId)
    await updateDoc(doc(db, 'periodStats', key), {
      assignedCount: increment(studentCount),
      lastUpdated:   serverTimestamp(),
    })
  } catch (e) {
    console.error('[useMissionStatsWriter] onAssigned:', e)
  }
}

/**
 * Called when a student successfully submits work (status: assigned → submitted).
 * Increments submittedCount by 1.
 */
export async function onSubmitted(
  teacherEmail: string,
  periodId:     string,
  schoolYearId: string,
): Promise<void> {
  const key = periodStatsKey(teacherEmail, periodId, schoolYearId)
  try {
    await ensureDoc(key, teacherEmail, periodId, schoolYearId)
    await updateDoc(doc(db, 'periodStats', key), {
      submittedCount: increment(1),
      lastUpdated:    serverTimestamp(),
    })
  } catch (e) {
    console.error('[useMissionStatsWriter] onSubmitted:', e)
  }
}

/**
 * Called when a graded status changes.
 * delta: +1 when work is accepted (graded), -1 when reversed (returned/ungraded).
 */
export async function onGraded(
  teacherEmail: string,
  periodId:     string,
  schoolYearId: string,
  delta: 1 | -1,
): Promise<void> {
  const key = periodStatsKey(teacherEmail, periodId, schoolYearId)
  try {
    await ensureDoc(key, teacherEmail, periodId, schoolYearId)
    await updateDoc(doc(db, 'periodStats', key), {
      gradedCount: increment(delta),
      lastUpdated: serverTimestamp(),
    })
  } catch (e) {
    console.error('[useMissionStatsWriter] onGraded:', e)
  }
}
