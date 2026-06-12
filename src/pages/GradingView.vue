<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>Mission Report Submissions</span></div>

    <!-- Access denied -->
    <div v-if="!isStaff && !isAdmin && !isAudit" class="denied-container">
      <div class="denied-icon">⛔</div>
      <h2 class="denied-title">ACCESS DENIED</h2>
      <p class="denied-sub">This section is restricted to staff.</p>
    </div>

    <div v-else class="grading-container">

      <!-- ── Tab switcher + period pills ──────────────────────────────────── -->
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
            @click="activeTab = 'student'"
        >BY STUDENT</button>
        <button
            class="tab-btn"
            :class="{ active: activeTab === 'gradebook' }"
            @click="activeTab = 'gradebook'"
        >GRADEBOOK</button>

        <div class="tab-bar-spacer"></div>

        <template v-if="activeTab !== 'gradebook'">
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
        </template>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- TAB: Overview                                                         -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
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

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- TAB: By Assignment — accordion                                        -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'assignment'" class="tab-panel">

        <!-- Staged grades bar -->
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

        <div v-if="!selectedPeriodId" class="status-msg">
          Select a period using the pills above to see submissions needing grading.
        </div>

        <template v-if="selectedPeriodId">
          <div v-if="isLoading" class="status-msg">LOADING REPORTS...</div>
          <div v-else-if="error" class="status-error">{{ error }}</div>
          <template v-else>

            <!-- Confirmation queue: manual items awaiting teacher sign-off -->
            <template v-if="confirmationQueue.length > 0">
              <div class="confirm-section-heading">AWAITING CONFIRMATION</div>
              <div class="submissions-table confirm-table">
                <div class="table-header confirm-header">
                  <span>CADET</span>
                  <span>ASSIGNMENT</span>
                  <span>ITEMS TO CONFIRM</span>
                </div>
                <div
                    v-for="sub in confirmationQueue"
                    :key="sub.id"
                    class="table-row confirm-row"
                >
                  <span class="col-name">{{ studentName(sub.studentId) }}</span>
                  <span class="col-assignment">{{ assignmentTitle(sub.assignmentId) }}</span>
                  <span class="col-checks">
                    <div
                        v-for="item in manualItemsForSub(sub)"
                        :key="item.index"
                        class="check-item"
                    >
                      <button
                          class="check-btn"
                          :class="{ 'check-btn--done': sub.componentChecks?.[String(item.index)]?.done }"
                          :disabled="markingComponent === sub.id + '_' + item.index"
                          @click="toggleComponent(sub, item.index)"
                      >
                        <span class="check-icon">
                          {{ sub.componentChecks?.[String(item.index)]?.done ? '✓' : '○' }}
                        </span>
                        <span class="check-label">{{ itemCheckLabel(item) }}</span>
                      </button>
                    </div>
                    <span v-if="allManualDone(sub)" class="all-done-tag">✓ All confirmed</span>
                  </span>
                </div>
              </div>
            </template>

            <!-- Empty state -->
            <div v-if="submissions.length === 0 && confirmationQueue.length === 0" class="status-msg">
              No submissions waiting to be graded for this period.
            </div>

            <!-- Bulk actions toolbar -->
            <div v-if="submissions.length > 0 && !isAudit" class="bulk-bar">
              <label class="bulk-select-all-label" @click.stop>
                <input
                    type="checkbox"
                    class="bulk-checkbox"
                    :checked="allVisibleSelected"
                    :indeterminate.prop="indeterminateSelection"
                    @change="toggleSelectAll"
                />
                <span class="bulk-select-text">
                  {{ allVisibleSelected ? 'Deselect All' : 'Select All' }}
                </span>
              </label>
              <span v-if="someSelected" class="bulk-selected-badge">
                {{ selectedSubIds.size }} selected
              </span>
              <button
                  v-if="someSelected"
                  class="action-btn finalize-btn bulk-approve-btn"
                  @click="approveSelected"
              >✓ Grant Full Marks to {{ selectedSubIds.size }}</button>

              <div class="bulk-bar-spacer"></div>

              <!-- Approve All with inline confirm -->
              <template v-if="!showApproveAllConfirm">
                <button
                    class="action-btn approve-all-btn"
                    @click="showApproveAllConfirm = true"
                >APPROVE ALL ({{ submissions.length }})</button>
              </template>
              <template v-else>
                <span class="approve-all-confirm-msg">
                  Grant full marks to all {{ submissions.length }} submissions?
                </span>
                <button class="action-btn finalize-btn" @click="executeApproveAll">✓ Yes, Approve All</button>
                <button class="action-btn cancel-btn" @click="showApproveAllConfirm = false">Cancel</button>
              </template>
            </div>

            <!-- Accordion by assignment -->
            <div v-if="assignmentGroups.length > 0" class="accordion">
              <div
                  v-for="group in assignmentGroups"
                  :key="group.assignmentId"
                  class="accordion-group"
              >
                <div
                    class="accordion-header"
                    @click="toggleAssignment(group.assignmentId)"
                >
                  <span class="accordion-chevron">
                    {{ expandedAssignments.has(group.assignmentId) ? '▾' : '▸' }}
                  </span>
                  <span class="accordion-title">{{ group.title }}</span>
                  <span class="accordion-badge">{{ group.subs.length }}</span>
                </div>
                <div v-if="expandedAssignments.has(group.assignmentId)" class="accordion-body">
                  <div
                      v-for="sub in group.subs"
                      :key="sub.id"
                      class="accordion-row accordion-row--with-check"
                      :class="{ 'accordion-row--staged': !!pendingForSub(sub.id), 'accordion-row--selected': selectedSubIds.has(sub.id) }"
                      @click="openGradingPanel(sub)"
                  >
                    <label class="row-check-label" @click.stop>
                      <input
                          type="checkbox"
                          class="row-checkbox"
                          :checked="selectedSubIds.has(sub.id)"
                          @change="toggleSubSelection(sub.id, $event)"
                      />
                    </label>
                    <span class="accordion-row-name">{{ studentName(sub.studentId) }}</span>
                    <span class="accordion-row-date dim">{{ formatTimestamp(sub.submittedAt) }}</span>
                    <span class="accordion-row-status">
                      <span class="status-badge" :class="pendingForSub(sub.id) ? 'staged' : sub.status">
                        {{ pendingForSub(sub.id) ? '⏳ Staged' : statusLabel(sub.status) }}
                      </span>
                      <span
                          v-if="pendingForSub(sub.id) != null || sub.pointsEarned != null"
                          class="points-display"
                      >
                        {{ pendingForSub(sub.id)?.points ?? sub.pointsEarned }}/{{ subPointsPossible(sub) ?? '?' }} pts
                      </span>
                    </span>
                    <span v-if="sub.dueDateOverride" class="extend-indicator">
                      📅 {{ formatDate(sub.dueDateOverride) }}
                    </span>
                    <span class="accordion-row-arrow">→</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Export -->
            <div v-if="submissions.length > 0" class="export-row">
              <button class="lcars-btn lcars-btn--ghost" @click="exportToSheets">
                EXPORT TO SHEETS
              </button>
              <span v-if="exportStatus" class="export-status" :class="exportStatus">
                {{ exportStatus === 'ok' ? '✓ Exported' : '✗ Export failed' }}
              </span>
            </div>

          </template>
        </template>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- TAB: By Student — accordion                                           -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'student'" class="tab-panel">

        <!-- Search + count -->
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
          <span v-if="selectedPeriodId && studentGroups.length > 0" class="stud-count-label">
            {{ studentGroups.length }} cadet{{ studentGroups.length !== 1 ? 's' : '' }} with pending work
          </span>
        </div>

        <div v-if="!selectedPeriodId" class="status-msg">
          Select a period using the pills above to view your class.
        </div>
        <div v-else-if="isLoading" class="status-msg">LOADING...</div>
        <div v-else-if="studentGroups.length === 0" class="status-msg">
          No submissions waiting to be graded{{ studentSearch ? ' matching your search' : ' for this period' }}.
        </div>

        <div v-else class="accordion">
          <div
              v-for="group in studentGroups"
              :key="group.uid"
              class="accordion-group"
          >
            <div
                class="accordion-header"
                @click="toggleStudent(group.uid)"
            >
              <span class="accordion-chevron">
                {{ expandedStudents.has(group.uid) ? '▾' : '▸' }}
              </span>
              <span class="accordion-title">{{ group.displayName }}</span>
              <span class="accordion-badge">{{ group.subs.length }}</span>
            </div>
            <div v-if="expandedStudents.has(group.uid)" class="accordion-body">
              <div
                  v-for="sub in group.subs"
                  :key="sub.id"
                  class="accordion-row accordion-row--with-check"
                  :class="{ 'accordion-row--staged': !!pendingForSub(sub.id), 'accordion-row--selected': selectedSubIds.has(sub.id) }"
                  @click="openGradingPanel(sub)"
              >
                <label class="row-check-label" @click.stop>
                  <input
                      type="checkbox"
                      class="row-checkbox"
                      :checked="selectedSubIds.has(sub.id)"
                      @change="toggleSubSelection(sub.id, $event)"
                  />
                </label>
                <span class="accordion-row-name">{{ assignmentTitle(sub.assignmentId) }}</span>
                <span class="accordion-row-date dim">{{ formatTimestamp(sub.submittedAt) }}</span>
                <span class="accordion-row-status">
                  <span class="status-badge" :class="pendingForSub(sub.id) ? 'staged' : sub.status">
                    {{ pendingForSub(sub.id) ? '⏳ Staged' : statusLabel(sub.status) }}
                  </span>
                  <span
                      v-if="pendingForSub(sub.id) != null || sub.pointsEarned != null"
                      class="points-display"
                  >
                    {{ pendingForSub(sub.id)?.points ?? sub.pointsEarned }}/{{ subPointsPossible(sub) ?? '?' }} pts
                  </span>
                </span>
                <span class="accordion-row-arrow">→</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ════════════════════════════════════════════════════════════════════ -->
      <!-- TAB: Gradebook                                                        -->
      <!-- ════════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'gradebook'" class="tab-panel">
        <GradebookTab
            :assignments="assignments"
            :students="students"
            :mission-map="missionMap"
        />
      </div>

    </div>
  </section>

  <!-- ── Grading slide-out panel ──────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="panel-slide">
      <div
          v-if="gradingPanelSub"
          class="gp-backdrop"
          @click.self="closeGradingPanel"
      >
        <div class="gp-panel">

          <!-- Header -->
          <div class="gp-header">
            <div class="gp-header-info">
              <div class="gp-student">{{ studentName(gradingPanelSub.studentId) }}</div>
              <div class="gp-assignment">{{ assignmentTitle(gradingPanelSub.assignmentId) }}</div>
            </div>
            <button class="gp-close" @click="closeGradingPanel">✕</button>
          </div>

          <!-- Body -->
          <div class="gp-body">

            <!-- Meta -->
            <div class="gp-meta">
              <span
                  class="status-badge"
                  :class="pendingForSub(gradingPanelSub.id) ? 'staged' : gradingPanelSub.status"
              >
                {{ pendingForSub(gradingPanelSub.id) ? '⏳ Grade Staged' : statusLabel(gradingPanelSub.status) }}
              </span>
              <span class="gp-date dim">
                Submitted {{ formatTimestamp(gradingPanelSub.submittedAt) }}
              </span>
            </div>

            <!-- Staged grade notice + unstage -->
            <div v-if="pendingForSub(gradingPanelSub.id)" class="gp-staged-notice">
              <span>
                ⏳ Grade staged:
                {{ pendingForSub(gradingPanelSub.id)?.points }}/{{ subPointsPossible(gradingPanelSub) ?? '?' }} pts
                — not yet saved
              </span>
              <button
                  v-if="!isAudit"
                  class="action-btn ungrade-btn gp-unstage-btn"
                  @click="cancelPending(gradingPanelSub.id)"
              >✕ Unstage</button>
            </div>

            <!-- File link -->
            <a
                v-if="gradingPanelSub.type === 'file' && gradingPanelSub.data?.url"
                :href="gradingPanelSub.data.url"
                target="_blank"
                class="view-link gp-file-link"
            >View submitted file ↗</a>

            <!-- Existing feedback (read-only) -->
            <template v-if="gradingPanelSub.feedbackNote">
              <div class="gp-section-label">Previous Feedback</div>
              <div class="gp-feedback-read">{{ gradingPanelSub.feedbackNote }}</div>
            </template>

            <template v-if="!isAudit">

              <!-- Late penalty notice -->
              <div
                v-if="panelPenalty && panelPenalty.daysLate > 0"
                class="gp-late-notice"
              >
                Submitted {{ panelPenalty.daysLate }} day{{ panelPenalty.daysLate !== 1 ? 's' : '' }} late
                — suggested score:
                <strong>{{ panelPenalty.adjustedPoints ?? '?' }} / {{ subPointsPossible(gradingPanelSub!) ?? '?' }}</strong>
                <span class="gp-late-deduction">(−{{ panelPenalty.penaltyPct }}%)</span>
              </div>

              <!-- Points -->
              <div class="gp-section-label">Points</div>
              <div class="gp-points-row">
                <input
                    v-model.number="pointsDraft"
                    type="number"
                    min="0"
                    :max="subPointsPossible(gradingPanelSub) ?? 9999"
                    class="lcars-input gp-points-input"
                    placeholder="Pts"
                />
                <span class="grade-points-max">/ {{ subPointsPossible(gradingPanelSub) ?? '?' }}</span>
              </div>

              <!-- Feedback -->
              <div class="gp-section-label">Feedback for Student</div>
              <input
                  v-model="gradeFeedbackDraft"
                  class="lcars-input gp-feedback-input"
                  placeholder="(optional)"
              />

              <!-- Grade actions -->
              <div class="gp-actions">
                <button
                    class="action-btn finalize-btn"
                    :disabled="pointsDraft === null"
                    @click="finalizeGrade(gradingPanelSub)"
                    title="Save grade — student will see it as finalized"
                >Finalize Grade</button>
                <button
                    class="action-btn return-btn"
                    :disabled="pointsDraft === null"
                    @click="returnGrade(gradingPanelSub)"
                    title="Send back to student with feedback — they can revise and resubmit"
                >↩ Return for Revision</button>
              </div>

              <!-- Extend due date -->
              <div class="gp-extend-section">
                <button
                    v-if="!panelShowExtend"
                    class="action-btn extend-btn"
                    @click="panelShowExtend = true; extendDateDraft = gradingPanelSub.dueDateOverride ?? ''"
                >
                  {{
                    gradingPanelSub.dueDateOverride
                      ? `📅 Extension: ${formatDate(gradingPanelSub.dueDateOverride)}`
                      : 'Extend Due Date'
                  }}
                </button>
                <div v-if="panelShowExtend" class="gp-extend-row">
                  <input
                      v-model="extendDateDraft"
                      class="lcars-input extend-date-input"
                      type="date"
                  />
                  <button
                      class="action-btn save-btn"
                      :disabled="isSaving === gradingPanelSub.id || !extendDateDraft"
                      @click="saveExtend(gradingPanelSub)"
                  >{{ isSaving === gradingPanelSub.id ? '...' : 'Set' }}</button>
                  <button
                      v-if="gradingPanelSub.dueDateOverride"
                      class="action-btn ungrade-btn"
                      :disabled="isSaving === gradingPanelSub.id"
                      @click="clearExtend(gradingPanelSub)"
                  >Clear</button>
                  <button class="action-btn cancel-btn" @click="panelShowExtend = false">Cancel</button>
                </div>
              </div>

            </template>
          </div><!-- /gp-body -->
        </div><!-- /gp-panel -->
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import GradebookTab from '@/components/grading/GradebookTab.vue'
import { collection, query, where, getDocs } from '@/data/db'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useAssignments, type Assignment } from '@/composables/useAssignments'
import { useSubmissions, type Submission, type StatsCtx } from '@/composables/useSubmissions'
import { useMissions, type Mission, type DeliveryItem } from '@/composables/useMissions'
import { computeLatePenalty } from '@/composables/useLatePenalty'
import { PERIOD_IDS, SCHOOL_YEAR_ID } from '@/config/schoolYear'
import { recalculateShipHealth } from '@/composables/useShipStatus'

