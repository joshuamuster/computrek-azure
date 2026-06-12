// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useAssignments.ts
//
// Firestore operations for assignments.
// An assignment is a deployment of a Mission to a single period.
//
// Schema (v2):
//   assignments/{id} {
//     missionId:    string        — the source mission template
//     periodId:     string        — exactly one period per deployment
//     dueDate:      string | null — YYYY-MM-DD, set now or later
//     quarterId:    string | null — derived from dueDate; null if no date yet
//     schoolYearId: string
//     teacherEmail: string
//     assignedAt:   Timestamp
//   }
//
// Multi-teacher support:
//   - teacherEmail is stamped at creation and never changes.
//   - fetchAssignments(periodId?, teacherEmail?) scopes to a teacher.
//   - Admin passes no teacherEmail to see all.
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
  collection, addDoc, updateDoc, deleteDoc, writeBatch,
  doc, getDocs, query, where, orderBy,
  serverTimestamp, Timestamp, documentId,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID, getQuarterIdForDate } from '@/config/schoolYear'
import type { MissionType, DeliveryItem } from '@/composables/useMissions'
import { onAssigned } from '@/composables/useMissionStatsWriter'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Which phase of the class period this assignment belongs to.
 * Used by the Warp Core Energy system to track live session progress.
 *   warmUp   — typing / warm-up activity  (contributes up to 20% warp energy)
 *   lesson   — main CS/IT lesson          (contributes up to 60% warp energy)
 *   extension — applied extension project (contributes up to 20% warp energy)
 */
export type WarpPhase = 'warmUp' | 'lesson' | 'extension'

export interface Assignment {
  id:           string
  missionId:    string
  periodId:     string        // single period (not an array)
  dueDate:      string | null // YYYY-MM-DD, or null if not yet set
  quarterId:    string | null // derived at write time; null when dueDate is null
  schoolYearId: string
  teacherEmail: string
  assignedAt:   Timestamp | null
  /** Optional — when set, this assignment contributes to Warp Core Energy for its phase. */
  category?:    WarpPhase
}

// ── Extension types ───────────────────────────────────────────────────────────

export type ExtensionType = 'sick' | 'sports'

/**
 * One entry in a submission's extensionLog array.
 * Stored on the per-student submissions doc (not the shared assignment doc).
 */
export interface ExtensionEntry {
  type:       ExtensionType
  grantedAt:  Timestamp
  grantedBy:  string      // teacher email
  fromDate:   string      // YYYY-MM-DD — effective due date before this extension
  toDate:     string      // YYYY-MM-DD — new effective due date after this extension
}

/**
 * The portion of a submissions doc relevant to extensions.
 * Used when fetching outstanding work for the slide-over.
 */
export interface OutstandingSubmission {
  id:              string
  missionId:       string
  assignmentId:    string
  periodId:        string
  status:          string
  dueDateOverride: string | null   // YYYY-MM-DD, null until first extension
  extensionLog:    ExtensionEntry[]
}

