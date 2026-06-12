// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useAdminPeriods.ts
//
// Manages the `periods` Firestore collection — metadata that tracks each
// period's lifecycle (active, archived, Open Access) across school years.
//
// Document IDs use the pattern `{schoolYearId}__{periodId}` so multiple
// years can coexist in the same collection without collisions.
// ─────────────────────────────────────────────────────────────────────────────

import { ref } from 'vue'
import {
  collection, doc, getDocs, setDoc, updateDoc,
  query, where, arrayRemove, Timestamp,
} from '@/data/db'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID, PERIOD_IDS } from '@/config/schoolYear'

export interface PeriodMeta {
  docId: string
  periodId: string
  label: string
  schoolYearId: string
  type: 'standard' | 'openAccess'
  adminOnly: boolean
  archived: boolean
  teacherEmail: string | null
  archivedAt?: Timestamp | null
  createdAt?: Timestamp
}

export interface CadetEntry {
  email: string
  displayName: string
  periodId: string
  teacherEmail: string
  schoolYearId: string
}

export interface StaffEntry {
  email: string
  displayName: string
  periodIds: string[]
}

export function useAdminPeriods() {
  const periods  = ref<PeriodMeta[]>([])
  const cadets   = ref<CadetEntry[]>([])
  const staff    = ref<StaffEntry[]>([])
  const loading  = ref(false)
  const saving   = ref(false)
  const error    = ref<string | null>(null)

  // ── Loaders ───────────────────────────────────────────────────────────────

  async function loadPeriods() {
    const snap = await getDocs(collection(db, 'periods'))
    periods.value = snap.docs.map(d => ({
      docId: d.id,
      ...d.data(),
    } as PeriodMeta))
  }

  async function loadCadets() {
    const snap = await getDocs(
      query(collection(db, 'approvedUsers'), where('role', '==', 'cadet'))
    )
    cadets.value = snap.docs.map(d => ({
      email: d.id,
      displayName: d.data().displayName ?? d.id,
      periodId: d.data().periodId ?? '',
      teacherEmail: d.data().teacherEmail ?? '',
      schoolYearId: d.data().schoolYearId ?? '',
    }))
  }

  async function loadStaff() {
    const snap = await getDocs(
      query(collection(db, 'approvedUsers'), where('role', '==', 'staff'))
    )
    staff.value = snap.docs.map(d => ({
      email: d.id,
      displayName: d.data().displayName ?? d.id,
      periodIds: d.data().periodIds ?? [],
    }))
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      await Promise.all([loadPeriods(), loadCadets(), loadStaff()])
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  // ── Period initialization ─────────────────────────────────────────────────

  // Builds period docs for SCHOOL_YEAR_ID from static config + staff periodIds.
  // Safe to run multiple times — uses merge:true.
  async function initPeriodsFromConfig() {
    saving.value = true
    try {
      // Build reverse map: periodId → teacherEmail from staff periodIds arrays
      const teacherMap: Record<string, string> = {}
      for (const s of staff.value) {
        for (const pid of s.periodIds) {
          teacherMap[pid] = s.email
        }
      }

      for (const p of PERIOD_IDS) {
        const docId = `${SCHOOL_YEAR_ID}__${p.id}`
        await setDoc(doc(db, 'periods', docId), {
          periodId: p.id,
          label: p.label,
          schoolYearId: SCHOOL_YEAR_ID,
          type: 'standard',
          adminOnly: false,
          archived: false,
          teacherEmail: teacherMap[p.id] ?? null,
          createdAt: Timestamp.now(),
        }, { merge: true })
      }
      await loadPeriods()
    } finally {
      saving.value = false
    }
  }

  // ── Archiving ─────────────────────────────────────────────────────────────

  // Marks a period archived and removes it from the teacher's periodIds so
  // it disappears from their selector. Data is never deleted.
  async function archivePeriod(meta: PeriodMeta) {
    saving.value = true
    try {
      await updateDoc(doc(db, 'periods', meta.docId), {
        archived: true,
        archivedAt: Timestamp.now(),
      })
      if (meta.teacherEmail) {
        await updateDoc(doc(db, 'approvedUsers', meta.teacherEmail), {
          periodIds: arrayRemove(meta.periodId),
        })
      }
      await loadPeriods()
    } finally {
      saving.value = false
    }
  }

  async function unarchivePeriod(meta: PeriodMeta) {
    saving.value = true
    try {
      await updateDoc(doc(db, 'periods', meta.docId), {
        archived: false,
        archivedAt: null,
      })
      await loadPeriods()
    } finally {
      saving.value = false
    }
  }

  // ── Open Access ───────────────────────────────────────────────────────────

  async function createOpenAccess() {
    saving.value = true
    try {
      const docId = `${SCHOOL_YEAR_ID}__open-access`
      await setDoc(doc(db, 'periods', docId), {
        periodId: 'open-access',
        label: 'Open Access',
        schoolYearId: SCHOOL_YEAR_ID,
        type: 'openAccess',
        adminOnly: true,
        archived: false,
        teacherEmail: null,
        createdAt: Timestamp.now(),
      })
      await loadPeriods()
    } finally {
      saving.value = false
    }
  }

  // ── Cadet movement ────────────────────────────────────────────────────────

  async function moveCadet(
    cadetEmail: string,
    newPeriodId: string,
    newTeacherEmail: string | null,
  ) {
    saving.value = true
    try {
      await updateDoc(doc(db, 'approvedUsers', cadetEmail), {
        periodId: newPeriodId,
        teacherEmail: newTeacherEmail ?? '',
      })
      await loadCadets()
    } finally {
      saving.value = false
    }
  }

  // ── New year preparation ──────────────────────────────────────────────────

  // Creates blank period docs for the next school year so they're ready
  // to receive teacher assignments. Does NOT change any student data or
  // the active SCHOOL_YEAR_ID constant — that still requires a code update.
  async function prepareNextYear(nextYearId: string) {
    saving.value = true
    try {
      for (const p of PERIOD_IDS) {
        const docId = `${nextYearId}__${p.id}`
        await setDoc(doc(db, 'periods', docId), {
          periodId: p.id,
          label: p.label,
          schoolYearId: nextYearId,
          type: 'standard',
          adminOnly: false,
          archived: false,
          teacherEmail: null,
          createdAt: Timestamp.now(),
        }, { merge: true })
      }
      const openDocId = `${nextYearId}__open-access`
      await setDoc(doc(db, 'periods', openDocId), {
        periodId: 'open-access',
        label: 'Open Access',
        schoolYearId: nextYearId,
        type: 'openAccess',
        adminOnly: true,
        archived: false,
        teacherEmail: null,
        createdAt: Timestamp.now(),
      }, { merge: true })
      await loadPeriods()
    } finally {
      saving.value = false
    }
  }

  return {
    periods,
    cadets,
    staff,
    loading,
    saving,
    error,
    load,
    initPeriodsFromConfig,
    archivePeriod,
    unarchivePeriod,
    createOpenAccess,
    moveCadet,
    prepareNextYear,
  }
}
