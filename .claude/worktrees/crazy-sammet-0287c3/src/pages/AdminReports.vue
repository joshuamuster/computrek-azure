<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>Reports</span></div>

    <div class="rpt-shell">

      <!-- ── Header ─────────────────────────────────────────────────── -->
      <div class="rpt-header">
        <div>
          <div class="rpt-title">{{ userInfo?.displayName ?? 'Administrator' }}</div>
          <div class="rpt-sub">Analytics Console</div>
        </div>

        <!-- Tab bar -->
        <div class="tab-bar">
          <button
            v-for="tab in TABS"
            :key="tab.id"
            :class="['tab-btn', { 'tab-btn--active': activeTab === tab.id }]"
            @click="switchTab(tab.id)"
          >{{ tab.label }}</button>
        </div>
      </div>

      <!-- ── Period selector (hidden on overview tabs) ────────────────── -->
      <div class="period-row" v-if="!overviewTabs.has(activeTab)">
        <span class="period-row-label">PERIOD</span>
        <div class="period-pills">
          <button
            v-for="p in availablePeriods"
            :key="p.id"
            :class="['period-pill', { 'period-pill--active': selectedPeriodId === p.id }]"
            @click="selectPeriod(p.id)"
          >{{ shortLabel(p.id) }}</button>
        </div>
      </div>

      <!-- No period selected prompt (not shown on overview tabs) -->
      <div v-if="!selectedPeriodId && !overviewTabs.has(activeTab)" class="empty-state">
        Select a period above to load report data.
      </div>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- TAB 1: End of Period                                          -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'eop' && selectedPeriodId">

        <!-- Date picker row -->
        <div class="date-row">
          <span class="period-row-label">DATE</span>
          <input
            type="date"
            class="date-input"
            :value="selectedDate"
            :max="todayISO"
            @change="onDateChange"
          />
          <button
            v-if="selectedDate !== todayISO"
            class="date-today-btn"
            @click="resetToToday"
          >Today</button>
          <span class="date-display">{{ formattedDate }}</span>
        </div>

        <!-- Loading skeleton -->
        <div v-if="isLoading" class="loading-row">
          <div class="loading-pill">Loading report data…</div>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="error-banner">{{ error }}</div>

        <!-- ── Three metric panels ─────────────────────────────────── -->
        <div v-else class="metric-grid">

          <!-- ── TYPING ──────────────────────────────────────────── -->
          <div class="metric-panel">
            <div class="metric-panel-head">
              <span class="metric-icon">⌨️</span>
              <div>
                <div class="metric-title">TYPING</div>
                <div class="metric-sub">Sessions completed today</div>
              </div>
            </div>

            <template v-if="typing">
              <div v-if="typing.sessionCount === 0" class="no-data-msg">
                No typing sessions recorded for this period today.
              </div>
              <template v-else>
                <div class="stat-row">
                  <div class="stat-block">
                    <div class="stat-value">{{ typing.avgWpm ?? '—' }}</div>
                    <div class="stat-label">Avg WPM</div>
                  </div>
                  <div class="stat-block">
                    <div class="stat-value">{{ typing.avgAccuracy != null ? typing.avgAccuracy + '%' : '—' }}</div>
                    <div class="stat-label">Avg Accuracy</div>
                  </div>
                  <div class="stat-block">
                    <div class="stat-value accent-orange">{{ typing.topWpm ?? '—' }}</div>
                    <div class="stat-label">Top WPM</div>
                  </div>
                </div>
                <div class="stat-footer">
                  {{ typing.sessionCount }} session{{ typing.sessionCount !== 1 ? 's' : '' }}
                  &nbsp;·&nbsp;
                  {{ typing.participantCount }} student{{ typing.participantCount !== 1 ? 's' : '' }} participated
                </div>
              </template>
            </template>
            <div v-else class="no-data-msg">No data loaded.</div>
          </div>

          <!-- ── MISSIONS ────────────────────────────────────────── -->
          <div class="metric-panel">
            <div class="metric-panel-head">
              <span class="metric-icon">📋</span>
              <div>
                <div class="metric-title">MISSIONS</div>
                <div class="metric-sub">Assignments due today</div>
              </div>
            </div>

            <template v-if="missions">
              <div v-if="missions.assignments.length === 0" class="no-data-msg">
                No missions due today for this period.
              </div>
              <template v-else>
                <div
                  v-for="a in missions.assignments"
                  :key="a.id"
                  class="mission-row"
                >
                  <div class="mission-title">{{ a.title }}</div>
                  <div class="stat-row">
                    <div class="stat-block">
                      <div class="stat-value">{{ a.submittedCount }}<span class="stat-denom">/{{ a.totalStudents }}</span></div>
                      <div class="stat-label">Turned In</div>
                    </div>
                    <div class="stat-block">
                      <div class="stat-value">{{ turnInPct(a.submittedCount, a.totalStudents) }}%</div>
                      <div class="stat-label">Turn-in Rate</div>
                    </div>
                    <div class="stat-block">
                      <div class="stat-value">
                        <template v-if="a.avgScore != null">
                          {{ a.avgScore }}<span v-if="a.pointsPossible" class="stat-denom">/{{ a.pointsPossible }}</span>
                        </template>
                        <template v-else>—</template>
                      </div>
                      <div class="stat-label">Avg Score</div>
                    </div>
                  </div>
                  <!-- Turn-in progress bar -->
                  <div class="progress-track">
                    <div
                      class="progress-fill"
                      :style="{
                        width: turnInPct(a.submittedCount, a.totalStudents) + '%',
                        background: turnInColor(turnInPct(a.submittedCount, a.totalStudents)),
                      }"
                    ></div>
                  </div>
                </div>
              </template>
            </template>
            <div v-else class="no-data-msg">No data loaded.</div>
          </div>

          <!-- ── CONDUCT ─────────────────────────────────────────── -->
          <div class="metric-panel">
            <div class="metric-panel-head">
              <span class="metric-icon">🪐</span>
              <div>
                <div class="metric-title">CONDUCT</div>
                <div class="metric-sub">End-of-period ratings</div>
              </div>
            </div>

            <template v-if="conduct">
              <div v-if="conduct.ratingCount === 0" class="no-data-msg">
                No conduct ratings logged for this period today.
                <div class="no-data-hint">
                  Rate cadets from their individual Cadet Detail page.
                </div>
              </div>
              <template v-else>
                <div class="stat-row">
                  <div class="stat-block">
                    <div class="stat-value accent-green">{{ conduct.avgOverall != null ? conduct.avgOverall.toFixed(1) : '—' }}</div>
                    <div class="stat-label">Overall (1–5)</div>
                  </div>
                  <div class="stat-block">
                    <div class="stat-value">{{ conduct.ratingCount }}<span class="stat-denom">/{{ conduct.totalStudents }}</span></div>
                    <div class="stat-label">Cadets Rated</div>
                  </div>
                </div>
                <div class="conduct-categories">
                  <div class="conduct-cat-row" v-for="cat in conductCategories" :key="cat.key">
                    <span class="conduct-cat-label">{{ cat.label }}</span>
                    <div class="conduct-pip-track">
                      <div
                        class="conduct-pip-fill"
                        :style="{ width: conductFillPct(conduct[cat.key]) + '%' }"
                      ></div>
                    </div>
                    <span class="conduct-cat-val">{{ conduct[cat.key] != null ? (conduct[cat.key] as number).toFixed(1) : '—' }}</span>
                  </div>
                </div>
              </template>
            </template>
            <div v-else class="no-data-msg">No data loaded.</div>
          </div>

        </div><!-- /metric-grid -->
      </template>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- TAB 2: By Student                                             -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'student' && selectedPeriodId">

        <div class="roster-toolbar">
          <input
            v-model="studentSearch"
            class="search-input"
            placeholder="Search cadets…"
            type="search"
          />
          <span class="roster-count">{{ filteredRoster.length }} cadet{{ filteredRoster.length !== 1 ? 's' : '' }}</span>
        </div>

        <div v-if="isRosterLoading" class="loading-row">
          <div class="loading-pill">Loading roster…</div>
        </div>

        <div v-else-if="filteredRoster.length === 0 && !isRosterLoading" class="empty-state">
          {{ studentSearch ? 'No cadets match your search.' : 'No cadets found in this period.' }}
        </div>

        <div v-else class="roster-table">
          <!-- Header row -->
          <div class="roster-header">
            <div class="col-name">CADET</div>
            <div class="col-stat">CONDUCT</div>
            <div class="col-stat">LATEST WPM</div>
            <div class="col-stat">TURN-IN</div>
            <div class="col-action"></div>
          </div>

          <div
            v-for="row in filteredRoster"
            :key="row.uid"
            class="roster-row"
          >
            <div class="col-name">
              <span class="cadet-name">{{ row.displayName }}</span>
            </div>
            <div class="col-stat">
              <!-- Conduct score pips (0–4) -->
              <div class="pip-row">
                <span
                  v-for="i in 4"
                  :key="i"
                  :class="['pip', i - 1 < row.conductScore ? 'pip--filled' : 'pip--empty']"
                ></span>
              </div>
              <span class="pip-label">{{ conductLabel(row.conductScore) }}</span>
            </div>
            <div class="col-stat">
              <span :class="['wpm-val', wpmTier(row.latestWpm)]">
                {{ row.latestWpm != null ? row.latestWpm + ' wpm' : '—' }}
              </span>
            </div>
            <div class="col-stat">
              <span
                v-if="row.turnInRate != null"
                :class="['turnin-badge', turnInTier(row.turnInRate)]"
              >{{ row.turnInRate }}%</span>
              <span v-else class="turnin-badge">—</span>
            </div>
            <div class="col-action">
              <RouterLink :to="`/admin/cadet/${row.uid}`" class="detail-link">
                View →
              </RouterLink>
            </div>
          </div>
        </div>

      </template>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- TAB 3: Trends (placeholder for now)                           -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'trends' && selectedPeriodId">
        <div class="trends-placeholder">
          <div class="trends-icon">📈</div>
          <div class="trends-heading">Class Trends</div>
          <div class="trends-body">
            Track how a period improves over time across typing, missions, and conduct.
            Filter by quarter or curriculum unit. Coming soon.
          </div>
          <div class="trends-items">
            <div class="trends-item">📊 Avg WPM by week</div>
            <div class="trends-item">📋 Turn-in rate by quarter</div>
            <div class="trends-item">🪐 Conduct trend over time</div>
            <div class="trends-item">🎓 Filter by Q1–Q4 or Unit 1–7</div>
          </div>
        </div>
      </template>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- TAB: Typing Overview                                          -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'typing'">
        <div v-if="typingDashLoading" class="loading-row">
          <div class="loading-pill">Loading typing data…</div>
        </div>
        <div v-else-if="!typingDashData || !periodTypingStats.length" class="empty-state">
          No typing sessions recorded yet.
        </div>
        <template v-else>
          <!-- Summary bar -->
          <div class="ov-summary-bar">
            <span class="ov-summary-item">
              <span class="ov-summary-val">{{ typingDashData.totalSessions }}</span>
              total sessions
            </span>
            <span class="ov-summary-sep">·</span>
            <span class="ov-summary-item">
              <span class="ov-summary-val">{{ typingDashData.allStudents.length }}</span>
              students active
            </span>
            <span class="ov-summary-sep">·</span>
            <span class="ov-summary-item">
              Top key errors:
              <span v-for="(k, i) in typingDashData.missedKeys.slice(0, 5)" :key="k.key" class="ov-key-chip">{{ k.key }}</span>
            </span>
          </div>

          <!-- Per-period cards -->
          <div class="ov-period-grid">
            <div
              v-for="p in periodTypingStats"
              :key="p.periodId"
              class="ov-period-card"
            >
              <div class="opc-accent-bar" :style="{ background: wpmColor(p.avgWpm) }"></div>
              <div class="opc-header">
                <span class="opc-label">{{ shortLabel(p.periodId) }}</span>
                <span class="opc-sessions">{{ p.sessions }} sessions</span>
              </div>
              <div class="opc-wpm" :style="{ color: wpmColor(p.avgWpm) }">{{ p.avgWpm }}</div>
              <div class="opc-wpm-label">avg WPM</div>
              <div class="opc-divider"></div>
              <div class="opc-stats">
                <div class="opc-stat">
                  <div class="opc-stat-val">{{ p.bestWpm }}</div>
                  <div class="opc-stat-label">best WPM</div>
                </div>
                <div class="opc-stat">
                  <div class="opc-stat-val">{{ p.avgAccuracy }}%</div>
                  <div class="opc-stat-label">accuracy</div>
                </div>
                <div class="opc-stat">
                  <div class="opc-stat-val">{{ p.students }}</div>
                  <div class="opc-stat-label">students</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Top students across all periods -->
          <div class="ov-section-title">TOP CADETS</div>
          <div class="ov-top-students">
            <div
              v-for="(s, i) in typingDashData.topStudents.slice(0, 10)"
              :key="s.uid"
              class="ov-top-row"
            >
              <span class="ov-top-rank">#{{ i + 1 }}</span>
              <span class="ov-top-name">{{ s.displayName }}</span>
              <span class="ov-top-period">{{ shortLabel(s.periodId) }}</span>
              <span class="ov-top-wpm" :style="{ color: wpmColor(s.bestWpm) }">{{ s.bestWpm }} wpm</span>
              <span class="ov-top-avg">avg {{ s.avgWpm }}</span>
            </div>
          </div>
        </template>
      </template>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- TAB: Missions Overview                                         -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'missions'">
        <div v-if="missionOverviewLoading" class="loading-row">
          <div class="loading-pill">Loading mission data…</div>
        </div>
        <div v-else-if="missionOverviewError" class="error-banner">{{ missionOverviewError }}</div>
        <template v-else>

          <!-- ── Period Health ───────────────────────────────────────── -->
          <div class="ov-section-title">PERIOD HEALTH</div>
          <div class="ov-panel">
            <div
              v-for="p in availablePeriods"
              :key="p.id"
              class="health-row"
            >
              <span class="health-row-label">{{ shortLabel(p.id) }}</span>
              <div class="health-row-track">
                <div
                  class="health-row-fill"
                  :style="{
                    width: periodHealth(p.id) + '%',
                    background: healthColor(periodHealth(p.id)),
                  }"
                ></div>
              </div>
              <span class="health-row-pct" :style="{ color: healthColor(periodHealth(p.id)) }">
                {{ periodHealth(p.id).toFixed(0) }}%
              </span>
              <span class="health-row-detail">
                {{ statusByPeriod.get(p.id)?.gradedCount ?? 0 }} graded
                <template v-if="(statusByPeriod.get(p.id)?.overdueCount ?? 0) > 0">
                  · <span class="overdue-txt">{{ statusByPeriod.get(p.id)?.overdueCount }} overdue</span>
                </template>
              </span>
            </div>
          </div>

          <!-- ── Mission Turn-In ────────────────────────────────────── -->
          <div class="ov-section-title" style="margin-top: 1.5rem;">
            MISSION TURN-IN
            <span class="ov-section-sub">Current school year · all assignments</span>
          </div>
          <div class="ov-panel">
            <div
              v-for="stat in missionOverviewStats"
              :key="stat.periodId"
              class="turnin-row"
            >
              <span class="turnin-label">{{ shortLabel(stat.periodId) }}</span>
              <div class="turnin-bar-wrap">
                <div class="turnin-bar" v-if="stat.total > 0">
                  <div
                    class="turnin-seg turnin-seg--graded"
                    :style="{ width: segWidth(stat.graded, stat.total) + '%' }"
                    :title="`Graded/Returned: ${stat.graded}`"
                  ></div>
                  <div
                    class="turnin-seg turnin-seg--awaiting"
                    :style="{ width: segWidth(stat.awaiting, stat.total) + '%' }"
                    :title="`Awaiting grade: ${stat.awaiting}`"
                  ></div>
                  <div
                    class="turnin-seg turnin-seg--assigned"
                    :style="{ width: segWidth(stat.assigned, stat.total) + '%' }"
                    :title="`Not submitted: ${stat.assigned}`"
                  ></div>
                </div>
                <div v-else class="turnin-bar turnin-bar--empty"></div>
              </div>
              <span class="turnin-count">
                {{ stat.turnedIn }}<span class="turnin-denom">/{{ stat.total }}</span>
              </span>
              <span
                class="turnin-pct"
                :class="turnInTier(turnInPct(stat.turnedIn, stat.total))"
              >{{ turnInPct(stat.turnedIn, stat.total) }}%</span>
            </div>

            <!-- Legend -->
            <div class="turnin-legend">
              <span class="tl-dot tl-dot--graded"></span><span class="tl-text">Graded / Returned</span>
              <span class="tl-dot tl-dot--awaiting"></span><span class="tl-text">Awaiting Grade</span>
              <span class="tl-dot tl-dot--assigned"></span><span class="tl-text">Not Submitted</span>
            </div>
          </div>

          <!-- Refresh button -->
          <div style="margin-top: 0.75rem; text-align: right;">
            <button class="ov-refresh-btn" @click="loadMissionsOverview">Refresh data</button>
          </div>
        </template>
      </template>

    </div><!-- /rpt-shell -->
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { usePeriodSelector } from '@/composables/usePeriodSelector'
import { useEndOfPeriodReport } from '@/composables/useEndOfPeriodReport'
import { useTypingDashboard } from '@/composables/useTypingDashboard'
import { useShipStatus } from '@/composables/useShipStatus'
import { PERIOD_IDS, SCHOOL_YEAR_ID } from '@/config/schoolYear'

