// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useMissions.ts
//
// Firestore operations for the missions library.
//
// Missions are reusable templates — they have no due date or period assignment.
// Those belong on `assignments` docs created when a mission is deployed to a class.
//
// Multi-teacher support:
//   - teacherEmail is stamped at creation and never changes.
//   - fetchMissions(teacherEmail?) scopes to a teacher when provided.
//   - Admin passes no teacherEmail to see all missions.
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
  collection, addDoc, updateDoc,
  doc, getDocs, query, where, orderBy, documentId,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RubricCriterion {
  label:  string
  points: number
}

export interface MissionAttachment {
  name: string
  url:  string
}

export type MissionType = 'file' | 'game'

export interface Mission {
  id:             string
  title:          string
  description:    string
  type:           MissionType
  pointsPossible: number
  rubric:         RubricCriterion[]
  attachments:    MissionAttachment[]
  teacherEmail:   string
  createdAt:      Timestamp | null
  archived:       boolean
  unitId:         string | null
}

export interface MissionDraft {
  title:          string
  description:    string
  type:           MissionType
  pointsPossible: number
  rubric:         RubricCriterion[]
  attachments?:   MissionAttachment[]
  teacherEmail?:  string
  unitId?:        string | null
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useMissions() {
  const missions  = ref<Mission[]>([])
  const isLoading = ref(false)
  const error     = ref('')

  // Fetch all non-archived missions.
  // Pass teacherEmail to scope to one teacher (staff); omit for admin (sees all).
  const fetchMissions = async (teacherEmail?: string) => {
    isLoading.value = true
    error.value     = ''
    try {
      const constraints: any[] = [
        where('archived', '==', false),
        orderBy('createdAt', 'desc'),
      ]
      if (teacherEmail) {
        constraints.push(where('teacherEmail', '==', teacherEmail))
      }
      const q    = query(collection(db, 'missions'), ...constraints)
      const snap = await getDocs(q)
      missions.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission))
    } catch (e: any) {
      console.error('fetchMissions:', e)
      error.value = 'Failed to load missions.'
    } finally {
      isLoading.value = false
    }
  }

  // Create a new mission in the library. teacherEmail must be passed by the caller.
  const createMission = async (draft: MissionDraft): Promise<string | null> => {
    error.value = ''
    try {
      const docRef = await addDoc(collection(db, 'missions'), {
        title:          draft.title.trim(),
        description:    draft.description.trim(),
        type:           draft.type,
        pointsPossible: draft.pointsPossible,
        rubric:         draft.rubric,
        attachments:    draft.attachments ?? [],
        teacherEmail:   draft.teacherEmail ?? '',
        unitId:         draft.unitId ?? null,
        archived:       false,
        createdAt:      serverTimestamp(),
      })
      return docRef.id
    } catch (e: any) {
      console.error('createMission:', e)
      error.value = 'Failed to create mission.'
      return null
    }
  }

  // Update an existing mission (partial). teacherEmail is protected and ignored.
  const updateMission = async (id: string, changes: Partial<MissionDraft>): Promise<boolean> => {
    error.value = ''
    try {
      const { teacherEmail: _ignored, ...rest } = changes
      await updateDoc(doc(db, 'missions', id), rest)
      // Reflect change locally so the UI updates without a re-fetch
      const idx = missions.value.findIndex(m => m.id === id)
      if (idx !== -1) missions.value[idx] = { ...missions.value[idx], ...rest }
      return true
    } catch (e: any) {
      console.error('updateMission:', e)
      error.value = 'Failed to update mission.'
      return false
    }
  }

  // Soft-delete — sets archived: true. Existing assignment links are preserved.
  const archiveMission = async (id: string): Promise<boolean> => {
    error.value = ''
    try {
      await updateDoc(doc(db, 'missions', id), { archived: true })
      missions.value = missions.value.filter(m => m.id !== id)
      return true
    } catch (e: any) {
      console.error('archiveMission:', e)
      error.value = 'Failed to archive mission.'
      return false
    }
  }

  // Batch-fetch mission docs by an array of IDs.
  // Firestore 'in' queries support up to 30 values; chunked automatically.
  const fetchMissionsByIds = async (ids: string[]): Promise<Mission[]> => {
    if (!ids.length) return []
    const results: Mission[] = []
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30)
      const q = query(
        collection(db, 'missions'),
        where(documentId(), 'in', chunk),
      )
      const snap = await getDocs(q)
      snap.docs.forEach(d => results.push({ id: d.id, ...d.data() } as Mission))
    }
    return results
  }

  return {
    missions,
    isLoading,
    error,
    fetchMissions,
    fetchMissionsByIds,
    createMission,
    updateMission,
    archiveMission,
  }
}