const { isStaff, isAdmin, isAudit, userInfo, effectiveTeacherEmail } = useAuth()

// ── Shared data ───────────────────────────────────────────────────────────────

const { assignments, fetchAssignments } = useAssignments()
const { fetchMissionsByIds } = useMissions()

const {
  submissions: rawSubmissions, students,
  isLoading, error,
  fetchAllByPeriod, fetchStudents,
  gradeSubmission, returnSubmission, ungradeSubmission, setDueDateOverride,
  markComponentDone,
} = useSubmissions()

// Mission lookup map — populated after assignments load
const missionMap = ref(new Map<string, Mission>())

const submissions       = ref<Submission[]>([])
const confirmationQueue = ref<Submission[]>([])

// ── Tabs ──────────────────────────────────────────────────────────────────────

const activeTab = ref<'overview' | 'assignment' | 'student' | 'gradebook'>('overview')

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
  const periodIds = (isAdmin.value || isAudit.value)
    ? PERIOD_IDS.map(p => p.id)
    : myPeriodIds.value

  if (periodIds.length === 0) {
    overviewPeriods.value = []
    overviewLoading.value = false
    return
  }

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

  overviewPeriods.value = results.sort((a, b) =>
    b.totalNeedingGrade - a.totalNeedingGrade || a.periodId.localeCompare(b.periodId)
  )
  overviewLoading.value = false
}

