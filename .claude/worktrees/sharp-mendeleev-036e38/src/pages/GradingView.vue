<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>Mission Reports</span></div>

    <!-- Access denied -->
    <div v-if="!isStaff && !isAdmin && !isAudit" class="denied-container">
      <div class="denied-icon">⛔</div>
      <h2 class="denied-title">ACCESS DENIED</h2>
      <p class="denied-sub">This section is restricted to staff.</p>
    </div>

    <div v-else class="grading-container">

      <!-- ── Tab switcher ─────────────────────────────────────────────────── -->
      <div class="tab-bar">
        <button
            class="tab-btn"
            :class="{ active: activeTab === 'overview' }"
            @click="activeTab = 'overview'; loadOverview()"
        >OVERVIEW</button>
        <button
            class="tab-btn"
            :class="{ active: activeTab === 'assignment' }"
            @click="activeTab = 'assignment'"
        >BY ASSIGNMENT</button>
        <button
            class="tab-btn"
            :class="{ active: activeTab === 'student' }"
            @click="activeTab = 'student'; if (selectedPeriodId) loadStudentTable()"
        >BY STUDENT</button>

        <div class="tab-bar-spacer"></div>

        <button
            v-for="p in PERIOD_IDS"
            :key="p.id"
            class="period-pill"
            :class="{
              'period-pill--mine':   isAdmin || isAudit || myPeriodIds.includes(p.id),
              'period-pill--active': selectedPeriodId === p.id,
            }"
            :disabled="!isAdmin && !isAudit && !myPeriodIds.includes(p.id)"
            :title="p.label"
            @click="quickSelectPeriod(p.id)"
        >{{ periodShortLabel(p.id) }}</button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB: Overview                                                       -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'overview'" class="tab-panel">
        <div v-if="overviewLoading" class="status-msg">SCANNING PERIODS…</div>
        <div v-else-if="overviewPeriods.length === 0" class="status-msg">
          No periods found. Make sure your account has periods assigned.
        </div>
        <div v-else class="overview-grid">
          <div
              v-for="p in overviewPeriods"
              :key="p.periodId"
              class="ov-card"
              :class="{
                'ov-card--urgent':   p.totalNeedingGrade >= 5,
                'ov-card--has-work': p.totalNeedingGrade > 0 && p.totalNeedingGrade < 5,
                'ov-card--clear':    p.totalNeedingGrade === 0,
              }"
          >
            <div class="ov-period-label">{{ p.label }}</div>
            <div
                class="ov-count"
                :class="{
                  'ov-count--urgent':   p.totalNeedingGrade >= 5,
                  'ov-count--has-work': p.totalNeedingGrade > 0 && p.totalNeedingGrade < 5,
                  'ov-count--clear':    p.totalNeedingGrade === 0,
                }"
            >{{ p.totalNeedingGrade }}</div>
            <div class="ov-count-label">to grade</div>
            <div class="ov-breakdown">
              <span v-if="p.submittedCount > 0" class="ov-chip ov-chip--submitted">
                {{ p.submittedCount }} submitted
              </span>
              <span v-if="p.returnedCount > 0" class="ov-chip ov-chip--returned">
                {{ p.returnedCount }} returned
              </span>
              <span v-if="p.totalNeedingGrade === 0" class="ov-chip ov-chip--clear">
                ✓ all clear
              </span>
            </div>
            <button
                v-if="p.totalNeedingGrade > 0"
                class="ov-grade-btn"
                @click="goToGradeQueue(p.periodId)"
            >GRADE →</button>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB: By Assignment — Grade Queue                                   -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'assignment'" class="tab-panel">

        <!-- ── Staged grades bar (shown when grades are queued but not yet saved) ── -->
        <div v-if="pendingGrades.size > 0 && !isAudit" class="submit-bar">
          <span class="submit-bar-msg">
            {{ pendingGrades.size }} grade{{ pendingGrades.size === 1 ? '' : 's' }} staged — not yet saved
          </span>
          <button class="action-btn ungrade-btn" @click="cancelAllPending">Discard All</button>
          <button
              class="lcars-btn submit-all-btn"
              :disabled="isSubmitting"
              @click="submitAllGrades"
          >{{ isSubmitting ? 'Saving…' : `Submit ${pendingGrades.size} Grade${pendingGrades.size === 1 ? '' : 's'}` }}</button>
        </div>

        <!-- No period selected prompt -->
        <div v-if="!selectedPeriodId" class="status-msg">
          Select a period using the pills above to see submissions needing grading.
        </div>

        <!-- Submissions table -->
        <template v-else>
          <div v-if="isLoading" class="status-msg">LOADING REPORTS...</div>
          <div v-else-if="error" class="status-error">{{ error }}</div>
          <div v-else-if="submissions.length === 0" class="status-msg">
            No submissions waiting to be graded for this period.
          </div>
          <div v-else class="submissions-table">
            <div class="table-header grade-queue-header">
              <span class="sortable" @click="setSort('studentName')">
                CADET {{ sortIcon('studentName') }}
              </span>
              <span>ASSIGNMENT</span>
              <span class="sortable" @click="setSort('submittedAt')">
                SUBMITTED {{ sortIcon('submittedAt') }}
              </span>
              <span>STATUS</span>
              <span>WORK</span>
              <span>FEEDBACK / NOTES</span>
              <span></span>
            </div>

            <div
                v-for="sub in sortedSubmissions"
                :key="sub.id"
                class="table-row-wrap"
            >
            <div
                class="table-row grade-queue-row"
                :class="`status--${sub.status}`"
            >
              <span class="col-name">{{ studentName(sub.studentId) }}</span>
              <span class="col-assignment">{{ assignmentTitle(sub.assignmentId) }}</span>
              <span class="col-date">{{ formatTimestamp(sub.submittedAt) }}</span>
              <span class="col-status">
                <span class="status-badge" :class="pendingForSub(sub.id) ? 'staged' : sub.status">
                  {{ pendingForSub(sub.id) ? '⏳ Staged' : statusLabel(sub.status) }}
                </span>
                <span v-if="pendingForSub(sub.id) != null || sub.pointsEarned != null" class="points-display">
                  {{ pendingForSub(sub.id)?.points ?? sub.pointsEarned }}/{{ subPointsPossible(sub) ?? '?' }} pts
                </span>
              </span>
              <span class="col-work">
                <a
                    v-if="sub.type === 'file' && sub.data?.url"
                    :href="sub.data.url"
                    target="_blank"
                    class="view-link"
                >View file ↗</a>
                <span v-else class="dim">—</span>
              </span>
              <span class="col-feedback">
                <span class="feedback-text" :class="{ dim: !sub.feedbackNote }">
                  {{ sub.feedbackNote || '—' }}
                </span>
              </span>
              <span class="col-actions">
                <template v-if="!isAudit">
                  <!-- Staged (pending) grade: show Edit and Unstage -->
                  <template v-if="pendingForSub(sub.id)">
                    <button
                        class="action-btn grade-btn"
                        :class="{ active: editingGrade === sub.id }"
                        @click="editingGrade === sub.id ? cancelGrade() : startGrade(sub)"
                    >Edit</button>
                    <button
                        class="action-btn ungrade-btn"
                        @click="cancelPending(sub.id)"
                        title="Remove this staged grade"
                    >✕ Unstage</button>
                  </template>
                  <template v-else>
                    <!-- Grade panel trigger (submitted or returned) -->
                    <button
                        v-if="sub.status === 'submitted' || sub.status === 'returned'"
                        class="action-btn grade-btn"
                        :class="{ active: editingGrade === sub.id }"
                        @click="editingGrade === sub.id ? cancelGrade() : startGrade(sub)"
                    >Grade</button>
                    <!-- Revert graded back to submitted -->
                    <button
                        v-if="sub.status === 'graded'"
                        class="action-btn ungrade-btn"
                        :disabled="isSaving === sub.id"
                        @click="markUngraded(sub)"
                    >Revert</button>
                  </template>
                  <!-- Extend date override (always shown) -->
                  <button
                      v-if="editingExtend !== sub.id"
                      class="action-btn extend-btn"
                      @click="startExtend(sub)"
                      title="Set a custom due date extension for this student"
                  >{{ sub.dueDateOverride ? '📅' : 'Extend' }}</button>
                </template>
              </span>
            </div>

            <!-- Grading panel (expand-below) -->
            <div v-if="editingGrade === sub.id" class="grade-row">
              <span class="grade-label">Grade for {{ studentName(sub.studentId) }}</span>
              <div class="grade-points-wrap">
                <input
                    v-model.number="pointsDraft"
                    type="number" min="0"
                    :max="subPointsPossible(sub) ?? 9999"
                    class="lcars-input grade-points-input"
                    placeholder="Pts"
                    autofocus
                />
                <span class="grade-points-max">/ {{ subPointsPossible(sub) ?? '?' }}</span>
              </div>
              <input
                  v-model="gradeFeedbackDraft"
                  class="lcars-input grade-feedback-input"
                  placeholder="Feedback for student (optional)"
              />
              <button
                  class="action-btn finalize-btn"
                  :disabled="pointsDraft === null"
                  @click="finalizeGrade(sub)"
              >Stage Grade</button>
              <button
                  class="action-btn return-btn"
                  :disabled="pointsDraft === null"
                  @click="returnGrade(sub)"
              >Stage → Return</button>
              <button class="action-btn" style="border-color:#334;color:#445" @click="cancelGrade">✕</button>
            </div>

            <!-- Extend row (inline, below the main row) -->
            <div v-if="editingExtend === sub.id" class="extend-row">
              <span class="extend-label">
                Extension for {{ studentName(sub.studentId) }}:
                <span v-if="sub.dueDateOverride" class="extend-current">current {{ formatDate(sub.dueDateOverride) }}</span>
              </span>
              <input
                  v-model="extendDateDraft"
                  class="lcars-input extend-date-input"
                  type="date"
              />
              <button class="action-btn save-btn" :disabled="isSaving === sub.id" @click="saveExtend(sub)">
                {{ isSaving === sub.id ? '...' : 'Set' }}
              </button>
              <button
                  v-if="sub.dueDateOverride"
                  class="action-btn ungrade-btn"
                  :disabled="isSaving === sub.id"
                  @click="clearExtend(sub)"
              >Clear</button>
              <button class="action-btn" style="border-color:#334;color:#445" @click="cancelExtend">✕</button>
            </div>

            </div><!-- end table-row-wrap -->
          </div>

          <!-- Export button -->
          <div v-if="submissions.length > 0" class="export-row">
            <button class="lcars-btn lcars-btn--ghost" @click="exportToSheets">
              EXPORT TO SHEETS
            </button>
            <span v-if="exportStatus" class="export-status" :class="exportStatus">
              {{ exportStatus === 'ok' ? '✓ Exported' : '✗ Export failed' }}
            </span>
          </div>
        </template>

      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB: By Student                                                    -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'student'" class="tab-panel">

        <!-- ── Drill-down: individual student detail ── -->
        <template v-if="selectedStudent">
          <div class="stud-back-row">
            <button class="action-btn back-btn" @click="clearStudentSearch">← All Students</button>
            <span class="stud-back-name">{{ selectedStudent.displayName }}</span>
            <span class="stud-back-period">{{ periodLabel(selectedStudent.periodId) }}</span>
          </div>

          <div class="student-summary">
            <span class="student-summary-count">
              {{ studentGradedCount }} / {{ studentSubmissions.length }} graded
            </span>
            <span class="student-summary-count" style="color:#ff9900">
              {{ studentSubmittedCount }} waiting to grade
            </span>
          </div>

          <div v-if="studentLoading" class="status-msg">LOADING CADET FILE...</div>
          <div v-else-if="studentSubmissions.length === 0" class="status-msg">
            No assignments found for this student.
          </div>
          <div v-else class="submissions-table">
            <div class="table-header student-table-header">
              <span>ASSIGNMENT</span>
              <span>DUE DATE</span>
              <span>SUBMITTED</span>
              <span>STATUS</span>
              <span>WORK</span>
              <span>FEEDBACK</span>
            </div>
            <div
                v-for="sub in sortedStudentSubmissions"
                :key="sub.id"
                class="table-row"
                :class="`status--${sub.status}`"
            >
              <span class="col-name">{{ assignmentTitle(sub.assignmentId) }}</span>
              <span class="col-date dim">{{ assignmentDueDate(sub.assignmentId) }}</span>
              <span class="col-date">{{ formatTimestamp(sub.submittedAt) }}</span>
              <span class="col-status">
                <span class="status-badge" :class="sub.status">{{ statusLabel(sub.status) }}</span>
                <span v-if="sub.pointsEarned != null" class="points-display">
                  {{ sub.pointsEarned }}/{{ subPointsPossible(sub) ?? '?' }} pts
                </span>
              </span>
              <span class="col-work">
                <a v-if="sub.type === 'file' && sub.data?.url" :href="sub.data.url" target="_blank" class="view-link">View file ↗</a>
                <span v-else class="dim">—</span>
              </span>
              <span class="col-feedback">
                <span class="feedback-text" :class="{ dim: !sub.feedbackNote }">{{ sub.feedbackNote || '—' }}</span>
              </span>
            </div>
          </div>
        </template>

        <!-- ── Class-wide student table ── -->
        <template v-else>
          <!-- Search field -->
          <div class="stud-search-row">
            <div class="search-wrap stud-search-wrap">
              <input
                  v-model="studentSearch"
                  class="lcars-input search-input"
                  type="text"
                  placeholder="Search cadet…"
              />
              <button v-if="studentSearch" class="clear-search" @click="studentSearch = ''">✕</button>
            </div>
            <span v-if="selectedPeriodId" class="stud-count-label">
              {{ studentRows.length }} cadet{{ studentRows.length !== 1 ? 's' : '' }}
            </span>
          </div>

          <div v-if="!selectedPeriodId" class="status-msg">
            Select a period using the pills above to view your class.
          </div>
          <div v-else-if="studentTableLoading" class="status-msg">LOADING CLASS...</div>
          <div v-else-if="studentRows.length === 0" class="status-msg">
            No students found{{ studentSearch ? ' matching your search' : ' in this period' }}.
          </div>
          <div v-else class="submissions-table">
            <!-- Table header -->
            <div class="table-header stud-class-header">
              <span class="sortable" @click="setStudSort('displayName')">
                CADET {{ studSortIcon('displayName') }}
              </span>
              <span class="sortable" @click="setStudSort('total')">
                TOTAL {{ studSortIcon('total') }}
              </span>
              <span class="sortable" @click="setStudSort('graded')">
                GRADED {{ studSortIcon('graded') }}
              </span>
              <span class="sortable" @click="setStudSort('waiting')">
                WAITING {{ studSortIcon('waiting') }}
              </span>
              <span class="sortable" @click="setStudSort('avgScore')">
                AVG SCORE {{ studSortIcon('avgScore') }}
              </span>
              <span class="sortable" @click="setStudSort('lastSubmitted')">
                LAST SUBMITTED {{ studSortIcon('lastSubmitted') }}
              </span>
            </div>
            <!-- Table rows -->
            <div
                v-for="row in studentRows"
                :key="row.uid"
                class="table-row stud-class-row"
                @click="selectStudent(row.record)"
            >
              <span class="col-name">{{ row.displayName }}</span>
              <span class="col-num dim">{{ row.total || '—' }}</span>
              <span class="col-num" style="color:#69f0ae">{{ row.graded || '—' }}</span>
              <span class="col-num" :class="{ 'col-waiting': row.waiting > 0 }">
                {{ row.waiting || '—' }}
              </span>
              <span class="col-score" :class="scoreClass(row.avgScore)">
                {{ row.avgScore !== null ? row.avgScore + '%' : '—' }}
              </span>
              <span class="col-date">{{ formatStudDate(row.lastSubmitted) }}</span>
            </div>
          </div>
        </template>

      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useAssignments, type Assignment } from '@/composables/useAssignments'
