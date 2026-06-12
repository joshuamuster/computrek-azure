// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useExtensions.ts
//
// Handles reading outstanding submissions for a student and granting extensions.
//
// Extension logic:
//   1. Determine the "effective due date" = dueDateOverride ?? assignment.dueDate
//   2. Look up that date's parity (odd/even) in the academic calendar
//   3. Call getNextClassDay(effectiveDueDate, parity) → new due date
//   4. Write dueDateOverride + append to extensionLog on the submission doc
//
// Extensions stack naturally: each one starts from the current override, so
// a second sick day extends from wherever the first one landed.
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
  collection, query, where, getDocs, getDoc, updateDoc,
  doc, arrayUnion, serverTimestamp,
} from '@/data/db'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID } from '@/config/schoolYear'
import { getCalendarDay, getNextClassDay } from '@/composables/useAcademicCalendar'
import type { DayParity } from '@/composables/useAcademicCalendar'
import type {
  OutstandingSubmission, ExtensionType, ExtensionEntry,
} from '@/composables/useAssignments'
import { useMissions } from '@/composables/useMissions'

// ── Enriched view model ───────────────────────────────────────────────────────

/** A submission enriched with its mission title and assignment due date. */
export interface OutstandingItem {
  submissionId:    string
  assignmentId:    string
  missionId:       string
  missionTitle:    string
  status:          string
  originalDueDate: string | null   // from the assignment doc (YYYY-MM-DD)
  dueDateOverride: string | null   // from the submission doc
  extensionLog:    ExtensionEntry[]

  // Derived
  effectiveDueDate: string | null   // dueDateOverride ?? originalDueDate
  parity:           DayParity       // looked up from the calendar
  nextClassDay:     string | null   // what the new due date would be if extended now
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useExtensions() {
  const items      = ref<OutstandingItem[]>([])
  const isLoading  = ref(false)
  const isSaving   = ref(false)
  const error      = ref('')

  const { fetchMissionsByIds } = useMissions()

  // ── Fetch outstanding submissions for a student ──────────────────────────

  const fetchOutstanding = async (studentUid: string, periodId: string) => {
    items.value     = []
    isLoading.value = true
    error.value     = ''

    try {
      // 1. Fetch all submissions for this student in the school year.
      //    Filter periodId and status client-side to avoid composite-index requirements.
      const snap = await getDocs(query(
        collection(db, 'submissions'),
        where('studentId',    '==', studentUid),
        where('schoolYearId', '==', SCHOOL_YEAR_ID),
      ))

      const outstanding: OutstandingSubmission[] = snap.docs
        .map(d => ({
          id:              d.id,
          missionId:       d.data().missionId       as string,
          assignmentId:    d.data().assignmentId     as string,
          periodId:        d.data().periodId         as string,
          status:          d.data().status           as string,
          dueDateOverride: d.data().dueDateOverride  as string | null ?? null,
          extensionLog:    d.data().extensionLog      as ExtensionEntry[] ?? [],
        }))
        .filter(s =>
          s.periodId === periodId &&
          ['assigned', 'in_progress', 'returned'].includes(s.status)
        )

      if (!outstanding.length) {
        isLoading.value = false
        return
      }

      // 2. Batch-fetch the shared assignment docs to get originalDueDate.
      const assignmentIds = [...new Set(outstanding.map(s => s.assignmentId))]
      const assignmentDocs = await Promise.all(
        assignmentIds.map(id => getDoc(doc(db, 'assignments', id)))
      )
      const assignmentMap = new Map<string, string | null>()
      assignmentDocs.forEach(d => {
        if (d.exists()) {
          assignmentMap.set(d.id, d.data().dueDate as string | null ?? null)
        }
      })

      // 3. Batch-fetch mission titles.
      const missionIds = [...new Set(outstanding.map(s => s.missionId))]
      const missions   = await fetchMissionsByIds(missionIds)
      const missionMap = new Map(missions.map(m => [m.id, m.title]))

      // 4. Enrich each submission into an OutstandingItem.
      items.value = outstanding.map(sub => {
        const originalDueDate = assignmentMap.get(sub.assignmentId) ?? null
        const effectiveDueDate = sub.dueDateOverride ?? originalDueDate

        let parity: DayParity       = 'neutral'
        let nextClassDay: string | null = null

        if (effectiveDueDate) {
          const calDay = getCalendarDay(effectiveDueDate)
          parity = calDay?.Parity ?? 'neutral'
          if (parity === 'odd' || parity === 'even') {
            try {
              nextClassDay = getNextClassDay(effectiveDueDate, parity)
            } catch {
              nextClassDay = null
            }
          }
        }

        return {
          submissionId:    sub.id,
          assignmentId:    sub.assignmentId,
          missionId:       sub.missionId,
          missionTitle:    missionMap.get(sub.missionId) ?? 'Unknown Mission',
          status:          sub.status,
          originalDueDate,
          dueDateOverride: sub.dueDateOverride,
          extensionLog:    sub.extensionLog,
          effectiveDueDate,
          parity,
          nextClassDay,
        }
      })
    } catch (e: any) {
      console.error('[useExtensions] fetchOutstanding:', e)
      error.value = 'Failed to load outstanding assignments.'
    } finally {
      isLoading.value = false
    }
  }

  // ── Grant an extension on a single submission ────────────────────────────

  const grantExtension = async (
    item:         OutstandingItem,
    type:         ExtensionType,
    teacherEmail: string,
  ): Promise<boolean> => {
    if (!item.effectiveDueDate || !item.nextClassDay) {
      error.value = 'Cannot calculate new due date for this assignment.'
      return false
    }

    isSaving.value = true
    error.value    = ''

    try {
      const entry: Omit<ExtensionEntry, 'grantedAt'> & { grantedAt: any } = {
        type,
        grantedAt:  serverTimestamp(),
        grantedBy:  teacherEmail,
        fromDate:   item.effectiveDueDate,
        toDate:     item.nextClassDay,
      }

      await updateDoc(doc(db, 'submissions', item.submissionId), {
        dueDateOverride: item.nextClassDay,
        extensionLog:    arrayUnion(entry),
      })

      // Update local state so the UI reflects the change immediately
      const idx = items.value.findIndex(i => i.submissionId === item.submissionId)
      if (idx !== -1) {
        const updated       = { ...items.value[idx] }
        const newOverride   = item.nextClassDay
        const calDay        = getCalendarDay(newOverride!)
        const newParity     = calDay?.Parity ?? updated.parity

        let newNext: string | null = null
        if (newParity === 'odd' || newParity === 'even') {
          try { newNext = getNextClassDay(newOverride!, newParity) } catch { newNext = null }
        }

        updated.dueDateOverride  = newOverride
        updated.effectiveDueDate = newOverride
        updated.parity           = newParity as DayParity
        updated.nextClassDay     = newNext
        updated.extensionLog     = [
          ...updated.extensionLog,
          { ...entry, grantedAt: null as any },   // grantedAt resolves server-side
        ]
        items.value[idx] = updated
      }

      return true
    } catch (e: any) {
      console.error('[useExtensions] grantExtension:', e)
      error.value = 'Failed to save extension.'
      return false
    } finally {
      isSaving.value = false
    }
  }

  return {
    items,
    isLoading,
    isSaving,
    error,
    fetchOutstanding,
    grantExtension,
  }
}
