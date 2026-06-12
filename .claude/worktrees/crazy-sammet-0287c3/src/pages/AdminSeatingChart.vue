<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { collection, query, where, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useSeatingChart, PRESET_LAYOUTS, type SeatStudent } from '@/composables/useSeatingChart'
import { pipColor, pipFilled, pipLabel } from '@/composables/useConductScore'
import { PERIOD_IDS, SCHOOL_YEAR_ID } from '@/config/schoolYear'
import { usePeriodSelector } from '@/composables/usePeriodSelector'
import { useMissions } from '@/composables/useMissions'
import CadetSlideOver from '@/components/CadetSlideOver.vue'

// Mission lookup — needed to resolve pointsPossible for grade calculation
const { fetchMissionsByIds } = useMissions()

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

const { userInfo, isAdmin, isStaff, emulatingEmail } = useAuth()

// The teacher email whose charts we're editing
const resolvedTeacherEmail = computed<string | null>(() => {
  if (isStaff.value)  return userInfo.value?.email ?? null
  if (isAdmin.value && emulatingEmail.value) return emulatingEmail.value
  return null
})

// Period IDs for the resolved teacher
const teacherPeriodIds = ref<string[]>([])

// Use the shared period selector so the seating chart respects whatever
// period the teacher already has active (e.g. from the period switcher).
const { selectedPeriodId, setPeriod } = usePeriodSelector()

// Tabs in strict numerical order (1 → 8) regardless of storage order
const sortedPeriodIds = computed(() => {
  const order = PERIOD_IDS.map(p => p.id) as string[]
  return [...teacherPeriodIds.value].sort((a, b) => order.indexOf(a) - order.indexOf(b))
})

watch(
  resolvedTeacherEmail,
  async (email) => {
    if (!email) {
      teacherPeriodIds.value = []
      return
    }
    let pids: string[] = []
    if (isStaff.value) {
      pids = (userInfo.value as any)?.periodIds ?? []
    } else {
      // Admin emulating — fetch emulated teacher's record
      try {
        const snap = await getDoc(doc(db, 'approvedUsers', email))
        if (snap.exists()) pids = snap.data().periodIds ?? []
      } catch (e) {
        console.warn('[AdminSeatingChart] could not fetch teacher record:', e)
      }
    }
    teacherPeriodIds.value = pids
    // If the currently selected period isn't valid for this teacher, clear it
    // so the seating area stays blank rather than loading the wrong chart.
    // Do NOT auto-select pids[0] — let the teacher's existing selection stand.
    if (selectedPeriodId.value && !pids.includes(selectedPeriodId.value)) {
      setPeriod(null)
    }
  },
  { immediate: true },
)

const periodLabel = (id: string) =>
  PERIOD_IDS.find(p => p.id === id)?.label ?? id

// ─────────────────────────────────────────────────────────────────────────────
// Seating chart composable
// ─────────────────────────────────────────────────────────────────────────────

const {
  seats, layout, loading, saving,
  fetchSeatingChart, saveSeatingChart,
  placeStudent, removeFromSeat, removeStudentByUid,
  seatedUids, applyLayout,
} = useSeatingChart()

/** True while the teacher has clicked EDIT and is actively rearranging seats. */
const isEditing = ref(false)

// Re-fetch whenever period or teacher changes
watch(
  [selectedPeriodId, resolvedTeacherEmail],
  async ([pid, email]) => {
    if (pid && email) {
      isEditing.value = false  // always return to locked mode when switching periods
      await fetchSeatingChart(pid, email)
      captureSnapshot()        // freeze the just-loaded state as the cancel target
      subscribePeriodStudents(pid, email)
      loadQuarterGrades(pid)   // fire-and-forget — populates studentGradeMap async
    }
  },
  { immediate: true },
)

// ─────────────────────────────────────────────────────────────────────────────
// Student roster
// ─────────────────────────────────────────────────────────────────────────────

interface RosterStudent {
  uid:          string
  docId:        string   // approvedUsers doc ID (= email) — needed for score writes
  displayName:  string
  conductScore: number   // 0-4, default 4
  studentId?:   string
}