import { useSubmissions, type Submission, type StudentRecord, type StatsCtx } from '@/composables/useSubmissions'
import { useMissions, type Mission } from '@/composables/useMissions'
import { PERIOD_IDS, SCHOOL_YEAR_ID } from '@/config/schoolYear'
import { recalculateShipHealth } from '@/composables/useShipStatus'

const { isStaff, isAdmin, isAudit, userInfo, effectiveTeacherEmail } = useAuth()

// ── Shared data ───────────────────────────────────────────────────────────────

const {
  assignments, fetchAssignments,
} = useAssignments()

const { fetchMissionsByIds } = useMissions()

const {
  submissions: rawSubmissions, students,
  isLoading, error,
  fetchAllByStudent, fetchNeedingGradingByPeriod, fetchStudents,
  gradeSubmission, returnSubmission, ungradeSubmission, setDueDateOverride,
} = useSubmissions()

// Mission lookup map — populated after assignments load
const missionMap = ref(new Map<string, Mission>())

const submissions        = ref<Submission[]>([])
const studentSubmissions = ref<Submission[]>([])

// ── Tabs ──────────────────────────────────────────────────────────────────────

const activeTab = ref<'overview' | 'assignment' | 'student'>('overview')

// Periods this user teaches (staff have periodIds; admins typically don't)
const myPeriodIds = computed<string[]>(() => userInfo.value?.periodIds ?? [])