export interface DeployDraft {
  missionId:     string
  missionType:   MissionType    // denormalized onto each submission at fan-out
  deliveryItems: DeliveryItem[] // snapshot at deploy time; used to build componentChecks
  periodId:      string
  dueDate:       string | null
  teacherEmail:  string
  /** Optional — tag this deployment as a specific Warp Core phase. */
  category?:     WarpPhase
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useAssignments() {
  const assignments = ref<Assignment[]>([])
  const isLoading   = ref(false)
  const error       = ref('')

  // Fetch assignments for the current school year.
  //   periodId    — limits to a single period
  //   teacherEmail — limits to one teacher's assignments (staff); omit for admin
  const fetchAssignments = async (periodId?: string, teacherEmail?: string) => {
    isLoading.value = true
    error.value     = ''
    try {
      const constraints: any[] = [
        where('schoolYearId', '==', SCHOOL_YEAR_ID),
      ]
      if (periodId)     constraints.push(where('periodId',     '==', periodId))
      if (teacherEmail) constraints.push(where('teacherEmail', '==', teacherEmail))
      constraints.push(orderBy('assignedAt', 'desc'))

      const q    = query(collection(db, 'assignments'), ...constraints)
      const snap = await getDocs(q)
      assignments.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment))
    } catch (e: any) {
      console.error('fetchAssignments:', e)
      error.value = 'Failed to load assignments.'
    } finally {
      isLoading.value = false
    }
  }

  // Batch-fetch assignment docs by an array of IDs.
  // Firestore 'in' queries support up to 30 values; chunked automatically.
  const fetchAssignmentsByIds = async (ids: string[]): Promise<Assignment[]> => {
    if (!ids.length) return []
    const results: Assignment[] = []
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30)
      const q = query(
        collection(db, 'assignments'),
        where(documentId(), 'in', chunk),
      )
      const snap = await getDocs(q)
      snap.docs.forEach(d => results.push({ id: d.id, ...d.data() } as Assignment))
    }
    return results
  }

  // Deploy a mission to a period:
  //   1. Create the assignment doc with the new schema.
  //   2. Query approvedUsers for all cadets in the target period.
  //   3. Batch-write one 'assigned' submission doc per student.
  //
  // Returns the new assignment ID, or null on failure.
  const deployMission = async (draft: DeployDraft): Promise<string | null> => {
    error.value = ''
    try {
      const quarterId = draft.dueDate ? getQuarterIdForDate(draft.dueDate) : null

      // 1. Create the assignment doc
      const assignmentData: Record<string, any> = {
        missionId:    draft.missionId,
        periodId:     draft.periodId,
        dueDate:      draft.dueDate,
        quarterId,
        schoolYearId: SCHOOL_YEAR_ID,
        teacherEmail: draft.teacherEmail,
        assignedAt:   serverTimestamp(),
      }
      if (draft.category) assignmentData.category = draft.category

      const aRef = await addDoc(collection(db, 'assignments'), assignmentData)

      // 2. Fetch all cadets in the target period
      const studentSnap = await getDocs(query(
        collection(db, 'approvedUsers'),
        where('role',     '==', 'cadet'),
        where('periodId', '==', draft.periodId),
      ))

      // Build initial componentChecks for all manual delivery items.
      // Only manual items need tracking; file-upload and auto items are self-reporting.
      const initialComponentChecks: Record<string, { done: boolean; doneAt: null }> = {}
      draft.deliveryItems.forEach((item, i) => {
        if (item.submissionMethod === 'manual') {
          initialComponentChecks[String(i)] = { done: false, doneAt: null }
        }
      })
      const hasManualItems = Object.keys(initialComponentChecks).length > 0

      // 3. Batch-write one submission per student (500 op limit; class size is safe)
      if (studentSnap.size > 0) {
        const batch = writeBatch(db)
        studentSnap.docs.forEach(sDoc => {
          const sData  = sDoc.data()
          const newRef = doc(collection(db, 'submissions'))
          const subData: Record<string, any> = {
            studentId:       sData.uid ?? sDoc.id,
            assignmentId:    aRef.id,
            missionId:       draft.missionId,
            periodId:        draft.periodId,
            quarterId,
            schoolYearId:    SCHOOL_YEAR_ID,
            type:            draft.missionType,
            status:          'assigned',
            data:            {},
            submittedAt:     null,
            feedbackNote:    '',
            dueDateOverride: null,
          }
          if (hasManualItems) {
            subData.componentChecks = initialComponentChecks
          }
          batch.set(newRef, subData)
        })
        await batch.commit()

        // 4. Increment the period stats counter (fire-and-forget — non-blocking)
        onAssigned(draft.teacherEmail, draft.periodId, SCHOOL_YEAR_ID, studentSnap.size)
          .catch(e => console.warn('[deployMission] periodStats update failed:', e))
      }

      return aRef.id
    } catch (e: any) {
      console.error('deployMission:', e)
      error.value = 'Failed to deploy mission.'
      return null
    }
  }

  // Update an assignment's dueDate (and re-derive quarterId).
  // Ownership fields (missionId, periodId, teacherEmail) never change.
  const updateAssignment = async (
    id: string,
    changes: { dueDate?: string | null },
  ): Promise<boolean> => {
    error.value = ''
    try {
      const payload: Record<string, any> = { ...changes }
      if ('dueDate' in changes) {
        payload.quarterId = changes.dueDate ? getQuarterIdForDate(changes.dueDate) : null
      }
      await updateDoc(doc(db, 'assignments', id), payload)
      const idx = assignments.value.findIndex(a => a.id === id)
      if (idx !== -1) assignments.value[idx] = { ...assignments.value[idx], ...payload }
      return true
    } catch (e: any) {
      console.error('updateAssignment:', e)
      error.value = 'Failed to update assignment.'
      return false
    }
  }

  // Delete an assignment and cascade-delete all of its submissions.
  const deleteAssignment = async (assignmentId: string): Promise<boolean> => {
    error.value = ''
    try {
      // Gather all submission docs for this assignment
      const subsSnap = await getDocs(
        query(collection(db, 'submissions'), where('assignmentId', '==', assignmentId))
      )

      // Batch-delete submissions (500-doc limit per batch)
      const BATCH_SIZE = 499
      for (let i = 0; i < subsSnap.docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        subsSnap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref))
        await batch.commit()
      }

      // Delete the assignment itself
      await deleteDoc(doc(db, 'assignments', assignmentId))
      assignments.value = assignments.value.filter(a => a.id !== assignmentId)
      return true
    } catch (e: any) {
      console.error('deleteAssignment:', e)
      error.value = 'Failed to delete assignment.'
      return false
    }
  }

  return {
    assignments,
    isLoading,
    error,
    fetchAssignments,
    fetchAssignmentsByIds,
    deployMission,
    updateAssignment,
    deleteAssignment,
  }
}