function goToGradeQueue(periodId: string) {
  selectedPeriodId.value = periodId
  activeTab.value        = 'assignment'
}

// ── Grade queue state ─────────────────────────────────────────────────────────

const route            = useRoute()
const selectedPeriodId = ref('')
const isSaving         = ref<string | null>(null)
const exportStatus     = ref<'ok' | 'error' | null>(null)

// Lookup maps
const studentMap = computed(() => {
  const m = new Map<string, string>()
  students.value.forEach(s => m.set(s.uid, s.displayName))
  return m
})

const assignmentMap = computed(() => {
  const m = new Map<string, Assignment>()
  assignments.value.forEach(a => m.set(a.id, a))
  return m
})

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

// sortedSubmissions — used for export
const sortedSubmissions = computed(() =>
  [...submissions.value].sort((a, b) =>
    studentName(a.studentId).toLowerCase().localeCompare(studentName(b.studentId).toLowerCase())
  )
)

async function loadGradeQueue() {
  if (!selectedPeriodId.value) return
  pendingGrades.value = new Map()
  cancelGrade()
  closeGradingPanel()

  await fetchAllByPeriod(selectedPeriodId.value)
  const all = rawSubmissions.value

  submissions.value = all.filter(s => s.status === 'submitted' || s.status === 'returned')

  confirmationQueue.value = all.filter(s =>
    s.status === 'assigned' &&
    (missionMap.value.get(s.missionId)?.deliveryItems ?? []).some(i => i.submissionMethod === 'manual')
  )
}

