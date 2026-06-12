// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useMissions.ts
//
// Firestore operations for the missions library.
//
// Missions are reusable templates — they have no due date or period assignment.
// Those belong on `assignments` docs created when a mission is deployed to a class.
//
// Shared library model:
//   - teacherEmail is stamped at creation for attribution and never changes.
//   - All teachers see the full library — no per-teacher scoping on fetch.
//   - Assignments (not missions) carry the per-teacher/period context.
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
  collection, addDoc, updateDoc,
  doc, getDocs, query, where, orderBy, documentId,
  serverTimestamp, Timestamp,
} from '@/data/db'
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

// ── Delivery item types ───────────────────────────────────────────────────────
// Each delivery item describes one piece of the assignment: how it's delivered
// to students and how they (or the teacher) mark it complete.

/** How the assignment material reaches students. */
export type DeliveryItemKind = 'pdf' | 'link' | 'paper' | 'game'

/**
 * How completion is tracked for this item:
 *   file-upload — student uploads a file in the app
 *   manual      — teacher manually marks it done (paper handouts, external links)
 *   auto        — completion is logged automatically (in-game scores)
 */
export type SubmissionMethod = 'file-upload' | 'manual' | 'auto'

export interface DeliveryItem {
  kind:             DeliveryItemKind
  submissionMethod: SubmissionMethod
  name?:            string   // pdf: display name shown to students
  url?:             string   // pdf or link: the URL
  label?:           string   // link: display label (e.g. "Quizlet Set")
  gameId?:          string   // game: the gameId string used by useGameScores
  variant?:         string   // game: optional variant (e.g. 'standard' | '960' | 'crazyhouse' for chess)
  repeatCount?:     number   // game: how many times the student must play (default 1 = single-play)
}

/**
 * Derives the legacy type field from a mission's delivery items.
 * Used when writing to Firestore so old code that reads `type` still works.
 */
export function deriveMissionType(items: DeliveryItem[]): MissionType {
  if (!items.length) return 'file'
  const methods = items.map(i => i.submissionMethod)
  if (methods.includes('file-upload')) return 'file'
  if (methods.includes('auto'))        return 'game'
  return 'manual'
}

/** 'manual' added for assignments where teacher marks completion (paper/link). */
export type MissionType = 'file' | 'game' | 'manual'

export interface Mission {
  id:             string
  title:          string
  summary?:       string
  description:    string
  type:           MissionType
  /** The delivery items for this mission. Empty on legacy missions (use `type` fallback). */
  deliveryItems:  DeliveryItem[]
  pointsPossible: number
  rubric:         RubricCriterion[]
  attachments:    MissionAttachment[]   // legacy — kept for backward compat
  teacherEmail:   string
  createdAt:      Timestamp | null
  archived:       boolean
  unitId:         string | null
}

export interface MissionDraft {
  title:          string
  summary?:       string
  description:    string
  type:           MissionType
  deliveryItems:  DeliveryItem[]
  pointsPossible: number
  rubric:         RubricCriterion[]
  attachments?:   MissionAttachment[]   // legacy
  teacherEmail?:  string
  unitId?:        string | null
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useMissions() {
  const missions  = ref<Mission[]>([])
  const isLoading = ref(false)
  const error     = ref('')

  // Fetch all non-archived missions.
  // The library is shared across all teachers — no per-teacher scoping.
  // teacherEmail param is accepted but unused, kept for call-site compatibility.
  const fetchMissions = async (_teacherEmail?: string) => {
    isLoading.value = true
    error.value     = ''
    try {
      const constraints: any[] = [
        where('archived', '==', false),
        orderBy('createdAt', 'desc'),
      ]
      const q    = query(collection(db, 'missions'), ...constraints)
      const snap = await getDocs(q)
      missions.value = snap.docs.map(d => {
        const data = d.data()
        return { id: d.id, deliveryItems: [] as DeliveryItem[], ...data } as Mission
      })
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
      const deliveryItems = draft.deliveryItems ?? []
      const docRef = await addDoc(collection(db, 'missions'), {
        title:          draft.title.trim(),
        summary:        draft.summary?.trim() ?? '',
        description:    draft.description.trim(),
        type:           deriveMissionType(deliveryItems),
        deliveryItems,
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
      // Re-derive `type` whenever deliveryItems changes so legacy field stays in sync
      if (rest.deliveryItems !== undefined) {
        rest.type = deriveMissionType(rest.deliveryItems)
      }
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
      snap.docs.forEach(d => {
        const data = d.data()
        results.push({ id: d.id, deliveryItems: [] as DeliveryItem[], ...data } as Mission)
      })
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
