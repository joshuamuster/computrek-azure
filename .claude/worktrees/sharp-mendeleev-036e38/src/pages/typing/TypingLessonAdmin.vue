<template>
  <div class="lesson-admin">
    <div class="lcars-text-bar"><span>Typing Lab — Admin</span></div>

    <!-- Section switcher -->
    <div class="section-bar">
      <button
        class="section-btn"
        :class="{ active: section === 'lessons' }"
        @click="section = 'lessons'; tab = 'lessons'"
      >Structured Lessons</button>
      <button
        class="section-btn"
        :class="{ active: section === 'custom' }"
        @click="section = 'custom'; ctTab = 'list'"
      >Custom Texts</button>
      <button
        class="section-btn"
        :class="{ active: section === 'stats' }"
        @click="openStats"
      >Class Stats</button>
      <button
        class="section-btn"
        :class="{ active: section === 'progress' }"
        @click="openProgress"
      >Period Progress</button>
      <button
        class="section-btn"
        :class="{ active: section === 'student' }"
        @click="openStudent"
      >Student</button>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════
         STRUCTURED LESSONS SECTION
         ════════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'lessons'">

    <!-- Tabs -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: tab === 'lessons' }"
        @click="tab = 'lessons'"
      >Lessons</button>
      <button
        class="tab-btn"
        :class="{ active: tab === 'create' }"
        @click="openCreate"
      >+ New Lesson</button>
    </div>

    <!-- ── Lessons tab ──────────────────────────────────────────────────── -->
    <div v-if="tab === 'lessons'" class="tab-content">


      <!-- Error message -->
      <p v-if="error" class="error-msg">{{ error }}</p>

      <!-- Lesson list -->
      <div v-if="isLoading" class="loading-msg">Loading lessons…</div>
      <div v-else class="lesson-list">
        <div
          v-for="lesson in lessons"
          :key="lesson.id"
          class="lesson-row"
          :class="{ archived: lesson.archived }"
        >
          <!-- Order handle / number -->
          <div class="order-num">#{{ lesson.order + 1 }}</div>

          <!-- Main info -->
          <div class="lesson-info" @click="openEdit(lesson)">
            <div class="lesson-name">
              {{ lesson.title }}
              <span v-if="lesson.isTutorial" class="tutorial-badge">Tutorial</span>
            </div>
            <div class="lesson-meta">
              <span v-if="lesson.focusKeys.length" class="meta-keys">
                Keys: {{ lesson.focusKeys.map(k => k.toUpperCase()).join(' · ') }}
              </span>
              <span v-else class="meta-keys">Full keyboard</span>
              <span class="meta-sep">·</span>
              <span class="meta-chars">{{ lesson.passage.length }} chars</span>
              <span v-if="lesson.archived" class="meta-archived">archived</span>
            </div>
          </div>

          <!-- Row actions -->
          <div class="row-actions">
            <button class="action-btn edit-btn"    @click="openEdit(lesson)">Edit</button>
            <button
              class="action-btn archive-btn"
              @click="toggleArchive(lesson)"
            >{{ lesson.archived ? 'Restore' : 'Archive' }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Create / Edit tab ─────────────────────────────────────────────── -->
    <div v-if="tab === 'create' || tab === 'edit'" class="tab-content form-panel">
      <div class="form-title">{{ tab === 'edit' ? 'Edit Lesson' : 'New Lesson' }}</div>

      <label class="form-label">
        Title
        <input
          v-model="form.title"
          class="lcars-input"
          placeholder="e.g. Left Home Row"
        />
      </label>

      <label class="form-label">
        Description
        <textarea
          v-model="form.description"
          class="lcars-input lcars-textarea"
          placeholder="Brief instructions for students…"
          rows="3"
        />
      </label>

      <label class="form-label">
        Focus Keys
        <input
          v-model="focusKeysRaw"
          class="lcars-input"
          placeholder="a s d f  (space-separated, leave blank for full keyboard)"
        />
        <span class="input-hint">Space-separated list of keys to highlight on the keyboard.</span>
      </label>

      <!-- Preview keyboard with focus keys -->
      <div v-if="parsedFocusKeys.length" class="form-keyboard-wrap">
        <div class="form-keyboard-label">Key Preview</div>
        <TypingKeyboard :focusKeys="parsedFocusKeys" />
      </div>

      <label class="form-label">
        Passage
        <textarea
          v-model="form.passage"
          class="lcars-input lcars-textarea passage-area"
          placeholder="The text students will type…"
          rows="5"
        />
        <span class="input-hint">{{ form.passage.length }} characters</span>
      </label>

      <label class="form-label checkbox-label">
        <input
          v-model="form.isTutorial"
          type="checkbox"
          class="lcars-checkbox"
        />
        <span>This is a Warmup Tutorial lesson</span>
      </label>

      <label class="form-label">
        Order (0 = first)
        <input
          v-model.number="form.order"
          type="number"
          min="0"
          class="lcars-input order-input"
        />
      </label>

      <p v-if="formError" class="error-msg">{{ formError }}</p>

      <div class="form-actions">
        <button
          class="lcars-btn save-btn"
          :disabled="isSaving"
          @click="submitForm"
        >{{ isSaving ? 'Saving…' : tab === 'edit' ? 'Save Changes' : 'Create Lesson' }}</button>
        <button class="lcars-btn cancel-btn" @click="tab = 'lessons'">Cancel</button>
      </div>
    </div>

    </template> <!-- end lessons section -->

    <!-- ════════════════════════════════════════════════════════════════════
         CUSTOM TEXTS SECTION
         ════════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'custom'">

      <!-- Tabs -->
      <div class="tab-bar">
        <button class="tab-btn" :class="{ active: ctTab === 'list' }"   @click="ctTab = 'list'">Passages</button>
        <button class="tab-btn" :class="{ active: ctTab === 'create' }" @click="openCtCreate">+ New Passage</button>
      </div>

      <!-- ── Passage list ──────────────────────────────────────────────── -->
      <div v-if="ctTab === 'list'" class="tab-content">
        <p v-if="ctError" class="error-msg">{{ ctError }}</p>
        <div v-if="ctLoading" class="loading-msg">Loading passages…</div>
        <div v-else-if="ctTexts.length === 0" class="lesson-empty">
          No custom passages yet. Click "+ New Passage" to write your first one.
        </div>
        <div v-else class="lesson-list">
          <div
            v-for="ct in ctTexts"
            :key="ct.id"
            class="lesson-row"
            :class="{ archived: ct.archived }"
          >
            <div class="lesson-info" @click="openCtEdit(ct)">
              <div class="lesson-name">{{ ct.title }}</div>
              <div class="lesson-meta">
                <span v-if="ct.category" class="meta-keys">{{ ct.category }}</span>
                <span class="meta-sep" v-if="ct.category">·</span>
                <span class="meta-chars">{{ ct.passage.length }} chars</span>
                <span v-if="ct.archived" class="meta-archived">archived</span>
              </div>
            </div>
            <div class="row-actions">
              <button class="action-btn edit-btn"    @click="openCtEdit(ct)">Edit</button>
              <button class="action-btn archive-btn" @click="toggleCtArchive(ct)">
                {{ ct.archived ? 'Restore' : 'Archive' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Create / Edit passage form ───────────────────────────────── -->
      <div v-if="ctTab === 'create' || ctTab === 'edit'" class="tab-content form-panel">
        <div class="form-title">{{ ctTab === 'edit' ? 'Edit Passage' : 'New Passage' }}</div>

        <label class="form-label">
          Title
          <input v-model="ctForm.title" class="lcars-input" placeholder="e.g. The Prime Directive" />
        </label>

        <label class="form-label">
          Category <span class="input-hint" style="text-transform:none; letter-spacing:0">(optional — e.g. Trek Quotes, Vocab, Story)</span>
          <input v-model="ctForm.category" class="lcars-input" placeholder="Trek Quotes" />
        </label>

        <label class="form-label">
          Passage
          <textarea
            v-model="ctForm.passage"
            class="lcars-input lcars-textarea passage-area"
            placeholder="Type or paste the passage here…"
            rows="7"
          />
          <span class="input-hint">{{ ctForm.passage.length }} characters</span>
        </label>

        <p v-if="ctFormError" class="error-msg">{{ ctFormError }}</p>

        <div class="form-actions">
          <button class="lcars-btn save-btn" :disabled="ctSaving" @click="submitCtForm">
            {{ ctSaving ? 'Saving…' : ctTab === 'edit' ? 'Save Changes' : 'Create Passage' }}
          </button>
          <button class="lcars-btn cancel-btn" @click="ctTab = 'list'">Cancel</button>
        </div>
      </div>

    </template> <!-- end custom texts section -->

    <!-- ════════════════════════════════════════════════════════════════════
         CLASS STATS SECTION
         ════════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'stats'">

      <div v-if="dashLoading" class="loading-msg">Loading class data…</div>
      <div v-else-if="dashError" class="error-msg">{{ dashError }}</div>

      <template v-else-if="dashData">

        <!-- Summary bar -->
        <div class="stats-summary">
          <div class="summary-chip">
            <span class="summary-val">{{ dashData.totalSessions }}</span>
            <span class="summary-lbl">Total Sessions</span>
          </div>
          <div class="summary-chip">
            <span class="summary-val">{{ dashData.periods.length }}</span>
            <span class="summary-lbl">Periods</span>
          </div>
          <div class="summary-chip">
            <span class="summary-val">{{ overallAvgWpm }}</span>
            <span class="summary-lbl">Avg WPM</span>
          </div>
          <div class="summary-chip">
            <span class="summary-val">{{ overallBestWpm }}</span>
            <span class="summary-lbl">Class Best</span>
          </div>
          <div class="summary-chip refreshed">
            <span class="summary-lbl">Updated {{ refreshedLabel }}</span>
          </div>
        </div>

        <!-- Period breakdown -->
        <div class="stats-section-title">By Period</div>
        <div v-if="dashData.periods.length === 0" class="lesson-empty">
          No data yet — students haven't completed any typing sessions.
        </div>
        <div v-else class="period-grid">
          <div v-for="p in dashData.periods" :key="p.periodId" class="period-card">
            <div class="period-name">Period {{ p.periodId }}</div>
            <div class="period-stats">
              <div class="pstat">
                <span class="pstat-val">{{ p.avgWpm }}</span>
                <span class="pstat-lbl">Avg WPM</span>
              </div>
              <div class="pstat">
                <span class="pstat-val">{{ p.bestWpm }}</span>
                <span class="pstat-lbl">Best</span>
              </div>
              <div class="pstat">
                <span class="pstat-val">{{ p.avgAccuracy }}%</span>
                <span class="pstat-lbl">Accuracy</span>
              </div>
              <div class="pstat">
                <span class="pstat-val">{{ p.students }}</span>
                <span class="pstat-lbl">Students</span>
              </div>
              <div class="pstat">
                <span class="pstat-val">{{ p.sessions }}</span>
                <span class="pstat-lbl">Sessions</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Top performers -->
        <div class="stats-section-title">Top Performers</div>
        <div v-if="dashData.topStudents.length === 0" class="lesson-empty">No data yet.</div>
        <div v-else class="top-list">
          <div
            v-for="(s, i) in dashData.topStudents"
            :key="s.uid"
            class="top-row"
            :class="{ gold: i === 0, silver: i === 1, bronze: i === 2 }"
          >
            <div class="top-rank">{{ i + 1 }}</div>
            <div class="top-info">
              <div class="top-name">{{ s.displayName }}</div>
              <div class="top-meta">Period {{ s.periodId }} · {{ s.sessions }} sessions</div>
            </div>
            <div class="top-wpm">
              <span class="top-wpm-val">{{ s.bestWpm }}</span>
              <span class="top-wpm-lbl">WPM best</span>
            </div>
            <div class="top-avg">{{ s.avgWpm }} avg</div>
          </div>
        </div>

        <!-- Most-missed keys -->
        <div class="stats-section-title">Most Missed Keys (Class-wide)</div>
        <div v-if="dashData.missedKeys.length === 0" class="lesson-empty">No error data yet.</div>
        <div v-else class="missed-keys">
          <div
            v-for="(mk, i) in dashData.missedKeys"
            :key="mk.key"
            class="missed-chip"
            :class="{ 'miss-1': i === 0, 'miss-2': i === 1, 'miss-3': i === 2 }"
          >
            <span class="miss-key">{{ mk.key.toUpperCase() }}</span>
            <span class="miss-count">{{ mk.count }}</span>
          </div>
        </div>

      </template>

      <div v-else class="lesson-empty">No data yet.</div>

    </template> <!-- end stats section -->

    <!-- ════════════════════════════════════════════════════════════════════
         PERIOD PROGRESS SECTION
         ════════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'progress'">

      <!-- Period pill selector -->
      <div class="prog-period-bar">
        <span class="prog-period-label">PERIOD</span>
        <button
          v-for="p in PERIOD_IDS"
          :key="p.id"
          class="prog-pill"
          :class="{
            'prog-pill--mine':   isAdmin || isAudit || myPeriodIds.includes(p.id),
            'prog-pill--active': progPeriodId === p.id,
          }"
          :disabled="!isAdmin && !isAudit && !myPeriodIds.includes(p.id)"
          :title="p.label"
          @click="progPeriodId = p.id"
        >{{ p.id.replace('period-', 'P') }}</button>
      </div>

      <!-- Loading / error states -->
      <div v-if="dashLoading" class="loading-msg">Loading class data…</div>
      <div v-else-if="dashError" class="error-msg">{{ dashError }}</div>

      <!-- No period selected -->
      <div v-else-if="!progPeriodId" class="lesson-empty">
        Select a period above to view student progress.
      </div>

      <!-- Period table -->
      <template v-else-if="dashData">

        <!-- Period summary strip -->
        <div class="prog-summary" v-if="progPeriodStat">
          <div class="prog-summary-chip">
            <span class="prog-summary-val">{{ progPeriodStat.students }}</span>
            <span class="prog-summary-lbl">Students Active</span>
          </div>
          <div class="prog-summary-chip">
            <span class="prog-summary-val">{{ progPeriodStat.sessions }}</span>
            <span class="prog-summary-lbl">Total Sessions</span>
          </div>
          <div class="prog-summary-chip">
            <span class="prog-summary-val">{{ progPeriodStat.bestWpm }}</span>
            <span class="prog-summary-lbl">Period Best WPM</span>
          </div>
          <div class="prog-summary-chip">
            <span class="prog-summary-val">{{ progPeriodStat.avgWpm }}</span>
            <span class="prog-summary-lbl">Period Avg WPM</span>
          </div>
          <div class="prog-summary-chip">
            <span class="prog-summary-val">{{ progPeriodStat.avgAccuracy }}%</span>
            <span class="prog-summary-lbl">Avg Accuracy</span>
          </div>
        </div>

        <div v-if="sortedPeriodStudents.length === 0" class="lesson-empty">
          No students in this period have completed a typing session yet.
        </div>

        <template v-else>
          <!-- Sortable table header -->
          <div class="prog-table">
            <div class="prog-thead">
              <span class="prog-th prog-th--name sortable" @click="setProgSort('displayName')">
                CADET {{ progSortIcon('displayName') }}
              </span>
              <span class="prog-th sortable" @click="setProgSort('sessions')">
                SESSIONS {{ progSortIcon('sessions') }}
              </span>
              <span class="prog-th sortable" @click="setProgSort('bestWpm')">
                BEST WPM {{ progSortIcon('bestWpm') }}
              </span>
              <span class="prog-th sortable" @click="setProgSort('avgWpm')">
                AVG WPM {{ progSortIcon('avgWpm') }}
              </span>
              <span class="prog-th sortable" @click="setProgSort('avgAccuracy')">
                ACCURACY {{ progSortIcon('avgAccuracy') }}
              </span>
              <span class="prog-th sortable" @click="setProgSort('lastActive')">
                LAST ACTIVE {{ progSortIcon('lastActive') }}
              </span>
            </div>

            <div
              v-for="(s, i) in sortedPeriodStudents"
              :key="s.uid"
              class="prog-row"
              :class="{ 'prog-row--alt': i % 2 === 1 }"
            >
              <span class="prog-td prog-td--name">{{ s.displayName }}</span>
              <span class="prog-td prog-td--num">{{ s.sessions }}</span>
              <span class="prog-td prog-td--wpm">
                <span class="prog-wpm-val" :class="wpmClass(s.bestWpm, progPeriodStat?.bestWpm)">
                  {{ s.bestWpm }}
                </span>
                <span class="prog-wpm-bar">
                  <span
                    class="prog-wpm-fill"
                    :style="{ width: progPeriodStat?.bestWpm ? (s.bestWpm / progPeriodStat.bestWpm * 100) + '%' : '0%' }"
                  ></span>
                </span>
              </span>
              <span class="prog-td prog-td--num">{{ s.avgWpm }}</span>
              <span class="prog-td prog-td--acc"
                :class="accClass(s.avgAccuracy)"
              >{{ s.avgAccuracy }}%</span>
              <span class="prog-td prog-td--date">{{ formatLastActive(s.lastActive) }}</span>
            </div>
          </div>

          <p class="prog-footnote">
            Only students with at least one completed session appear here.
          </p>
        </template>

      </template>

    </template> <!-- end progress section -->

    <!-- ════════════════════════════════════════════════════════════════════
         STUDENT SECTION — all students, searchable, across all periods
         ════════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'student'">

      <!-- Search + period pills in one row -->
      <div class="stud-controls">
        <div class="stud-search-wrap">
          <input
            v-model="studentSearchQ"
            class="lcars-input stud-search-input"
            type="text"
            placeholder="Search cadet name…"
          />
          <button v-if="studentSearchQ" class="stud-search-clear" @click="studentSearchQ = ''">✕</button>
        </div>
        <div class="prog-period-bar stud-pills">
          <span class="prog-period-label">PERIOD</span>
          <button
            class="prog-pill"
            :class="{
              'prog-pill--mine':   true,
              'prog-pill--active': studentPeriodFilter === '',
            }"
            @click="studentPeriodFilter = ''"
          >ALL</button>
          <button
            v-for="p in PERIOD_IDS"
            :key="p.id"
            class="prog-pill"
            :class="{
              'prog-pill--mine':   isAdmin || isAudit || myPeriodIds.includes(p.id),
              'prog-pill--active': studentPeriodFilter === p.id,
            }"
            :disabled="!isAdmin && !isAudit && !myPeriodIds.includes(p.id)"
            @click="studentPeriodFilter = p.id"
          >{{ periodShortLbl(p.id) }}</button>
        </div>
      </div>

      <!-- Loading / error -->
      <div v-if="dashLoading" class="loading-msg">Loading student data…</div>
      <div v-else-if="dashError" class="error-msg">{{ dashError }}</div>

      <template v-else-if="dashData">

        <!-- Result count + summary strip -->
        <div class="stud-meta-row">
          <span class="stud-result-count">
            {{ filteredStudents.length }} cadet{{ filteredStudents.length !== 1 ? 's' : '' }}
            <template v-if="studentSearchQ || studentPeriodFilter"> matching</template>
          </span>
        </div>

        <div v-if="filteredStudents.length === 0" class="lesson-empty">
          No students match your search or filter.
        </div>

        <template v-else>
          <!-- Sortable table — same style as Period Progress, + PERIOD column -->
          <div class="prog-table stud-table">
            <div class="prog-thead stud-thead">
              <span class="prog-th prog-th--name sortable" @click="setStudSort('displayName')">
                CADET {{ studSortIcon('displayName') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('periodId')">
                PERIOD {{ studSortIcon('periodId') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('sessions')">
                SESSIONS {{ studSortIcon('sessions') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('bestWpm')">
                BEST WPM {{ studSortIcon('bestWpm') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('avgWpm')">
                AVG WPM {{ studSortIcon('avgWpm') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('avgAccuracy')">
                ACCURACY {{ studSortIcon('avgAccuracy') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('lastActive')">
                LAST ACTIVE {{ studSortIcon('lastActive') }}
              </span>
            </div>

            <div
              v-for="(s, i) in filteredStudents"
              :key="s.uid"
              class="prog-row"
              :class="{ 'prog-row--alt': i % 2 === 1 }"
            >
              <span class="prog-td prog-td--name">{{ s.displayName }}</span>
              <span class="prog-td prog-td--period">{{ periodShortLbl(s.periodId) }}</span>
              <span class="prog-td prog-td--num">{{ s.sessions }}</span>
              <span class="prog-td prog-td--wpm">
                <span class="prog-wpm-val" :class="wpmClass(s.bestWpm, studBestWpm)">
                  {{ s.bestWpm }}
                </span>
                <span class="prog-wpm-bar">
                  <span
                    class="prog-wpm-fill"
                    :style="{ width: studBestWpm ? (s.bestWpm / studBestWpm * 100) + '%' : '0%' }"
                  ></span>
                </span>
              </span>
              <span class="prog-td prog-td--num">{{ s.avgWpm }}</span>
              <span class="prog-td prog-td--acc" :class="accClass(s.avgAccuracy)">
                {{ s.avgAccuracy }}%
              </span>
              <span class="prog-td prog-td--date">{{ formatLastActive(s.lastActive) }}</span>
            </div>
          </div>

          <p class="prog-footnote">
            Only cadets with at least one completed session appear here.
          </p>
        </template>

      </template>

    </template> <!-- end student section -->

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTypingContent }      from '@/composables/useTypingContent'
import { useTypingCustomText }   from '@/composables/useTypingCustomText'
import { useTypingDashboard }    from '@/composables/useTypingDashboard'
import { useAuth }               from '@/composables/useAuth.js'
import TypingKeyboard            from '@/components/typing/TypingKeyboard.vue'
import type { TypingLesson }     from '@/composables/useTypingContent'
import type { CustomText }       from '@/composables/useTypingCustomText'
import { PERIOD_IDS, SCHOOL_YEAR_ID } from '@/config/schoolYear'

const { lessons, isLoading, error, fetchAllLessons, createLesson, updateLesson } =
  useTypingContent()
const { texts: ctTexts, isLoading: ctLoading, error: ctError,
        fetchAllTexts, createText, updateText, archiveText, restoreText } =
  useTypingCustomText()
const { userInfo, isAdmin, isAudit } = useAuth()

const myPeriodIds = computed<string[]>(() => userInfo.value?.periodIds ?? [])

// ── Section switcher ──────────────────────────────────────────────────────────

type Section = 'lessons' | 'custom' | 'stats' | 'progress' | 'student'
const section = ref<Section>('lessons')

// ── Lesson tabs ───────────────────────────────────────────────────────────────

type Tab = 'lessons' | 'create' | 'edit'
const tab = ref<Tab>('lessons')

// ── Form state ────────────────────────────────────────────────────────────────

const defaultForm = () => ({
  title:       '',
  description: '',
  passage:     '',
  order:       lessons.value.length,
  isTutorial:  false,
})

const form         = ref(defaultForm())
const focusKeysRaw = ref('')
const formError    = ref('')
const isSaving     = ref(false)
const editingId    = ref<string | null>(null)

const parsedFocusKeys = computed(() =>
  focusKeysRaw.value
    .split(/\s+/)
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length === 1),
)

const openCreate = () => {
  editingId.value    = null
  form.value         = defaultForm()
  focusKeysRaw.value = ''
  formError.value    = ''
  tab.value          = 'create'
}

const openEdit = (lesson: TypingLesson) => {
  editingId.value    = lesson.id
  form.value         = {
    title:       lesson.title,
    description: lesson.description,
    passage:     lesson.passage,
    order:       lesson.order,
    isTutorial:  lesson.isTutorial ?? false,
  }
  focusKeysRaw.value = lesson.focusKeys.join(' ')
  formError.value    = ''
  tab.value          = 'edit'
}

const submitForm = async () => {
  formError.value = ''
  if (!form.value.title.trim())   { formError.value = 'Title is required.';   return }
  if (!form.value.passage.trim()) { formError.value = 'Passage is required.'; return }

  isSaving.value = true
  const payload = {
    ...form.value,
    focusKeys: parsedFocusKeys.value,
  }

  try {
    if (editingId.value) {
      await updateLesson(editingId.value, payload)
    } else {
      await createLesson({ ...payload, createdBy: userInfo.value?.email ?? '' })
    }
    await fetchAllLessons()
    tab.value = 'lessons'
  } finally {
    isSaving.value = false
  }
}

// ── Archive toggle ────────────────────────────────────────────────────────────

const toggleArchive = async (lesson: TypingLesson) => {
  await updateLesson(lesson.id, { archived: !lesson.archived })
  await fetchAllLessons()
}


// ── Custom Text state ─────────────────────────────────────────────────────────

type CtTab = 'list' | 'create' | 'edit'
const ctTab       = ref<CtTab>('list')
const ctEditingId = ref<string | null>(null)
const ctFormError = ref('')
const ctSaving    = ref(false)
const ctForm      = ref({ title: '', category: '', passage: '' })

const openCtCreate = () => {
  ctEditingId.value = null
  ctForm.value      = { title: '', category: '', passage: '' }
  ctFormError.value = ''
  ctTab.value       = 'create'
}

const openCtEdit = (ct: CustomText) => {
  ctEditingId.value = ct.id
  ctForm.value      = { title: ct.title, category: ct.category, passage: ct.passage }
  ctFormError.value = ''
  ctTab.value       = 'edit'
}

const submitCtForm = async () => {
  ctFormError.value = ''
  if (!ctForm.value.title.trim())   { ctFormError.value = 'Title is required.';   return }
  if (!ctForm.value.passage.trim()) { ctFormError.value = 'Passage is required.'; return }

  ctSaving.value = true
  try {
    if (ctEditingId.value) {
      await updateText(ctEditingId.value, { ...ctForm.value })
    } else {
      await createText({ ...ctForm.value, createdBy: userInfo.value?.email ?? '' })
    }
    await fetchAllTexts()
    ctTab.value = 'list'
  } finally {
    ctSaving.value = false
  }
}

const toggleCtArchive = async (ct: CustomText) => {
  if (ct.archived) await restoreText(ct.id)
  else             await archiveText(ct.id)
  await fetchAllTexts()
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const { data: dashData, isLoading: dashLoading, error: dashError, fetchDashboard } =
  useTypingDashboard()

const openStats = async () => {
  section.value = 'stats'
  if (!dashData.value) {
    await fetchDashboard(
      userInfo.value?.email ?? '',
      userInfo.value?.schoolYearId ?? '2025-2026',
    )
  }
}

const overallAvgWpm = computed(() => {
  if (!dashData.value?.periods.length) return 0
  const total = dashData.value.periods.reduce((s, p) => s + p.avgWpm * p.sessions, 0)
  const sess  = dashData.value.periods.reduce((s, p) => s + p.sessions, 0)
  return sess ? Math.round(total / sess) : 0
})

const overallBestWpm = computed(() =>
  dashData.value?.topStudents[0]?.bestWpm ?? 0
)

const refreshedLabel = computed(() => {
  if (!dashData.value) return ''
  return dashData.value.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

// ── Period Progress ────────────────────────────────────────────────────────────

const progPeriodId = ref('')

// Shared dashboard fetch — reuse same data as Class Stats section
const openProgress = async () => {
  section.value = 'progress'
  if (!dashData.value) {
    await fetchDashboard(
      userInfo.value?.email ?? '',
      userInfo.value?.schoolYearId ?? SCHOOL_YEAR_ID,
    )
  }
}

// Stats for the selected period (from the periods array)
const progPeriodStat = computed(() =>
  dashData.value?.periods.find(p => p.periodId === progPeriodId.value) ?? null
)

// All students in the selected period, from the full allStudents list
const periodStudents = computed(() =>
  dashData.value?.allStudents.filter(s => s.periodId === progPeriodId.value) ?? []
)

// Sorting
type ProgSortKey = 'displayName' | 'sessions' | 'bestWpm' | 'avgWpm' | 'avgAccuracy' | 'lastActive'
const progSortKey = ref<ProgSortKey>('displayName')
const progSortDir = ref<'asc' | 'desc'>('asc')

const setProgSort = (key: ProgSortKey) => {
  if (progSortKey.value === key) progSortDir.value = progSortDir.value === 'asc' ? 'desc' : 'asc'
  else { progSortKey.value = key; progSortDir.value = key === 'displayName' ? 'asc' : 'desc' }
}
const progSortIcon = (key: string) => {
  if (progSortKey.value !== key) return '⇅'
  return progSortDir.value === 'asc' ? '↑' : '↓'
}

const sortedPeriodStudents = computed(() => {
  return [...periodStudents.value].sort((a, b) => {
    let cmp = 0
    if (progSortKey.value === 'displayName') {
      cmp = a.displayName.localeCompare(b.displayName)
    } else if (progSortKey.value === 'lastActive') {
      cmp = (a.lastActive?.getTime() ?? 0) - (b.lastActive?.getTime() ?? 0)
    } else {
      cmp = (a[progSortKey.value] as number) - (b[progSortKey.value] as number)
    }
    return progSortDir.value === 'asc' ? cmp : -cmp
  })
})

// Colour helpers
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
  const now   = new Date()
  const diff  = now.getTime() - d.getTime()
  const days  = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Student Progress section ──────────────────────────────────────────────────

const studentSearchQ      = ref('')
const studentPeriodFilter = ref('')  // '' = all periods

const openStudent = async () => {
  section.value = 'student'
  if (!dashData.value) {
    await fetchDashboard(
      userInfo.value?.email ?? '',
      userInfo.value?.schoolYearId ?? SCHOOL_YEAR_ID,
    )
  }
}

// Sort state (independent from Period Progress sort)
type StudSortKey = 'displayName' | 'periodId' | 'sessions' | 'bestWpm' | 'avgWpm' | 'avgAccuracy' | 'lastActive'
const studSortKey = ref<StudSortKey>('displayName')
const studSortDir = ref<'asc' | 'desc'>('asc')

const setStudSort = (key: StudSortKey) => {
  if (studSortKey.value === key) studSortDir.value = studSortDir.value === 'asc' ? 'desc' : 'asc'
  else { studSortKey.value = key; studSortDir.value = key === 'displayName' || key === 'periodId' ? 'asc' : 'desc' }
}
const studSortIcon = (key: string) => {
  if (studSortKey.value !== key) return '⇅'
  return studSortDir.value === 'asc' ? '↑' : '↓'
}

const filteredStudents = computed(() => {
  if (!dashData.value) return []
  let list = dashData.value.allStudents
  // Period pill filter
  if (studentPeriodFilter.value) {
    list = list.filter(s => s.periodId === studentPeriodFilter.value)
  }
  // Search filter
  const q = studentSearchQ.value.trim().toLowerCase()
  if (q) list = list.filter(s => s.displayName.toLowerCase().includes(q))
  // Sort
  return [...list].sort((a, b) => {
    let cmp = 0
    if (studSortKey.value === 'displayName') cmp = a.displayName.localeCompare(b.displayName)
    else if (studSortKey.value === 'periodId') cmp = a.periodId.localeCompare(b.periodId)
    else if (studSortKey.value === 'lastActive') cmp = (a.lastActive?.getTime() ?? 0) - (b.lastActive?.getTime() ?? 0)
    else cmp = (a[studSortKey.value] as number) - (b[studSortKey.value] as number)
    return studSortDir.value === 'asc' ? cmp : -cmp
  })
})

// Best WPM among visible students — used to scale the WPM bar
const studBestWpm = computed(() =>
  filteredStudents.value.reduce((max, s) => Math.max(max, s.bestWpm), 0)
)

// Period label helpers — short labels like "P1"
function periodShortLbl(id: string) { return id.replace('period-', 'P') }

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(() => { fetchAllLessons(); fetchAllTexts() })
</script>

<style scoped>
/* ── Page wrapper ────────────────────────────────────────────────────────── */
.lesson-admin {
  display:         flex;
  flex-direction:  column;
  gap:             1.25rem;
}

/* ── Section switcher ────────────────────────────────────────────────────── */
.section-bar {
  display:     flex;
  gap:         0.25rem;
  background:  rgba(0, 10, 30, 0.5);
  border:      0.0625rem solid rgba(153, 204, 255, 0.12);
  border-radius: 0.625rem;
  padding:     0.25rem;
  width:       fit-content;
}
.section-btn {
  font-family:   'Antonio', sans-serif;
  font-size:     0.85rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  background:    transparent;
  border:        none;
  border-radius: 0.4rem;
  color:         rgba(153, 204, 255, 0.5);
  padding:       0.4rem 1.1rem;
  cursor:        pointer;
  transition:    background 0.2s, color 0.2s;
}
.section-btn:hover  { color: #99ccff; }
.section-btn.active {
  background: rgba(153, 204, 255, 0.15);
  color:      #e8f0ff;
}

/* ── Tab bar ─────────────────────────────────────────────────────────────── */
.tab-bar {
  display:     flex;
  gap:         0.5rem;
  flex-wrap:   wrap;
}

.tab-btn {
  font-family:   'Antonio', sans-serif;
  font-size:     0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background:    rgba(0, 20, 45, 0.6);
  border:        0.0625rem solid rgba(153, 204, 255, 0.2);
  border-radius: 62.4375rem;
  color:         rgba(153, 204, 255, 0.7);
  padding:       0.4rem 1.2rem;
  cursor:        pointer;
  transition:    background 0.2s, color 0.2s, border-color 0.2s;
}
.tab-btn:hover  {
  background:    rgba(0, 40, 80, 0.7);
  border-color:  rgba(153, 204, 255, 0.5);
  color:         #99ccff;
}
.tab-btn.active {
  background:    rgba(153, 204, 255, 0.15);
  border-color:  rgba(153, 204, 255, 0.55);
  color:         #e8f0ff;
}

/* ── Tab content area ────────────────────────────────────────────────────── */
.tab-content {
  display:         flex;
  flex-direction:  column;
  gap:             0.75rem;
}

/* ── Seed banner ─────────────────────────────────────────────────────────── */
.seed-banner {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  gap:             1rem;
  padding:         1.25rem 1.5rem;
  background:      rgba(0, 30, 60, 0.5);
  border:          0.0625rem solid rgba(153, 204, 255, 0.2);
  border-radius:   0.75rem;
  flex-wrap:       wrap;
}
.seed-text {
  margin:    0;
  color:     #99ccff;
  font-size: 0.9rem;
  flex:      1;
}

/* ── Lesson list ─────────────────────────────────────────────────────────── */
.lesson-list {
  display:        flex;
  flex-direction: column;
  gap:            0.5rem;
}

.lesson-row {
  display:      flex;
  align-items:  center;
  gap:          1rem;
  padding:      0.85rem 1.1rem;
  background:   rgba(0, 20, 45, 0.55);
  border:       0.0625rem solid rgba(153, 204, 255, 0.15);
  border-radius: 0.625rem;
  transition:   border-color 0.2s, background 0.2s;
}
.lesson-row:hover {
  border-color: rgba(153, 204, 255, 0.35);
  background:   rgba(0, 35, 75, 0.55);
}
.lesson-row.archived {
  opacity: 0.45;
}

.order-num {
  font-family:   'Antonio', monospace, sans-serif;
  font-size:     0.85rem;
  color:         rgba(153, 204, 255, 0.4);
  min-width:     2rem;
  text-align:    center;
}

.lesson-info {
  flex:   1;
  cursor: pointer;
}
.lesson-name {
  font-family:   'Antonio', sans-serif;
  font-size:     1.05rem;
  color:         #e8f0ff;
  letter-spacing: 0.03em;
}
.lesson-meta {
  display:     flex;
  align-items: center;
  gap:         0.4rem;
  flex-wrap:   wrap;
  margin-top:  0.15rem;
}
.meta-keys {
  font-family: 'Antonio', monospace, sans-serif;
  font-size:   0.75rem;
  color:       rgba(255, 210, 60, 0.7);
}
.meta-chars {
  font-size: 0.75rem;
  color:     rgba(153, 204, 255, 0.5);
}
.meta-sep {
  color:     rgba(153, 204, 255, 0.3);
  font-size: 0.75rem;
}
.meta-archived {
  font-family:   'Antonio', sans-serif;
  font-size:     0.65rem;
  color:         rgba(255, 100, 100, 0.7);
  background:    rgba(255, 80, 80, 0.1);
  border:        0.0625rem solid rgba(255, 80, 80, 0.25);
  border-radius: 62.4375rem;
  padding:       0.1rem 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.tutorial-badge {
  font-family:   'Antonio', sans-serif;
  font-size:     0.65rem;
  color:         rgba(255, 180, 0, 0.9);
  background:    rgba(255, 180, 0, 0.15);
  border:        0.0625rem solid rgba(255, 180, 0, 0.4);
  border-radius: 62.4375rem;
  padding:       0.1rem 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-left:   0.5rem;
  vertical-align: middle;
}

/* Row action buttons */
.row-actions {
  display: flex;
  gap:     0.5rem;
}
.action-btn {
  font-family:   'Antonio', sans-serif;
  font-size:     0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding:       0.25rem 0.75rem;
  border-radius: 62.4375rem;
  border:        0.0625rem solid;
  cursor:        pointer;
  transition:    background 0.2s, color 0.2s;
}
.edit-btn {
  color:            #99ccff;
  border-color:     rgba(153, 204, 255, 0.3);
  background:       transparent;
}
.edit-btn:hover {
  background:   rgba(153, 204, 255, 0.1);
  border-color: rgba(153, 204, 255, 0.6);
}
.archive-btn {
  color:        rgba(255, 150, 50, 0.7);
  border-color: rgba(255, 150, 50, 0.25);
  background:   transparent;
}
.archive-btn:hover {
  background:   rgba(255, 150, 50, 0.1);
  border-color: rgba(255, 150, 50, 0.55);
}

/* ── Form panel ──────────────────────────────────────────────────────────── */
.form-panel {
  gap: 1.1rem;
}
.form-title {
  font-family:   'Antonio', sans-serif;
  font-size:     1.1rem;
  color:         #ff9900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.form-label {
  display:        flex;
  flex-direction: column;
  gap:            0.35rem;
  font-family:    'Antonio', sans-serif;
  font-size:      0.78rem;
  color:          rgba(153, 204, 255, 0.6);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lcars-input {
  font-family:   'Roboto', sans-serif;
  font-size:     0.9rem;
  color:         #e8f0ff;
  background:    rgba(0, 20, 50, 0.7);
  border:        0.0625rem solid rgba(153, 204, 255, 0.25);
  border-radius: 0.375rem;
  padding:       0.55rem 0.85rem;
  outline:       none;
  transition:    border-color 0.2s;
  width:         100%;
  box-sizing:    border-box;
}
.lcars-input:focus {
  border-color:  rgba(153, 204, 255, 0.65);
  box-shadow:    0 0 0.5rem rgba(153, 204, 255, 0.1);
}
.lcars-textarea {
  resize:     vertical;
  min-height: 4rem;
  line-height: 1.5;
}

.checkbox-label {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}
.lcars-checkbox {
  width: 1.2rem;
  height: 1.2rem;
  accent-color: #ff9900;
  cursor: pointer;
}

.passage-area {
  font-family: 'Courier New', monospace;
  font-size:   0.85rem;
}
.order-input {
  width: 6rem;
}
.input-hint {
  font-family:    'Roboto', sans-serif;
  font-size:      0.75rem;
  color:          rgba(153, 204, 255, 0.4);
  text-transform: none;
  letter-spacing: 0;
}

/* Form keyboard preview */
.form-keyboard-wrap {
  display:        flex;
  flex-direction: column;
  gap:            0.4rem;
}
.form-keyboard-label {
  font-family:   'Antonio', sans-serif;
  font-size:     0.75rem;
  color:         rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── Form action buttons ──────────────────────────────────────────────────── */
.form-actions {
  display:     flex;
  gap:         0.75rem;
  flex-wrap:   wrap;
  padding-top: 0.5rem;
}

.lcars-btn {
  font-family:   'Antonio', sans-serif;
  font-size:     0.85rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border:        none;
  border-radius: 62.4375rem;
  padding:       0.5rem 1.5rem;
  cursor:        pointer;
  transition:    background 0.2s, transform 0.15s;
}
.lcars-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.save-btn {
  background: #99ccff;
  color:      #0a1628;
}
.save-btn:not(:disabled):hover {
  background: #bbddff;
  transform:  translateY(-0.1rem);
}
.cancel-btn {
  background: rgba(153, 204, 255, 0.1);
  color:      #99ccff;
  border:     0.0625rem solid rgba(153, 204, 255, 0.3);
}
.cancel-btn:hover {
  background: rgba(153, 204, 255, 0.2);
}
.seed-btn {
  background: rgba(100, 220, 140, 0.2);
  color:      rgba(100, 220, 140, 0.9);
  border:     0.0625rem solid rgba(100, 220, 140, 0.4);
  white-space: nowrap;
}
.seed-btn:not(:disabled):hover {
  background: rgba(100, 220, 140, 0.3);
}

/* ── Dashboard ───────────────────────────────────────────────────────────── */

.stats-section-title {
  font-family:    'Antonio', sans-serif;
  font-size:      0.78rem;
  color:          rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top:     1.25rem;
  margin-bottom:  0.5rem;
}

/* Summary chips */
.stats-summary {
  display:   flex;
  gap:       0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}
.summary-chip {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  padding:        0.65rem 1.1rem;
  background:     rgba(0, 20, 50, 0.6);
  border:         0.0625rem solid rgba(153, 204, 255, 0.15);
  border-radius:  0.625rem;
  min-width:      5rem;
}
.summary-val {
  font-family: 'Antonio', sans-serif;
  font-size:   1.6rem;
  color:       #99ccff;
  line-height: 1;
}
.summary-lbl {
  font-family:   'Antonio', sans-serif;
  font-size:     0.65rem;
  color:         rgba(153, 204, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top:    0.2rem;
}
.summary-chip.refreshed {
  justify-content: center;
  background: transparent;
  border-color: transparent;
}
.summary-chip.refreshed .summary-lbl { font-size: 0.7rem; color: rgba(153,204,255,0.3); }

/* Period grid */
.period-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.75rem;
}
.period-card {
  background:    rgba(0, 20, 50, 0.55);
  border:        0.0625rem solid rgba(153, 204, 255, 0.15);
  border-radius: 0.75rem;
  padding:       1rem 1.1rem;
}
.period-name {
  font-family:   'Antonio', sans-serif;
  font-size:     1rem;
  color:         #ff9900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}
.period-stats {
  display:   flex;
  gap:       1rem;
  flex-wrap: wrap;
}
.pstat {
  display:        flex;
  flex-direction: column;
  align-items:    center;
}
.pstat-val {
  font-family: 'Antonio', sans-serif;
  font-size:   1.25rem;
  color:       #e8f0ff;
  line-height: 1;
}
.pstat-lbl {
  font-family:   'Antonio', sans-serif;
  font-size:     0.6rem;
  color:         rgba(153, 204, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top:    0.15rem;
}

/* Top performers */
.top-list {
  display:        flex;
  flex-direction: column;
  gap:            0.4rem;
}
.top-row {
  display:      flex;
  align-items:  center;
  gap:          0.85rem;
  padding:      0.65rem 1rem;
  background:   rgba(0, 20, 45, 0.5);
  border:       0.0625rem solid rgba(153, 204, 255, 0.1);
  border-radius: 0.5rem;
}
.top-row.gold   { border-color: rgba(255, 196, 0, 0.35);  background: rgba(255, 196, 0, 0.06); }
.top-row.silver { border-color: rgba(200, 210, 230, 0.3); background: rgba(200, 210, 230, 0.04); }
.top-row.bronze { border-color: rgba(200, 130, 80, 0.3);  background: rgba(200, 130, 80, 0.04); }

.top-rank {
  font-family:   'Antonio', sans-serif;
  font-size:     1.1rem;
  color:         rgba(153, 204, 255, 0.35);
  min-width:     1.5rem;
  text-align:    center;
}
.top-row.gold   .top-rank { color: rgba(255, 210, 60, 0.9); }
.top-row.silver .top-rank { color: rgba(200, 215, 240, 0.8); }
.top-row.bronze .top-rank { color: rgba(210, 150, 100, 0.8); }

.top-info { flex: 1; }
.top-name {
  font-family:   'Antonio', sans-serif;
  font-size:     1rem;
  color:         #e8f0ff;
  letter-spacing: 0.02em;
}
.top-meta {
  font-size: 0.72rem;
  color:     rgba(153, 204, 255, 0.45);
  margin-top: 0.1rem;
}
.top-wpm {
  display:        flex;
  flex-direction: column;
  align-items:    flex-end;
}
.top-wpm-val {
  font-family: 'Antonio', sans-serif;
  font-size:   1.4rem;
  color:       #99ccff;
  line-height: 1;
}
.top-wpm-lbl {
  font-family:   'Antonio', sans-serif;
  font-size:     0.6rem;
  color:         rgba(153, 204, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.top-avg {
  font-family: 'Antonio', sans-serif;
  font-size:   0.8rem;
  color:       rgba(153, 204, 255, 0.5);
  min-width:   4rem;
  text-align:  right;
}

/* Most-missed keys */
.missed-keys {
  display:   flex;
  gap:       0.5rem;
  flex-wrap: wrap;
}
.missed-chip {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  padding:        0.5rem 0.9rem;
  background:     rgba(255, 80, 80, 0.08);
  border:         0.0625rem solid rgba(255, 80, 80, 0.2);
  border-radius:  0.5rem;
  min-width:      3.5rem;
  transition:     background 0.2s;
}
.missed-chip.miss-1 { background: rgba(255,60,60,0.18); border-color: rgba(255,80,80,0.5); }
.missed-chip.miss-2 { background: rgba(255,60,60,0.13); border-color: rgba(255,80,80,0.38); }
.missed-chip.miss-3 { background: rgba(255,60,60,0.09); border-color: rgba(255,80,80,0.28); }
.miss-key {
  font-family: 'Antonio', monospace, sans-serif;
  font-size:   1.2rem;
  color:       rgba(255, 140, 140, 0.95);
  line-height: 1;
}
.miss-count {
  font-family:   'Antonio', sans-serif;
  font-size:     0.65rem;
  color:         rgba(255, 150, 150, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top:    0.2rem;
}

/* ── Misc ────────────────────────────────────────────────────────────────── */
.error-msg   { color: #ff5555; font-size: 0.85rem; margin: 0; }
.loading-msg { color: rgba(153, 204, 255, 0.5); font-size: 0.9rem; }
.lesson-empty { color: rgba(153, 204, 255, 0.4); font-size: 0.9rem; padding: 1rem 0; }

/* ══════════════════════════════════════════════════════════════════════════
   PERIOD PROGRESS
   ══════════════════════════════════════════════════════════════════════════ */

/* Period pill selector */
.prog-period-bar {
  display:     flex;
  align-items: center;
  gap:         0.4rem;
  flex-wrap:   wrap;
}
.prog-period-label {
  font-family:    'Antonio', sans-serif;
  font-size:      0.72rem;
  color:          rgba(153, 204, 255, 0.4);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-right:   0.25rem;
}
.prog-pill {
  font-family:    'Antonio', sans-serif;
  font-size:      0.72rem;
  font-weight:    bold;
  letter-spacing: 0.07em;
  padding:        0.22rem 0.6rem;
  border-radius:  0.3rem;
  border:         0.0625rem solid rgba(80, 100, 80, 0.3);
  background:     transparent;
  color:          #445;
  cursor:         default;
  transition:     all 0.15s;
}
.prog-pill--mine {
  color:        #69f0ae;
  border-color: rgba(105, 240, 174, 0.4);
  cursor:       pointer;
}
.prog-pill--mine:hover {
  border-color: #69f0ae;
  background:   rgba(105, 240, 174, 0.08);
}
.prog-pill--active {
  color:        #ff9900 !important;
  border-color: #ff9900 !important;
  background:   rgba(255, 153, 0, 0.12) !important;
  cursor:       pointer;
}

/* Period summary strip */
.prog-summary {
  display:   flex;
  gap:       0.6rem;
  flex-wrap: wrap;
}
.prog-summary-chip {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  padding:        0.5rem 0.9rem;
  background:     rgba(0, 20, 50, 0.55);
  border:         0.0625rem solid rgba(153, 204, 255, 0.13);
  border-radius:  0.5rem;
  min-width:      4.5rem;
}
.prog-summary-val {
  font-family: 'Antonio', sans-serif;
  font-size:   1.4rem;
  color:       #99ccff;
  line-height: 1;
}
.prog-summary-lbl {
  font-family:    'Antonio', sans-serif;
  font-size:      0.58rem;
  color:          rgba(153, 204, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-top:     0.18rem;
  white-space:    nowrap;
}

/* Progress table */
.prog-table {
  display:        flex;
  flex-direction: column;
  border:         0.0625rem solid rgba(153, 204, 255, 0.12);
  border-radius:  0.625rem;
  overflow:       hidden;
}

.prog-thead,
.prog-row {
  display:     grid;
  grid-template-columns: 1.8fr 0.7fr 1.1fr 0.7fr 0.75fr 0.85fr;
  align-items: center;
  gap:         0.25rem;
  padding:     0.55rem 1rem;
}

.prog-thead {
  background:   rgba(0, 15, 40, 0.7);
  border-bottom: 0.0625rem solid rgba(153, 204, 255, 0.12);
}
.prog-th {
  font-family:    'Antonio', sans-serif;
  font-size:      0.68rem;
  color:          rgba(153, 204, 255, 0.45);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  user-select:    none;
}
.prog-th.sortable { cursor: pointer; }
.prog-th.sortable:hover { color: #99ccff; }

.prog-row {
  background: rgba(0, 20, 50, 0.35);
  transition: background 0.12s;
}
.prog-row--alt  { background: rgba(0, 15, 40, 0.5); }
.prog-row:hover { background: rgba(0, 35, 80, 0.6); }

.prog-td {
  font-family: 'Antonio', sans-serif;
  font-size:   0.92rem;
  color:       #c8d8f0;
}
.prog-td--name { color: #e8f0ff; font-size: 0.95rem; }
.prog-td--num  { color: rgba(153, 204, 255, 0.7); text-align: center; }
.prog-td--date { color: rgba(153, 204, 255, 0.5); font-size: 0.8rem; }

/* WPM cell with bar */
.prog-td--wpm {
  display:        flex;
  flex-direction: column;
  gap:            0.18rem;
}
.prog-wpm-val        { font-size: 0.95rem; }
.prog-wpm-val.wpm--high { color: #69f0ae; }
.prog-wpm-val.wpm--mid  { color: #ffd740; }
.prog-wpm-val.wpm--low  { color: rgba(153, 204, 255, 0.55); }

.prog-wpm-bar {
  height:        0.2rem;
  border-radius: 62.5rem;
  background:    rgba(153, 204, 255, 0.1);
  overflow:      hidden;
}
.prog-wpm-fill {
  display:       block;
  height:        100%;
  border-radius: 62.5rem;
  background:    linear-gradient(90deg, #4488cc, #69f0ae);
  transition:    width 0.4s ease;
}

/* Accuracy colouring */
.prog-td--acc.acc--high { color: #69f0ae; }
.prog-td--acc.acc--mid  { color: #ffd740; }
.prog-td--acc.acc--low  { color: rgba(255, 120, 120, 0.8); }

/* Footnote */
.prog-footnote {
  font-size:  0.75rem;
  color:      rgba(153, 204, 255, 0.3);
  margin:     0;
  padding-top: 0.4rem;
  font-style: italic;
}

/* ══════════════════════════════════════════════════════════════════════════
   STUDENT SECTION
   ══════════════════════════════════════════════════════════════════════════ */

.stud-controls {
  display:     flex;
  align-items: center;
  gap:         1rem;
  flex-wrap:   wrap;
}

.stud-search-wrap {
  position:   relative;
  flex:        1 1 220px;
  max-width:   320px;
}
.stud-search-input {
  width:        100%;
  box-sizing:   border-box;
  padding-right: 2rem;
}
.stud-search-clear {
  position:  absolute;
  right:     0.5rem;
  top:       50%;
  transform: translateY(-50%);
  background: none;
  border:    none;
  color:     rgba(153, 204, 255, 0.5);
  cursor:    pointer;
  font-size: 0.8rem;
  line-height: 1;
}
.stud-search-clear:hover { color: #ff9900; }

/* Pills row sits inline beside the search */
.stud-pills {
  flex: 0 0 auto;
}

.stud-meta-row {
  display:     flex;
  align-items: center;
  gap:         0.75rem;
}
.stud-result-count {
  font-family:    'Antonio', sans-serif;
  font-size:      0.75rem;
  color:          rgba(153, 204, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Student table: 7 columns (adds PERIOD between name and sessions) */
.stud-thead,
.stud-table .prog-row {
  grid-template-columns: 1.5fr 0.55fr 0.65fr 1.1fr 0.65fr 0.72fr 0.85fr;
}

.prog-td--period {
  font-family:    'Antonio', sans-serif;
  font-size:      0.8rem;
  color:          rgba(255, 153, 0, 0.7);
  letter-spacing: 0.06em;
}
</style>