function periodShortLabel(id: string): string {
  return id.replace('period-', 'P')
}

function quickSelectPeriod(periodId: string) {
  selectedPeriodId.value = periodId
  submissions.value = []
}

// ── Overview tab ──────────────────────────────────────────────────────────────

interface PeriodOverview {
  periodId:          string
  label:             string
  submittedCount:    number
  returnedCount:     number
  totalNeedingGrade: number
}

const overviewLoading = ref(false)
const overviewPeriods = ref<PeriodOverview[]>([])

async function loadOverview() {
  overviewLoading.value = true
  // Determine which periods to show:
  //   admin / audit → all periods; staff → their own periods
  const periodIds = (isAdmin.value || isAudit.value)
    ? PERIOD_IDS.map(p => p.id)
    : myPeriodIds.value

  if (periodIds.length === 0) {
    overviewPeriods.value = []
    overviewLoading.value = false
    return
  }

  // Fetch all submissions per period in parallel, filter client-side
  const results = await Promise.all(
    periodIds.map(async (periodId): Promise<PeriodOverview> => {
      const q    = query(
        collection(db, 'submissions'),
        where('periodId',    '==', periodId),
        where('schoolYearId','==', SCHOOL_YEAR_ID),
      )
      const snap = await getDocs(q)
      const subs = snap.docs.map(d => d.data())
      const submittedCount = subs.filter(s => s.status === 'submitted').length
      const returnedCount  = subs.filter(s => s.status === 'returned').length
      return {
        periodId,
        label:             PERIOD_IDS.find(p => p.id === periodId)?.label ?? periodId,
        submittedCount,
        returnedCount,
        totalNeedingGrade: submittedCount + returnedCount,
      }
    })
  )

  // Sort: most work first, then alphabetical by periodId for ties
  overviewPeriods.value = results.sort((a, b) =>
    b.totalNeedingGrade - a.totalNeedingGrade || a.periodId.localeCompare(b.periodId)
  )
  overviewLoading.value = false
}

/** Switch to the grade queue for a specific period. */
function goToGradeQueue(periodId: string) {
  selectedPeriodId.value = periodId
  activeTab.value        = 'assignment'
  // watch(selectedPeriodId) fires after both refs are set → calls loadGradeQueue()
}

// ── By-assignment (grade queue) state ────────────────────────────────────────