// ── Auth & period ─────────────────────────────────────────────────────────────

const { userInfo, isAdmin, isAudit, effectiveTeacherEmail } = useAuth()
const { selectedPeriodId, setPeriod } = usePeriodSelector()

// Periods available to this user:
//   admin / audit → all periods
//   staff         → only their assigned periods (periodIds from userInfo)
const myPeriodIds = computed<string[]>(() => userInfo.value?.periodIds ?? [])

const availablePeriods = computed(() =>
  (isAdmin.value || isAudit.value)
    ? PERIOD_IDS
    : PERIOD_IDS.filter(p => myPeriodIds.value.includes(p.id)),
)

function shortLabel(id: string) { return id.replace('period-', 'P') }

function selectPeriod(id: string) {
  setPeriod(id)
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'eop',      label: 'End of Period'  },
  { id: 'student',  label: 'By Student'     },
  { id: 'typing',   label: 'Typing'         },
  { id: 'missions', label: 'Missions'       },
  { id: 'trends',   label: 'Trends'         },
] as const

type TabId = typeof TABS[number]['id']
const activeTab = ref<TabId>('eop')

const overviewTabs = new Set<TabId>(['typing', 'missions'])

function switchTab(id: TabId) {
  activeTab.value = id
  if (id === 'student'  && selectedPeriodId.value) loadRoster()
  if (id === 'typing')   loadTypingOverview()
  if (id === 'missions') loadMissionsOverview()
}

