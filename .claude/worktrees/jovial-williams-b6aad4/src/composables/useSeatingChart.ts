import { ref } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { SCHOOL_YEAR_ID } from '@/config/schoolYear'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SeatStudent {
  uid: string
  displayName: string
}

export interface SeatingLayout {
  rows: number
  cols: number
  label: string
}

/** Map of "r{row}c{col}" → student or null */
export type SeatsMap = Record<string, SeatStudent | null>

// ─────────────────────────────────────────────────────────────────────────────
// Preset layouts
// ─────────────────────────────────────────────────────────────────────────────

export const PRESET_LAYOUTS: SeatingLayout[] = [
  { rows: 4, cols: 9, label: '4 × 9' },
  { rows: 5, cols: 6, label: '5 × 6' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeEmail(email: string): string {
  return email.replace(/[@.]/g, '_')
}

function chartDocId(teacherEmail: string, periodId: string): string {
  return `${sanitizeEmail(teacherEmail)}__${periodId}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export function useSeatingChart() {
  const seats   = ref<SeatsMap>({})
  const layout  = ref<SeatingLayout>({ ...PRESET_LAYOUTS[0] })
  const loading = ref(false)
  const saving  = ref(false)

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchSeatingChart = async (periodId: string, teacherEmail: string) => {
    loading.value = true
    try {
      const snap = await getDoc(doc(db, 'seatingCharts', chartDocId(teacherEmail, periodId)))
      if (snap.exists()) {
        const data = snap.data()
        seats.value  = data.seats  ?? {}
        layout.value = data.layout ?? { ...PRESET_LAYOUTS[0] }
      } else {
        seats.value  = {}
        layout.value = { ...PRESET_LAYOUTS[0] }
      }
    } finally {
      loading.value = false
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveSeatingChart = async (periodId: string, teacherEmail: string) => {
    saving.value = true
    try {
      await setDoc(doc(db, 'seatingCharts', chartDocId(teacherEmail, periodId)), {
        periodId,
        teacherEmail,
        schoolYearId: SCHOOL_YEAR_ID,
        layout: layout.value,
        seats: seats.value,
        updatedAt: new Date(),
      })
    } finally {
      saving.value = false
    }
  }

  // ── Seat helpers ─────────────────────────────────────────────────────────

  const seatKey = (row: number, col: number) => `r${row}c${col}`

  const getStudentAtSeat = (row: number, col: number): SeatStudent | null =>
    seats.value[seatKey(row, col)] ?? null

  const placeStudent = (row: number, col: number, student: SeatStudent | null) => {
    seats.value = { ...seats.value, [seatKey(row, col)]: student }
  }

  const removeFromSeat = (row: number, col: number) => {
    seats.value = { ...seats.value, [seatKey(row, col)]: null }
  }

  const removeStudentByUid = (uid: string) => {
    const updated: SeatsMap = {}
    for (const [key, val] of Object.entries(seats.value)) {
      updated[key] = val?.uid === uid ? null : val
    }
    seats.value = updated
  }

  const findSeatOfStudent = (uid: string): { row: number; col: number } | null => {
    for (const [key, val] of Object.entries(seats.value)) {
      if (val?.uid === uid) {
        const m = key.match(/^r(\d+)c(\d+)$/)
        if (m) return { row: parseInt(m[1]), col: parseInt(m[2]) }
      }
    }
    return null
  }

  /** UIDs of all currently-seated students */
  const seatedUids = (): Set<string> => {
    const s = new Set<string>()
    for (const val of Object.values(seats.value)) {
      if (val?.uid) s.add(val.uid)
    }
    return s
  }

  /** Switch to a new layout, trimming seats outside the new bounds */
  const applyLayout = (newLayout: SeatingLayout) => {
    layout.value = { ...newLayout }
    const updated: SeatsMap = {}
    for (let r = 0; r < newLayout.rows; r++) {
      for (let c = 0; c < newLayout.cols; c++) {
        const key = seatKey(r, c)
        updated[key] = seats.value[key] ?? null
      }
    }
    seats.value = updated
  }

  return {
    seats,
    layout,
    loading,
    saving,
    fetchSeatingChart,
    saveSeatingChart,
    getStudentAtSeat,
    placeStudent,
    removeFromSeat,
    removeStudentByUid,
    findSeatOfStudent,
    seatedUids,
    applyLayout,
    PRESET_LAYOUTS,
  }
}