const route = useRoute()
const selectedPeriodId   = ref('')
const isSaving           = ref<string | null>(null)
const editingGrade       = ref<string | null>(null)
const pointsDraft        = ref<number | null>(null)
const gradeFeedbackDraft = ref('')
const exportStatus       = ref<'ok' | 'error' | null>(null)

// Sort state
const sortKey = ref<'studentName' | 'submittedAt'>('studentName')
const sortDir = ref<'asc' | 'desc'>('asc')

const setSort = (key: typeof sortKey.value) => {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortDir.value = 'asc' }
}

const sortIcon = (key: string) => {
  if (sortKey.value !== key) return '⇅'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

// Build a uid → displayName map for fast lookup
const studentMap = computed(() => {
  const m = new Map<string, string>()
  students.value.forEach(s => m.set(s.uid, s.displayName))
  return m
})

// Build an assignmentId → assignment map
const assignmentMap = computed(() => {
  const m = new Map<string, Assignment>()
  assignments.value.forEach(a => m.set(a.id, a))
  return m
})

// Look up points possible for a specific submission's mission
function subPointsPossible(sub: Submission): number | null {
  return missionMap.value.get(sub.missionId)?.pointsPossible ?? null
}

function studentName(uid: string): string {
  return studentMap.value.get(uid) ?? uid
}

function assignmentTitle(id: string): string {
  const assignment = assignmentMap.value.get(id)
  if (!assignment) return id
  return missionMap.value.get(assignment.missionId)?.title ?? id
}

function assignmentDueDate(id: string): string {
  const due = assignmentMap.value.get(id)?.dueDate
  return due ? formatDate(due) : '—'
}

// Sorted submissions for the assignment tab
const sortedSubmissions = computed(() => {
  return [...submissions.value].sort((a, b) => {
    let av: string, bv: string
    if (sortKey.value === 'studentName') {
      av = studentName(a.studentId).toLowerCase()
      bv = studentName(b.studentId).toLowerCase()
    } else {
      av = a.submittedAt?.toMillis().toString() ?? '0'
      bv = b.submittedAt?.toMillis().toString() ?? '0'
    }
    const cmp = av.localeCompare(bv)
    return sortDir.value === 'asc' ? cmp : -cmp
  })
})

async function loadGradeQueue() {
  if (!selectedPeriodId.value) return
  pendingGrades.value = new Map()
  cancelGrade()
  await fetchNeedingGradingByPeriod(selectedPeriodId.value)
  submissions.value = rawSubmissions.value
}

// ── By-student state ──────────────────────────────────────────────────────────

const studentSearch      = ref('')   // filters the class table
const selectedStudentUid = ref('')
const selectedStudent    = ref<StudentRecord | null>(null)
const studentLoading     = ref(false)

// ── Student class-table ───────────────────────────────────────────────────────
// Holds ALL submissions for the selected period so we can aggregate per student.
const studentTableSubs    = ref<Submission[]>([])
const studentTableLoading = ref(false)

interface StudentRow {
  uid:           string
  displayName:   string
  periodId:      string
  record:        StudentRecord
  total:         number
  graded:        number
  waiting:       number          // submitted + returned
  avgScore:      number | null   // null if no graded submissions yet
  lastSubmitted: Date | null
}

async function loadStudentTable() {
  if (!selectedPeriodId.value) { studentTableSubs.value = []; return }
  studentTableLoading.value = true
  try {
    const q = query(
      collection(db, 'submissions'),
      where('periodId',    '==', selectedPeriodId.value),
      where('schoolYearId','==', SCHOOL_YEAR_ID),
    )
    const snap = await getDocs(q)
    studentTableSubs.value = snap.docs.map(d => ({ id: d.id, feedbackNote: '', ...d.data() } as Submission))
  } catch (e) {
    console.error('loadStudentTable:', e)
  } finally {
    studentTableLoading.value = false
  }
}

// Sort state for the class table
type StudSortKey = 'displayName' | 'total' | 'graded' | 'waiting' | 'avgScore' | 'lastSubmitted'
const studSortKey = ref<StudSortKey>('displayName')
const studSortDir = ref<'asc' | 'desc'>('asc')

function setStudSort(key: StudSortKey) {
  if (studSortKey.value === key) studSortDir.value = studSortDir.value === 'asc' ? 'desc' : 'asc'
  else { studSortKey.value = key; studSortDir.value = key === 'displayName' ? 'asc' : 'desc' }
}
function studSortIcon(key: string) {
  return studSortKey.value !== key ? '⇅' : studSortDir.value === 'asc' ? '↑' : '↓'
}

// Build one row per student in the selected period
const studentRows = computed((): StudentRow[] => {
  const periodStudents = students.value.filter(s =>
    selectedPeriodId.value ? s.periodId === selectedPeriodId.value : true
  )
  // Group submissions by student uid
  const byStudent = new Map<string, Submission[]>()
  for (const sub of studentTableSubs.value) {
    if (!byStudent.has(sub.studentId)) byStudent.set(sub.studentId, [])
    byStudent.get(sub.studentId)!.push(sub)
  }
  // Filter by search
  const q = studentSearch.value.trim().toLowerCase()
  const filtered = q
    ? periodStudents.filter(s => s.displayName.toLowerCase().includes(q))
    : periodStudents

  const rows: StudentRow[] = filtered.map(s => {
    const subs    = byStudent.get(s.uid) ?? []
    const graded  = subs.filter(sub => sub.status === 'graded')
    const waiting = subs.filter(sub => sub.status === 'submitted' || sub.status === 'returned').length
    // Avg score as % across all graded submissions that have points
    const scorable = graded.filter(sub => sub.pointsEarned != null && subPointsPossible(sub) != null)
    const avgScore  = scorable.length
      ? Math.round(scorable.reduce((sum, sub) => sum + (sub.pointsEarned! / subPointsPossible(sub)!) * 100, 0) / scorable.length)
      : null
    // Most recent submission timestamp
    let lastSubmitted: Date | null = null
    for (const sub of subs) {
      if (sub.submittedAt) {
        const d = sub.submittedAt.toDate ? sub.submittedAt.toDate() : new Date(sub.submittedAt as any)
        if (!lastSubmitted || d > lastSubmitted) lastSubmitted = d
      }
    }
    return { uid: s.uid, displayName: s.displayName, periodId: s.periodId, record: s,
             total: subs.length, graded: graded.length, waiting, avgScore, lastSubmitted }
  })

  // Sort
  return rows.sort((a, b) => {
    let cmp = 0
    if (studSortKey.value === 'displayName')   cmp = a.displayName.localeCompare(b.displayName)
    else if (studSortKey.value === 'lastSubmitted') cmp = (a.lastSubmitted?.getTime() ?? 0) - (b.lastSubmitted?.getTime() ?? 0)
    else if (studSortKey.value === 'avgScore')  cmp = (a.avgScore ?? -1) - (b.avgScore ?? -1)
    else cmp = (a[studSortKey.value] as number) - (b[studSortKey.value] as number)
    return studSortDir.value === 'asc' ? cmp : -cmp
  })
})

function formatStudDate(d: Date | null): string {
  if (!d) return '—'
  const now  = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function scoreClass(pct: number | null): string {
  if (pct === null) return ''
  if (pct >= 90) return 'score--high'
  if (pct >= 75) return 'score--mid'
  return 'score--low'
}

function periodLabel(periodId: string): string {
  return PERIOD_IDS.find(p => p.id === periodId)?.label ?? periodId
}

const studentGradedCount = computed(() =>
    studentSubmissions.value.filter(s => s.status === 'graded').length
)

const studentSubmittedCount = computed(() =>
    studentSubmissions.value.filter(s => s.status === 'submitted').length
)

// Student submissions sorted: submitted first, then assigned, then returned, then graded;
// within each group, ordered by assignment due date
const sortedStudentSubmissions = computed(() => {
  const statusOrder: Record<string, number> = { submitted: 0, returned: 1, assigned: 2, graded: 3 }
  return [...studentSubmissions.value].sort((a, b) => {
    const so = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    if (so !== 0) return so
    // Within same status, sort by due date (ascending — earliest due first)
    const da = assignmentMap.value.get(a.assignmentId)?.dueDate ?? ''
    const db = assignmentMap.value.get(b.assignmentId)?.dueDate ?? ''
    return da.localeCompare(db)
  })
})

function selectStudent(s: StudentRecord) {
  selectedStudent.value    = s
  selectedStudentUid.value = s.uid
  loadStudentSubmissions()
}

function clearStudentSearch() {
  selectedStudentUid.value = ''
  selectedStudent.value    = null
  studentSubmissions.value = []
}

async function loadStudentSubmissions() {
  if (!selectedStudentUid.value) return
  studentLoading.value = true
  await fetchAllByStudent(selectedStudentUid.value)
  studentSubmissions.value = rawSubmissions.value
  studentLoading.value = false
}

// ── Status label ──────────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  switch (status) {
    case 'graded':    return '✓ Graded'
    case 'submitted': return 'Submitted'
    case 'returned':  return '↩ Returned'
    default:          return 'Not submitted'
  }
}

