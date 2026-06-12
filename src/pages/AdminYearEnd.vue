<template>
  <section class="adventure-page year-end-page">
    <div class="lcars-text-bar"><span>Year-End Management</span></div>

    <div class="ye-body">

      <!-- Alert banner -->
      <div class="ye-alert">
        <span class="ye-alert-icon">⚠️</span>
        <span>Actions on this page affect live data for all users. Archiving a period removes it from teacher views — no data is deleted. Moving a cadet is reversible.</span>
      </div>

      <!-- How This Works (collapsible) -->
      <div class="ye-help">
        <button class="ye-help-toggle" @click="helpOpen = !helpOpen">
          <span>📖 How Year-End Management Works</span>
          <span class="ye-help-chevron" :class="{ 'ye-help-chevron--open': helpOpen }">▾</span>
        </button>
        <div v-if="helpOpen" class="ye-help-body">

          <div class="ye-help-section">
            <div class="ye-help-heading">The Core Idea</div>
            <p>
              The <strong>Mission Library</strong> (lessons, games, typing, projects) persists forever — it's your content catalog, not tied to any year.
              What resets each year is the <em>activity layer</em>: which periods are active, which students are in them, and which assignments have been deployed.
              Old grades and submissions are never deleted; they just stop appearing in the default filtered views once you roll the year.
            </p>
          </div>

          <div class="ye-help-section">
            <div class="ye-help-heading">The periods Collection</div>
            <p>
              This page manages a Firestore collection called <code>periods</code>. Each document represents one period for one school year,
              using the ID format <code>2025-2026__period-1</code>. Multiple years coexist in the same collection — nothing is ever overwritten.
              The first time you use this page, click <strong>Initialize Period Records</strong> to seed it from the current teacher assignments.
            </p>
          </div>

          <div class="ye-help-section">
            <div class="ye-help-heading">Archiving a Period</div>
            <p>
              Archiving does two things atomically: it marks the period document <code>archived: true</code> in Firestore, and it removes that
              period ID from the teacher's <code>periodIds</code> array in <code>approvedUsers</code>. The teacher's selector no longer shows it,
              but every student, submission, grade, and score for that period is still in Firestore and can be queried at any time.
              You can restore a period if you archive one by mistake.
            </p>
          </div>

          <div class="ye-help-section">
            <div class="ye-help-heading">Open Access Period</div>
            <p>
              Open Access is a special <code>adminOnly</code> period — invisible to all teachers. Any cadet you move into it keeps their login and
              can still reach games, typing, and content, but they won't appear in any teacher's gradebook or seating chart.
              It's meant for students who want to keep playing after the school year ends. Moving a cadet is fully reversible.
            </p>
          </div>

          <div class="ye-help-section">
            <div class="ye-help-heading">Year Rollover Order of Operations</div>
            <ol class="ye-help-ol">
              <li>Archive all active periods (removes them from teacher views)</li>
              <li>Create Open Access and move any continuing students into it</li>
              <li>Click "Create 2026-2027 Periods" to seed next year's period docs in Firestore</li>
              <li>
                Edit <code>src/config/schoolYear.ts</code> — change <code>SCHOOL_YEAR_ID</code>, update quarter dates, and revise <code>UNITS</code> if the curriculum is changing
              </li>
              <li>Re-deploy. New students enrolled after that point will automatically carry the new school year ID.</li>
              <li>Use the Users page to assign teachers to the new periods (update their <code>periodIds</code> arrays)</li>
            </ol>
          </div>

          <div class="ye-help-section">
            <div class="ye-help-heading">What the Config File Controls</div>
            <p>
              <code>src/config/schoolYear.ts</code> is the one file you edit at the start of each year:
            </p>
            <ul class="ye-help-ul">
              <li><code>SCHOOL_YEAR_ID</code> — the string that tags all new data (e.g. <code>'2026-2027'</code>)</li>
              <li><code>QUARTERS</code> — start/end dates used for grading windows and reports</li>
              <li><code>UNITS</code> — the curriculum unit list shown in Mission Library filters</li>
              <li><code>PERIOD_IDS</code> — the static list of valid period IDs (rarely needs to change)</li>
            </ul>
            <p>Everything else — teacher assignments, student enrollment, mission content — is managed through the UI.</p>
          </div>

        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="ye-loading">Loading period data…</div>
      <div v-else-if="error" class="ye-error">{{ error }}</div>

      <template v-else>

        <!-- ── Section 1: Current Periods ────────────────────────────────── -->
        <div class="ye-section">
          <div class="ye-section-header">
            <span class="ye-section-title">Current Periods — {{ SCHOOL_YEAR_ID }}</span>
            <button
              v-if="!periodsInitialized"
              class="ye-btn ye-btn--primary"
              :disabled="saving"
              @click="handleInit"
            >
              Initialize Period Records
            </button>
          </div>

          <div v-if="!periodsInitialized" class="ye-empty">
            Period records have not been initialized yet. Click above to seed them from the current teacher assignments.
          </div>

          <div v-else class="ye-period-grid">
            <div
              v-for="p in currentYearStandardPeriods"
              :key="p.docId"
              class="ye-period-card"
              :class="{ 'ye-period-card--archived': p.archived }"
            >
              <div class="ye-period-header">
                <span class="ye-period-name">{{ p.label }}</span>
                <span class="ye-period-status" :class="p.archived ? 'status--archived' : 'status--active'">
                  {{ p.archived ? 'ARCHIVED' : 'ACTIVE' }}
                </span>
              </div>

              <div class="ye-period-meta">
                <span class="ye-meta-item">
                  <span class="ye-meta-label">Teacher</span>
                  <span class="ye-meta-value">{{ teacherLabel(p.teacherEmail) }}</span>
                </span>
                <span class="ye-meta-item">
                  <span class="ye-meta-label">Cadets</span>
                  <span class="ye-meta-value">{{ cadetCountForPeriod(p.periodId) }}</span>
                </span>
              </div>

              <div class="ye-period-actions">
                <button
                  v-if="!p.archived"
                  class="ye-btn ye-btn--danger"
                  :disabled="saving"
                  @click="handleArchivePeriod(p)"
                >
                  Archive Period
                </button>
                <button
                  v-else
                  class="ye-btn ye-btn--ghost"
                  :disabled="saving"
                  @click="handleUnarchivePeriod(p)"
                >
                  Restore Period
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Section 2: Open Access ─────────────────────────────────────── -->
        <div class="ye-section">
          <div class="ye-section-header">
            <span class="ye-section-title">Open Access Period</span>
          </div>

          <p class="ye-section-desc">
            Open Access is an admin-only period for students who want to continue using the app (games, typing, etc.) after the school year ends. It is invisible to teachers.
          </p>

          <!-- No Open Access period yet -->
          <div v-if="!openAccessPeriod" class="ye-open-access-empty">
            <p>No Open Access period exists for {{ SCHOOL_YEAR_ID }} yet.</p>
            <button
              class="ye-btn ye-btn--primary"
              :disabled="saving"
              @click="handleCreateOpenAccess"
            >
              Create Open Access Period
            </button>
          </div>

          <!-- Open Access exists -->
          <div v-else class="ye-open-access">

            <!-- Cadets currently in Open Access -->
            <div class="ye-oa-current">
              <div class="ye-oa-section-label">Currently in Open Access ({{ openAccessCadets.length }})</div>
              <div v-if="openAccessCadets.length === 0" class="ye-oa-empty">
                No cadets in Open Access yet.
              </div>
              <div v-else class="ye-cadet-list">
                <div v-for="c in openAccessCadets" :key="c.email" class="ye-cadet-row">
                  <span class="ye-cadet-name">{{ c.displayName }}</span>
                  <span class="ye-cadet-email">{{ c.email }}</span>
                  <button
                    class="ye-btn ye-btn--sm ye-btn--ghost"
                    :disabled="saving"
                    @click="openMoveBackDialog(c)"
                  >
                    Move Back
                  </button>
                </div>
              </div>
            </div>

            <!-- Move cadets into Open Access -->
            <div class="ye-oa-move">
              <div class="ye-oa-section-label">Move Cadets into Open Access</div>
              <div class="ye-oa-filters">
                <select v-model="filterPeriodId" class="ye-select">
                  <option value="">All active periods</option>
                  <option v-for="p in activeStandardPeriods" :key="p.periodId" :value="p.periodId">
                    {{ p.label }}
                  </option>
                </select>
                <input
                  v-model="cadetSearch"
                  class="ye-input"
                  placeholder="Search cadets…"
                />
              </div>
              <div class="ye-cadet-list">
                <div
                  v-for="c in filteredNonOACadets"
                  :key="c.email"
                  class="ye-cadet-row"
                >
                  <span class="ye-cadet-name">{{ c.displayName }}</span>
                  <span class="ye-cadet-email">{{ c.email }}</span>
                  <span class="ye-cadet-period">{{ periodLabelForId(c.periodId) }}</span>
                  <button
                    class="ye-btn ye-btn--sm ye-btn--accent"
                    :disabled="saving"
                    @click="handleMoveToOpenAccess(c)"
                  >
                    Add to Open Access
                  </button>
                </div>
                <div v-if="filteredNonOACadets.length === 0" class="ye-oa-empty">
                  No cadets match the current filter.
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- ── Section 3: New School Year ────────────────────────────────── -->
        <div class="ye-section">
          <div class="ye-section-header">
            <span class="ye-section-title">Prepare Next School Year</span>
          </div>

          <p class="ye-section-desc">
            Follow these steps in order when you're ready to roll over to a new school year. None of these actions delete any existing student data or grades.
          </p>

          <div class="ye-steps">

            <div class="ye-step" :class="{ 'ye-step--done': allCurrentPeriodsArchived }">
              <div class="ye-step-num">1</div>
              <div class="ye-step-body">
                <div class="ye-step-title">Archive all active periods</div>
                <div class="ye-step-desc">
                  Archiving removes periods from teacher views. Use the "Current Periods" section above.
                  <span v-if="allCurrentPeriodsArchived" class="ye-step-check">All periods archived.</span>
                  <span v-else class="ye-step-remaining">{{ activeStandardPeriods.length }} period(s) still active.</span>
                </div>
              </div>
            </div>

            <div class="ye-step" :class="{ 'ye-step--done': openAccessPeriod != null }">
              <div class="ye-step-num">2</div>
              <div class="ye-step-body">
                <div class="ye-step-title">Set up Open Access and move continuing cadets</div>
                <div class="ye-step-desc">
                  Use the "Open Access Period" section above to create the period and move students into it.
                  <span v-if="openAccessPeriod" class="ye-step-check">Open Access exists ({{ openAccessCadets.length }} cadet(s)).</span>
                </div>
              </div>
            </div>

            <div class="ye-step" :class="{ 'ye-step--done': nextYearPeriodsExist }">
              <div class="ye-step-num">3</div>
              <div class="ye-step-body">
                <div class="ye-step-title">Create next year's period records</div>
                <div class="ye-step-desc">
                  Creates blank period records for <strong>{{ nextYearId }}</strong> in Firestore. You'll assign teachers to them via the Users page after updating the config.
                </div>
                <button
                  v-if="!nextYearPeriodsExist"
                  class="ye-btn ye-btn--primary ye-step-btn"
                  :disabled="saving"
                  @click="handlePrepareNextYear"
                >
                  Create {{ nextYearId }} Periods
                </button>
                <span v-else class="ye-step-check">Period records for {{ nextYearId }} created.</span>
              </div>
            </div>

            <div class="ye-step">
              <div class="ye-step-num">4</div>
              <div class="ye-step-body">
                <div class="ye-step-title">Update the school year config</div>
                <div class="ye-step-desc">
                  In <code>src/config/schoolYear.ts</code>, update:
                  <ul class="ye-code-steps">
                    <li>Change <code>SCHOOL_YEAR_ID</code> to <code>'{{ nextYearId }}'</code></li>
                    <li>Update the <code>QUARTERS</code> dates for the new year</li>
                    <li>Adjust <code>UNITS</code> if the curriculum is changing</li>
                  </ul>
                  This is the only step that requires a code edit and re-deploy.
                </div>
              </div>
            </div>

            <div class="ye-step">
              <div class="ye-step-num">5</div>
              <div class="ye-step-body">
                <div class="ye-step-title">Enroll new students</div>
                <div class="ye-step-desc">
                  After deploying the config update, new cadets can be added via the Users page. They'll automatically be associated with <code>{{ nextYearId }}</code>.
                </div>
              </div>
            </div>

          </div>
        </div>

      </template>
    </div>

    <!-- Move Back Dialog -->
    <div v-if="moveBackTarget" class="ye-dialog-overlay" @click.self="moveBackTarget = null">
      <div class="ye-dialog">
        <div class="ye-dialog-title">Move {{ moveBackTarget.displayName }} Back</div>
        <p class="ye-dialog-desc">Select the period to move this cadet back to:</p>
        <select v-model="moveBackPeriodId" class="ye-select ye-select--full">
          <option value="">Select a period…</option>
          <option v-for="p in currentYearStandardPeriods" :key="p.periodId" :value="p.periodId">
            {{ p.label }} — {{ teacherLabel(p.teacherEmail) }}
          </option>
        </select>
        <div class="ye-dialog-actions">
          <button class="ye-btn ye-btn--ghost" @click="moveBackTarget = null">Cancel</button>
          <button
            class="ye-btn ye-btn--primary"
            :disabled="!moveBackPeriodId || saving"
            @click="handleMoveBack"
          >
            Move Cadet
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useAdminPeriods, type CadetEntry, type PeriodMeta } from '@/composables/useAdminPeriods'
import { SCHOOL_YEAR_ID } from '@/config/schoolYear'