// ── Date picker ───────────────────────────────────────────────────────────────

const todayISO = new Date().toISOString().slice(0, 10)
const selectedDate = ref(todayISO)

const formattedDate = computed(() => {
  const [y, m, d] = selectedDate.value.split('-')
  const dt = new Date(+y, +m - 1, +d)
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
})

function onDateChange(e: Event) {
  selectedDate.value = (e.target as HTMLInputElement).value
}

function resetToToday() {
  selectedDate.value = todayISO
}

// ── Report data ───────────────────────────────────────────────────────────────

const {
  typing, missions, conduct, roster,
  isLoading, isRosterLoading, error,
  fetchEndOfPeriod, fetchRoster,
} = useEndOfPeriodReport()

// ── Typing overview ───────────────────────────────────────────────────────────

const {
  data: typingDashData,
  isLoading: typingDashLoading,
  fetchDashboard,
} = useTypingDashboard()

const periodTypingStats = computed(() => {
  if (!typingDashData.value) return []
  const myIds = new Set<string>(availablePeriods.value.map(p => p.id))
  return typingDashData.value.periods
    .filter(p => myIds.has(p.periodId))
    .sort((a, b) => b.avgWpm - a.avgWpm)
})

async function loadTypingOverview() {
  const email = effectiveTeacherEmail.value
  if (!email) return
  await fetchDashboard(email)
}