const periodStudents = ref<RosterStudent[]>([])

// Live listener — unsubscribed when period/teacher changes or component unmounts
let unsubStudents: (() => void) | null = null

const subscribePeriodStudents = (periodId: string, teacherEmail: string) => {
  // Tear down any previous listener first
  if (unsubStudents) { unsubStudents(); unsubStudents = null }

  const q = query(
    collection(db, 'approvedUsers'),
    where('role',         '==', 'cadet'),
    where('periodId',     '==', periodId),
    where('teacherEmail', '==', teacherEmail),
  )

  unsubStudents = onSnapshot(q, (snap) => {
    periodStudents.value = snap.docs.map(d => ({
      docId:        d.id,
      uid:          d.data().uid          ?? d.id,
      displayName:  d.data().displayName  ?? 'Unknown Cadet',
      conductScore: d.data().conductScore ?? 4,
      studentId:    d.data().studentId,
    }))
  }, (err) => {
    console.error('[AdminSeatingChart] student listener error:', err)
  })
}

onUnmounted(() => { if (unsubStudents) unsubStudents() })

// Lookup map uid → conductScore for quick access in the seat grid
const studentScoreMap = computed<Map<string, { score: number; docId: string }>>(() => {
  const m = new Map<string, { score: number; docId: string }>()
  for (const s of periodStudents.value) m.set(s.uid, { score: s.conductScore, docId: s.docId })
  return m
})

// ── Quarter grade map ──────────────────────────────────────────────────────
// uid → percentage grade (0–100) for the current quarter, or null if no graded work yet.

const studentGradeMap = ref<Map<string, number | null>>(new Map())

const loadQuarterGrades = async (periodId: string) => {
  studentGradeMap.value = new Map()

  try {
    // 1. Fetch all submissions for this period + school year (all quarters)
    //    We use the full year so grades from earlier quarters are included.
    const snap = await getDocs(query(
      collection(db, 'submissions'),
      where('periodId',     '==', periodId),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    ))

    // 2. Keep only graded/returned submissions with a score
    const all = snap.docs.map(d => ({
      missionId:    d.data().missionId   as string,
      studentId:    d.data().studentId   as string,
      pointsEarned: d.data().pointsEarned as number | null,
      status:       d.data().status       as string,
    }))

    const graded = all.filter(s => (s.status === 'graded' || s.status === 'returned') && s.pointsEarned != null)

    if (!graded.length) return

    // 3. Batch-fetch missions to get pointsPossible
    const missionIds = [...new Set(graded.map(s => s.missionId))]
    const missions   = await fetchMissionsByIds(missionIds)
    const mMap       = new Map(missions.map(m => [m.id, m.pointsPossible]))

    // 4. Group by student and compute percentage average
    const byStudent = new Map<string, { earned: number; possible: number }[]>()
    for (const sub of graded) {
      const possible = mMap.get(sub.missionId)
      if (possible == null || possible === 0) continue
      if (!byStudent.has(sub.studentId)) byStudent.set(sub.studentId, [])
      byStudent.get(sub.studentId)!.push({ earned: sub.pointsEarned!, possible })
    }

    const result = new Map<string, number | null>()
    for (const [uid, scores] of byStudent) {
      if (!scores.length) { result.set(uid, null); continue }
      const pct = Math.round(
        scores.reduce((sum, s) => sum + (s.earned / s.possible) * 100, 0) / scores.length
      )
      result.set(uid, pct)
    }
    studentGradeMap.value = result
  } catch (e: any) {
    console.error('[grades] query failed:', e?.message ?? e)
  }
}

const currentSeatedUids = computed(() => seatedUids())

/** Returns a CSS color for a grade percentage. */
function isIneligible(uid: string): boolean {
  const grade   = studentGradeMap.value.get(uid)
  const conduct = studentScoreMap.value.get(uid)?.score ?? 4
  const gradeIneligible   = grade != null && grade < 60   // C or below
  const conductIneligible = conduct <= 2                   // marked down 2+ pips
  return gradeIneligible || conductIneligible
}