// ── Pending grades (batch submission) ────────────────────────────────────────
//
// Grades are staged locally first and only written to Firestore when the
// teacher clicks "Submit Grades". This collapses N recalculateShipHealth
// calls (one per grade action) into a single call at the end of the session.

interface PendingGrade {
  points:   number
  feedback: string
  action:   'finalize' | 'return'
  periodId: string
}

const pendingGrades = ref(new Map<string, PendingGrade>())
const isSubmitting  = ref(false)

function pendingForSub(subId: string): PendingGrade | undefined {
  return pendingGrades.value.get(subId)
}

function cancelPending(subId: string) {
  const next = new Map(pendingGrades.value)
  next.delete(subId)
  pendingGrades.value = next
  if (editingGrade.value === subId) cancelGrade()
}

function cancelAllPending() {
  pendingGrades.value = new Map()
  cancelGrade()
}

/** Flush all staged grades to Firestore, then recalculate ship health once. */
async function submitAllGrades() {
  if (pendingGrades.value.size === 0) return
  isSubmitting.value = true
  try {
    const affectedPeriods = new Set<string>()
    for (const [subId, pending] of pendingGrades.value) {
      const ctx: StatsCtx = {
        teacherEmail: effectiveTeacherEmail.value ?? userInfo.value?.email ?? '',
        periodId:     pending.periodId,
        schoolYearId: SCHOOL_YEAR_ID,
      }
      if (pending.action === 'finalize') {
        await gradeSubmission(subId, pending.points, pending.feedback, ctx)
      } else {
        // Look up current status so returnSubmission knows whether to decrement gradedCount
        const currentStatus = submissions.value.find(s => s.id === subId)?.status
        await returnSubmission(subId, pending.points, pending.feedback, currentStatus, ctx)
      }
      affectedPeriods.add(pending.periodId)
    }
    pendingGrades.value = new Map()
    for (const pid of affectedPeriods) {
      recalculateShipHealth(pid).catch(console.error)
    }
    // Refresh the queue so rows reflect their committed Firestore state
    await loadGradeQueue()
  } catch (e) {
    console.error('Failed to submit grades:', e)
  } finally {
    isSubmitting.value = false
  }
}

// ── Grading panel ─────────────────────────────────────────────────────────────

function startGrade(sub: Submission) {
  // Pre-fill from any existing staged values so editing a pending grade works
  const pending            = pendingForSub(sub.id)
  editingGrade.value       = sub.id
  pointsDraft.value        = pending?.points ?? sub.pointsEarned ?? null
  gradeFeedbackDraft.value = pending?.feedback ?? sub.feedbackNote ?? ''
  editingExtend.value      = null  // close any open extend panel
}

function cancelGrade() {
  editingGrade.value       = null
  pointsDraft.value        = null
  gradeFeedbackDraft.value = ''
}

/** Stage a grade locally — does NOT write to Firestore yet. */
function finalizeGrade(sub: Submission) {
  if (pointsDraft.value === null) return
  pendingGrades.value = new Map(pendingGrades.value).set(sub.id, {
    points:   pointsDraft.value,
    feedback: gradeFeedbackDraft.value,
    action:   'finalize',
    periodId: sub.periodId,
  })
  cancelGrade()
}

/** Stage a returned grade locally — does NOT write to Firestore yet. */
function returnGrade(sub: Submission) {
  if (pointsDraft.value === null) return
  pendingGrades.value = new Map(pendingGrades.value).set(sub.id, {
    points:   pointsDraft.value,
    feedback: gradeFeedbackDraft.value,
    action:   'return',
    periodId: sub.periodId,
  })
  cancelGrade()
}

async function markUngraded(sub: Submission) {
  isSaving.value = sub.id
  const ctx: StatsCtx = {
    teacherEmail: effectiveTeacherEmail.value ?? userInfo.value?.email ?? '',
    periodId:     sub.periodId,
    schoolYearId: SCHOOL_YEAR_ID,
  }
  await ungradeSubmission(sub.id, ctx)
  isSaving.value = null
}

// ── Extension (dueDateOverride) ───────────────────────────────────────────────

const editingExtend   = ref<string | null>(null)
const extendDateDraft = ref('')