function wpmColor(wpm: number): string {
  if (wpm >= 50) return '#5e9f63'
  if (wpm >= 35) return '#4d99ee'
  if (wpm >= 20) return '#ff9900'
  return '#c0392b'
}

// ── Missions overview ─────────────────────────────────────────────────────────

const { statusByPeriod } = useShipStatus()

function periodHealth(periodId: string): number {
  return statusByPeriod.value.get(periodId)?.health ?? 100
}

function healthColor(h: number): string {
  if (h >= 80) return '#4FAE6A'
  if (h >= 55) return '#E3C720'
  return '#e05252'
}

interface PeriodMissionStat {
  periodId: string
  total:    number
  graded:   number
  awaiting: number
  assigned: number
  turnedIn: number
}

const missionOverviewStats   = ref<PeriodMissionStat[]>([])
const missionOverviewLoading = ref(false)
const missionOverviewError   = ref('')

async function loadMissionsOverview() {
  const periods = availablePeriods.value
  if (!periods.length) return
  missionOverviewLoading.value = true
  missionOverviewError.value   = ''
  try {
    const results: PeriodMissionStat[] = await Promise.all(
      periods.map(async p => {
        const snap = await getDocs(query(
          collection(db, 'submissions'),
          where('periodId',    '==', p.id),
          where('schoolYearId','==', SCHOOL_YEAR_ID),
        ))
        const docs     = snap.docs.map(d => d.data() as { status: string })
        const graded   = docs.filter(d => d.status === 'graded'   || d.status === 'returned').length
        const awaiting = docs.filter(d => d.status === 'submitted').length
        const assigned = docs.filter(d => d.status === 'assigned').length
        return { periodId: p.id, total: docs.length, graded, awaiting, assigned, turnedIn: graded + awaiting }
      })
    )
    missionOverviewStats.value = results
  } catch (e: any) {
    missionOverviewError.value = 'Failed to load mission data.'
  } finally {
    missionOverviewLoading.value = false
  }
}