function gradeColor(pct: number): string {
  if (pct >= 80) return '#3399ff'   // A (80-100) — blue
  if (pct >= 60) return '#00cc66'   // B (60-79)  — green
  if (pct >= 40) return '#ffcc00'   // C (40-59)  — yellow
  if (pct >= 20) return '#ff9900'   // D (20-39)  — orange
  return '#ff4422'                   // F (<20)    — red
}

const unseatedStudents = computed(() =>
  periodStudents.value.filter(s => !currentSeatedUids.value.has(s.uid))
)

const seatedStudents = computed(() =>
  periodStudents.value.filter(s => currentSeatedUids.value.has(s.uid))
)

// ─────────────────────────────────────────────────────────────────────────────
// Drag and drop
// ─────────────────────────────────────────────────────────────────────────────

interface DragPayload {
  uid: string
  displayName: string
  fromRow?: number
  fromCol?: number
}

const dragOverSeat = ref<string | null>(null)  // "r{row}c{col}" of seat being hovered
const dragOverRoster = ref(false)

const onStudentDragStart = (e: DragEvent, student: RosterStudent) => {
  if (!e.dataTransfer) return
  const payload: DragPayload = { uid: student.uid, displayName: student.displayName }
  e.dataTransfer.setData('text/plain', JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'move'
}

const onSeatDragStart = (e: DragEvent, row: number, col: number, student: SeatStudent) => {
  if (!e.dataTransfer) return
  const payload: DragPayload = { uid: student.uid, displayName: student.displayName, fromRow: row, fromCol: col }
  e.dataTransfer.setData('text/plain', JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'move'
}

const onSeatDragOver = (e: DragEvent, row: number, col: number) => {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverSeat.value = `r${row}c${col}`
}

const onSeatDragLeave = () => { dragOverSeat.value = null }

const onSeatDrop = (e: DragEvent, row: number, col: number) => {
  e.preventDefault()
  dragOverSeat.value = null
  if (!e.dataTransfer) return

  let payload: DragPayload
  try {
    payload = JSON.parse(e.dataTransfer.getData('text/plain'))
  } catch { return }

  const targetOccupant = seats.value[`r${row}c${col}`] ?? null

  // If dragged from another seat, handle swap
  if (payload.fromRow !== undefined && payload.fromCol !== undefined) {
    if (targetOccupant) {
      // Swap: put the displaced student in the source seat
      placeStudent(payload.fromRow, payload.fromCol, targetOccupant)
    } else {
      removeFromSeat(payload.fromRow, payload.fromCol)
    }
  } else {
    // Dragged from roster — remove from any existing seat first
    removeStudentByUid(payload.uid)
  }

  placeStudent(row, col, { uid: payload.uid, displayName: payload.displayName })
}

const onRosterDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverRoster.value = true
}

const onRosterDragLeave = () => { dragOverRoster.value = false }

const onRosterDrop = (e: DragEvent) => {
  e.preventDefault()
  dragOverRoster.value = false
  if (!e.dataTransfer) return

  let payload: DragPayload
  try {
    payload = JSON.parse(e.dataTransfer.getData('text/plain'))
  } catch { return }

  // Only handle drops from an existing seat (roster→roster is a no-op)
  if (payload.fromRow !== undefined && payload.fromCol !== undefined) {
    removeFromSeat(payload.fromRow, payload.fromCol)
  }
}

const clearSeat = (row: number, col: number) => {
  removeFromSeat(row, col)
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide-over panel
// ─────────────────────────────────────────────────────────────────────────────

interface SlideOverStudent { uid: string; displayName: string; periodId: string; docId: string }

// Only store identity — score is derived live from periodStudents
const slideOverUid = ref<string | null>(null)

// Computed so conductScore stays live as onSnapshot fires
const slideOverStudent = computed<SlideOverStudent & { conductScore: number } | null>(() => {
  if (!slideOverUid.value || !selectedPeriodId.value) return null
  const roster = periodStudents.value.find(s => s.uid === slideOverUid.value)
  return {
    uid:          slideOverUid.value,
    displayName:  roster?.displayName ?? '',
    periodId:     selectedPeriodId.value,
    docId:        roster?.docId ?? '',
    conductScore: roster?.conductScore ?? 4,
  }
})

const openSlideOver = (student: SeatStudent) => {
  slideOverUid.value = student.uid
}

const closeSlideOver = () => {
  slideOverUid.value = null
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit / Cancel / Save
// ─────────────────────────────────────────────────────────────────────────────

/** Deep-clone of seats at last save (or load) — used by CANCEL to revert. */
const savedSnapshot = ref<Record<string, SeatStudent>>({})

const captureSnapshot = () => {
  savedSnapshot.value = JSON.parse(JSON.stringify(seats.value))
}

const enterEdit = () => { isEditing.value = true }

const cancelEdit = () => {
  seats.value    = JSON.parse(JSON.stringify(savedSnapshot.value))
  isEditing.value = false
}

const savedFlash = ref(false)

const save = async () => {
  if (!selectedPeriodId.value || !resolvedTeacherEmail.value) return
  await saveSeatingChart(selectedPeriodId.value, resolvedTeacherEmail.value)
  captureSnapshot()       // update cancel target to the just-saved state
  isEditing.value = false // return to locked mode after saving
  savedFlash.value = true
  setTimeout(() => { savedFlash.value = false }, 2000)
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid
// ─────────────────────────────────────────────────────────────────────────────

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${layout.value.cols}, 1fr)`,
  gridTemplateRows:    `repeat(${layout.value.rows}, auto)`,
}))

const gridSeats = computed(() => {
  const result: { row: number; col: number; key: string; student: SeatStudent | null }[] = []
  for (let r = 0; r < layout.value.rows; r++) {
    for (let c = 0; c < layout.value.cols; c++) {
      const key = `r${r}c${c}`
      result.push({ row: r, col: c, key, student: seats.value[key] ?? null })
    }
  }
  return result
})
</script>

<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>Seating Chart</span></div>

    <!-- No teacher selected (admin without View As) -->
    <div v-if="!resolvedTeacherEmail" class="no-teacher-msg">
      <div class="no-teacher-icon">🪑</div>
      <div class="no-teacher-title">SELECT A TEACHER</div>
      <div class="no-teacher-sub">Use the <strong>View As</strong> control in the top nav to select a teacher, then manage their seating arrangement.</div>
    </div>

    <template v-else>

      <!-- ── Controls bar ───────────────────────────────────────────────────── -->
      <div class="seating-controls">

        <!-- Period tabs — sorted 1 → 8 -->
        <div class="period-tabs">
          <button
            v-for="pid in sortedPeriodIds"
            :key="pid"
            class="period-tab"
            :class="{ 'is-active': selectedPeriodId === pid }"
            @click="setPeriod(pid)"
          >{{ periodLabel(pid) }}</button>
          <span v-if="sortedPeriodIds.length === 0" class="no-periods-msg">No periods assigned</span>
        </div>

        <!-- Layout presets — only accessible while editing -->
        <div class="layout-presets" v-if="isEditing">
          <span class="preset-label">LAYOUT:</span>
          <button
            v-for="preset in PRESET_LAYOUTS"
            :key="preset.label"
            class="preset-btn"
            :class="{ 'is-active': layout.cols === preset.cols && layout.rows === preset.rows }"
            @click="applyLayout(preset)"
          >{{ preset.label }}</button>
        </div>

        <!-- Edit / Cancel / Save -->
        <div class="chart-actions">
          <!-- Locked mode: show EDIT button -->
          <button v-if="!isEditing" class="edit-btn" @click="enterEdit">EDIT</button>

          <!-- Edit mode: show CANCEL + SAVE -->
          <template v-else>
            <button class="cancel-btn" @click="cancelEdit">CANCEL</button>
            <button
              class="save-btn"
              :class="{ 'is-saving': saving, 'is-saved': savedFlash }"
              :disabled="saving || !selectedPeriodId"
              @click="save"
            >
              <span v-if="saving">SAVING…</span>
              <span v-else-if="savedFlash">✓ SAVED</span>
              <span v-else>SAVE</span>
            </button>
          </template>
        </div>

      </div>

      <!-- ── No period selected ───────────────────────────────────────────────── -->
      <div v-if="!selectedPeriodId" class="no-period-msg">
        <div class="no-period-icon">🪑</div>
        <div class="no-period-title">SELECT A PERIOD</div>
        <div class="no-period-sub">Choose a period above to load its seating chart.</div>
      </div>

      <!-- ── Loading ────────────────────────────────────────────────────────── -->
      <div v-else-if="loading" class="loading-msg">Loading seating chart…</div>

      <!-- ── Main 2-column layout ───────────────────────────────────────────── -->
      <div v-else class="seating-layout">

        <!-- Seating grid -->
        <div class="seating-area">
          <div class="front-banner">▲ FRONT OF ROOM</div>

          <div class="seating-grid" :style="gridStyle">
            <div
              v-for="seat in gridSeats"
              :key="seat.key"
              class="seat"
              :class="{
                'is-occupied':   !!seat.student,
                'is-ineligible': !!seat.student && isIneligible(seat.student.uid),
                'is-drag-over':  isEditing && dragOverSeat === seat.key,
                'is-locked':     !isEditing,
              }"
              :draggable="isEditing && !!seat.student"
              :title="seat.student ? 'View ' + seat.student.displayName : undefined"
              @click="seat.student ? openSlideOver(seat.student) : undefined"
              @dragstart="isEditing && seat.student ? onSeatDragStart($event, seat.row, seat.col, seat.student) : undefined"
              @dragover="isEditing ? onSeatDragOver($event, seat.row, seat.col) : undefined"
              @dragleave="isEditing ? onSeatDragLeave() : undefined"
              @drop="isEditing ? onSeatDrop($event, seat.row, seat.col) : undefined"
            >
              <template v-if="seat.student">
                <span class="seat-name">
                  <span class="seat-name__last">{{ seat.student.displayName.split(' ').slice(1).join(' ') || seat.student.displayName }}</span>
                  <span class="seat-name__first">{{ seat.student.displayName.split(' ')[0] }}</span>
                </span>

                <!-- Quarter grade badge -->
                <div class="seat-grade"
                  v-if="studentGradeMap.get(seat.student.uid) != null"
                  :style="{ color: gradeColor(studentGradeMap.get(seat.student.uid)!) }"
                  title="Current quarter grade"
                >{{ studentGradeMap.get(seat.student.uid) }}%</div>
                <div class="seat-grade seat-grade--none" v-else title="No graded work yet">—</div>

                <button v-if="isEditing" class="seat-clear" title="Remove from seat" @click.stop="clearSeat(seat.row, seat.col)">✕</button>
                <!-- Conduct score pips -->
                <div class="seat-pips" :title="pipLabel(studentScoreMap.get(seat.student.uid)?.score ?? 4)">
                  <span
                    v-for="i in 4"
                    :key="i"
                    class="seat-pip"
                    :style="pipFilled(studentScoreMap.get(seat.student.uid)?.score ?? 4, i)
                      ? { background: pipColor(studentScoreMap.get(seat.student.uid)?.score ?? 4) }
                      : {}"
                  ></span>
                </div>
              </template>
              <template v-else>
                <span class="seat-vacant">{{ `${seat.row + 1}-${seat.col + 1}` }}</span>
              </template>
            </div>
          </div>

          <div class="seat-count-bar">
            {{ layout.rows * layout.cols }} seats · {{ seatedStudents.length }} occupied · {{ unseatedStudents.length }} unassigned
          </div>
        </div>

        <!-- Roster sidebar -->
        <div
          class="seating-sidebar"
          :class="{ 'is-drag-over': isEditing && dragOverRoster }"
          @dragover="isEditing ? onRosterDragOver($event) : undefined"
          @dragleave="isEditing ? onRosterDragLeave() : undefined"
          @drop="isEditing ? onRosterDrop($event) : undefined"
        >
          <div class="sidebar-header">
            <span class="sidebar-title">ROSTER</span>
            <span class="sidebar-period" v-if="selectedPeriodId">{{ periodLabel(selectedPeriodId) }}</span>
          </div>
          <div class="sidebar-count">{{ periodStudents.length }} cadets</div>

          <div v-if="periodStudents.length === 0" class="sidebar-empty">
            No cadets in this period.
          </div>

          <div v-else class="roster-sections">

            <!-- Unseated -->
            <div v-if="unseatedStudents.length" class="roster-group">
              <div class="roster-group-label">UNASSIGNED</div>
              <div
                v-for="student in unseatedStudents"
                :key="student.uid"
                class="roster-item roster-item--unseated"
                :class="{ 'roster-item--locked': !isEditing }"
                :draggable="isEditing"
                @dragstart="isEditing ? onStudentDragStart($event, student) : undefined"
              >
                <span class="roster-dot roster-dot--unseated"></span>
                <span class="roster-name">{{ student.displayName }}</span>
                <span class="roster-drag-hint">⠿</span>
              </div>
            </div>

            <!-- Seated -->
            <div v-if="seatedStudents.length" class="roster-group">
              <div class="roster-group-label">SEATED</div>
              <div
                v-for="student in seatedStudents"
                :key="student.uid"
                class="roster-item roster-item--seated"
                :class="{ 'roster-item--locked': !isEditing }"
                :draggable="isEditing"
                @dragstart="isEditing ? onStudentDragStart($event, student) : undefined"
              >
                <span class="roster-dot roster-dot--seated"></span>
                <span class="roster-name">{{ student.displayName }}</span>
                <span class="roster-drag-hint">⠿</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </template>
  </section>

  <!-- Cadet slide-over panel -->
  <CadetSlideOver
    :student="slideOverStudent"
    :teacherEmail="resolvedTeacherEmail ?? ''"
    @close="closeSlideOver"
  />
</template>

<style scoped>

/* ── Page shell ─────────────────────────────────────────────────────────── */

.adventure-page {
  padding-bottom: 2rem;
}

/* ── No teacher ─────────────────────────────────────────────────────────── */

.no-teacher-msg {
  text-align: center;
  padding: 4rem 2rem;
  color: #6688aa;
}

.no-teacher-icon { font-size: 3rem; margin-bottom: 1rem; }
.no-teacher-title {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.4rem;
  letter-spacing: 0.12em;
  color: #99ccff;
  margin-bottom: 0.75rem;
}
.no-teacher-sub { font-size: 0.9rem; line-height: 1.5; max-width: 28rem; margin: 0 auto; }
.no-teacher-sub strong { color: #ff9900; }

/* ── Controls bar ───────────────────────────────────────────────────────── */

.seating-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: rgba(10, 18, 34, 0.6);
  border-bottom: 1px solid rgba(51, 102, 255, 0.2);
  margin-bottom: 0;
}

.period-tabs {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.period-tab {
  background: rgba(51, 102, 255, 0.08);
  border: 1px solid rgba(51, 102, 255, 0.25);
  color: #6688aa;
  padding: 0.35rem 0.85rem;
  border-radius: 0.3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.15s;
}

.period-tab:hover { color: #99ccff; border-color: rgba(51, 102, 255, 0.5); }
.period-tab.is-active {
  background: rgba(51, 102, 255, 0.25);
  border-color: #3366ff;
  color: #99ccff;
}

.no-periods-msg { font-size: 0.8rem; color: #554; font-style: italic; }

.layout-presets {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.preset-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  color: #445566;
}

.preset-btn {
  background: rgba(51, 102, 255, 0.08);
  border: 1px solid rgba(51, 102, 255, 0.2);
  color: #6688aa;
  padding: 0.3rem 0.7rem;
  border-radius: 0.3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.07em;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-btn:hover { color: #99ccff; border-color: rgba(51, 102, 255, 0.5); }
.preset-btn.is-active {
  background: rgba(255, 153, 0, 0.15);
  border-color: #ff9900;
  color: #ff9900;
}

.save-btn {
  background: rgba(51, 102, 255, 0.18);
  border: 1px solid #3366ff;
  color: #99ccff;
  padding: 0.4rem 1.2rem;
  border-radius: 0.3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.82rem;
  letter-spacing: 0.12em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 5.5rem;
}

.save-btn:hover:not(:disabled) {
  background: rgba(51, 102, 255, 0.35);
  box-shadow: 0 0 0.6rem rgba(51, 102, 255, 0.4);
}

.save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.save-btn.is-saved {
  background: rgba(0, 204, 102, 0.18);
  border-color: #00cc66;
  color: #00cc66;
}

/* ── No period selected ─────────────────────────────────────────────────── */

.no-period-msg {
  text-align: center;
  padding: 4rem 2rem;
  color: #6688aa;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.no-period-icon { font-size: 2.5rem; margin-bottom: 0.25rem; }
.no-period-title {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.1rem;
  letter-spacing: 0.18em;
  color: #99ccff;
}
.no-period-sub {
  font-size: 0.85rem;
  color: #445566;
  font-family: 'Roboto', sans-serif;
}

/* ── Loading ────────────────────────────────────────────────────────────── */

.loading-msg {
  text-align: center;
  padding: 3rem;
  color: #6688aa;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  letter-spacing: 0.1em;
}

/* ── Main 2-column ──────────────────────────────────────────────────────── */

.seating-layout {
  display: flex;
  gap: 0;
  align-items: flex-start;
  min-height: 0;
}

/* ── Seating area ───────────────────────────────────────────────────────── */

.seating-area {
  flex: 1 1 0;
  min-width: 0;
  padding: 1rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.front-banner {
  text-align: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: #ff9900;
  padding: 0.4rem 1rem;
  background: rgba(255, 153, 0, 0.06);
  border: 1px solid rgba(255, 153, 0, 0.2);
  border-radius: 0.3rem;
}

.seating-grid {
  display: grid;
  gap: 0.4rem;
}

.seat {
  position: relative;
  min-height: 3.6rem;
  border: 1px solid rgba(51, 102, 255, 0.25);
  border-radius: 0.3rem;
  background: rgba(10, 20, 40, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.3rem 0.5rem 0.65rem;  /* extra bottom padding for the pips row */
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  cursor: default;
  overflow: hidden;
}

.seat.is-occupied {
  background: rgba(51, 102, 255, 0.12);
  border-color: rgba(51, 102, 255, 0.45);
  cursor: grab;     /* edit mode: whole seat is draggable */
}

.seat.is-occupied:active { cursor: grabbing; }

/* Ineligible for alternative seating: C or below, OR conduct ≤ 2 pips */
.seat.is-ineligible {
  background: rgba(180, 30, 10, 0.15);
  border-color: rgba(220, 60, 30, 0.55);
}
.seat.is-ineligible:hover {
  border-color: rgba(220, 60, 30, 0.8);
}

/* Locked mode: whole seat is clickable but not draggable */
.seat.is-locked.is-occupied { cursor: pointer; }

.seat.is-drag-over {
  border-color: #ff9900;
  background: rgba(255, 153, 0, 0.1);
  box-shadow: 0 0 0.5rem rgba(255, 153, 0, 0.3);
}

.seat-name {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'Roboto', sans-serif;
  font-size: 1rem;
  text-align: center;
  line-height: 1.2;
  word-break: break-word;
  pointer-events: none;  /* clicks pass through to the parent seat div */
  gap: 0.05rem;
}
.seat-name__last {
  color: #7aaadd;
  font-weight: 600;
}
.seat-name__first {
  color: #cce0ff;
  font-weight: 400;
  font-size: 0.88rem;
}

.seat-vacant {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.05em;
  color: rgba(51, 102, 255, 0.25);
}

.seat-grade {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1rem;
  letter-spacing: 0.04em;
  font-weight: bold;
  line-height: 1;
  pointer-events: none;
}

.seat-grade--none {
  color: rgba(102, 136, 170, 0.35);
  font-weight: normal;
}

/* ── Conduct-score pips on seat square ──────────────────────────────────── */
.seat-pips {
  position: absolute;
  bottom: 0.2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
}

.seat-pip {
  width: 5px;
  height: 5px;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.1);
  transition: background 0.25s;
}

.seat-clear {
  position: absolute;
  top: 0.15rem;
  right: 0.15rem;
  background: none;
  border: none;
  color: rgba(153, 204, 255, 0.4);
  font-size: 0.65rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.1rem;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.seat:hover .seat-clear { opacity: 1; }
.seat-clear:hover { color: #ff6644; }

.seat-count-bar {
  text-align: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: #445566;
  padding-top: 0.25rem;
}

/* ── Sidebar ────────────────────────────────────────────────────────────── */

.seating-sidebar {
  width: 14rem;
  flex-shrink: 0;
  border-left: 1px solid rgba(51, 102, 255, 0.15);
  background: rgba(8, 14, 28, 0.55);
  display: flex;
  flex-direction: column;
  min-height: 20rem;
  transition: background 0.15s, border-color 0.15s;
}

.seating-sidebar.is-drag-over {
  background: rgba(255, 100, 50, 0.07);
  border-left-color: rgba(255, 100, 50, 0.4);
}

.sidebar-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.75rem 0.85rem 0.2rem;
  border-bottom: 1px solid rgba(51, 102, 255, 0.12);
}

.sidebar-title {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  color: #99ccff;
  font-weight: bold;
}

.sidebar-period {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.7rem;
  color: #445566;
  letter-spacing: 0.07em;
}

.sidebar-count {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.68rem;
  color: #445566;
  letter-spacing: 0.07em;
  padding: 0.2rem 0.85rem 0.5rem;
}

.sidebar-empty {
  padding: 1.5rem 0.85rem;
  font-size: 0.82rem;
  color: #445566;
  font-style: italic;
}

.roster-sections {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0 0.5rem;
}

.roster-group { margin-bottom: 0.5rem; }

.roster-group-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: #334455;
  padding: 0.4rem 0.85rem 0.2rem;
}

.roster-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.85rem;
  cursor: grab;
  transition: background 0.12s;
  border-radius: 0;
  user-select: none;
}

.roster-item:active { cursor: grabbing; }

.roster-item--unseated:hover {
  background: rgba(51, 102, 255, 0.08);
}

.roster-item--seated {
  opacity: 0.55;
}

.roster-item--seated:hover {
  opacity: 0.85;
  background: rgba(51, 102, 255, 0.06);
}

.roster-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.roster-dot--unseated { background: #ff9900; }
.roster-dot--seated   { background: #00cc66; }

.roster-name {
  font-family: 'Roboto', sans-serif;
  font-size: 0.78rem;
  color: #99bbcc;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.roster-drag-hint {
  font-size: 0.8rem;
  color: #334455;
  flex-shrink: 0;
}

/* ── Locked mode ────────────────────────────────────────────────────────── */

/* Empty seats stay non-interactive when locked */
.seat.is-locked { cursor: default; }

/* Roster items are non-draggable when locked */
.roster-item.roster-item--locked {
  cursor: default;
}
.roster-item.roster-item--locked .roster-drag-hint {
  visibility: hidden;  /* hide the drag grip icon */
}

/* ── Chart action buttons (EDIT / CANCEL / SAVE group) ──────────────────── */

.chart-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.edit-btn {
  background: rgba(0, 204, 102, 0.12);
  border: 1px solid #00cc66;
  color: #00cc66;
  padding: 0.4rem 1.2rem;
  border-radius: 0.3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.82rem;
  letter-spacing: 0.12em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 5rem;
}

.edit-btn:hover {
  background: rgba(0, 204, 102, 0.25);
  box-shadow: 0 0 0.6rem rgba(0, 204, 102, 0.35);
}

.cancel-btn {
  background: rgba(255, 80, 50, 0.1);
  border: 1px solid rgba(255, 80, 50, 0.5);
  color: #ff7755;
  padding: 0.4rem 1rem;
  border-radius: 0.3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.82rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 5rem;
}

.cancel-btn:hover {
  background: rgba(255, 80, 50, 0.2);
  border-color: #ff5533;
  color: #ff5533;
}

</style>