// ── Accordion state ───────────────────────────────────────────────────────────

const expandedAssignments = ref(new Set<string>())
const expandedStudents    = ref(new Set<string>())

function toggleAssignment(id: string) {
  const next = new Set(expandedAssignments.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedAssignments.value = next
}

function toggleStudent(uid: string) {
  const next = new Set(expandedStudents.value)
  next.has(uid) ? next.delete(uid) : next.add(uid)
  expandedStudents.value = next
}

// ── Accordion computed groups ─────────────────────────────────────────────────

interface AssignmentGroup {
  assignmentId: string
  title:        string
  subs:         Submission[]
}

const assignmentGroups = computed((): AssignmentGroup[] => {
  const map = new Map<string, Submission[]>()
  for (const sub of submissions.value) {
    if (!map.has(sub.assignmentId)) map.set(sub.assignmentId, [])
    map.get(sub.assignmentId)!.push(sub)
  }
  return [...map.entries()]
    .map(([assignmentId, subs]) => ({
      assignmentId,
      title: assignmentTitle(assignmentId),
      subs,
    }))
    .sort((a, b) => b.subs.length - a.subs.length || a.title.localeCompare(b.title))
})

interface StudentGroup {
  uid:         string
  displayName: string
  subs:        Submission[]
}

const studentSearch = ref('')

const studentGroups = computed((): StudentGroup[] => {
  const map = new Map<string, Submission[]>()
  for (const sub of submissions.value) {
    if (!map.has(sub.studentId)) map.set(sub.studentId, [])
    map.get(sub.studentId)!.push(sub)
  }
  const q = studentSearch.value.trim().toLowerCase()
  return [...map.entries()]
    .map(([uid, subs]) => ({ uid, displayName: studentName(uid), subs }))
    .filter(g => !q || g.displayName.toLowerCase().includes(q))
    .sort((a, b) => b.subs.length - a.subs.length || a.displayName.localeCompare(b.displayName))
})

// ── Grading slide-out panel ───────────────────────────────────────────────────

const gradingPanelSub    = ref<Submission | null>(null)
const panelShowExtend    = ref(false)
const pointsDraft        = ref<number | null>(null)
const gradeFeedbackDraft = ref('')
const extendDateDraft    = ref('')

// Late-penalty info for the currently open grading panel
const panelPenalty = computed(() => {
  const sub = gradingPanelSub.value
  if (!sub) return null
  const assignment = assignmentMap.value.get(sub.assignmentId)
  if (!assignment?.penaltyPctPerDay) return null
  return computeLatePenalty(
    sub.submittedAt,
    sub.dueDateOverride ?? assignment.dueDate ?? null,
    assignment.penaltyPctPerDay,
    assignment.maxPenaltyPct ?? 0,
    subPointsPossible(sub),
  )
})

function openGradingPanel(sub: Submission) {
  const pending            = pendingForSub(sub.id)
  gradingPanelSub.value    = sub
  gradeFeedbackDraft.value = pending?.feedback ?? sub.feedbackNote ?? ''
  panelShowExtend.value    = false
  extendDateDraft.value    = sub.dueDateOverride ?? ''

  if (pending?.points != null) {
    pointsDraft.value = pending.points
  } else if (sub.pointsEarned != null) {
    pointsDraft.value = sub.pointsEarned
  } else {
    // Pre-fill with late-penalty-adjusted score if penalty is configured
    const assignment = assignmentMap.value.get(sub.assignmentId)
    const penalty = computeLatePenalty(
      sub.submittedAt,
      sub.dueDateOverride ?? assignment?.dueDate ?? null,
      assignment?.penaltyPctPerDay ?? 0,
      assignment?.maxPenaltyPct    ?? 0,
      subPointsPossible(sub),
    )
    pointsDraft.value = penalty.adjustedPoints
  }
}

function closeGradingPanel() {
  gradingPanelSub.value    = null
  pointsDraft.value        = null
  gradeFeedbackDraft.value = ''
  panelShowExtend.value    = false
  extendDateDraft.value    = ''
}

// ── Status ────────────────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  switch (status) {
    case 'graded':    return '✓ Graded'
    case 'submitted': return 'Submitted'
    case 'returned':  return '↩ Returned'
    default:          return 'Not submitted'
  }
}

// ── Pending grades (batch submission) ────────────────────────────────────────

interface PendingGrade {
  points:   number
  feedback: string
  action:   'finalize' | 'return'
  periodId: string
}

const pendingGrades = ref(new Map<string, PendingGrade>())
const isSubmitting  = ref(false)

// ── Bulk selection ────────────────────────────────────────────────────────────

const selectedSubIds        = ref(new Set<string>())
const showApproveAllConfirm = ref(false)

const allVisibleSelected = computed(() =>
  submissions.value.length > 0 &&
  submissions.value.every(s => selectedSubIds.value.has(s.id))
)

const someSelected = computed(() => selectedSubIds.value.size > 0)

const indeterminateSelection = computed(() =>
  someSelected.value && !allVisibleSelected.value
)

function toggleSubSelection(subId: string, e: Event) {
  e.stopPropagation()
  const next = new Set(selectedSubIds.value)
  next.has(subId) ? next.delete(subId) : next.add(subId)
  selectedSubIds.value = next
}

function toggleSelectAll() {
  selectedSubIds.value = allVisibleSelected.value
    ? new Set()
    : new Set(submissions.value.map(s => s.id))
}

/** Stage full marks for a set of submissions into pendingGrades. */
function stageFullMarksForSubs(subs: Submission[]) {
  const next = new Map(pendingGrades.value)
  for (const sub of subs) {
    const pts = subPointsPossible(sub)
    if (pts === null) continue
    next.set(sub.id, { points: pts, feedback: '', action: 'finalize', periodId: sub.periodId })
  }
  pendingGrades.value = next
}

