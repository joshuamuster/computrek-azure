<template>
  <div class="gradebook">

    <!-- ── Selectors ─────────────────────────────────────────────────────── -->
    <div class="gb-selectors">
      <div class="gb-selector-group">
        <span class="gb-selector-label">QUARTER</span>
        <button
            v-for="q in QUARTERS"
            :key="q.id"
            class="gb-pill"
            :class="{ 'gb-pill--active': selectedQuarterId === q.id }"
            @click="selectedQuarterId = q.id"
        >{{ q.label }}</button>
      </div>
      <div class="gb-selector-group">
        <span class="gb-selector-label">PERIODS</span>
        <button
            class="gb-pill"
            :class="{ 'gb-pill--active': allPeriodsSelected }"
            @click="toggleAllPeriods"
        >ALL</button>
        <button
            v-for="p in myPeriods"
            :key="p.id"
            class="gb-pill"
            :class="{ 'gb-pill--active': selectedPeriodIds.has(p.id) }"
            @click="togglePeriod(p.id)"
        >{{ shortLabel(p.id) }}</button>
      </div>
    </div>

    <div v-if="activePeriodIds.length === 0" class="status-msg">
      Select at least one period above to view the gradebook.
    </div>
    <div v-else-if="loading" class="status-msg">LOADING GRADEBOOK…</div>

    <template v-else>

      <!-- ── Actions bar ─────────────────────────────────────────────────── -->
      <div class="gb-actions-bar">
        <div class="gb-action-group">
          <button class="action-btn gb-btn" @click="exportCsv">↓ CSV</button>
          <button class="action-btn gb-btn" @click="printPdf">↓ PDF</button>
        </div>
        <div class="gb-action-group">
          <button
              class="lcars-btn gb-snapshot-btn"
              :disabled="takingSnapshot || isAudit"
              @click="takeSnapshot"
          >{{ takingSnapshot ? 'Saving…' : '📸 Take Snapshot' }}</button>
        </div>
      </div>

      <!-- ── Grid: one section per period ──────────────────────────────── -->
      <div
          v-for="periodId in activePeriodIds"
          :key="periodId"
          class="gb-period-section gb-print-section"
      >
        <div class="gb-period-header">
          <span class="gb-period-name">{{ fullLabel(periodId) }}</span>
          <span class="dim gb-period-meta">
            {{ orderedStudentsForPeriod(periodId).length }} students
            · {{ columnsForPeriod(periodId).length }} missions
          </span>
          <span class="dim gb-drag-hint">⠿ drag rows to reorder for Atlas</span>
          <span v-if="savingOrder === periodId" class="dim gb-saving-hint">saving order…</span>
        </div>

        <div class="gb-table-wrap">
          <table class="gb-table">
            <thead>
              <tr>
                <th class="gb-th-student">Student</th>
                <th
                    v-for="col in columnsForPeriod(periodId)"
                    :key="col.assignmentId"
                    class="gb-th-mission"
                    :title="col.missionTitle"
                >
                  <div class="gb-col-title">{{ col.missionTitle }}</div>
                  <div class="gb-col-pts dim">/ {{ col.pointsPossible ?? '?' }}</div>
                </th>
                <th class="gb-th-total">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                  v-for="student in orderedStudentsForPeriod(periodId)"
                  :key="student.uid"
                  draggable="true"
                  class="gb-tr"
                  :class="{
                    'gb-tr--dragging':  draggingUid === student.uid && draggingPeriod === periodId,
                    'gb-tr--drag-over': dragOverTarget === `${periodId}_${student.uid}`,
                  }"
                  @dragstart="onDragStart($event, periodId, student.uid)"
                  @dragover.prevent="onDragOver($event, periodId, student.uid)"
                  @drop.prevent="onDrop($event, periodId, student.uid)"
                  @dragend="onDragEnd"
              >
                <td class="gb-td-student">
                  <span class="drag-handle" title="Drag to reorder">⠿</span>
                  {{ student.displayName }}
                </td>
                <td
                    v-for="col in columnsForPeriod(periodId)"
                    :key="col.assignmentId"
                    class="gb-td-grade"
                    :class="gradeCellClass(student.uid, col.assignmentId, col.pointsPossible)"
                >
                  {{ gradeCellDisplay(student.uid, col.assignmentId) }}
                </td>
                <td class="gb-td-total">{{ studentTotal(student.uid, periodId) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Snapshots ──────────────────────────────────────────────────── -->
      <div class="gb-snapshots gb-no-print">
        <div class="gb-section-header">
          <span class="gb-section-title">SNAPSHOTS</span>
          <span v-if="snapshots.length > 0" class="dim gb-snap-meta">
            {{ snapshots.length }} saved for {{ selectedQuarterLabel }}
          </span>
        </div>

        <div v-if="snapshotsLoading" class="status-msg-small">Loading…</div>
        <div v-else-if="snapshots.length === 0" class="status-msg-small">
          No snapshots yet for {{ selectedQuarterLabel }}. Click "Take Snapshot" to save the current grades.
        </div>

        <div v-else class="gb-snapshot-list">
          <div
              v-for="snap in snapshots"
              :key="snap.id"
              class="gb-snapshot-row"
              :class="{ 'gb-snapshot-row--active': diffSnapshot?.id === snap.id && showDiff }"
          >
            <div class="gb-snap-info">
              <span class="gb-snap-label">{{ snap.label }}</span>
              <span class="dim gb-snap-detail">
                {{ snap.periodIds.map(shortLabel).join(', ') }}
                · {{ snap.grades.length }} grades
              </span>
            </div>
            <div class="gb-snap-actions">
              <button
                  class="action-btn gb-diff-btn"
                  :class="{ active: diffSnapshot?.id === snap.id && showDiff }"
                  @click="toggleDiff(snap)"
              >{{ diffSnapshot?.id === snap.id && showDiff ? 'Hide Diff' : 'Diff ↕' }}</button>
              <button class="action-btn gb-btn" @click="downloadSnapshot(snap)">↓ CSV</button>
            </div>
          </div>
        </div>

        <!-- Diff view -->
        <template v-if="showDiff && diffSnapshot">
          <div class="gb-diff-header">
            <span class="gb-section-title">CHANGES SINCE {{ diffSnapshot.label.toUpperCase() }}</span>
            <span v-if="diffRows.length > 0" class="gb-diff-count">
              {{ diffRows.length }} change{{ diffRows.length !== 1 ? 's' : '' }}
            </span>
            <button
                v-if="diffRows.length > 0"
                class="action-btn gb-btn"
                @click="exportDiffCsv"
            >↓ CSV</button>
          </div>

          <div v-if="diffRows.length === 0" class="status-msg-small">
            No graded changes since this snapshot.
          </div>
          <div v-else class="gb-table-wrap">
            <table class="gb-diff-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Period</th>
                  <th>Mission</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                <tr
                    v-for="row in diffRows"
                    :key="`${row.studentId}_${row.assignmentId}`"
                    class="gb-diff-row"
                    :class="`diff--${row.changeType}`"
                >
                  <td>{{ row.displayName }}</td>
                  <td>{{ shortLabel(row.periodId) }}</td>
                  <td>{{ row.missionTitle }}</td>
                  <td class="diff-old dim">{{ row.oldPoints ?? '—' }}</td>
                  <td class="diff-new">{{ row.newPoints }}</td>
                  <td>
                    <span class="diff-badge" :class="`diff-badge--${row.changeType}`">
                      {{ row.changeType === 'new' ? '+ New' : '↑ Updated' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  collection, query, where, getDocs,
  addDoc, doc, setDoc, getDoc, serverTimestamp, type Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import type { Assignment } from '@/composables/useAssignments'
import type { Submission, StudentRecord } from '@/composables/useSubmissions'
import type { Mission } from '@/composables/useMissions'
import { QUARTERS, PERIOD_IDS, SCHOOL_YEAR_ID, getQuarterIdForDate } from '@/config/schoolYear'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  assignments: Assignment[]
  students:    StudentRecord[]
  missionMap:  Map<string, Mission>
}>()

const { effectiveTeacherEmail, userInfo, isAdmin, isAudit } = useAuth()

const teacherKey = computed(() =>
  effectiveTeacherEmail.value ?? userInfo.value?.email ?? ''
)

// ── Quarter + Period selection ─────────────────────────────────────────────────

const todayStr        = new Date().toISOString().slice(0, 10)
const todayQuarterId  = getQuarterIdForDate(todayStr)
const selectedQuarterId = ref<string>(
  todayQuarterId !== 'unknown' ? todayQuarterId : QUARTERS[0].id
)

const selectedQuarterLabel = computed(() =>
  QUARTERS.find(q => q.id === selectedQuarterId.value)?.label ?? selectedQuarterId.value
)

// Periods visible to this user
const myPeriods = computed(() => {
  const myIds = userInfo.value?.periodIds as string[] | undefined
  if (isAdmin.value || isAudit.value || !myIds) return [...PERIOD_IDS]
  return PERIOD_IDS.filter(p => myIds.includes(p.id))
})

const selectedPeriodIds = ref(new Set<string>())

// Seed with all my periods on first load
watch(myPeriods, (periods) => {
  if (selectedPeriodIds.value.size === 0 && periods.length > 0) {
    selectedPeriodIds.value = new Set(periods.map(p => p.id))
  }
}, { immediate: true })

const activePeriodIds = computed(() =>
  [...selectedPeriodIds.value].sort()
)

const allPeriodsSelected = computed(() =>
  myPeriods.value.length > 0 && myPeriods.value.every(p => selectedPeriodIds.value.has(p.id))
)

function togglePeriod(id: string) {
  const next = new Set(selectedPeriodIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedPeriodIds.value = next
}

function toggleAllPeriods() {
  selectedPeriodIds.value = allPeriodsSelected.value
    ? new Set()
    : new Set(myPeriods.value.map(p => p.id))
}

// ── Data loading ──────────────────────────────────────────────────────────────

const gradebookSubs    = ref<Submission[]>([])
const loading          = ref(false)

// Declared here (before the immediate watcher below) to avoid TDZ errors
// when loadStudentOrders / loadSnapshots are called during setup.
const periodOrders     = ref(new Map<string, string[]>())
const savingOrder      = ref<string | null>(null)
const snapshots        = ref<GradebookSnapshot[]>([])
const snapshotsLoading = ref(false)
const takingSnapshot   = ref(false)

async function loadGradebook() {
  if (activePeriodIds.value.length === 0 || !teacherKey.value) return
  loading.value = true
  try {
    const q = query(
      collection(db, 'submissions'),
      where('periodId',    'in', activePeriodIds.value),
      where('schoolYearId','==', SCHOOL_YEAR_ID),
    )
    const snap = await getDocs(q)
    const all  = snap.docs.map(d => ({ id: d.id, feedbackNote: '', ...d.data() } as Submission))
    // Filter client-side: only graded submissions for the selected quarter
    gradebookSubs.value = all.filter(
      s => s.status === 'graded' && s.quarterId === selectedQuarterId.value
    )
  } catch (e) {
    console.error('loadGradebook:', e)
  } finally {
    loading.value = false
  }
}

watch(
  [activePeriodIds, selectedQuarterId, teacherKey],
  () => {
    gradebookSubs.value = []
    loadGradebook()
    loadSnapshots()
    loadStudentOrders()
  },
  { immediate: true }
)

// ── Column definitions ────────────────────────────────────────────────────────

interface Column {
  assignmentId:  string
  missionId:     string
  missionTitle:  string
  pointsPossible: number | null
  dueDate:       string | null
}

function columnsForPeriod(periodId: string): Column[] {
  return props.assignments
    .filter(a => a.periodId === periodId && a.quarterId === selectedQuarterId.value)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .map(a => ({
      assignmentId:   a.id,
      missionId:      a.missionId,
      missionTitle:   props.missionMap.get(a.missionId)?.title ?? a.id,
      pointsPossible: props.missionMap.get(a.missionId)?.pointsPossible ?? null,
      dueDate:        a.dueDate,
    }))
}

// ── Grade lookup ──────────────────────────────────────────────────────────────

const gradeMap = computed(() => {
  const m = new Map<string, number>()
  for (const sub of gradebookSubs.value) {
    if (sub.pointsEarned !== null) {
      m.set(`${sub.studentId}_${sub.assignmentId}`, sub.pointsEarned)
    }
  }
  return m
})

function gradeForCell(studentId: string, assignmentId: string): number | null {
  const v = gradeMap.value.get(`${studentId}_${assignmentId}`)
  return v !== undefined ? v : null
}

function gradeCellDisplay(studentId: string, assignmentId: string): string {
  const pts = gradeForCell(studentId, assignmentId)
  return pts !== null ? String(pts) : '—'
}

function gradeCellClass(studentId: string, assignmentId: string, possible: number | null): string {
  const pts = gradeForCell(studentId, assignmentId)
  if (pts === null) return 'gb-grade--empty'
  if (possible === null || possible === 0) return ''
  const pct = pts / possible
  if (pct >= 0.9) return 'gb-grade--high'
  if (pct >= 0.7) return 'gb-grade--mid'
  return 'gb-grade--low'
}

function studentTotal(studentId: string, periodId: string): string {
  const cols     = columnsForPeriod(periodId)
  let earned     = 0
  let possible   = 0
  let hasGrade   = false
  let allHavePts = true

  for (const col of cols) {
    const pts = gradeForCell(studentId, col.assignmentId)
    if (pts !== null) { earned += pts; hasGrade = true }
    if (col.pointsPossible !== null) possible += col.pointsPossible
    else allHavePts = false
  }

  if (!hasGrade) return '—'
  return allHavePts ? `${earned} / ${possible}` : `${earned} pts`
}

// ── Student ordering (per period, saved to Firestore) ─────────────────────────

async function loadStudentOrders() {
  if (!teacherKey.value) return
  const updates = new Map(periodOrders.value)
  for (const periodId of activePeriodIds.value) {
    try {
      const snap = await getDoc(doc(db, 'gradebookOrder', `${teacherKey.value}_${periodId}`))
      if (snap.exists()) updates.set(periodId, snap.data().order as string[])
    } catch (e) { /* no saved order yet, fine */ }
  }
  periodOrders.value = updates
}

async function saveStudentOrder(periodId: string, order: string[]) {
  if (!teacherKey.value || isAudit.value) return
  savingOrder.value = periodId
  try {
    await setDoc(doc(db, 'gradebookOrder', `${teacherKey.value}_${periodId}`), {
      teacherEmail: teacherKey.value,
      periodId,
      order,
      updatedAt: serverTimestamp(),
    })
  } catch (e) { console.error('saveStudentOrder:', e) }
  finally { savingOrder.value = null }
}

function orderedStudentsForPeriod(periodId: string): StudentRecord[] {
  const periodStudents = props.students.filter(s => s.periodId === periodId)
  const saved          = periodOrders.value.get(periodId)

  if (!saved || saved.length === 0) {
    return [...periodStudents].sort((a, b) => a.displayName.localeCompare(b.displayName))
  }

  // Place saved-order students first, append any new students alphabetically at the end
  const remaining = new Map(periodStudents.map(s => [s.uid, s]))
  const ordered: StudentRecord[] = []
  for (const uid of saved) {
    const s = remaining.get(uid)
    if (s) { ordered.push(s); remaining.delete(uid) }
  }
  const extra = [...remaining.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
  return [...ordered, ...extra]
}

// ── Drag-to-reorder ───────────────────────────────────────────────────────────

const draggingUid    = ref<string | null>(null)
const draggingPeriod = ref<string | null>(null)
const dragOverTarget = ref<string | null>(null)

function onDragStart(e: DragEvent, periodId: string, uid: string) {
  draggingUid.value    = uid
  draggingPeriod.value = periodId
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(_e: DragEvent, periodId: string, uid: string) {
  if (draggingPeriod.value !== periodId) return
  dragOverTarget.value = `${periodId}_${uid}`
}

function onDrop(_e: DragEvent, periodId: string, targetUid: string) {
  if (!draggingUid.value || draggingPeriod.value !== periodId) { onDragEnd(); return }
  const fromUid = draggingUid.value
  if (fromUid === targetUid)                                    { onDragEnd(); return }

  const currentOrder = orderedStudentsForPeriod(periodId).map(s => s.uid)
  const fromIdx      = currentOrder.indexOf(fromUid)
  const toIdx        = currentOrder.indexOf(targetUid)
  if (fromIdx === -1 || toIdx === -1)                           { onDragEnd(); return }

  currentOrder.splice(fromIdx, 1)
  currentOrder.splice(toIdx, 0, fromUid)

  // Optimistic local update
  periodOrders.value = new Map(periodOrders.value).set(periodId, currentOrder)
  saveStudentOrder(periodId, currentOrder)
  onDragEnd()
}

function onDragEnd() {
  draggingUid.value    = null
  draggingPeriod.value = null
  dragOverTarget.value = null
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

interface GradeRecord {
  studentId:     string
  displayName:   string
  periodId:      string
  assignmentId:  string
  missionId:     string
  missionTitle:  string
  pointsEarned:  number
  pointsPossible: number | null
}

interface GradebookSnapshot {
  id:          string
  teacherEmail: string
  periodIds:   string[]
  quarterId:   string
  schoolYearId: string
  takenAt:     Timestamp
  label:       string
  grades:      GradeRecord[]
}

async function loadSnapshots() {
  if (!teacherKey.value) return
  snapshotsLoading.value = true
  try {
    const q    = query(
      collection(db, 'gradebookSnapshots'),
      where('teacherEmail', '==', teacherKey.value),
      where('quarterId',    '==', selectedQuarterId.value),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    )
    const snap = await getDocs(q)
    snapshots.value = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as GradebookSnapshot))
      .sort((a, b) => (b.takenAt?.toMillis?.() ?? 0) - (a.takenAt?.toMillis?.() ?? 0))
  } catch (e) {
    console.error('loadSnapshots:', e)
  } finally {
    snapshotsLoading.value = false
  }
}

function buildGradeRecords(): GradeRecord[] {
  const records: GradeRecord[] = []
  for (const periodId of activePeriodIds.value) {
    for (const student of orderedStudentsForPeriod(periodId)) {
      for (const col of columnsForPeriod(periodId)) {
        const pts = gradeForCell(student.uid, col.assignmentId)
        if (pts !== null) {
          records.push({
            studentId:     student.uid,
            displayName:   student.displayName,
            periodId,
            assignmentId:  col.assignmentId,
            missionId:     col.missionId,
            missionTitle:  col.missionTitle,
            pointsEarned:  pts,
            pointsPossible: col.pointsPossible,
          })
        }
      }
    }
  }
  return records
}

async function takeSnapshot() {
  if (!teacherKey.value || isAudit.value) return
  takingSnapshot.value = true
  try {
    const grades = buildGradeRecords()
    const now    = new Date()
    const label  = `${selectedQuarterLabel.value} — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    await addDoc(collection(db, 'gradebookSnapshots'), {
      teacherEmail:  teacherKey.value,
      periodIds:     activePeriodIds.value,
      quarterId:     selectedQuarterId.value,
      schoolYearId:  SCHOOL_YEAR_ID,
      takenAt:       serverTimestamp(),
      label,
      grades,
    })
    await loadSnapshots()
  } catch (e) {
    console.error('takeSnapshot:', e)
  } finally {
    takingSnapshot.value = false
  }
}

// ── Diff ──────────────────────────────────────────────────────────────────────

const diffSnapshot = ref<GradebookSnapshot | null>(null)
const showDiff     = ref(false)

interface DiffRow {
  studentId:    string
  displayName:  string
  periodId:     string
  assignmentId: string
  missionTitle: string
  oldPoints:    number | null
  newPoints:    number
  changeType:   'new' | 'updated'
}

const diffRows = computed((): DiffRow[] => {
  if (!diffSnapshot.value) return []

  // Build a lookup of snapshot grades
  const snapMap = new Map<string, number>()
  for (const g of diffSnapshot.value.grades) {
    snapMap.set(`${g.studentId}_${g.assignmentId}`, g.pointsEarned)
  }

  const rows: DiffRow[] = []
  for (const periodId of activePeriodIds.value) {
    for (const student of orderedStudentsForPeriod(periodId)) {
      for (const col of columnsForPeriod(periodId)) {
        const current = gradeForCell(student.uid, col.assignmentId)
        if (current === null) continue   // not yet graded
        const key = `${student.uid}_${col.assignmentId}`
        const old = snapMap.get(key) ?? null
        if (old === current) continue    // unchanged
        rows.push({
          studentId:    student.uid,
          displayName:  student.displayName,
          periodId,
          assignmentId: col.assignmentId,
          missionTitle: col.missionTitle,
          oldPoints:    old,
          newPoints:    current,
          changeType:   old === null ? 'new' : 'updated',
        })
      }
    }
  }
  return rows
})

function toggleDiff(snap: GradebookSnapshot) {
  if (diffSnapshot.value?.id === snap.id && showDiff.value) {
    showDiff.value     = false
    diffSnapshot.value = null
  } else {
    diffSnapshot.value = snap
    showDiff.value     = true
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportCsv() {
  const rows: string[][] = []
  for (const periodId of activePeriodIds.value) {
    const cols = columnsForPeriod(periodId)
    if (rows.length > 0) rows.push([])
    rows.push([fullLabel(periodId)])
    rows.push(['Student', ...cols.map(c => `${c.missionTitle} (/${c.pointsPossible ?? '?'})`), 'Total'])
    for (const student of orderedStudentsForPeriod(periodId)) {
      const grades = cols.map(c => {
        const pts = gradeForCell(student.uid, c.assignmentId)
        return pts !== null ? String(pts) : ''
      })
      rows.push([student.displayName, ...grades, studentTotal(student.uid, periodId)])
    }
  }
  downloadCsv(rows, `gradebook_${selectedQuarterId.value}.csv`)
}

function exportDiffCsv() {
  if (!diffSnapshot.value || diffRows.value.length === 0) return
  const rows: string[][] = [
    [`Changes since: ${diffSnapshot.value.label}`],
    [],
    ['Student', 'Period', 'Mission', 'Previous', 'Current', 'Change'],
    ...diffRows.value.map(r => [
      r.displayName,
      fullLabel(r.periodId),
      r.missionTitle,
      r.oldPoints !== null ? String(r.oldPoints) : '',
      String(r.newPoints),
      r.changeType === 'new' ? 'New Grade' : 'Updated',
    ]),
  ]
  downloadCsv(
    rows,
    `diff_${selectedQuarterId.value}_${diffSnapshot.value.label.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`,
  )
}

function downloadSnapshot(snap: GradebookSnapshot) {
  // Group grades by period, then student
  const byPeriod = new Map<string, GradeRecord[]>()
  for (const g of snap.grades) {
    if (!byPeriod.has(g.periodId)) byPeriod.set(g.periodId, [])
    byPeriod.get(g.periodId)!.push(g)
  }
  const rows: string[][] = [[`Snapshot: ${snap.label}`], []]
  for (const [periodId, grades] of byPeriod) {
    const missionSet = [...new Map(grades.map(g => [g.assignmentId, g])).values()]
    const missionHeaders = missionSet.map(g => `${g.missionTitle} (/${g.pointsPossible ?? '?'})`)
    rows.push([fullLabel(periodId)])
    rows.push(['Student', ...missionHeaders, 'Earned'])
    const byStudent = new Map<string, GradeRecord[]>()
    for (const g of grades) {
      if (!byStudent.has(g.studentId)) byStudent.set(g.studentId, [])
      byStudent.get(g.studentId)!.push(g)
    }
    for (const [, sGrades] of byStudent) {
      const nameRow  = sGrades[0].displayName
      const gMap     = new Map(sGrades.map(g => [g.assignmentId, g.pointsEarned]))
      const cells    = missionSet.map(g => {
        const pts = gMap.get(g.assignmentId)
        return pts !== undefined ? String(pts) : ''
      })
      const earned   = sGrades.reduce((s, g) => s + g.pointsEarned, 0)
      rows.push([nameRow, ...cells, String(earned)])
    }
    rows.push([])
  }
  downloadCsv(rows, `snapshot_${snap.label.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`)
}

function downloadCsv(rows: string[][], filename: string) {
  const csv  = rows.map(r =>
    r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

function printPdf() {
  window.print()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortLabel(id: string): string { return id.replace('period-', 'P') }
function fullLabel(id: string):  string {
  return PERIOD_IDS.find(p => p.id === id)?.label ?? id
}
</script>

<style scoped>
.gradebook {
  display: flex; flex-direction: column; gap: 1.5rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

/* ── Selectors ── */
.gb-selectors {
  display: flex; flex-wrap: wrap; gap: 1.25rem;
}
.gb-selector-group {
  display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap;
}
.gb-selector-label {
  color: #445; font-size: 0.68rem; font-weight: bold;
  letter-spacing: 0.12em; margin-right: 0.25rem; white-space: nowrap;
}
.gb-pill {
  background: transparent;
  border: 0.0625rem solid rgba(153,204,255,0.2);
  border-radius: 0.25rem; color: #556;
  cursor: pointer; font-family: inherit;
  font-size: 0.72rem; font-weight: bold; letter-spacing: 0.06em;
  padding: 0.2rem 0.55rem; transition: all 0.15s;
}
.gb-pill:hover { border-color: rgba(153,204,255,0.45); color: #99ccff; }
.gb-pill--active {
  background: rgba(255,153,0,0.12);
  border-color: rgba(255,153,0,0.6);
  color: #ff9900;
}

/* ── Actions bar ── */
.gb-actions-bar {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  justify-content: space-between;
}
.gb-action-group { display: flex; gap: 0.4rem; }

.action-btn {
  background: transparent; border-radius: 0.3rem;
  cursor: pointer; font-family: inherit; font-size: 0.75rem;
  font-weight: bold; letter-spacing: 0.04em;
  padding: 0.25rem 0.6rem; transition: all 0.15s; white-space: nowrap;
  border: 0.0625rem solid rgba(153,204,255,0.25); color: #7799bb;
}
.action-btn:hover   { border-color: rgba(153,204,255,0.5); color: #99ccff; background: rgba(153,204,255,0.06); }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn.active  { border-color: rgba(255,153,0,0.5); color: #ff9900; }

.gb-btn {
  border-color: rgba(153,204,255,0.3); color: #6688aa;
}
.gb-diff-btn {
  border-color: rgba(255,213,79,0.35); color: #ffd740;
}
.gb-diff-btn:hover { border-color: #ffd740; background: rgba(255,213,79,0.08); }

.lcars-btn {
  background: linear-gradient(90deg, #cc6600, #ff9900);
  border: none; border-radius: 0.4rem; color: black;
  cursor: pointer; font-family: inherit; font-size: 0.85rem;
  font-weight: bold; letter-spacing: 0.08em; padding: 0.4rem 1rem;
  transition: opacity 0.2s;
}
.lcars-btn:hover:not(:disabled) { opacity: 0.85; }
.lcars-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── Period section ── */
.gb-period-section { display: flex; flex-direction: column; gap: 0.6rem; }
.gb-period-header {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding-bottom: 0.4rem;
  border-bottom: 0.0625rem solid rgba(255,153,0,0.2);
}
.gb-period-name {
  color: #ff9900; font-size: 1.05rem; font-weight: bold; letter-spacing: 0.06em;
}
.gb-period-meta  { font-size: 0.78rem; }
.gb-drag-hint    { font-size: 0.72rem; margin-left: auto; }
.gb-saving-hint  { font-size: 0.72rem; color: #ff9900; }

/* ── Gradebook table ── */
.gb-table-wrap {
  overflow-x: auto;
  border: 0.0625rem solid rgba(153,204,255,0.1);
  border-radius: 0.375rem;
}

.gb-table {
  border-collapse: collapse; width: 100%; min-width: 500px;
  font-size: 0.88rem;
}

.gb-table thead tr {
  background: rgba(0,20,50,0.7);
}

.gb-th-student {
  text-align: left; padding: 0.5rem 0.75rem;
  color: #556; font-size: 0.7rem; letter-spacing: 0.1em;
  position: sticky; left: 0; z-index: 2;
  background: rgba(0,20,50,0.95);
  min-width: 160px;
  border-right: 0.0625rem solid rgba(153,204,255,0.1);
}

.gb-th-mission {
  text-align: center; padding: 0.4rem 0.5rem;
  color: #556; font-size: 0.7rem; letter-spacing: 0.08em;
  min-width: 72px; max-width: 100px;
  border-right: 0.0625rem solid rgba(153,204,255,0.07);
}

.gb-th-total {
  text-align: center; padding: 0.5rem 0.5rem;
  color: #556; font-size: 0.7rem; letter-spacing: 0.1em;
  min-width: 80px;
  background: rgba(0,20,50,0.95);
}

.gb-col-title {
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  max-width: 90px; color: #99bbcc;
}
.gb-col-pts { color: #445; font-size: 0.65rem; margin-top: 0.1rem; }

/* Rows */
.gb-tr {
  border-bottom: 0.0625rem solid rgba(153,204,255,0.06);
  transition: background 0.1s;
}
.gb-tr:hover { background: rgba(0,35,75,0.4); }
.gb-tr--dragging { opacity: 0.4; }
.gb-tr--drag-over {
  background: rgba(255,153,0,0.08) !important;
  outline: 0.0625rem dashed rgba(255,153,0,0.5);
}

.gb-td-student {
  padding: 0.5rem 0.75rem; color: #cce0ff; font-size: 0.88rem;
  position: sticky; left: 0; z-index: 1;
  background: rgba(6,12,28,0.95);
  border-right: 0.0625rem solid rgba(153,204,255,0.08);
  white-space: nowrap;
}
.gb-tr:hover .gb-td-student { background: rgba(0,25,60,0.95); }

.drag-handle {
  color: #334; cursor: grab; margin-right: 0.4rem; font-size: 0.9rem;
  user-select: none;
}
.drag-handle:hover { color: #99ccff; }

.gb-td-grade {
  text-align: center; padding: 0.45rem 0.4rem;
  font-size: 0.9rem; font-weight: bold;
  border-right: 0.0625rem solid rgba(153,204,255,0.06);
}
.gb-grade--empty { color: #334; font-weight: normal; font-size: 0.8rem; }
.gb-grade--high  { color: #69f0ae; }
.gb-grade--mid   { color: #ffd740; }
.gb-grade--low   { color: rgba(255,110,110,0.85); }

.gb-td-total {
  text-align: center; padding: 0.45rem 0.5rem;
  color: #99ccff; font-size: 0.82rem;
  background: rgba(0,15,35,0.3);
}

/* ── Snapshots ── */
.gb-snapshots {
  display: flex; flex-direction: column; gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 0.0625rem solid rgba(153,204,255,0.1);
}

.gb-section-header {
  display: flex; align-items: center; gap: 0.75rem;
}
.gb-section-title {
  color: #556; font-size: 0.7rem; font-weight: bold;
  letter-spacing: 0.14em; text-transform: uppercase;
}
.gb-snap-meta { font-size: 0.75rem; }

.status-msg {
  color: #99ccff; font-size: 1rem; text-align: center; padding: 3rem 0; opacity: 0.7;
}
.status-msg-small {
  color: #445; font-size: 0.82rem; padding: 0.5rem 0;
}

.gb-snapshot-list {
  display: flex; flex-direction: column; gap: 0.3rem;
}

.gb-snapshot-row {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.6rem 0.85rem;
  background: rgba(0,15,35,0.4);
  border: 0.0625rem solid rgba(153,204,255,0.08);
  border-radius: 0.35rem;
  transition: border-color 0.15s;
}
.gb-snapshot-row:hover { border-color: rgba(153,204,255,0.18); }
.gb-snapshot-row--active {
  border-color: rgba(255,213,79,0.3);
  background: rgba(255,213,79,0.03);
}

.gb-snap-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.gb-snap-label  { color: #cce0ff; font-size: 0.9rem; }
.gb-snap-detail { font-size: 0.72rem; }
.gb-snap-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }

/* ── Diff ── */
.gb-diff-header {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.4rem 0;
}
.gb-diff-count {
  color: #ffd740; font-size: 0.78rem; font-weight: bold; letter-spacing: 0.06em;
}

.gb-diff-table {
  border-collapse: collapse; width: 100%; font-size: 0.85rem;
}
.gb-diff-table th {
  text-align: left; padding: 0.4rem 0.65rem;
  color: #445; font-size: 0.68rem; letter-spacing: 0.1em;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.15);
}
.gb-diff-row td {
  padding: 0.45rem 0.65rem; color: #cce0ff;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.06);
}
.gb-diff-row:hover td { background: rgba(0,30,65,0.4); }
.diff--new td     { }
.diff--updated td { }
.diff-old { color: #556 !important; }
.diff-new { color: #69f0ae; font-weight: bold; }

.diff-badge {
  display: inline-block; font-size: 0.65rem; font-weight: bold;
  letter-spacing: 0.06em; padding: 0.1rem 0.4rem;
  border-radius: 0.2rem; white-space: nowrap;
}
.diff-badge--new {
  background: rgba(105,240,174,0.1);
  border: 0.0625rem solid rgba(105,240,174,0.3);
  color: #69f0ae;
}
.diff-badge--updated {
  background: rgba(255,213,79,0.1);
  border: 0.0625rem solid rgba(255,213,79,0.3);
  color: #ffd740;
}

.dim { color: #556; }
</style>

<!-- Global print styles (unscoped) — hides everything except the gradebook grid -->
<style>
@media print {
  body * { visibility: hidden !important; }
  .gb-print-section,
  .gb-print-section * { visibility: visible !important; }
  .gb-no-print { display: none !important; }
  .gb-print-section {
    position: fixed; top: 0; left: 0; width: 100%;
    background: white !important; color: black !important;
    font-family: Arial, sans-serif; font-size: 10pt;
  }
  .gb-table { border-collapse: collapse; width: 100%; }
  .gb-table th, .gb-table td {
    border: 0.5pt solid #999; padding: 3pt 5pt;
    color: black !important; background: white !important;
  }
  .gb-th-student, .gb-td-student { position: static; }
  .gb-grade--high { color: #1a7a3a !important; }
  .gb-grade--mid  { color: #8a6200 !important; }
  .gb-grade--low  { color: #aa2222 !important; }
  .drag-handle { display: none; }
  .gb-period-name { color: black !important; font-size: 13pt; margin-bottom: 6pt; }
}
</style>