const {
  periods, cadets, staff,
  loading, saving, error,
  load,
  initPeriodsFromConfig,
  archivePeriod, unarchivePeriod,
  createOpenAccess,
  moveCadet,
  prepareNextYear,
} = useAdminPeriods()

// Derived next-year ID (e.g. "2025-2026" → "2026-2027")
const nextYearId = computed(() => {
  const [start, end] = SCHOOL_YEAR_ID.split('-').map(Number)
  return `${start + 1}-${end + 1}`
})

// ── Period computed helpers ────────────────────────────────────────────────

const currentYearPeriods = computed(() =>
  periods.value.filter(p => p.schoolYearId === SCHOOL_YEAR_ID)
)

const currentYearStandardPeriods = computed(() =>
  currentYearPeriods.value.filter(p => p.type === 'standard')
)

const activeStandardPeriods = computed(() =>
  currentYearStandardPeriods.value.filter(p => !p.archived)
)

const openAccessPeriod = computed(() =>
  currentYearPeriods.value.find(p => p.type === 'openAccess') ?? null
)

const periodsInitialized = computed(() =>
  currentYearStandardPeriods.value.length > 0
)

const allCurrentPeriodsArchived = computed(() =>
  periodsInitialized.value && activeStandardPeriods.value.length === 0
)