function segWidth(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0
}

const studentSearch = ref('')

const filteredRoster = computed(() => {
  const q = studentSearch.value.toLowerCase().trim()
  return q
    ? roster.value.filter(r => r.displayName.toLowerCase().includes(q))
    : roster.value
})

async function loadEndOfPeriod() {
  if (!selectedPeriodId.value) return
  await fetchEndOfPeriod(
    selectedPeriodId.value,
    effectiveTeacherEmail.value,
    selectedDate.value,
  )
}

async function loadRoster() {
  if (!selectedPeriodId.value) return
  await fetchRoster(selectedPeriodId.value, effectiveTeacherEmail.value)
}

// Reload when period or date changes
watch(selectedPeriodId, () => {
  if (activeTab.value === 'eop')     loadEndOfPeriod()
  if (activeTab.value === 'student') loadRoster()
})

watch(selectedDate, () => {
  if (activeTab.value === 'eop' && selectedPeriodId.value) loadEndOfPeriod()
})

onMounted(() => {
  if (selectedPeriodId.value) loadEndOfPeriod()
})

// ── Display helpers ───────────────────────────────────────────────────────────

function turnInPct(submitted: number, total: number): number {
  return total > 0 ? Math.round((submitted / total) * 100) : 0
}

function turnInColor(pct: number): string {
  if (pct >= 90) return '#5e9f63'   // green
  if (pct >= 70) return '#4d99ee'   // blue
  if (pct >= 50) return '#ff9900'   // orange
  return '#c0392b'                  // red
}

function turnInTier(pct: number): string {
  if (pct >= 90) return 'tier-green'
  if (pct >= 70) return 'tier-blue'
  if (pct >= 50) return 'tier-orange'
  return 'tier-red'
}

// Conduct category labels
const conductCategories = [
  { key: 'avgParticipation' as const, label: 'Participation' },
  { key: 'avgRespect'       as const, label: 'Respect'       },
  { key: 'avgOnTask'        as const, label: 'On Task'        },
  { key: 'avgEffort'        as const, label: 'Effort'         },
]

// Fill %: scale 1–5 → 0–100%
function conductFillPct(val: number | null | undefined): number {
  if (val == null) return 0
  return ((val - 1) / 4) * 100
}

// Conduct score (0–4 int) → label
function conductLabel(score: number): string {
  const labels = ['Critical', 'Low', 'Fair', 'Good', 'Exemplary']
  return labels[Math.max(0, Math.min(4, Math.round(score)))] ?? '—'
}