function startExtend(sub: Submission) {
  editingExtend.value   = sub.id
  extendDateDraft.value = sub.dueDateOverride ?? ''
  cancelGrade()  // close any open grading panel
}

function cancelExtend() {
  editingExtend.value   = null
  extendDateDraft.value = ''
}

async function saveExtend(sub: Submission) {
  if (!extendDateDraft.value) return
  isSaving.value = sub.id
  await setDueDateOverride(sub.id, extendDateDraft.value)
  isSaving.value = null
  cancelExtend()
}

async function clearExtend(sub: Submission) {
  isSaving.value = sub.id
  await setDueDateOverride(sub.id, null)
  isSaving.value = null
  cancelExtend()
}

// ── Export ────────────────────────────────────────────────────────────────────

async function exportToSheets() {
  exportStatus.value = null
  try {
    const rows = sortedSubmissions.value.map(sub => ({
      student:    studentName(sub.studentId),
      assignment: assignmentTitle(sub.assignmentId),
      period:     selectedPeriodId.value,
      submitted:  sub.submittedAt ? formatTimestamp(sub.submittedAt) : '',
      status:     sub.status,
      score:      sub.data?.score ?? '',
      feedback:   sub.feedbackNote ?? '',
    }))
    const resp = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: 'Submissions', rows }),
    })
    exportStatus.value = resp.ok ? 'ok' : 'error'
  } catch {
    exportStatus.value = 'error'
  }
  setTimeout(() => { exportStatus.value = null }, 3000)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTimestamp(ts: any): string {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  // effectiveTeacherEmail handles all scoping:
  //   staff → their own email; admin emulating → emulated teacher; admin/audit → undefined (all)
  const teacherEmail = effectiveTeacherEmail.value
  await Promise.all([
    fetchAssignments(undefined, teacherEmail),
    fetchStudents(teacherEmail),
  ])
  // After assignments load, batch-fetch their referenced missions for title/type lookups
  const missionIds = [...new Set(assignments.value.map(a => a.missionId).filter(Boolean))]
  if (missionIds.length) {
    const missions = await fetchMissionsByIds(missionIds)
    missionMap.value = new Map(missions.map(m => [m.id, m]))
  }
  // Pre-select period if navigated here from the Grading Queue, then load
  const qp = route.query.period
  if (qp && typeof qp === 'string') {
    selectedPeriodId.value = qp
    activeTab.value        = 'assignment'
    loadGradeQueue()
  } else {
    loadOverview()
  }
})

// When period changes, reload the active tab's data and discard any staged grades
watch(selectedPeriodId, () => {
  submissions.value   = []
  pendingGrades.value = new Map()
  cancelGrade()
  clearStudentSearch()
  if (activeTab.value === 'assignment') {
    loadGradeQueue()
  } else if (activeTab.value === 'student') {
    loadStudentTable()
  }
})
</script>

<style scoped>
@import '../assets/styles/classic.css';