const nextYearPeriodsExist = computed(() =>
  periods.value.some(p => p.schoolYearId === nextYearId.value && p.type === 'standard')
)

// ── Cadet computed helpers ─────────────────────────────────────────────────

const openAccessCadets = computed(() =>
  cadets.value.filter(c => c.periodId === 'open-access' && c.schoolYearId === SCHOOL_YEAR_ID)
)

// Filter state for the "move to OA" section
const filterPeriodId = ref('')
const cadetSearch = ref('')

const filteredNonOACadets = computed(() => {
  let list = cadets.value.filter(
    c => c.periodId !== 'open-access' && c.schoolYearId === SCHOOL_YEAR_ID
  )
  if (filterPeriodId.value) {
    list = list.filter(c => c.periodId === filterPeriodId.value)
  }
  if (cadetSearch.value.trim()) {
    const q = cadetSearch.value.trim().toLowerCase()
    list = list.filter(
      c => c.displayName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    )
  }
  return list.sort((a, b) => a.displayName.localeCompare(b.displayName))
})

// ── Label helpers ─────────────────────────────────────────────────────────

function teacherLabel(email: string | null): string {
  if (!email) return 'Unassigned'
  const s = staff.value.find(t => t.email === email)
  return s?.displayName || email
}

function cadetCountForPeriod(periodId: string): number {
  return cadets.value.filter(
    c => c.periodId === periodId && c.schoolYearId === SCHOOL_YEAR_ID
  ).length
}