function approveSelected() {
  const subs = submissions.value.filter(s => selectedSubIds.value.has(s.id))
  stageFullMarksForSubs(subs)
  selectedSubIds.value = new Set()
}

function executeApproveAll() {
  stageFullMarksForSubs(submissions.value)
  showApproveAllConfirm.value = false
}

function pendingForSub(subId: string): PendingGrade | undefined {
  return pendingGrades.value.get(subId)
}

function cancelPending(subId: string) {
  const next = new Map(pendingGrades.value)
  next.delete(subId)
  pendingGrades.value = next
  // If the grading panel is open for this sub, refresh the draft state
  if (gradingPanelSub.value?.id === subId) {
    const sub = submissions.value.find(s => s.id === subId)
    if (sub) {
      pointsDraft.value        = sub.pointsEarned ?? null
      gradeFeedbackDraft.value = sub.feedbackNote ?? ''
    }
  }
}

function cancelAllPending() {
  pendingGrades.value = new Map()
  cancelGrade()
}

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
        const currentStatus = submissions.value.find(s => s.id === subId)?.status
        await returnSubmission(subId, pending.points, pending.feedback, currentStatus, ctx)
      }
      affectedPeriods.add(pending.periodId)
    }
    pendingGrades.value = new Map()
    for (const pid of affectedPeriods) {
      recalculateShipHealth(pid).catch(console.error)
    }
    await loadGradeQueue()
  } catch (e) {
    console.error('Failed to submit grades:', e)
  } finally {
    isSubmitting.value = false
  }
}

// ── Grading actions ───────────────────────────────────────────────────────────

function cancelGrade() {
  pointsDraft.value        = null
  gradeFeedbackDraft.value = ''
}

/** Stage a finalize grade and close the panel. */
function finalizeGrade(sub: Submission) {
  if (pointsDraft.value === null) return
  pendingGrades.value = new Map(pendingGrades.value).set(sub.id, {
    points:   pointsDraft.value,
    feedback: gradeFeedbackDraft.value,
    action:   'finalize',
    periodId: sub.periodId,
  })
  closeGradingPanel()
}

/** Stage a return-for-revision grade and close the panel. */
function returnGrade(sub: Submission) {
  if (pointsDraft.value === null) return
  pendingGrades.value = new Map(pendingGrades.value).set(sub.id, {
    points:   pointsDraft.value,
    feedback: gradeFeedbackDraft.value,
    action:   'return',
    periodId: sub.periodId,
  })
  closeGradingPanel()
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
  closeGradingPanel()
  await loadGradeQueue()
}

// ── Confirmation queue (manual delivery items) ────────────────────────────────

const markingComponent = ref<string | null>(null)

function manualItemsForSub(sub: Submission): (DeliveryItem & { index: number })[] {
  const items = missionMap.value.get(sub.missionId)?.deliveryItems ?? []
  return items
    .map((item, index) => ({ ...item, index }))
    .filter(item => item.submissionMethod === 'manual')
}

function allManualDone(sub: Submission): boolean {
  const items = manualItemsForSub(sub)
  return items.length > 0 && items.every(item => sub.componentChecks?.[String(item.index)]?.done)
}

function itemCheckLabel(item: DeliveryItem): string {
  if (item.kind === 'paper') return item.label || 'Paper handout'
  if (item.kind === 'link')  return item.label || 'Web assignment'
  if (item.kind === 'pdf')   return item.name  || 'PDF worksheet'
  return 'Item'
}

async function toggleComponent(sub: Submission, itemIndex: number) {
  const currentlyDone    = sub.componentChecks?.[String(itemIndex)]?.done ?? false
  const newDone          = !currentlyDone
  const key              = `${sub.id}_${itemIndex}`
  markingComponent.value = key

  const deliveryItems = missionMap.value.get(sub.missionId)?.deliveryItems ?? []
  const ok = await markComponentDone(sub.id, itemIndex, newDone, deliveryItems)
  if (ok) {
    const entry = confirmationQueue.value.find(s => s.id === sub.id)
    if (entry) {
      if (!entry.componentChecks) entry.componentChecks = {}
      entry.componentChecks[String(itemIndex)] = { done: newDone, doneAt: null }
      if (allManualDone(entry)) {
        const idx = confirmationQueue.value.indexOf(entry)
        confirmationQueue.value.splice(idx, 1)
        submissions.value.push({ ...entry, status: 'submitted' })
      }
    }
  }
  markingComponent.value = null
}

// ── Extension ─────────────────────────────────────────────────────────────────

async function saveExtend(sub: Submission) {
  if (!extendDateDraft.value) return
  isSaving.value = sub.id
  await setDueDateOverride(sub.id, extendDateDraft.value)
  // Update local submission record
  const local = submissions.value.find(s => s.id === sub.id)
  if (local) local.dueDateOverride = extendDateDraft.value
  // Keep panel in sync
  if (gradingPanelSub.value?.id === sub.id) {
    gradingPanelSub.value = { ...gradingPanelSub.value, dueDateOverride: extendDateDraft.value }
  }
  isSaving.value    = null
  panelShowExtend.value = false
}

async function clearExtend(sub: Submission) {
  isSaving.value = sub.id
  await setDueDateOverride(sub.id, null)
  const local = submissions.value.find(s => s.id === sub.id)
  if (local) delete (local as any).dueDateOverride
  if (gradingPanelSub.value?.id === sub.id) {
    const updated = { ...gradingPanelSub.value }
    delete (updated as any).dueDateOverride
    gradingPanelSub.value = updated
  }
  isSaving.value    = null
  panelShowExtend.value = false
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
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function periodLabel(periodId: string): string {
  return PERIOD_IDS.find(p => p.id === periodId)?.label ?? periodId
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  const teacherEmail = effectiveTeacherEmail.value
  await Promise.all([
    fetchAssignments(undefined, teacherEmail),
    fetchStudents(teacherEmail),
  ])
  const missionIds = [...new Set(assignments.value.map(a => a.missionId).filter(Boolean))]
  if (missionIds.length) {
    const missions = await fetchMissionsByIds(missionIds)
    missionMap.value = new Map(missions.map(m => [m.id, m]))
  }
  const qp = route.query.period
  if (qp && typeof qp === 'string') {
    selectedPeriodId.value = qp
    activeTab.value        = 'assignment'
    loadGradeQueue()
  } else {
    loadOverview()
  }
})

