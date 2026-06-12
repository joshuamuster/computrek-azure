<template>
  <section class="adventure-page rpt-page">
    <div class="lcars-text-bar"><span>Reports</span></div>

    <div ref="shellRef" class="rpt-shell">

      <!-- ═══════════════════ STICKY HEAD ══════════════════════════════ -->
      <div ref="stickyHeadRef" class="rpt-sticky-head" :style="stuckStyle">

        <!-- ── Title + Tab bar ──────────────────────────────────────── -->
        <div class="rpt-header">
          <div>
            <div class="rpt-title">{{ userInfo?.displayName ?? 'Administrator' }}</div>
            <div class="rpt-sub">Analytics Console</div>
          </div>
          <div class="tab-bar">
            <button
              v-for="tab in TABS"
              :key="tab.id"
              :class="['tab-btn', { 'tab-btn--active': activeTab === tab.id }]"
              @click="switchTab(tab.id)"
            >{{ tab.label }}</button>
          </div>
        </div>

        <!-- Period selector: EOP / By Student / Trends tabs -->
        <div class="period-row" v-if="['eop', 'student', 'trends'].includes(activeTab)">
          <span class="period-row-label">PERIOD</span>
          <div class="period-pills">
            <button
              v-for="p in availablePeriods"
              :key="p.id"
              :class="['period-pill', { 'period-pill--active': viewPeriodId === p.id }]"
              @click="selectPeriod(p.id)"
            >{{ shortLabel(p.id) }}</button>
          </div>
        </div>

        <!-- By Student: search toolbar (when period is selected) -->
        <div class="roster-toolbar" v-if="activeTab === 'student' && viewPeriodId">
          <input
            v-model="studentSearch"
            class="search-input"
            placeholder="Search cadets…"
            type="search"
          />
          <label class="at-risk-toggle">
            <input type="checkbox" v-model="atRiskOnly" class="at-risk-checkbox" />
            <span class="at-risk-label">At-risk only</span>
            <span v-if="alertByUid.size > 0" class="at-risk-count">{{ alertByUid.size }}</span>
          </label>
          <span class="roster-count">{{ filteredRoster.length }} cadet{{ filteredRoster.length !== 1 ? 's' : '' }}</span>
        </div>

        <!-- Typing: sub-tab bar -->
        <div class="typing-sub-bar" v-if="activeTab === 'typing'">
          <button :class="['typing-sub-btn', { 'typing-sub-btn--active': typingSubTab === 'overview' }]" @click="typingSubTab = 'overview'">Overview</button>
          <button :class="['typing-sub-btn', { 'typing-sub-btn--active': typingSubTab === 'period'   }]" @click="typingSubTab = 'period'">By Period</button>
          <button :class="['typing-sub-btn', { 'typing-sub-btn--active': typingSubTab === 'cadets'   }]" @click="typingSubTab = 'cadets'">All Cadets</button>
        </div>

        <!-- Typing > By Period: drill period selector -->
        <div class="period-row" v-if="activeTab === 'typing' && typingSubTab === 'period'">
          <span class="period-row-label">PERIOD</span>
          <div class="period-pills">
            <button
              v-for="p in availablePeriods"
              :key="p.id"
              :class="['period-pill', { 'period-pill--active': typingDrillPeriodId === p.id }]"
              @click="typingDrillPeriodId = p.id"
            >{{ shortLabel(p.id) }}</button>
          </div>
        </div>

        <!-- Typing > All Cadets: search + period filter + result count -->
        <template v-if="activeTab === 'typing' && typingSubTab === 'cadets' && typingDashData">
          <div class="ty-controls">
            <div class="ty-search-wrap">
              <input v-model="typingSearchQ" class="search-input ty-search-input" type="text" placeholder="Search cadet name…" />
              <button v-if="typingSearchQ" class="ty-search-clear" @click="typingSearchQ = ''">✕</button>
            </div>
            <div class="period-row" style="margin-bottom:0">
              <span class="period-row-label">PERIOD</span>
              <div class="period-pills">
                <button :class="['period-pill', { 'period-pill--active': typingPeriodFilter === '' }]" @click="typingPeriodFilter = ''">ALL</button>
                <button
                  v-for="p in availablePeriods"
                  :key="p.id"
                  :class="['period-pill', { 'period-pill--active': typingPeriodFilter === p.id }]"
                  @click="typingPeriodFilter = p.id"
                >{{ shortLabel(p.id) }}</button>
              </div>
            </div>
          </div>
          <div class="ty-meta-row">
            <span class="ty-result-count">
              {{ filteredTypingStudents.length }} cadet{{ filteredTypingStudents.length !== 1 ? 's' : '' }}<template v-if="typingSearchQ || typingPeriodFilter"> matching</template>
            </span>
          </div>
        </template>

      </div><!-- /rpt-sticky-head -->
      <!-- spacer holds layout space when head is position:fixed -->
      <div v-if="isStuck" :style="{ height: spacerHeight + 'px' }"></div>
      <!-- ════════════════════════════════════════════════════════════ -->

      <!-- No period selected prompt (not shown on overview tabs) -->
      <div v-if="!viewPeriodId && !overviewTabs.has(activeTab)" class="empty-state">
        Select a period above to load report data.
      </div>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- TAB 1: End of Period                                          -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'eop' && viewPeriodId">

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
      <template v-if="activeTab === 'student' && viewPeriodId">

        <!-- roster-toolbar moved to sticky head -->

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
            :class="{ 'roster-row--atrisk': alertByUid.has(row.uid) }"
          >
            <div class="col-name">
              <span class="cadet-name">{{ row.displayName }}</span>
              <!-- Risk factor chips -->
              <template v-if="alertByUid.has(row.uid)">
                <div class="risk-chips">
                  <span
                    class="risk-chip"
                    :style="{ background: riskColor(alertByUid.get(row.uid)!.riskLevel) + '22', color: riskColor(alertByUid.get(row.uid)!.riskLevel), borderColor: riskColor(alertByUid.get(row.uid)!.riskLevel) + '55' }"
                    v-for="(f, i) in alertByUid.get(row.uid)!.factors"
                    :key="i"
                  >{{ f }}</span>
                </div>
              </template>
            </div>
            <div class="col-stat">
              <!-- Conduct score pips (0–4), color-coded via pipColor/pipFilled -->
              <div class="pip-row">
                <span
                  v-for="i in 4"
                  :key="i"
                  :class="['pip', pipFilled(row.conductScore, i) ? 'pip--filled' : 'pip--empty']"
                  :style="pipFilled(row.conductScore, i)
                    ? { background: pipColor(row.conductScore), borderColor: pipColor(row.conductScore) }
                    : {}"
                ></span>
              </div>
              <span class="pip-label" :style="{ color: pipColor(row.conductScore) }">{{ conductLabel(row.conductScore) }}</span>
            </div>
            <div class="col-stat">
              <span :class="['wpm-val', wpmTier(row.latestWpm)]">
                {{ row.latestWpm != null ? row.latestWpm + ' wpm' : '—' }}
              </span>
              <span
                v-if="alertByUid.get(row.uid)?.wpmTrend"
                class="trend-arrow"
                :class="`trend-arrow--${alertByUid.get(row.uid)!.wpmTrend}`"
              >{{ trendIcon(alertByUid.get(row.uid)!.wpmTrend) }}</span>
            </div>
            <div class="col-stat">
              <span
                v-if="row.turnInRate != null"
                :class="['turnin-badge', turnInTier(row.turnInRate)]"
              >{{ row.turnInRate }}%</span>
              <span v-else class="turnin-badge">—</span>
              <span
                v-if="alertByUid.get(row.uid)?.turnInTrend"
                class="trend-arrow"
                :class="`trend-arrow--${alertByUid.get(row.uid)!.turnInTrend}`"
              >{{ trendIcon(alertByUid.get(row.uid)!.turnInTrend) }}</span>
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
      <template v-if="activeTab === 'trends' && viewPeriodId">
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
      <!-- TAB: Typing                                                    -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'typing'">

        <!-- typing-sub-bar moved to sticky head -->

        <div v-if="typingDashLoading" class="loading-row">
          <div class="loading-pill">Loading typing data…</div>
        </div>
        <div v-else-if="!typingDashData" class="empty-state">
          No typing sessions recorded yet.
        </div>

        <template v-else>

          <!-- ── Overview ──────────────────────────────────────────────── -->
          <template v-if="typingSubTab === 'overview'">
            <div v-if="!periodTypingStats.length" class="empty-state">No data yet.</div>
            <template v-else>
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
                  <span v-for="k in typingDashData.missedKeys.slice(0, 5)" :key="k.key" class="ov-key-chip">{{ k.key }}</span>
                </span>
              </div>
              <div class="ov-period-grid">
                <div v-for="p in periodTypingStats" :key="p.periodId" class="ov-period-card">
                  <div class="opc-accent-bar" :style="{ background: wpmColor(p.avgWpm) }"></div>
                  <div class="opc-header">
                    <span class="opc-label">{{ shortLabel(p.periodId) }}</span>
                    <span class="opc-sessions">{{ p.sessions }} sessions</span>
                  </div>
                  <div class="opc-wpm" :style="{ color: wpmColor(p.avgWpm) }">{{ p.avgWpm }}</div>
                  <div class="opc-wpm-label">avg WPM</div>
                  <div class="opc-divider"></div>
                  <div class="opc-stats">
                    <div class="opc-stat"><div class="opc-stat-val">{{ p.bestWpm }}</div><div class="opc-stat-label">best WPM</div></div>
                    <div class="opc-stat"><div class="opc-stat-val">{{ p.avgAccuracy }}%</div><div class="opc-stat-label">accuracy</div></div>
                    <div class="opc-stat"><div class="opc-stat-val">{{ p.students }}</div><div class="opc-stat-label">students</div></div>
                  </div>
                </div>
              </div>
              <div class="ov-section-title">TOP CADETS</div>
              <div class="ov-top-students">
                <div v-for="(s, i) in typingDashData.topStudents.slice(0, 10)" :key="s.uid" class="ov-top-row">
                  <span class="ov-top-rank">#{{ i + 1 }}</span>
                  <span class="ov-top-name">{{ s.displayName }}</span>
                  <span class="ov-top-period">{{ shortLabel(s.periodId) }}</span>
                  <span class="ov-top-wpm" :style="{ color: wpmColor(s.bestWpm) }">{{ s.bestWpm }} wpm</span>
                  <span class="ov-top-avg">avg {{ s.avgWpm }}</span>
                </div>
              </div>
            </template>
          </template>

          <!-- ── By Period ─────────────────────────────────────────────── -->
          <template v-else-if="typingSubTab === 'period'">

            <!-- period-row moved to sticky head -->

            <div v-if="!typingDrillPeriodId" class="empty-state">
              Select a period above to view student progress.
            </div>

            <template v-else>
              <div v-if="typingDrillStat" class="ty-summary">
                <div class="ty-summary-chip"><span class="ty-summary-val">{{ typingDrillStat.students }}</span><span class="ty-summary-lbl">Students Active</span></div>
                <div class="ty-summary-chip"><span class="ty-summary-val">{{ typingDrillStat.sessions }}</span><span class="ty-summary-lbl">Total Sessions</span></div>
                <div class="ty-summary-chip"><span class="ty-summary-val">{{ typingDrillStat.bestWpm }}</span><span class="ty-summary-lbl">Period Best WPM</span></div>
                <div class="ty-summary-chip"><span class="ty-summary-val">{{ typingDrillStat.avgWpm }}</span><span class="ty-summary-lbl">Period Avg WPM</span></div>
                <div class="ty-summary-chip"><span class="ty-summary-val">{{ typingDrillStat.avgAccuracy }}%</span><span class="ty-summary-lbl">Avg Accuracy</span></div>
              </div>

              <div v-if="sortedDrillStudents.length === 0" class="empty-state">
                No students in this period have completed a typing session yet.
              </div>
              <template v-else>
                <div class="ty-table">
                  <div class="ty-thead ty-thead--period">
                    <span class="ty-th ty-th--name sortable" @click="setProgSort('displayName')">CADET {{ progSortIcon('displayName') }}</span>
                    <span class="ty-th sortable" @click="setProgSort('sessions')">SESSIONS {{ progSortIcon('sessions') }}</span>
                    <span class="ty-th sortable" @click="setProgSort('bestWpm')">BEST WPM {{ progSortIcon('bestWpm') }}</span>
                    <span class="ty-th sortable" @click="setProgSort('avgWpm')">AVG WPM {{ progSortIcon('avgWpm') }}</span>
                    <span class="ty-th sortable" @click="setProgSort('avgAccuracy')">ACCURACY {{ progSortIcon('avgAccuracy') }}</span>
                    <span class="ty-th sortable" @click="setProgSort('lastActive')">LAST ACTIVE {{ progSortIcon('lastActive') }}</span>
                  </div>
                  <div
                    v-for="(s, i) in sortedDrillStudents"
                    :key="s.uid"
                    class="ty-row"
                    :class="{ 'ty-row--alt': i % 2 === 1 }"
                  >
                    <span class="ty-td ty-td--name">{{ s.displayName }}</span>
                    <span class="ty-td ty-td--num">{{ s.sessions }}</span>
                    <span class="ty-td ty-td--wpm">
                      <span :class="['ty-wpm-val', wpmClass(s.bestWpm, typingDrillBestWpm)]">{{ s.bestWpm }}</span>
                      <span class="ty-wpm-bar"><span class="ty-wpm-fill" :style="{ width: typingDrillBestWpm ? (s.bestWpm / typingDrillBestWpm * 100) + '%' : '0%' }"></span></span>
                    </span>
                    <span class="ty-td ty-td--num">{{ s.avgWpm }}</span>
                    <span :class="['ty-td', 'ty-td--acc', accClass(s.avgAccuracy)]">{{ s.avgAccuracy }}%</span>
                    <span class="ty-td ty-td--date">{{ formatLastActive(s.lastActive) }}</span>
                  </div>
                </div>
                <p class="ty-footnote">Only cadets with at least one completed session appear here.</p>
              </template>
            </template>
          </template>

          <!-- ── All Cadets ─────────────────────────────────────────────── -->
          <template v-else-if="typingSubTab === 'cadets'">

            <!-- ty-controls and ty-meta-row moved to sticky head -->

            <div v-if="filteredTypingStudents.length === 0" class="empty-state">
              No cadets match your search or filter.
            </div>
            <template v-else>
              <div class="ty-table ty-table--wide">
                <div class="ty-thead ty-thead--cadets">
                  <span class="ty-th ty-th--name sortable" @click="setStudSort('displayName')">CADET {{ studSortIcon('displayName') }}</span>
                  <span class="ty-th sortable" @click="setStudSort('periodId')">PERIOD {{ studSortIcon('periodId') }}</span>
                  <span class="ty-th sortable" @click="setStudSort('sessions')">SESSIONS {{ studSortIcon('sessions') }}</span>
                  <span class="ty-th sortable" @click="setStudSort('bestWpm')">BEST WPM {{ studSortIcon('bestWpm') }}</span>
                  <span class="ty-th sortable" @click="setStudSort('avgWpm')">AVG WPM {{ studSortIcon('avgWpm') }}</span>
                  <span class="ty-th sortable" @click="setStudSort('avgAccuracy')">ACCURACY {{ studSortIcon('avgAccuracy') }}</span>
                  <span class="ty-th sortable" @click="setStudSort('lastActive')">LAST ACTIVE {{ studSortIcon('lastActive') }}</span>
                </div>
                <div
                  v-for="(s, i) in filteredTypingStudents"
                  :key="s.uid"
                  class="ty-row"
                  :class="{ 'ty-row--alt': i % 2 === 1 }"
                >
                  <span class="ty-td ty-td--name">{{ s.displayName }}</span>
                  <span class="ty-td ty-td--period">{{ shortLabel(s.periodId) }}</span>
                  <span class="ty-td ty-td--num">{{ s.sessions }}</span>
                  <span class="ty-td ty-td--wpm">
                    <span :class="['ty-wpm-val', wpmClass(s.bestWpm, typingStudBestWpm)]">{{ s.bestWpm }}</span>
                    <span class="ty-wpm-bar"><span class="ty-wpm-fill" :style="{ width: typingStudBestWpm ? (s.bestWpm / typingStudBestWpm * 100) + '%' : '0%' }"></span></span>
                  </span>
                  <span class="ty-td ty-td--num">{{ s.avgWpm }}</span>
                  <span :class="['ty-td', 'ty-td--acc', accClass(s.avgAccuracy)]">{{ s.avgAccuracy }}%</span>
                  <span class="ty-td ty-td--date">{{ formatLastActive(s.lastActive) }}</span>
                </div>
              </div>
              <p class="ty-footnote">Only cadets with at least one completed session appear here.</p>
            </template>
          </template>

        </template>
      </template>

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!-- TAB: Weekly Summary                                            -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'weekly'">
        <div class="weekly-header">
          <div class="weekly-week-label">Week of {{ getMondayStr() }}</div>
          <button class="ov-refresh-btn" @click="loadWeeklySummary">Refresh</button>
          <button class="ov-refresh-btn weekly-print-btn" @click="printWeekly">Print</button>
        </div>

        <div v-if="weeklyLoading" class="loading-row">
          <div class="loading-pill">Scanning all periods…</div>
        </div>

        <div v-else-if="weeklyPeriods.every(p => p.alerts.length === 0)" class="empty-state">
          No at-risk cadets this week — all clear.
        </div>

        <template v-else>
          <div
            v-for="p in weeklyPeriods"
            :key="p.periodId"
            class="weekly-period-section"
          >
            <div class="weekly-period-heading">{{ p.label }}</div>

            <div v-if="p.alerts.length === 0" class="weekly-period-clear">All clear — no at-risk cadets.</div>

            <div v-else class="weekly-alert-list">
              <div
                v-for="alert in p.alerts"
                :key="alert.uid"
                class="weekly-alert-row"
              >
                <span
                  class="weekly-risk-dot"
                  :style="{ background: riskColor(alert.riskLevel) }"
                ></span>
                <span class="weekly-cadet-name">{{ alert.displayName }}</span>
                <div class="weekly-factors">
                  <span
                    v-for="(f, i) in alert.factors"
                    :key="i"
                    class="risk-chip"
                    :style="{ background: riskColor(alert.riskLevel) + '22', color: riskColor(alert.riskLevel), borderColor: riskColor(alert.riskLevel) + '55' }"
                  >{{ f }}</span>
                </div>
                <span
                  v-if="alert.wpmTrend"
                  class="trend-arrow"
                  :class="`trend-arrow--${alert.wpmTrend}`"
                  title="WPM trend"
                >{{ trendIcon(alert.wpmTrend) }}</span>
              </div>
            </div>
          </div>

          <div class="weekly-footer">
            Students to call parents about this week: {{ weeklyPeriods.reduce((n, p) => n + p.alerts.length, 0) }} cadet{{ weeklyPeriods.reduce((n, p) => n + p.alerts.length, 0) !== 1 ? 's' : '' }}
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { usePeriodSelector } from '@/composables/usePeriodSelector'
import { useEndOfPeriodReport } from '@/composables/useEndOfPeriodReport'
import { useTypingDashboard } from '@/composables/useTypingDashboard'
import { useShipStatus } from '@/composables/useShipStatus'
import { useStruggleDetection, type StudentAlert, type TrendDir } from '@/composables/useStruggleDetection'
import { PERIOD_IDS, SCHOOL_YEAR_ID } from '@/config/schoolYear'
import { pipColor, pipFilled } from '@/composables/useConductScore'