function periodLabelForId(periodId: string): string {
  const p = currentYearStandardPeriods.value.find(p => p.periodId === periodId)
  return p?.label ?? periodId
}

// ── Move-back dialog ──────────────────────────────────────────────────────

const moveBackTarget = ref<CadetEntry | null>(null)
const moveBackPeriodId = ref('')

function openMoveBackDialog(cadet: CadetEntry) {
  moveBackTarget.value = cadet
  moveBackPeriodId.value = ''
}

async function handleMoveBack() {
  if (!moveBackTarget.value || !moveBackPeriodId.value) return
  const period = currentYearStandardPeriods.value.find(
    p => p.periodId === moveBackPeriodId.value
  )
  await moveCadet(moveBackTarget.value.email, moveBackPeriodId.value, period?.teacherEmail ?? null)
  moveBackTarget.value = null
}

// ── Action handlers ───────────────────────────────────────────────────────

async function handleInit() {
  if (!confirm('Initialize period records from current teacher assignments? This is safe to run at any time.')) return
  await initPeriodsFromConfig()
}

async function handleArchivePeriod(p: PeriodMeta) {
  const count = cadetCountForPeriod(p.periodId)
  const msg = `Archive ${p.label}?\n\nThis removes it from the teacher's period selector. The ${count} cadet(s) in this period and all their data are preserved — nothing is deleted.`
  if (!confirm(msg)) return
  await archivePeriod(p)
}