// When period changes, reload grade queue for both assignment and student tabs
watch(selectedPeriodId, () => {
  submissions.value          = []
  confirmationQueue.value    = []
  pendingGrades.value        = new Map()
  selectedSubIds.value       = new Set()
  showApproveAllConfirm.value = false
  cancelGrade()
  closeGradingPanel()
  if (activeTab.value !== 'overview') {
    loadGradeQueue()
  }
})

// When switching to assignment/student tab with period already selected, ensure data loads
watch(activeTab, (newTab) => {
  if (
    (newTab === 'assignment' || newTab === 'student') &&
    selectedPeriodId.value &&
    submissions.value.length === 0 &&
    !isLoading.value
  ) {
    loadGradeQueue()
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

/* ── Status messages ── */
.status-msg   { color: #99ccff; font-size: 1rem; text-align: center; padding: 3rem 0; opacity: 0.7; }
.status-error { color: #ff6e6e; font-size: 1rem; text-align: center; padding: 2rem 0; }

/* ── LCARS input ── */
.lcars-input {
  background: rgba(0,0,0,0.35); border: 0.125rem solid #99ccff;
  border-radius: 0.4rem; color: #e6f0ff; font-family: inherit;
  font-size: 1rem; padding: 0.5rem 0.75rem; transition: border-color 0.2s;
}
.lcars-input:focus   { outline: none; border-color: #ff9900; }
.lcars-input:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Search ── */
.search-wrap { position: relative; }
.search-input { width: 100%; box-sizing: border-box; padding-right: 2rem; }
.clear-search {
  position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
  background: none; border: none; color: #99ccff; cursor: pointer; font-size: 0.85rem;
}
.clear-search:hover { color: #ff9900; }

/* ── Student search row ── */
.stud-search-row {
  display: flex; align-items: center; gap: 1rem;
}
.stud-search-wrap { flex: 1 1 280px; max-width: 360px; }
.stud-count-label {
  color: #445; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase;
}

/* ── Action buttons ── */
.action-btn {
  background: transparent; border-radius: 0.3rem;
  cursor: pointer; font-family: inherit; font-size: 0.75rem;
  font-weight: bold; letter-spacing: 0.04em;
  padding: 0.25rem 0.6rem; transition: all 0.15s; white-space: nowrap;
}
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

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
.save-btn:hover:not(:disabled) { background: rgba(255,153,0,0.1); }

.extend-btn {
  border: 0.0625rem solid rgba(153,204,255,0.25); color: #556;
}
.extend-btn:hover { border-color: rgba(255,215,64,0.5); color: #ffd740; }

.cancel-btn {
  border: 0.0625rem solid rgba(153,204,255,0.3); color: #7799bb;
}
.cancel-btn:hover:not(:disabled) {
  border-color: rgba(153,204,255,0.6); color: #aaccee;
  background: rgba(153,204,255,0.06);
}

/* ── Status badge ── */
.status-badge {
  display: inline-block; font-size: 0.7rem; font-weight: bold;
  letter-spacing: 0.06em; padding: 0.15rem 0.5rem;
  border-radius: 0.25rem; text-transform: uppercase;
}
.status-badge.assigned {
  background: rgba(80,80,80,0.1); border: 0.0625rem solid rgba(100,100,100,0.3); color: #556;
}
.status-badge.submitted {
  background: rgba(153,204,255,0.1); border: 0.0625rem solid rgba(153,204,255,0.3); color: #99ccff;
}
.status-badge.graded {
  background: rgba(105,240,174,0.1); border: 0.0625rem solid rgba(105,240,174,0.3); color: #69f0ae;
}
.status-badge.returned {
  background: rgba(255,180,0,0.1); border: 0.0625rem solid rgba(255,180,0,0.4); color: #ffb300;
}
.status-badge.staged {
  background: rgba(255,213,79,0.1); border: 0.0625rem solid rgba(255,213,79,0.4); color: #ffd54f;
}

.points-display {
  display: block; font-size: 0.72rem; color: #ffd740; margin-top: 0.1rem; letter-spacing: 0.03em;
}

.dim { color: #556; }

.view-link {
  color: #99ccff; font-size: 0.85rem; text-decoration: none;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.3); transition: color 0.15s;
}
.view-link:hover { color: #ff9900; border-bottom-color: rgba(255,153,0,0.5); }

.extend-indicator {
  font-size: 0.72rem; color: #ffd740; letter-spacing: 0.04em;
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

/* ── LCARS btn ── */
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

/* ── Export row ── */
.export-row {
  display: flex; align-items: center; gap: 1rem; padding-top: 0.5rem;
}
.export-status       { font-size: 0.85rem; font-weight: bold; }
.export-status.ok    { color: #69f0ae; }
.export-status.error { color: #ff6e6e; }

/* ── Bulk actions bar ── */
.bulk-bar {
  display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;
  padding: 0.55rem 0.9rem;
  background: rgba(0, 20, 50, 0.45);
  border: 0.0625rem solid rgba(153, 204, 255, 0.12);
  border-radius: 0.4rem;
}

.bulk-select-all-label {
  display: flex; align-items: center; gap: 0.45rem;
  cursor: pointer; user-select: none;
}

.bulk-checkbox,
.row-checkbox {
  accent-color: #ff9900;
  width: 1rem; height: 1rem;
  cursor: pointer; flex-shrink: 0;
}

.bulk-select-text {
  font-size: 0.78rem; font-weight: bold; letter-spacing: 0.06em;
  color: #7799bb; text-transform: uppercase;
}

.bulk-selected-badge {
  background: rgba(255, 153, 0, 0.15);
  border: 0.0625rem solid rgba(255, 153, 0, 0.4);
  border-radius: 1rem; color: #ff9900;
  font-size: 0.7rem; font-weight: bold; letter-spacing: 0.06em;
  padding: 0.1rem 0.55rem;
}

.bulk-approve-btn {
  font-size: 0.78rem; padding: 0.3rem 0.75rem;
}

.bulk-bar-spacer { flex: 1; }

.approve-all-btn {
  border: 0.0625rem solid rgba(105, 240, 174, 0.4);
  color: #69f0ae; font-size: 0.78rem; font-weight: bold;
  letter-spacing: 0.06em; padding: 0.3rem 0.85rem;
}
.approve-all-btn:hover { background: rgba(105, 240, 174, 0.1); border-color: #69f0ae; }

.approve-all-confirm-msg {
  font-size: 0.78rem; color: #ffb300; font-weight: bold; letter-spacing: 0.04em;
}

/* ── Accordion row with checkbox ── */
.accordion-row--with-check {
  grid-template-columns: 1.4rem 1.6fr 1fr 0.9fr auto auto;
}

.row-check-label {
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; padding: 0.15rem;
}

.accordion-row--selected {
  background: rgba(255, 153, 0, 0.06) !important;
  border-left: 0.2rem solid rgba(255, 153, 0, 0.5);
}

/* ── Accordion ── */
.accordion {
  display: flex; flex-direction: column; gap: 0.4rem;
}

.accordion-group {
  border-radius: 0.4rem;
  overflow: hidden;
  border: 0.0625rem solid rgba(153,204,255,0.1);
}

.accordion-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(0,20,50,0.5);
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}
.accordion-header:hover {
  background: rgba(0,35,75,0.65);
}

.accordion-chevron {
  color: #ff9900; font-size: 0.75rem; flex-shrink: 0; width: 0.8rem; text-align: center;
}

.accordion-title {
  flex: 1; color: #e6f0ff; font-size: 1rem; letter-spacing: 0.02em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.accordion-badge {
  flex-shrink: 0;
  background: rgba(255,153,0,0.15);
  border: 0.0625rem solid rgba(255,153,0,0.4);
  border-radius: 1rem;
  color: #ff9900;
  font-size: 0.72rem;
  font-weight: bold;
  letter-spacing: 0.06em;
  min-width: 1.4rem;
  padding: 0.1rem 0.5rem;
  text-align: center;
}

.accordion-body {
  display: flex; flex-direction: column; gap: 0;
  border-top: 0.0625rem solid rgba(153,204,255,0.1);
}

.accordion-row {
  display: grid;
  grid-template-columns: 1.6fr 1fr 0.9fr auto auto;
  align-items: center; gap: 0.75rem;
  padding: 0.6rem 1rem 0.6rem 2.2rem;
  cursor: pointer;
  background: rgba(0,15,35,0.4);
  border-bottom: 0.0625rem solid rgba(153,204,255,0.06);
  transition: background 0.12s;
}
.accordion-row:last-child { border-bottom: none; }
.accordion-row:hover {
  background: rgba(0,40,90,0.55);
}
.accordion-row--staged {
  background: rgba(255,213,79,0.04);
}
.accordion-row--staged:hover {
  background: rgba(255,213,79,0.08);
}

.accordion-row-name {
  color: #cce0ff; font-size: 0.92rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.accordion-row-date {
  font-size: 0.8rem; color: #556;
}
.accordion-row-status {
  /* just wraps the badge + points */
}
.accordion-row-arrow {
  color: #334; font-size: 0.8rem; flex-shrink: 0;
  transition: color 0.15s;
}
.accordion-row:hover .accordion-row-arrow { color: #ff9900; }

/* ── Confirmation queue table ── */
.submissions-table { display: flex; flex-direction: column; gap: 0.2rem; }

.table-header {
  display: grid;
  align-items: center;
  padding: 0.4rem 0.75rem;
  color: #556; font-size: 0.75rem; letter-spacing: 0.1em;
  border-bottom: 0.0625rem solid rgba(153,204,255,0.15);
}

.table-row {
  display: grid;
  align-items: center; gap: 0.25rem;
  padding: 0.6rem 0.75rem;
  background: rgba(0,30,60,0.35);
  border: 0.0625rem solid rgba(153,204,255,0.08);
  border-radius: 0.375rem;
}

.col-name       { color: #e6f0ff; font-size: 0.95rem; }
.col-assignment { color: #ccddff; font-size: 0.88rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.col-checks     { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }

.confirm-section-heading {
  font-size: 0.75rem; font-weight: bold; letter-spacing: 0.14em;
  color: #ffb300; padding: 0.5rem 0.75rem 0.25rem;
  border-bottom: 0.0625rem solid rgba(255,180,0,0.2);
}
.confirm-table { margin-bottom: 0.5rem; }
.confirm-header, .confirm-row { grid-template-columns: 1.4fr 1.6fr 1fr; }

.check-item { display: flex; }
.check-btn {
  display: flex; align-items: center; gap: 0.35rem;
  background: rgba(255,180,0,0.06);
  border: 0.0625rem solid rgba(255,180,0,0.3);
  border-radius: 0.3rem; color: #ffb300;
  cursor: pointer; font-family: inherit; font-size: 0.75rem;
  font-weight: bold; letter-spacing: 0.04em;
  padding: 0.25rem 0.6rem; transition: all 0.15s; white-space: nowrap;
}
.check-btn:hover:not(:disabled) { background: rgba(255,180,0,0.15); border-color: #ffb300; }
.check-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.check-btn--done {
  background: rgba(105,240,174,0.1); border-color: rgba(105,240,174,0.4); color: #69f0ae;
}
.check-btn--done:hover:not(:disabled) { background: rgba(105,240,174,0.18); }
.check-icon  { font-size: 0.8rem; flex-shrink: 0; }
.check-label { font-size: 0.75rem; }
.all-done-tag {
  font-size: 0.72rem; color: #69f0ae; font-weight: bold;
  letter-spacing: 0.06em; padding: 0.15rem 0.5rem;
  border: 0.0625rem solid rgba(105,240,174,0.3);
  border-radius: 0.25rem; background: rgba(105,240,174,0.07);
}

/* ── Grading slide-out panel ── */
.gp-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 300;
  display: flex; justify-content: flex-end;
}

.gp-panel {
  width: min(420px, 92vw);
  height: 100%;
  background: rgba(6,12,28,0.98);
  border-left: 0.125rem solid rgba(255,153,0,0.35);
  display: flex; flex-direction: column;
  overflow: hidden;
}

/* Slide-in from right */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.27s ease;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateX(100%);
}

.gp-header {
  display: flex; align-items: flex-start; gap: 0.75rem;
  padding: 1.1rem 1.25rem 1rem;
  background: rgba(0,20,45,0.8);
  border-bottom: 0.0625rem solid rgba(255,153,0,0.2);
  flex-shrink: 0;
}

.gp-header-info { flex: 1; min-width: 0; }

.gp-student {
  font-size: 1.2rem; font-weight: bold; letter-spacing: 0.04em;
  color: #ff9900;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.gp-assignment {
  font-size: 0.82rem; color: #7799bb; margin-top: 0.15rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  letter-spacing: 0.03em;
}

.gp-close {
  background: transparent; border: none;
  color: #445; cursor: pointer; font-size: 1rem;
  line-height: 1; padding: 0.2rem 0.3rem;
  transition: color 0.15s; flex-shrink: 0;
}
.gp-close:hover { color: #ff6e6e; }

.gp-body {
  flex: 1; overflow-y: auto;
  padding: 1.25rem;
  display: flex; flex-direction: column; gap: 0.85rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(153,204,255,0.15) transparent;
}

.gp-meta {
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
}

.gp-date {
  font-size: 0.8rem; color: #556;
}

.gp-staged-notice {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.5rem 0.75rem;
  background: rgba(255,213,79,0.06);
  border: 0.0625rem solid rgba(255,213,79,0.25);
  border-radius: 0.3rem;
  color: #ffd54f; font-size: 0.8rem; letter-spacing: 0.04em;
}
.gp-unstage-btn {
  margin-left: auto; flex-shrink: 0;
}

.gp-file-link {
  display: inline-block;
}

.gp-section-label {
  color: #556; font-size: 0.7rem; font-weight: bold;
  letter-spacing: 0.12em; text-transform: uppercase;
  margin-bottom: -0.4rem;
}

.gp-existing-feedback { display: flex; flex-direction: column; gap: 0.3rem; }
.gp-feedback-read {
  font-size: 0.88rem; color: #99bbcc; line-height: 1.5;
  padding: 0.5rem 0.75rem;
  background: rgba(0,0,0,0.25);
  border: 0.0625rem solid rgba(153,204,255,0.1);
  border-radius: 0.3rem;
}

.gp-points-row {
  display: flex; align-items: center; gap: 0.5rem;
}
.gp-points-input {
  width: 90px; font-size: 1.1rem; padding: 0.4rem 0.6rem; text-align: center;
}
.grade-points-max { color: #556; font-size: 0.9rem; }

.gp-feedback-input {
  width: 100%; box-sizing: border-box;
  font-size: 0.9rem; padding: 0.4rem 0.6rem;
}

.gp-actions {
  display: flex; gap: 0.5rem; flex-wrap: wrap;
  padding-top: 0.25rem;
}
.gp-actions .action-btn {
  font-size: 0.82rem; padding: 0.4rem 0.9rem;
}

.gp-extend-section {
  padding-top: 0.25rem;
  border-top: 0.0625rem solid rgba(153,204,255,0.08);
}

.gp-extend-row {
  display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
  padding-top: 0.5rem;
}

.extend-date-input {
  font-size: 0.85rem; padding: 0.3rem 0.5rem; max-width: 150px;
}

/* ── Overview ── */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem; padding-top: 0.25rem;
}
.ov-card {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  padding: 1.25rem 1rem 1rem; border-radius: 0.5rem;
  border: 0.125rem solid rgba(153,204,255,0.1);
  background: rgba(0,25,50,0.4);
  transition: border-color 0.2s, background 0.2s;
}
.ov-card--has-work { border-color: rgba(255,153,0,0.3); background: rgba(40,20,0,0.4); }
.ov-card--urgent   { border-color: rgba(255,80,60,0.4); background: rgba(50,10,5,0.45); }
.ov-card--clear    { opacity: 0.55; }
.ov-period-label {
  font-size: 0.75rem; letter-spacing: 0.12em; color: #6688aa;
  font-weight: bold; text-transform: uppercase;
}
.ov-count {
  font-size: 3.5rem; font-weight: bold; line-height: 1; letter-spacing: -0.02em;
}
.ov-count--clear    { color: #445; }
.ov-count--has-work { color: #ff9900; }
.ov-count--urgent   { color: #ff5c3a; }
.ov-count-label {
  font-size: 0.7rem; letter-spacing: 0.1em; color: #445;
  text-transform: uppercase; margin-top: -0.2rem;
}
.ov-breakdown {
  display: flex; flex-wrap: wrap; gap: 0.3rem; justify-content: center;
  margin-top: 0.3rem; min-height: 1.5rem;
}
.ov-chip {
  font-size: 0.68rem; font-weight: bold; letter-spacing: 0.05em;
  padding: 0.15rem 0.45rem; border-radius: 0.25rem;
}
.ov-chip--submitted {
  background: rgba(153,204,255,0.1); border: 0.0625rem solid rgba(153,204,255,0.3); color: #99ccff;
}
.ov-chip--returned {
  background: rgba(255,180,0,0.1); border: 0.0625rem solid rgba(255,180,0,0.35); color: #ffb300;
}
.ov-chip--clear {
  background: rgba(105,240,174,0.07); border: 0.0625rem solid rgba(105,240,174,0.2); color: #69f0ae;
}
.ov-grade-btn {
  margin-top: 0.5rem; background: transparent;
  border: 0.0625rem solid rgba(255,153,0,0.4); border-radius: 0.3rem;
  color: #ff9900; cursor: pointer; font-family: inherit;
  font-size: 0.75rem; font-weight: bold; letter-spacing: 0.08em;
  padding: 0.3rem 0.9rem; transition: all 0.15s; width: 100%;
}
.ov-grade-btn:hover { background: rgba(255,153,0,0.12); border-color: #ff9900; }

/* ── Late penalty notice ──────────────────────────────────────────────────── */
.gp-late-notice {
  background: rgba(255, 153, 0, 0.08);
  border: 1px solid rgba(255, 153, 0, 0.3);
  border-radius: 4px;
  color: #c8a060;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  line-height: 1.4;
}
.gp-late-notice strong {
  color: #ff9900;
  font-weight: 700;
}
.gp-late-deduction {
  color: #c0392b;
  font-size: 0.72rem;
  margin-left: 0.3rem;
}
</style>