// ── Auth & period ─────────────────────────────────────────────────────────────

const { userInfo, isAdmin, isAudit, effectiveTeacherEmail } = useAuth()
const { selectedPeriodId: activePeriodId } = usePeriodSelector()

// Local "viewing" period for this page — controls which report data displays.
// Independent of the global HUD/broadcast period; defaults to whichever
// period is "Active" when the page loads.
const viewPeriodId = ref<string | null>(activePeriodId.value)

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
  viewPeriodId.value = id
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'eop',     label: 'End of Period'    },
  { id: 'student', label: 'By Student'       },
  { id: 'typing',  label: 'Typing'           },
  { id: 'missions',label: 'Missions'         },
  { id: 'trends',  label: 'Trends'           },
  { id: 'weekly',  label: 'Weekly Summary'   },
] as const

type TabId = typeof TABS[number]['id']
const activeTab = ref<TabId>('eop')

const overviewTabs = new Set<TabId>(['typing', 'missions', 'weekly'])

function switchTab(id: TabId) {
  activeTab.value = id
  if (id === 'student'  && viewPeriodId.value) loadRoster()
  if (id === 'typing')   loadTypingOverview()
  if (id === 'missions') loadMissionsOverview()
  if (id === 'weekly')   loadWeeklySummary()
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

// ── Typing sub-tabs ────────────────────────────────────────────────────────────

type TypingSubTab = 'overview' | 'period' | 'cadets'
const typingSubTab = ref<TypingSubTab>('overview')

// ── Typing: By Period ──────────────────────────────────────────────────────────

const typingDrillPeriodId = ref('')

const typingDrillStat = computed(() =>
  typingDashData.value?.periods.find(p => p.periodId === typingDrillPeriodId.value) ?? null
)

const typingDrillStudents = computed(() =>
  typingDashData.value?.allStudents.filter(s => s.periodId === typingDrillPeriodId.value) ?? []
)

const typingDrillBestWpm = computed(() =>
  typingDrillStudents.value.reduce((max, s) => Math.max(max, s.bestWpm), 0)
)

type ProgSortKey = 'displayName' | 'sessions' | 'bestWpm' | 'avgWpm' | 'avgAccuracy' | 'lastActive'
const progSortKey = ref<ProgSortKey>('displayName')
const progSortDir = ref<'asc' | 'desc'>('asc')

function setProgSort(key: ProgSortKey) {
  if (progSortKey.value === key) progSortDir.value = progSortDir.value === 'asc' ? 'desc' : 'asc'
  else { progSortKey.value = key; progSortDir.value = key === 'displayName' ? 'asc' : 'desc' }
}
function progSortIcon(key: string) {
  return progSortKey.value !== key ? '⇅' : progSortDir.value === 'asc' ? '↑' : '↓'
}

const sortedDrillStudents = computed(() =>
  [...typingDrillStudents.value].sort((a, b) => {
    let cmp = 0
    if (progSortKey.value === 'displayName')  cmp = a.displayName.localeCompare(b.displayName)
    else if (progSortKey.value === 'lastActive') cmp = (a.lastActive?.getTime() ?? 0) - (b.lastActive?.getTime() ?? 0)
    else cmp = (a[progSortKey.value] as number) - (b[progSortKey.value] as number)
    return progSortDir.value === 'asc' ? cmp : -cmp
  })
)

// ── Typing: All Cadets ─────────────────────────────────────────────────────────

const typingSearchQ      = ref('')
const typingPeriodFilter = ref('')

type StudSortKey = 'displayName' | 'periodId' | 'sessions' | 'bestWpm' | 'avgWpm' | 'avgAccuracy' | 'lastActive'
const studSortKey = ref<StudSortKey>('displayName')
const studSortDir = ref<'asc' | 'desc'>('asc')

function setStudSort(key: StudSortKey) {
  if (studSortKey.value === key) studSortDir.value = studSortDir.value === 'asc' ? 'desc' : 'asc'
  else { studSortKey.value = key; studSortDir.value = (key === 'displayName' || key === 'periodId') ? 'asc' : 'desc' }
}
function studSortIcon(key: string) {
  return studSortKey.value !== key ? '⇅' : studSortDir.value === 'asc' ? '↑' : '↓'
}

const filteredTypingStudents = computed(() => {
  if (!typingDashData.value) return []
  let list = typingDashData.value.allStudents
  if (typingPeriodFilter.value) list = list.filter(s => s.periodId === typingPeriodFilter.value)
  const q = typingSearchQ.value.trim().toLowerCase()
  if (q) list = list.filter(s => s.displayName.toLowerCase().includes(q))
  return [...list].sort((a, b) => {
    let cmp = 0
    if (studSortKey.value === 'displayName')  cmp = a.displayName.localeCompare(b.displayName)
    else if (studSortKey.value === 'periodId') cmp = a.periodId.localeCompare(b.periodId)
    else if (studSortKey.value === 'lastActive') cmp = (a.lastActive?.getTime() ?? 0) - (b.lastActive?.getTime() ?? 0)
    else cmp = (a[studSortKey.value] as number) - (b[studSortKey.value] as number)
    return studSortDir.value === 'asc' ? cmp : -cmp
  })
})

const typingStudBestWpm = computed(() =>
  filteredTypingStudents.value.reduce((max, s) => Math.max(max, s.bestWpm), 0)
)

// ── Typing display helpers ─────────────────────────────────────────────────────

function wpmClass(wpm: number, best: number | undefined): string {
  if (!best) return ''
  const ratio = wpm / best
  if (ratio >= 0.85) return 'wpm--high'
  if (ratio >= 0.55) return 'wpm--mid'
  return 'wpm--low'
}

function accClass(acc: number): string {
  if (acc >= 96) return 'acc--high'
  if (acc >= 88) return 'acc--mid'
  return 'acc--low'
}

function formatLastActive(d: Date | null): string {
  if (!d) return '—'
  const now  = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

const studentSearch    = ref('')
const atRiskOnly       = ref(false)

// ── Struggle detection ────────────────────────────────────────────────────────

const { alerts: rosterAlerts, loading: alertsLoading, fetchAlerts } = useStruggleDetection()

// Map for quick lookup: uid → alert
const alertByUid = computed(() => {
  const m = new Map<string, StudentAlert>()
  rosterAlerts.value.forEach(a => m.set(a.uid, a))
  return m
})

const filteredRoster = computed(() => {
  let list = roster.value
  if (atRiskOnly.value) list = list.filter(r => alertByUid.value.has(r.uid))
  const q = studentSearch.value.toLowerCase().trim()
  return q ? list.filter(r => r.displayName.toLowerCase().includes(q)) : list
})

function trendIcon(dir: TrendDir): string {
  if (dir === 'up')   return '↑'
  if (dir === 'down') return '↓'
  if (dir === 'flat') return '→'
  return ''
}

function riskColor(level: string): string {
  if (level === 'high')   return '#c0392b'
  if (level === 'medium') return '#ff9900'
  return '#e3c720'
}

// ── Weekly summary ────────────────────────────────────────────────────────────

interface PeriodAlerts {
  periodId:  string
  label:     string
  alerts:    StudentAlert[]
  loading:   boolean
}

const weeklyPeriods   = ref<PeriodAlerts[]>([])
const weeklyLoading   = ref(false)

function getMondayStr(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function printWeekly() { window.print() }

async function loadWeeklySummary() {
  const email   = effectiveTeacherEmail.value
  const periods = availablePeriods.value
  if (!periods.length) return
  weeklyLoading.value = true
  weeklyPeriods.value = []

  await Promise.all(periods.map(async p => {
    const { alerts: pAlerts, loading: pLoading, fetchAlerts: pFetch } = useStruggleDetection()
    await pFetch(p.id, email ?? undefined)
    weeklyPeriods.value.push({ periodId: p.id, label: p.label, alerts: pAlerts.value, loading: false })
  }))

  // Sort by period id
  weeklyPeriods.value.sort((a, b) => a.periodId.localeCompare(b.periodId))
  weeklyLoading.value = false
}

async function loadEndOfPeriod() {
  if (!viewPeriodId.value) return
  await fetchEndOfPeriod(
    viewPeriodId.value,
    effectiveTeacherEmail.value,
    selectedDate.value,
  )
}

async function loadRoster() {
  if (!viewPeriodId.value) return
  await Promise.all([
    fetchRoster(viewPeriodId.value, effectiveTeacherEmail.value),
    fetchAlerts(viewPeriodId.value, effectiveTeacherEmail.value ?? undefined),
  ])
}

// Reload when period or date changes
watch(viewPeriodId, () => {
  if (activeTab.value === 'eop')     loadEndOfPeriod()
  if (activeTab.value === 'student') loadRoster()
})

watch(selectedDate, () => {
  if (activeTab.value === 'eop' && viewPeriodId.value) loadEndOfPeriod()
})

// ── Sticky head (JS-based — flex scroll containers block CSS sticky) ──────────

const stickyHeadRef = ref<HTMLElement>()
const shellRef       = ref<HTMLElement>()
const isStuck        = ref(false)
const stuckLeft      = ref(0)
const stuckWidth     = ref(0)
const spacerHeight   = ref(0)

const stuckStyle = computed(() =>
  isStuck.value
    ? { position: 'fixed' as const, top: '15rem', left: `${stuckLeft.value}px`, width: `${stuckWidth.value}px`,
        zIndex: '100' }
    : {}
)

let _scrollEl: HTMLElement | null = null
let _naturalOffset = 0

function getHeadPosition() {
  if (!shellRef.value) return
  // Compute from shell rect minus its horizontal padding so the fixed
  // header occupies the same content column regardless of sidebar state.
  const style  = window.getComputedStyle(shellRef.value)
  const padL   = parseFloat(style.paddingLeft)
  const padR   = parseFloat(style.paddingRight)
  const rect   = shellRef.value.getBoundingClientRect()
  stuckLeft.value  = rect.left + padL
  stuckWidth.value = rect.width - padL - padR
}

function updateStuck() {
  if (!_scrollEl || !stickyHeadRef.value || !shellRef.value) return
  const stuck = _scrollEl.scrollTop >= _naturalOffset
  if (stuck !== isStuck.value) {
    isStuck.value = stuck
    if (stuck) {
      const s = window.getComputedStyle(stickyHeadRef.value)
      spacerHeight.value = stickyHeadRef.value.offsetHeight + parseFloat(s.marginBottom)
      getHeadPosition()
    } else {
      spacerHeight.value = 0
    }
  } else if (stuck) {
    // Keep position in sync during resize events
    getHeadPosition()
  }
}

const route = useRoute()

onMounted(async () => {
  await nextTick()
  _scrollEl = document.querySelector<HTMLElement>('.main-scroll')
  if (!_scrollEl || !stickyHeadRef.value) return
  const scrollRect = _scrollEl.getBoundingClientRect()
  const headRect   = stickyHeadRef.value.getBoundingClientRect()
  _naturalOffset   = headRect.top - scrollRect.top + _scrollEl.scrollTop
  _scrollEl.addEventListener('scroll', updateStuck, { passive: true })
  window.addEventListener('resize',   updateStuck, { passive: true })

  // Support deep-link from AdminDashboard: ?tab=student&period=X&atRisk=1
  const qTab    = route.query.tab    as string | undefined
  const qPeriod = route.query.period as string | undefined
  const qAtRisk = route.query.atRisk as string | undefined
  if (qPeriod && availablePeriods.value.some(p => p.id === qPeriod)) {
    viewPeriodId.value = qPeriod
  }
  if (qTab && TABS.some(t => t.id === qTab)) {
    activeTab.value = qTab as TabId
  }
  if (qAtRisk === '1') atRiskOnly.value = true

  if (activeTab.value === 'student' && viewPeriodId.value) loadRoster()
  else if (viewPeriodId.value) loadEndOfPeriod()
})

onUnmounted(() => {
  _scrollEl?.removeEventListener('scroll', updateStuck)
  window.removeEventListener('resize', updateStuck)
})

// Re-measure spacer when sticky head content changes height (tab / subtab switch)
watch([activeTab, typingSubTab, viewPeriodId], async () => {
  if (!isStuck.value || !stickyHeadRef.value) return
  await nextTick()
  const s = window.getComputedStyle(stickyHeadRef.value)
  spacerHeight.value = stickyHeadRef.value.offsetHeight + parseFloat(s.marginBottom)
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
  padding: 0 1.5rem 1.25rem;
  max-width: 980px;
}

/* ── Sticky Head ───────────────────────────────────────────────────────────── */
/* position:fixed toggled via JS (CSS sticky unreliable in flex scroll containers) */
.rpt-sticky-head {
  background: #0d0f1a;
  padding: 1.25rem;
  border-bottom: 2px solid #2d3050;
  margin-bottom: 1.25rem;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.rpt-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 0 1rem;
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
  grid-template-columns: 1fr 140px 130px 110px 70px;
  align-items: start;
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

/* Conduct pips — color is applied via inline :style; class just handles shape */
.pip-row { display: flex; gap: 3px; justify-content: center; margin-bottom: 2px; }
.pip {
  width: 8px; height: 8px;
  border-radius: 50%;
  border: 1px solid #2d3050;
}
.pip--empty  { background: transparent; }
.pip-label {
  display: block;
  font-size: 0.6rem;
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

/* ── Typing sub-tabs ───────────────────────────────────────────────────────── */
.typing-sub-bar {
  display: flex;
  gap: 0.25rem;
  background: #0d0f1a;
  border: 1px solid #2d3050;
  border-radius: 4px;
  padding: 3px;
  width: fit-content;
  margin-bottom: 1rem;
}
.typing-sub-btn {
  background: transparent;
  border: none;
  border-radius: 3px;
  color: #668;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0.3rem 0.75rem;
  text-transform: uppercase;
  transition: background 0.15s, color 0.15s;
}
.typing-sub-btn:hover { color: #89a; background: #12141f; }
.typing-sub-btn--active { background: #1e2240; color: #4d99ee; }

/* ── Typing: By Period summary chips ──────────────────────────────────────── */
.ty-summary {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.ty-summary-chip {
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0.9rem;
  min-width: 5rem;
}
.ty-summary-val {
  font-family: 'Antonio', sans-serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: #4d99ee;
  line-height: 1;
}
.ty-summary-lbl {
  font-size: 0.6rem;
  color: #446;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-top: 0.2rem;
  white-space: nowrap;
}

/* ── Typing: All Cadets controls ──────────────────────────────────────────── */
.ty-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.ty-search-wrap {
  position: relative;
  flex: 1 1 200px;
  max-width: 280px;
}
.ty-search-input { padding-right: 2rem; }
.ty-search-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #557;
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1;
}
.ty-search-clear:hover { color: #4d99ee; }
.ty-meta-row { margin-bottom: 0.5rem; }
.ty-result-count {
  font-size: 0.7rem;
  color: #446;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ── Typing: sortable tables ─────────────────────────────────────────────── */
.ty-table {
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 4px;
  overflow: hidden;
}

.ty-thead, .ty-row {
  display: grid;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
}

/* By Period: 6 columns */
.ty-thead--period { grid-template-columns: 1.8fr 0.65fr 1.1fr 0.65fr 0.75fr 0.85fr; }
.ty-table:not(.ty-table--wide) .ty-row { grid-template-columns: 1.8fr 0.65fr 1.1fr 0.65fr 0.75fr 0.85fr; }

/* All Cadets: 7 columns */
.ty-thead--cadets { grid-template-columns: 1.5fr 0.5fr 0.65fr 1.1fr 0.65fr 0.72fr 0.85fr; }
.ty-table--wide .ty-row { grid-template-columns: 1.5fr 0.5fr 0.65fr 1.1fr 0.65fr 0.72fr 0.85fr; }

.ty-thead {
  background: #0d0f1a;
  border-bottom: 1px solid #2d3050;
}
.ty-th {
  font-size: 0.64rem;
  font-weight: 700;
  color: #446;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  user-select: none;
}
.ty-th.sortable { cursor: pointer; }
.ty-th.sortable:hover { color: #4d99ee; }

.ty-row {
  border-bottom: 1px solid #181a2a;
  transition: background 0.1s;
}
.ty-row--alt { background: #0d0f1a; }
.ty-row:last-child { border-bottom: none; }
.ty-row:hover { background: #14162a; }

.ty-td { font-size: 0.82rem; color: #c8d0e0; }
.ty-td--name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ty-td--num  { text-align: center; color: #668; }
.ty-td--date { font-size: 0.72rem; color: #557; }
.ty-td--period { font-size: 0.72rem; font-weight: 700; color: #ff9900; letter-spacing: 0.06em; opacity: 0.8; }

.ty-td--wpm { display: flex; flex-direction: column; gap: 0.15rem; }
.ty-wpm-val { font-size: 0.88rem; font-weight: 700; color: #c8d0e0; }
.ty-wpm-val.wpm--high { color: #5e9f63; }
.ty-wpm-val.wpm--mid  { color: #ff9900; }
.ty-wpm-val.wpm--low  { color: #668; }
.ty-wpm-bar { height: 3px; background: #1e2240; border-radius: 2px; overflow: hidden; }
.ty-wpm-fill { display: block; height: 100%; background: linear-gradient(90deg, #2c5f8f, #4d99ee); border-radius: 2px; transition: width 0.4s ease; }

.ty-td--acc { font-size: 0.82rem; font-weight: 600; }
.ty-td--acc.acc--high { color: #5e9f63; }
.ty-td--acc.acc--mid  { color: #ff9900; }
.ty-td--acc.acc--low  { color: #c0392b; }

.ty-footnote { font-size: 0.7rem; color: #334; margin: 0.4rem 0 0; font-style: italic; }

/* ── At-risk toggle ────────────────────────────────────────────────────────── */
.at-risk-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  user-select: none;
}
.at-risk-checkbox { accent-color: #ff9900; cursor: pointer; }
.at-risk-label {
  font-size: 0.72rem;
  color: #ff9900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}
.at-risk-count {
  background: rgba(255,153,0,0.15);
  border: 1px solid rgba(255,153,0,0.4);
  color: #ff9900;
  font-size: 0.68rem;
  font-weight: 800;
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
  letter-spacing: 0;
}

/* ── Roster at-risk row highlight ──────────────────────────────────────────── */
.roster-row--atrisk {
  border-left: 2px solid rgba(255, 153, 0, 0.4);
}
.roster-row.roster-row--atrisk:hover {
  background: #191410;
}

/* ── Risk chips ────────────────────────────────────────────────────────────── */
.risk-chips {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}
.risk-chip {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.08rem 0.45rem;
  border-radius: 3px;
  border: 1px solid transparent;
  white-space: nowrap;
}

/* ── Trend arrows ──────────────────────────────────────────────────────────── */
.trend-arrow {
  font-size: 0.8rem;
  font-weight: 700;
  margin-left: 0.25rem;
}
.trend-arrow--up   { color: #5e9f63; }
.trend-arrow--down { color: #c0392b; }
.trend-arrow--flat { color: #668; }

/* ── Weekly Summary tab ────────────────────────────────────────────────────── */
.weekly-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.weekly-week-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--almond-creme, #fba);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  flex: 1;
}
.weekly-print-btn { color: #5e9f63; border-color: rgba(94,159,99,0.3); }
.weekly-print-btn:hover { background: rgba(94,159,99,0.1); }

.weekly-period-section {
  margin-bottom: 1.5rem;
}
.weekly-period-heading {
  font-size: 0.72rem;
  font-weight: 700;
  color: #4d99ee;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #1e2240;
}
.weekly-period-clear {
  font-size: 0.78rem;
  color: #5e9f63;
  padding: 0.25rem 0;
  letter-spacing: 0.05em;
}
.weekly-alert-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.weekly-alert-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 0.75rem;
  background: #12141f;
  border: 1px solid #1e2240;
  border-radius: 4px;
  flex-wrap: wrap;
}
.weekly-risk-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.weekly-cadet-name {
  font-size: 0.84rem;
  font-weight: 600;
  color: #c8d0e0;
  min-width: 10rem;
}
.weekly-factors {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  flex: 1;
}
.weekly-footer {
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 4px;
  font-size: 0.82rem;
  color: #89a;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

/* ── Print styles ──────────────────────────────────────────────────────────── */
@media print {
  .rpt-sticky-head,
  .tab-bar,
  .period-row,
  .roster-toolbar,
  .ov-refresh-btn,
  .weekly-print-btn {
    display: none !important;
  }
  body { background: #fff; color: #000; }
  .weekly-period-heading { color: #000; border-color: #ccc; }
  .weekly-cadet-name     { color: #000; }
  .weekly-alert-row      { background: #f9f9f9; border-color: #ddd; }
  .weekly-footer         { background: #f0f0f0; border-color: #ccc; color: #333; }
  .risk-chip             { border-color: #999 !important; }
}

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