async function handleUnarchivePeriod(p: PeriodMeta) {
  if (!confirm(`Restore ${p.label} to active? This will add it back to the teacher's period selector.`)) return
  await unarchivePeriod(p)
}

async function handleCreateOpenAccess() {
  if (!confirm('Create the Open Access period for this school year? This period is admin-only and invisible to teachers.')) return
  await createOpenAccess()
}

async function handleMoveToOpenAccess(c: CadetEntry) {
  if (!confirm(`Move ${c.displayName} to Open Access?\n\nThey'll keep access to games and typing but won't appear in any teacher's gradebook.`)) return
  await moveCadet(c.email, 'open-access', null)
}

async function handlePrepareNextYear() {
  if (!confirm(`Create blank period records for ${nextYearId.value}?\n\nThis does not affect any current students or grades. You'll still need to update the config file (Step 4) before the new year goes live.`)) return
  await prepareNextYear(nextYearId.value)
}

// ── Help panel ────────────────────────────────────────────────────────────

const helpOpen = ref(false)

// ── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(load)
</script>

<style scoped>
@import '../assets/styles/classic.css';

.year-end-page {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

.ye-body {
  padding: 1.5rem 2rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* ── Alert banner ───────────────────────────────────────────────────────── */
.ye-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.9rem 1.25rem;
  background: rgba(255, 110, 0, 0.1);
  border: 1px solid rgba(255, 153, 0, 0.35);
  border-radius: 0.5rem;
  color: #ffbb55;
  font-size: 0.9rem;
  line-height: 1.5;
}
.ye-alert-icon { font-size: 1.2rem; flex-shrink: 0; }

.ye-loading { color: #6688aa; padding: 2rem 0; }
.ye-error   { color: #ff6e6e; padding: 2rem 0; }

/* ── Sections ───────────────────────────────────────────────────────────── */
.ye-section {
  background: rgba(0, 20, 45, 0.4);
  border: 1px solid rgba(102, 136, 170, 0.2);
  border-radius: 0.75rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.ye-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.ye-section-title {
  font-size: 1.2rem;
  font-weight: bold;
  color: #ff9900;
  letter-spacing: 0.05em;
}

.ye-section-desc {
  margin: 0;
  color: #99aacc;
  font-size: 0.9rem;
  line-height: 1.5;
  font-family: 'Antonio', sans-serif;
}

.ye-empty {
  color: #5577aa;
  font-size: 0.9rem;
  padding: 1rem 0;
}

/* ── Period grid ────────────────────────────────────────────────────────── */
.ye-period-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem;
}

.ye-period-card {
  background: rgba(0, 30, 60, 0.5);
  border: 1px solid rgba(102, 136, 170, 0.2);
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 0.2s;
}

.ye-period-card--archived {
  opacity: 0.55;
  border-color: rgba(102, 136, 170, 0.1);
}

.ye-period-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.ye-period-name {
  font-size: 1.05rem;
  font-weight: bold;
  color: #cce0ff;
}

.ye-period-status {
  font-size: 0.6rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
}
.status--active   { background: rgba(0, 200, 100, 0.15); color: #55ee99; border: 1px solid rgba(0,200,100,0.3); }
.status--archived { background: rgba(102, 136, 170, 0.1); color: #6688aa; border: 1px solid rgba(102,136,170,0.2); }

.ye-period-meta {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.ye-meta-item {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.8rem;
}
.ye-meta-label { color: #5577aa; min-width: 4rem; }
.ye-meta-value { color: #99ccff; }

.ye-period-actions { margin-top: 0.25rem; }

/* ── Open Access ────────────────────────────────────────────────────────── */
.ye-open-access-empty {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: #5577aa;
  font-size: 0.9rem;
}

.ye-open-access {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 860px) {
  .ye-open-access { grid-template-columns: 1fr; }
}

.ye-oa-current, .ye-oa-move {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ye-oa-section-label {
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  color: #5577aa;
  text-transform: uppercase;
}

.ye-oa-empty { color: #44556a; font-size: 0.85rem; }

.ye-oa-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ye-cadet-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 20rem;
  overflow-y: auto;
}

.ye-cadet-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  background: rgba(0, 20, 50, 0.4);
  border: 1px solid rgba(102, 136, 170, 0.12);
  border-radius: 0.35rem;
  flex-wrap: wrap;
}

.ye-cadet-name   { color: #cce0ff; font-size: 0.9rem; font-weight: bold; flex: 1; min-width: 6rem; }
.ye-cadet-email  { color: #5577aa; font-size: 0.75rem; }
.ye-cadet-period { color: #6688aa; font-size: 0.75rem; margin-left: auto; }

/* ── Steps ──────────────────────────────────────────────────────────────── */
.ye-steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ye-step {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem;
  background: rgba(0, 20, 45, 0.5);
  border: 1px solid rgba(102, 136, 170, 0.15);
  border-radius: 0.5rem;
  transition: border-color 0.2s;
}

.ye-step--done {
  border-color: rgba(0, 200, 100, 0.25);
  background: rgba(0, 100, 50, 0.08);
}

.ye-step-num {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: rgba(102, 136, 170, 0.2);
  border: 1px solid rgba(102, 136, 170, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: bold;
  color: #99ccff;
  flex-shrink: 0;
}

.ye-step--done .ye-step-num {
  background: rgba(0, 200, 100, 0.2);
  border-color: rgba(0, 200, 100, 0.4);
  color: #55ee99;
}

.ye-step-body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
}

.ye-step-title {
  font-size: 1rem;
  font-weight: bold;
  color: #cce0ff;
}

.ye-step-desc {
  font-size: 0.85rem;
  color: #6688aa;
  line-height: 1.5;
}

.ye-step-check    { color: #55ee99; display: block; margin-top: 0.25rem; }
.ye-step-remaining { color: #ffaa44; display: block; margin-top: 0.25rem; }
.ye-step-btn      { margin-top: 0.5rem; }

.ye-code-steps {
  margin: 0.5rem 0 0 1.25rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

code {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  background: rgba(0, 30, 60, 0.6);
  padding: 0.1rem 0.35rem;
  border-radius: 0.2rem;
  color: #99ccff;
}

/* ── Buttons ────────────────────────────────────────────────────────────── */
.ye-btn {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 0.08em;
  padding: 0.45rem 1rem;
  border-radius: 0.35rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}

.ye-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ye-btn--primary {
  background: rgba(0, 102, 255, 0.15);
  border-color: rgba(0, 102, 255, 0.4);
  color: #6699ff;
}
.ye-btn--primary:not(:disabled):hover {
  background: rgba(0, 102, 255, 0.25);
  border-color: rgba(0, 102, 255, 0.7);
}

.ye-btn--danger {
  background: rgba(200, 50, 50, 0.12);
  border-color: rgba(200, 50, 50, 0.35);
  color: #ff7070;
}
.ye-btn--danger:not(:disabled):hover {
  background: rgba(200, 50, 50, 0.22);
  border-color: rgba(200, 50, 50, 0.65);
}

.ye-btn--accent {
  background: rgba(255, 153, 0, 0.1);
  border-color: rgba(255, 153, 0, 0.3);
  color: #ff9900;
}
.ye-btn--accent:not(:disabled):hover {
  background: rgba(255, 153, 0, 0.2);
  border-color: rgba(255, 153, 0, 0.6);
}

.ye-btn--ghost {
  background: transparent;
  border-color: rgba(102, 136, 170, 0.3);
  color: #6688aa;
}
.ye-btn--ghost:not(:disabled):hover {
  border-color: rgba(102, 136, 170, 0.6);
  color: #99ccff;
}

.ye-btn--sm {
  font-size: 0.7rem;
  padding: 0.3rem 0.65rem;
}

/* ── Inputs ─────────────────────────────────────────────────────────────── */
.ye-select, .ye-input {
  background: rgba(0, 20, 50, 0.6);
  border: 1px solid rgba(102, 136, 170, 0.25);
  border-radius: 0.35rem;
  color: #99ccff;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  outline: none;
  transition: border-color 0.15s;
}
.ye-select:focus, .ye-input:focus {
  border-color: rgba(102, 136, 170, 0.55);
}
.ye-select option { background: #0b1220; color: #e6f0ff; }
.ye-select--full  { width: 100%; }
.ye-input { flex: 1; }

/* ── Move-back dialog ───────────────────────────────────────────────────── */
.ye-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 5, 20, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.ye-dialog {
  background: #0d1e38;
  border: 1px solid rgba(102, 136, 170, 0.3);
  border-radius: 0.75rem;
  padding: 1.75rem;
  width: min(32rem, 90vw);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ye-dialog-title {
  font-size: 1.15rem;
  font-weight: bold;
  color: #ff9900;
}

.ye-dialog-desc {
  margin: 0;
  color: #6688aa;
  font-size: 0.9rem;
}

.ye-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

/* ── Help panel ─────────────────────────────────────────────────────────── */
.ye-help {
  border: 1px solid rgba(102, 136, 170, 0.2);
  border-radius: 0.5rem;
  overflow: hidden;
}

.ye-help-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1.25rem;
  background: rgba(0, 20, 50, 0.4);
  border: none;
  color: #6688aa;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.9rem;
  font-weight: bold;
  letter-spacing: 0.05em;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.ye-help-toggle:hover {
  background: rgba(0, 30, 65, 0.6);
  color: #99ccff;
}

.ye-help-chevron {
  font-size: 1rem;
  transition: transform 0.2s;
  line-height: 1;
}
.ye-help-chevron--open {
  transform: rotate(180deg);
}

.ye-help-body {
  padding: 1.25rem 1.5rem 1.5rem;
  background: rgba(0, 15, 40, 0.35);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  border-top: 1px solid rgba(102, 136, 170, 0.12);
}

.ye-help-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.ye-help-heading {
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  color: #ff9900;
  text-transform: uppercase;
}

.ye-help-body p {
  margin: 0;
  color: #7799bb;
  font-size: 0.875rem;
  line-height: 1.6;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

.ye-help-body strong { color: #99ccff; font-weight: bold; }
.ye-help-body em     { color: #aabbdd; font-style: normal; }

.ye-help-ol,
.ye-help-ul {
  margin: 0.4rem 0 0 1.4rem;
  padding: 0;
  color: #7799bb;
  font-size: 0.875rem;
  line-height: 1.8;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}
</style>