.grading-container {
  display: flex; flex-direction: column; gap: 1.25rem;
  padding: 1.5rem 2rem 3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

/* ── Access denied ── */
.denied-container {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 6rem 2rem; gap: 1rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}
.denied-icon  { font-size: 4rem; }
.denied-title { color: #ff6e6e; font-size: 2.5rem; margin: 0; letter-spacing: 0.2em; }
.denied-sub   { color: #99ccff; font-size: 1.1rem; margin: 0; }

/* ── Tabs ── */
.tab-bar {
  display: flex; gap: 0.25rem;
  border-bottom: 0.125rem solid rgba(255,153,0,0.3);
  padding-bottom: 0;
}
.tab-btn {
  background: transparent; border: none;
  border-bottom: 0.2rem solid transparent;
  color: #556; cursor: pointer; font-family: inherit;
  font-size: 0.85rem; font-weight: bold; letter-spacing: 0.1em;
  padding: 0.5rem 1.25rem; transition: all 0.15s;
  margin-bottom: -0.125rem;
}
.tab-btn:hover { color: #99ccff; }
.tab-btn.active { color: #ff9900; border-bottom-color: #ff9900; }

.tab-bar-spacer { flex: 1; }

/* Period quick-select pills */
.period-pill {
  background: transparent;
  border: 0.125rem solid rgba(85,102,85,0.3);
  border-radius: 0.25rem;
  color: #445;
  cursor: default;
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.5rem;
  transition: all 0.15s;
  margin-bottom: -0.125rem;
}
.period-pill--mine {
  color: #69f0ae;
  border-color: rgba(105,240,174,0.4);
  cursor: pointer;
}
.period-pill--mine:hover {
  border-color: #69f0ae;
  background: rgba(105,240,174,0.08);
}
.period-pill--active {
  color: #ff9900 !important;
  border-color: #ff9900 !important;
  background: rgba(255,153,0,0.1) !important;
  cursor: pointer;
}

.tab-panel { display: flex; flex-direction: column; gap: 1rem; }

/* ── Filters ── */
.filter-row {
  display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;
}
.field { display: flex; flex-direction: column; gap: 0.3rem; flex: 1 1 180px; }
.field--wide { flex: 2 1 280px; }
.field-label { color: #99ccff; font-size: 0.78rem; letter-spacing: 0.1em; }

.lcars-input {
  background: rgba(0,0,0,0.35); border: 0.125rem solid #99ccff;
  border-radius: 0.4rem; color: #e6f0ff; font-family: inherit;
  font-size: 1rem; padding: 0.5rem 0.75rem; transition: border-color 0.2s;
}
.lcars-input:focus   { outline: none; border-color: #ff9900; }
.lcars-input:disabled { opacity: 0.5; cursor: not-allowed; }
.lcars-select option { background: #16213e; }

/* ── Search ── */
.search-wrap { position: relative; }
.search-input { width: 100%; box-sizing: border-box; padding-right: 2rem; }
.clear-search {
  position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
  background: none; border: none; color: #99ccff; cursor: pointer; font-size: 0.85rem;
}
.clear-search:hover { color: #ff9900; }

/* Student dropdown */
.student-dropdown {
  position: absolute; z-index: 50; width: 100%;
  background: #16213e; border: 0.125rem solid #99ccff;
  border-top: none; border-radius: 0 0 0.4rem 0.4rem;
  max-height: 14rem; overflow-y: auto;
}
.student-option {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 0.75rem; cursor: pointer; transition: background 0.1s;
}
.student-option:hover, .student-option.selected { background: rgba(153,204,255,0.1); }
.student-option-name   { color: #e6f0ff; font-size: 0.95rem; }
.student-option-period { color: #556; font-size: 0.8rem; letter-spacing: 0.05em; }

/* ── Summary strips ── */
.assignment-summary, .student-summary {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  background: rgba(0,30,60,0.4); border: 0.0625rem solid rgba(153,204,255,0.15);
  border-radius: 0.4rem; padding: 0.6rem 1rem; font-size: 0.85rem;
}
.summary-type   { color: #e6f0ff; font-weight: bold; }
.summary-due    { color: #99ccff; }
.summary-quarter { color: #556; }
.summary-count  { color: #ff9900; font-weight: bold; margin-left: auto; }

.student-summary-name   { color: #ff9900; font-size: 1.1rem; font-weight: bold; }
.student-summary-period { color: #99ccff; }
.student-summary-id     { color: #556; font-size: 0.8rem; }
.student-summary-count  { color: #69f0ae; font-weight: bold; margin-left: auto; }

/* ── Status messages ── */
.status-msg   { color: #99ccff; font-size: 1rem; text-align: center; padding: 3rem 0; opacity: 0.7; }
.status-error { color: #ff6e6e; font-size: 1rem; text-align: center; padding: 2rem 0; }

/* ── Submissions table ── */
.submissions-table { display: flex; flex-direction: column; gap: 0.2rem; }

.table-row-wrap { display: flex; flex-direction: column; gap: 0; }

.table-header {
  display: grid;
  grid-template-columns: 1.5fr 1fr 0.75fr 0.75fr 1.5fr 0.9fr;
  align-items: center;
  padding: 0.4rem 0.75rem;
  color: #556; font-size: 0.75rem; letter-spacing: 0.1em;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.15);
}
.student-table-header {
  grid-template-columns: 1.5fr 0.75fr 1fr 0.75fr 0.75fr 1.5fr;
}

.table-row {
  display: grid;
  grid-template-columns: 1.5fr 1fr 0.75fr 0.75fr 1.5fr 0.9fr;
  align-items: center; gap: 0.25rem;
  padding: 0.6rem 0.75rem;
  background: rgba(0,30,60,0.35);
  border: 0.0625rem solid rgba(153,204,255,0.08);
  border-radius: 0.375rem;
  transition: background 0.15s;
}
.table-row:hover { background: rgba(0,40,80,0.5); }
.table-row.status--graded { border-color: rgba(105,240,174,0.15); }

.sortable { cursor: pointer; user-select: none; }
.sortable:hover { color: #ff9900; }

.col-name   { color: #e6f0ff; font-size: 0.95rem; }
.col-date   { color: #99ccff; font-size: 0.85rem; }
.col-status { }
.col-work   { }
.col-feedback { overflow: hidden; }
.col-actions { display: flex; gap: 0.3rem; justify-content: flex-end; }

.dim { color: #445; }

/* Status badge */
.status-badge {
  display: inline-block; font-size: 0.7rem; font-weight: bold;
  letter-spacing: 0.06em; padding: 0.15rem 0.5rem;
  border-radius: 0.25rem; text-transform: uppercase;
}
.status-badge.assigned {
  background: rgba(80,80,80,0.1); border: 0.0625rem solid rgba(100,100,100,0.3);
  color: #556;
}
.status-badge.submitted {
  background: rgba(153,204,255,0.1); border: 0.0625rem solid rgba(153,204,255,0.3);
  color: #99ccff;
}
.status-badge.graded {
  background: rgba(105,240,174,0.1); border: 0.0625rem solid rgba(105,240,174,0.3);
  color: #69f0ae;
}
.status-badge.returned {
  background: rgba(255,180,0,0.1); border: 0.0625rem solid rgba(255,180,0,0.4);
  color: #ffb300;
}
.status-badge.staged {
  background: rgba(255,213,79,0.1); border: 0.0625rem solid rgba(255,213,79,0.4);
  color: #ffd54f;
}

.points-display {
  display: block; font-size: 0.72rem; color: #ffd740;
  margin-top: 0.15rem; letter-spacing: 0.03em;
}

.table-row.status--returned { border-color: rgba(255,180,0,0.2); }

.view-link {
  color: #99ccff; font-size: 0.85rem; text-decoration: none;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.3); transition: color 0.15s;
}
.view-link:hover { color: #ff9900; border-bottom-color: rgba(255,153,0,0.5); }

.score-val { color: #ffd740; font-size: 0.9rem; font-weight: bold; }

/* Feedback */
.feedback-text {
  font-size: 0.82rem; color: #99ccff; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: block; transition: color 0.1s;
}
.feedback-text:hover { color: #ff9900; }
.feedback-text.dim   { color: #334; font-style: italic; }

.feedback-input {
  width: 100%; box-sizing: border-box;
  background: rgba(0,0,0,0.4); border: 0.0625rem solid #ff9900;
  border-radius: 0.25rem; color: #e6f0ff; font-family: inherit;
  font-size: 0.85rem; padding: 0.3rem 0.5rem;
}
.feedback-input:focus { outline: none; }

/* Action buttons */
.action-btn {
  background: transparent; border-radius: 0.3rem;
  cursor: pointer; font-family: inherit; font-size: 0.75rem;
  font-weight: bold; letter-spacing: 0.04em;
  padding: 0.25rem 0.6rem; transition: all 0.15s; white-space: nowrap;
}
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.grade-btn {
  border: 0.0625rem solid rgba(105,240,174,0.4); color: #69f0ae;
}
.grade-btn:hover:not(:disabled), .grade-btn.active { background: rgba(105,240,174,0.12); }

.finalize-btn {
  border: 0.0625rem solid rgba(105,240,174,0.5); color: #69f0ae; font-weight: bold;
}
.finalize-btn:hover:not(:disabled) { background: rgba(105,240,174,0.15); }

.return-btn {
  border: 0.0625rem solid rgba(255,180,0,0.5); color: #ffb300;
}
.return-btn:hover:not(:disabled) { background: rgba(255,180,0,0.12); }

.ungrade-btn {
  border: 0.0625rem solid rgba(153,204,255,0.2); color: #445;
}
.ungrade-btn:hover:not(:disabled) { background: rgba(255,255,255,0.04); color: #99ccff; }

.save-btn {
  border: 0.0625rem solid rgba(255,153,0,0.5); color: #ff9900;
}
.save-btn:hover { background: rgba(255,153,0,0.1); }

.extend-btn {
  border: 0.0625rem solid rgba(153,204,255,0.25); color: #556;
}
.extend-btn:hover { border-color: rgba(255,215,64,0.5); color: #ffd740; }

/* Grading panel (expand-below) */
.grade-row {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  padding: 0.6rem 0.75rem 0.6rem 1.5rem;
  background: rgba(0,20,10,0.5);
  border: 0.0625rem solid rgba(105,240,174,0.2);
  border-top: none;
  border-radius: 0 0 0.375rem 0.375rem;
  margin-bottom: 0.2rem;
}
.grade-label { color: #69f0ae; font-size: 0.8rem; flex-shrink: 0; flex-basis: 100%; margin-bottom: 0.1rem; }
.grade-points-wrap { display: flex; align-items: center; gap: 0.3rem; }
.grade-points-input { font-size: 0.82rem; padding: 0.25rem 0.5rem; width: 70px; }
.grade-points-max { color: #556; font-size: 0.82rem; }
.grade-feedback-input { font-size: 0.82rem; padding: 0.25rem 0.5rem; flex: 1 1 200px; }

/* Extend row (inline below the submission row) */
.extend-row {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  padding: 0.5rem 0.75rem 0.5rem 1.5rem;
  background: rgba(20,15,0,0.4);
  border: 0.0625rem solid rgba(255,215,64,0.2);
  border-top: none;
  border-radius: 0 0 0.375rem 0.375rem;
  margin-bottom: 0.2rem;
}
.extend-label   { color: #99ccff; font-size: 0.8rem; flex-shrink: 0; }
.extend-current { color: #ffd740; font-size: 0.78rem; margin-left: 0.3rem; }
.extend-date-input {
  font-size: 0.82rem; padding: 0.25rem 0.5rem; max-width: 140px;
}

/* ── Submit staged grades bar ── */
.submit-bar {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: rgba(255,153,0,0.07);
  border: 0.0625rem solid rgba(255,153,0,0.35);
  border-radius: 0.4rem;
}
.submit-bar-msg {
  flex: 1; color: #ffb300; font-size: 0.83rem;
  font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase;
}
.submit-all-btn { font-size: 0.85rem; padding: 0.4rem 1rem; }

/* ── Export row ── */
.export-row {
  display: flex; align-items: center; gap: 1rem;
  padding-top: 0.5rem;
}
.lcars-btn {
  background: linear-gradient(90deg, #cc6600, #ff9900);
  border: none; border-radius: 0.4rem; color: black;
  cursor: pointer; font-family: inherit; font-size: 0.9rem;
  font-weight: bold; letter-spacing: 0.08em; padding: 0.5rem 1.2rem;
  transition: opacity 0.2s;
}
.lcars-btn:hover { opacity: 0.85; }
.lcars-btn--ghost {
  background: transparent; border: 0.125rem solid #99ccff; color: #99ccff;
}
.export-status       { font-size: 0.85rem; font-weight: bold; }
.export-status.ok    { color: #69f0ae; }
.export-status.error { color: #ff6e6e; }

/* ── Grade queue (BY ASSIGNMENT) — extra assignment column ── */
.grade-queue-header,
.grade-queue-row {
  grid-template-columns: 1.2fr 1.4fr 1fr 0.75fr 0.6fr 1.2fr 0.9fr;
}

.col-assignment {
  color: #ccddff;
  font-size: 0.88rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ── By Student — class-wide table ── */
.stud-search-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.stud-search-wrap { flex: 1 1 280px; max-width: 360px; }
.stud-count-label {
  color: #445;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stud-class-header,
.stud-class-row {
  grid-template-columns: 1.6fr 0.5fr 0.55fr 0.55fr 0.65fr 0.9fr;
}

.stud-class-row { cursor: pointer; }
.stud-class-row:hover {
  background: rgba(0, 50, 100, 0.55);
  border-color: rgba(153, 204, 255, 0.25);
}

.col-num {
  font-size: 0.9rem;
  text-align: center;
  color: #99ccff;
}
.col-waiting { color: #ff9900 !important; font-weight: bold; }

.col-score { font-size: 0.9rem; font-weight: bold; }
.score--high { color: #69f0ae; }
.score--mid  { color: #ffd740; }
.score--low  { color: rgba(255, 110, 110, 0.9); }

/* ── Student drill-down back row ── */
.stud-back-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.back-btn {
  border: 0.0625rem solid rgba(153, 204, 255, 0.25);
  color: #99ccff;
}
.back-btn:hover { background: rgba(153, 204, 255, 0.08); border-color: rgba(153, 204, 255, 0.5); }
.stud-back-name   { font-size: 1rem; color: #ff9900; font-weight: bold; letter-spacing: 0.04em; }
.stud-back-period { color: #6688aa; font-size: 0.85rem; }

/* ── Overview tab ── */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  padding-top: 0.25rem;
}

.ov-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.25rem 1rem 1rem;
  border-radius: 0.5rem;
  border: 0.125rem solid rgba(153,204,255,0.1);
  background: rgba(0,25,50,0.4);
  transition: border-color 0.2s, background 0.2s;
}
.ov-card--has-work {
  border-color: rgba(255,153,0,0.3);
  background: rgba(40,20,0,0.4);
}
.ov-card--urgent {
  border-color: rgba(255,80,60,0.4);
  background: rgba(50,10,5,0.45);
}
.ov-card--clear {
  opacity: 0.55;
}

.ov-period-label {
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  color: #6688aa;
  font-weight: bold;
  text-transform: uppercase;
}

.ov-count {
  font-size: 3.5rem;
  font-weight: bold;
  line-height: 1;
  letter-spacing: -0.02em;
}
.ov-count--clear    { color: #445; }
.ov-count--has-work { color: #ff9900; }
.ov-count--urgent   { color: #ff5c3a; }

.ov-count-label {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: #445;
  text-transform: uppercase;
  margin-top: -0.2rem;
}

.ov-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  justify-content: center;
  margin-top: 0.3rem;
  min-height: 1.5rem;
}
.ov-chip {
  font-size: 0.68rem;
  font-weight: bold;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.45rem;
  border-radius: 0.25rem;
}
.ov-chip--submitted {
  background: rgba(153,204,255,0.1);
  border: 0.0625rem solid rgba(153,204,255,0.3);
  color: #99ccff;
}
.ov-chip--returned {
  background: rgba(255,180,0,0.1);
  border: 0.0625rem solid rgba(255,180,0,0.35);
  color: #ffb300;
}
.ov-chip--clear {
  background: rgba(105,240,174,0.07);
  border: 0.0625rem solid rgba(105,240,174,0.2);
  color: #69f0ae;
}

.ov-grade-btn {
  margin-top: 0.5rem;
  background: transparent;
  border: 0.0625rem solid rgba(255,153,0,0.4);
  border-radius: 0.3rem;
  color: #ff9900;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.08em;
  padding: 0.3rem 0.9rem;
  transition: all 0.15s;
  width: 100%;
}
.ov-grade-btn:hover {
  background: rgba(255,153,0,0.12);
  border-color: #ff9900;
}
</style>