// WPM tier for coloring
function wpmTier(wpm: number | null): string {
  if (wpm == null) return ''
  if (wpm >= 50) return 'wpm-green'
  if (wpm >= 35) return 'wpm-blue'
  if (wpm >= 20) return 'wpm-orange'
  return 'wpm-red'
}
</script>

<style scoped>
/* ── Shell ─────────────────────────────────────────────────────────────────── */
.rpt-shell {
  padding: 1.25rem 1.5rem;
  max-width: 980px;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.rpt-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0.75rem 0 1rem;
  border-bottom: 2px solid #2d3050;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.rpt-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--almond-creme, #fba);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.rpt-sub {
  font-size: 0.75rem;
  color: var(--gray, #668);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: 0.15rem;
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  gap: 0.25rem;
  background: #0d0f1a;
  border: 1px solid #2d3050;
  border-radius: 4px;
  padding: 3px;
}
.tab-btn {
  background: transparent;
  border: none;
  color: #668;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.3rem 0.75rem;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.tab-btn:hover { color: #89a; background: #12141f; }
.tab-btn--active {
  background: #1e2240;
  color: #4d99ee;
}

/* ── Period pills ──────────────────────────────────────────────────────────── */
.period-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.period-row-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #446;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  min-width: 3.5rem;
}
.period-pills {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.period-pill {
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 3px;
  color: #668;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.65rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.period-pill:hover { background: #1e2240; color: #89a; border-color: #4d6; }
.period-pill--active {
  background: #1a2a44;
  border-color: #4d99ee;
  color: #4d99ee;
}

/* ── Date row ──────────────────────────────────────────────────────────────── */
.date-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}
.date-input {
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 3px;
  color: #c8d0e0;
  font-family: inherit;
  font-size: 0.82rem;
  padding: 0.28rem 0.6rem;
  cursor: pointer;
  transition: border-color 0.15s;
}
.date-input:focus { outline: none; border-color: #4d99ee; }
.date-today-btn {
  background: transparent;
  border: 1px solid #2d3050;
  border-radius: 3px;
  color: #4d99ee;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  transition: background 0.15s;
}
.date-today-btn:hover { background: #1a2a44; }
.date-display {
  font-size: 0.78rem;
  color: #556;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ── Loading / error ───────────────────────────────────────────────────────── */
.loading-row {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}
.loading-pill {
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 20px;
  color: #557;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  padding: 0.4rem 1.2rem;
  text-transform: uppercase;
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

.error-banner {
  background: #2a0e12;
  border: 1px solid #7a2233;
  border-radius: 4px;
  color: #f48;
  font-size: 0.82rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.empty-state {
  color: #446;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2rem 0;
  text-align: center;
}

/* ── Metric grid ───────────────────────────────────────────────────────────── */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.metric-panel {
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 4px;
  padding: 1.1rem 1.25rem 1rem;
}

.metric-panel-head {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #1e2240;
}
.metric-icon { font-size: 1.15rem; line-height: 1.1; margin-top: 0.05rem; }
.metric-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--almond-creme, #fba);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.metric-sub {
  font-size: 0.68rem;
  color: #446;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 0.1rem;
}

/* ── Stat blocks ───────────────────────────────────────────────────────────── */
.stat-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}
.stat-block {
  flex: 1;
  background: #0d0f1a;
  border: 1px solid #1e2240;
  border-radius: 3px;
  padding: 0.5rem 0.4rem;
  text-align: center;
}
.stat-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: #4d99ee;
  line-height: 1.1;
  font-family: 'Antonio', sans-serif;
}
.stat-denom {
  font-size: 0.75rem;
  color: #446;
  font-weight: 400;
}
.stat-label {
  font-size: 0.62rem;
  color: #557;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 0.2rem;
}
.stat-footer {
  font-size: 0.7rem;
  color: #446;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-top: 0.25rem;
  text-align: center;
}

.accent-orange { color: #ff9900 !important; }
.accent-green  { color: #5e9f63 !important; }

/* ── Mission-specific ──────────────────────────────────────────────────────── */
.mission-row + .mission-row { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #1e2240; }
.mission-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #89a;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 0.5rem;
}
.progress-track {
  height: 4px;
  background: #1e2240;
  border-radius: 2px;
  margin-top: 0.4rem;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}
.no-data-msg {
  font-size: 0.78rem;
  color: #446;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 0.5rem 0;
}
.no-data-hint {
  font-size: 0.7rem;
  color: #334;
  margin-top: 0.4rem;
  text-transform: none;
  letter-spacing: 0;
}

/* ── Conduct categories ────────────────────────────────────────────────────── */
.conduct-categories { margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.45rem; }
.conduct-cat-row    { display: flex; align-items: center; gap: 0.5rem; }
.conduct-cat-label  {
  font-size: 0.65rem;
  color: #668;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  width: 5rem;
  flex-shrink: 0;
}
.conduct-pip-track {
  flex: 1;
  height: 5px;
  background: #1e2240;
  border-radius: 3px;
  overflow: hidden;
}
.conduct-pip-fill {
  height: 100%;
  background: #4d99ee;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.conduct-cat-val {
  font-size: 0.68rem;
  color: #4d99ee;
  font-weight: 700;
  width: 1.8rem;
  text-align: right;
  flex-shrink: 0;
}

/* ── By Student roster ─────────────────────────────────────────────────────── */
.roster-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.search-input {
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 3px;
  color: #c8d0e0;
  font-family: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.75rem;
  width: 220px;
  transition: border-color 0.15s;
}
.search-input:focus { outline: none; border-color: #4d99ee; }
.roster-count {
  font-size: 0.7rem;
  color: #446;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.roster-table {
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 4px;
  overflow: hidden;
}
.roster-header,
.roster-row {
  display: grid;
  grid-template-columns: 1fr 140px 110px 90px 70px;
  align-items: center;
  padding: 0.55rem 1rem;
  gap: 0.5rem;
}
.roster-header {
  background: #0d0f1a;
  border-bottom: 1px solid #2d3050;
}
.roster-header > div {
  font-size: 0.64rem;
  font-weight: 700;
  color: #446;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.roster-row {
  border-bottom: 1px solid #181a2a;
  transition: background 0.1s;
}
.roster-row:last-child { border-bottom: none; }
.roster-row:hover { background: #14162a; }

.col-name   { overflow: hidden; }
.col-stat   { text-align: center; }
.col-action { text-align: right; }

.cadet-name {
  font-size: 0.84rem;
  font-weight: 600;
  color: #c8d0e0;
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* Conduct pips */
.pip-row { display: flex; gap: 3px; justify-content: center; margin-bottom: 2px; }
.pip {
  width: 8px; height: 8px;
  border-radius: 50%;
  border: 1px solid #2d3050;
}
.pip--filled { background: #4d99ee; border-color: #4d99ee; }
.pip--empty  { background: transparent; }
.pip-label {
  display: block;
  font-size: 0.6rem;
  color: #446;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: center;
}

/* WPM colors */
.wpm-val { font-size: 0.82rem; font-weight: 700; }
.wpm-green  { color: #5e9f63; }
.wpm-blue   { color: #4d99ee; }
.wpm-orange { color: #ff9900; }
.wpm-red    { color: #c0392b; }

/* Turn-in badges */
.turnin-badge {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  background: #1e2240;
  color: #446;
}
.tier-green  { background: #1a3320; color: #5e9f63; }
.tier-blue   { background: #12243a; color: #4d99ee; }
.tier-orange { background: #2a1e0a; color: #ff9900; }
.tier-red    { background: #2a0e12; color: #c0392b; }

.detail-link {
  font-size: 0.72rem;
  font-weight: 700;
  color: #4d99ee;
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.detail-link:hover { opacity: 1; }

/* ── Overview shared ───────────────────────────────────────────────────────── */
.ov-section-title {
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.14em;
  color: #446; text-transform: uppercase; margin: 1.25rem 0 0.6rem;
  display: flex; align-items: baseline; gap: 0.75rem;
}
.ov-section-sub {
  font-size: 0.62rem; font-weight: 400; color: #334; letter-spacing: 0.06em;
}
.ov-panel {
  background: #12141f; border: 1px solid #2d3050;
  border-radius: 4px; padding: 1rem 1.25rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.ov-refresh-btn {
  background: transparent; border: 1px solid #2d3050; border-radius: 3px;
  color: #4d99ee; cursor: pointer; font-family: inherit;
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.07em;
  padding: 0.25rem 0.75rem; text-transform: uppercase;
  transition: background 0.15s;
}
.ov-refresh-btn:hover { background: #1a2a44; }

/* ── Typing overview ───────────────────────────────────────────────────────── */
.ov-summary-bar {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  background: #12141f; border: 1px solid #2d3050; border-radius: 4px;
  padding: 0.6rem 1rem; margin-bottom: 1rem;
  font-size: 0.75rem; color: #668; text-transform: uppercase; letter-spacing: 0.07em;
}
.ov-summary-val   { color: #4d99ee; font-weight: 700; font-size: 0.9rem; margin-right: 0.2rem; }
.ov-summary-sep   { color: #2d3050; }
.ov-key-chip {
  display: inline-block; background: #0d0f1a; border: 1px solid #2d3050;
  border-radius: 3px; color: #e05252; font-family: monospace;
  font-size: 0.8rem; margin-left: 0.25rem; padding: 0.05rem 0.35rem;
}

.ov-period-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0.85rem;
  margin-bottom: 1.25rem;
}
.ov-period-card {
  background: #12141f; border: 1px solid #2d3050; border-radius: 4px;
  overflow: hidden; position: relative;
}
.opc-accent-bar { height: 3px; width: 100%; }
.opc-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.6rem 0.85rem 0.1rem;
}
.opc-label   { font-size: 0.75rem; font-weight: 700; color: #89a; letter-spacing: 0.1em; text-transform: uppercase; }
.opc-sessions { font-size: 0.62rem; color: #446; letter-spacing: 0.06em; }
.opc-wpm {
  font-size: 2.6rem; font-weight: 700; font-family: 'Antonio', sans-serif;
  line-height: 1; padding: 0.2rem 0.85rem 0;
}
.opc-wpm-label { font-size: 0.62rem; color: #446; letter-spacing: 0.1em; text-transform: uppercase; padding: 0 0.85rem 0.6rem; }
.opc-divider { height: 1px; background: #1e2240; margin: 0 0.85rem 0.6rem; }
.opc-stats { display: flex; gap: 0; padding: 0 0.85rem 0.85rem; }
.opc-stat  { flex: 1; text-align: center; }
.opc-stat-val   { font-size: 0.9rem; font-weight: 700; color: #c8d0e0; }
.opc-stat-label { font-size: 0.58rem; color: #446; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.1rem; }

.ov-top-students {
  background: #12141f; border: 1px solid #2d3050; border-radius: 4px; overflow: hidden;
}
.ov-top-row {
  display: grid; grid-template-columns: 2rem 1fr 3rem 5rem 4rem;
  align-items: center; gap: 0.5rem; padding: 0.45rem 1rem;
  border-bottom: 1px solid #181a2a;
}
.ov-top-row:last-child { border-bottom: none; }
.ov-top-row:nth-child(1) { background: rgba(255,153,0,0.05); }
.ov-top-row:nth-child(2) { background: rgba(255,255,255,0.02); }
.ov-top-row:nth-child(3) { background: rgba(255,255,255,0.01); }
.ov-top-rank { font-size: 0.68rem; color: #446; font-weight: 700; }
.ov-top-name { font-size: 0.82rem; color: #c8d0e0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-top-period { font-size: 0.68rem; color: #557; text-align: center; }
.ov-top-wpm  { font-size: 0.88rem; font-weight: 700; text-align: right; }
.ov-top-avg  { font-size: 0.68rem; color: #557; text-align: right; }

/* ── Missions overview ─────────────────────────────────────────────────────── */
.health-row {
  display: grid; grid-template-columns: 2.5rem 1fr 3rem 1fr;
  align-items: center; gap: 0.75rem;
}
.health-row-label { font-size: 0.72rem; font-weight: 700; color: #89a; letter-spacing: 0.08em; }
.health-row-track {
  height: 8px; background: #0d0f1a; border-radius: 4px; overflow: hidden;
}
.health-row-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.health-row-pct  { font-size: 0.8rem; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.health-row-detail { font-size: 0.65rem; color: #446; letter-spacing: 0.05em; }
.overdue-txt { color: #c0392b; }

.turnin-row {
  display: grid; grid-template-columns: 2.5rem 1fr 4rem 3.5rem;
  align-items: center; gap: 0.75rem;
}
.turnin-label { font-size: 0.72rem; font-weight: 700; color: #89a; letter-spacing: 0.08em; }
.turnin-bar-wrap { }
.turnin-bar {
  display: flex; height: 16px; border-radius: 3px; overflow: hidden;
  background: #0d0f1a;
}
.turnin-bar--empty { height: 16px; border-radius: 3px; }
.turnin-seg { height: 100%; transition: width 0.5s ease; }
.turnin-seg--graded   { background: #4FAE6A; }
.turnin-seg--awaiting { background: #4d99ee; }
.turnin-seg--assigned { background: #1e2240; }
.turnin-count {
  font-size: 0.8rem; font-weight: 700; color: #c8d0e0; text-align: right;
  font-variant-numeric: tabular-nums;
}
.turnin-denom { font-size: 0.65rem; color: #446; font-weight: 400; }
.turnin-pct {
  font-size: 0.78rem; font-weight: 700; padding: 0.1rem 0.35rem;
  border-radius: 3px; text-align: center;
}
.turnin-legend {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding-top: 0.75rem; border-top: 1px solid #1e2240; margin-top: 0.25rem;
}
.tl-dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 2px; flex-shrink: 0;
}
.tl-dot--graded   { background: #4FAE6A; }
.tl-dot--awaiting { background: #4d99ee; }
.tl-dot--assigned { background: #1e2240; border: 1px solid #2d3050; }
.tl-text { font-size: 0.65rem; color: #557; letter-spacing: 0.06em; text-transform: uppercase; }

/* ── Trends placeholder ────────────────────────────────────────────────────── */
.trends-placeholder {
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 4px;
  padding: 2.5rem 2rem;
  text-align: center;
  margin-top: 0.5rem;
}
.trends-icon    { font-size: 2.5rem; margin-bottom: 0.75rem; }
.trends-heading {
  font-size: 1rem;
  font-weight: 700;
  color: var(--almond-creme, #fba);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}
.trends-body {
  font-size: 0.82rem;
  color: #668;
  max-width: 380px;
  margin: 0 auto 1.25rem;
  line-height: 1.5;
}
.trends-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}
.trends-item {
  background: #0d0f1a;
  border: 1px solid #1e2240;
  border-radius: 3px;
  color: #446;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  padding: 0.35rem 0.75rem;
  text-transform: uppercase;
}
</style>
