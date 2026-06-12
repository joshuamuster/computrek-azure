<template>
  <div class="seed-page">
    <div class="lcars-text-bar"><span>Demo Data Seeder</span></div>
    <p class="sub-label">Populates Firestore with realistic demo data so every system can be tested end-to-end.</p>

    <!-- Status -->
    <div v-if="running" class="progress-panel">
      <div class="progress-label">{{ currentStep }}</div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" :style="{ width: progressPct + '%' }"></div>
      </div>
      <div class="progress-pct">{{ progressPct }}%</div>
    </div>

    <div v-if="doneMessage" class="done-banner" :class="doneError ? 'done-error' : 'done-ok'">
      {{ doneMessage }}
    </div>

    <!-- Log -->
    <div v-if="log.length" class="log-panel">
      <div v-for="(line, i) in log" :key="i" class="log-line" :class="line.type">
        <span class="log-icon">{{ line.type === 'ok' ? '✓' : line.type === 'skip' ? '—' : line.type === 'err' ? '✕' : '…' }}</span>
        {{ line.msg }}
      </div>
    </div>

    <!-- Seeding Options -->
    <div class="options-container" :class="{ 'is-running': running }">

      <div class="option-section">
        <div class="option-label">TARGET TEACHERS</div>
        <div class="checkbox-grid">
          <label v-for="t in teachers" :key="t.email" class="cb-label">
            <input type="checkbox" :value="t.email" v-model="selectedTeacherEmails" :disabled="running">
            {{ t.displayName || t.email }}
          </label>
        </div>
        <p class="option-help">Data will be seeded for each selected teacher independently.</p>
      </div>

      <div class="option-section">
        <div class="option-label">PERIODS &amp; GRADE PRESETS</div>
        <div class="period-preset-grid">
          <div v-for="pid in PERIOD_IDS_LIST" :key="pid" class="period-row">
            <label class="cb-label period-cb">
              <input type="checkbox" :value="pid" v-model="selectedPeriods" :disabled="running">
            </label>
            <div class="period-info">
              <span class="period-num">{{ pid.replace('period-', 'P') }}</span>
              <span class="period-franchise">{{ PERIOD_METADATA[pid].franchise }}</span>
            </div>
            <select v-model="selectedPresets[pid]" :disabled="running" class="lcars-select preset-select">
              <option v-for="(p, key) in GRADE_PRESETS" :key="key" :value="key">{{ p.icon }} {{ p.label }}</option>
            </select>
          </div>
        </div>
        <p class="option-help">Grade preset controls score distribution and the Systems page ship health colors.</p>
      </div>

      <div class="option-section">
        <div class="option-label">WHAT TO SEED</div>
        <div class="checkbox-grid">
          <label class="cb-label"><input type="checkbox" v-model="selectedCategories.missions"      :disabled="running"> Missions</label>
          <label class="cb-label"><input type="checkbox" v-model="selectedCategories.cadets"        :disabled="running"> Cadets</label>
          <label class="cb-label"><input type="checkbox" v-model="selectedCategories.assignments"   :disabled="running"> Assignments</label>
          <label class="cb-label"><input type="checkbox" v-model="selectedCategories.submissions"   :disabled="running"> Submissions</label>
          <label class="cb-label"><input type="checkbox" v-model="selectedCategories.shipStatus"    :disabled="running"> Ship Status</label>
          <label class="cb-label"><input type="checkbox" v-model="selectedCategories.typingResults" :disabled="running"> Typing Results</label>
          <label class="cb-label"><input type="checkbox" v-model="selectedCategories.conduct"       :disabled="running"> Conduct Data</label>
          <label class="cb-label"><input type="checkbox" v-model="selectedCategories.seatingChart"  :disabled="running"> Seating Chart</label>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls">
      <div class="control-group">
        <div class="control-label">SEED DEMO DATA</div>
        <p class="control-desc">
          Runs for <strong>{{ selectedTeacherEmails.length }} teacher(s)</strong> ×
          <strong>{{ selectedPeriods.length }} period(s)</strong>.
          Each period gets 25 cadets, 5 assignments, 125 submissions, 175 typing sessions, and conduct entries.
          Missions are created once per teacher and shared across all periods.
        </p>
        <button class="action-btn action-btn--seed" :disabled="running || !selectedTeacherEmails.length || !selectedPeriods.length" @click="runSeed">
          {{ running ? 'RUNNING…' : 'RUN SEED' }}
        </button>
      </div>

      <div class="divider"></div>

      <div class="control-group">
        <div class="control-label">CLEAR DEMO DATA</div>
        <p class="control-desc">
          Deletes all documents tagged <code>isDemoData: true</code> scoped to the selected
          teachers and periods. Resets shipStatus for selected periods to defaults.
        </p>
        <button class="action-btn action-btn--clear" :disabled="running || !selectedTeacherEmails.length || !selectedPeriods.length" @click="runClear">
          {{ running ? 'RUNNING…' : 'CLEAR DEMO DATA' }}
        </button>
      </div>
    </div>

    <!-- Reference cards -->
    <div class="reference-grid">
      <div class="ref-card">
        <div class="ref-title">MISSIONS (6 across 3 units)</div>
        <div class="ref-item" style="color:#f96;font-size:0.7rem;letter-spacing:0.1em">UNIT 1 · INTRO TO PROGRAMMING</div>
        <div class="ref-item">📎 Daily Typing Warm-Up · 10 pts</div>
        <div class="ref-item">📎 Intro to Variables Lab · 50 pts</div>
        <div class="ref-item" style="color:#f96;font-size:0.7rem;letter-spacing:0.1em;margin-top:0.35rem">UNIT 2 · FUNCTIONS &amp; LOOPS</div>
        <div class="ref-item">📎 Variables Challenge · 20 pts</div>
        <div class="ref-item">📎 Functions &amp; Parameters · 40 pts</div>
        <div class="ref-item" style="color:#f96;font-size:0.7rem;letter-spacing:0.1em;margin-top:0.35rem">UNIT 3 · CONTROL FLOW</div>
        <div class="ref-item">📎 Loop Design Challenge · 30 pts</div>
        <div class="ref-item">📎 Conditional Logic Lab · 35 pts</div>
      </div>
      <div class="ref-card">
        <div class="ref-title">CADETS (25 per period · 200 total)</div>
        <div class="ref-item" style="color:#f96;font-size:0.7rem;letter-spacing:0.1em">8 FRANCHISE THEMES</div>
        <div class="ref-item">P1: TOS &nbsp;·&nbsp; P2: Prequels / Clone Wars</div>
        <div class="ref-item">P3: TNG &nbsp;·&nbsp; P4: OT / Rogue One</div>
        <div class="ref-item">P5: Voyager &nbsp;·&nbsp; P6: Sequel Trilogy</div>
        <div class="ref-item">P7: Battlestar Galactica &nbsp;·&nbsp; P8: Firefly</div>
        <div class="ref-item" style="margin-top:0.35rem">Seating: 5 × 6 grid · all 25 seated · 5 empty</div>
      </div>
      <div class="ref-card">
        <div class="ref-title">GRADE PRESETS</div>
        <div class="ref-item">🔵 Warp 9 — ≥90% health (blue)</div>
        <div class="ref-item">🟢 On Course — ≥80% health (green)</div>
        <div class="ref-item">🟡 Mixed Signals — ≥70% health (yellow)</div>
        <div class="ref-item">🟠 Hull Breach — ≥60% health (orange)</div>
        <div class="ref-item">🔴 Red Alert — &lt;60% health (red)</div>
        <div class="ref-item" style="margin-top:0.35rem;color:#ff9900">Drives Systems page ship zone colors</div>
      </div>
      <div class="ref-card">
        <div class="ref-title">HISTORY (graded) — per period</div>
        <div class="ref-item">📋 Variables Lab · 28 days ago · all graded</div>
        <div class="ref-item">📋 Functions &amp; Parameters · 14 days ago · all graded</div>
        <div class="ref-item">Scores derived from selected grade preset</div>
      </div>
      <div class="ref-card">
        <div class="ref-title">GRADING QUEUE — per period</div>
        <div class="ref-item">📬 Variables Challenge · 7 days ago · all submitted</div>
        <div class="ref-item">📬 Typing Warm-Up · 3 days ago · all submitted</div>
        <div class="ref-item">All 25 students awaiting a grade</div>
      </div>
      <div class="ref-card">
        <div class="ref-title">IN-FLIGHT SESSION — per period</div>
        <div class="ref-item">📡 Conditional Logic Lab · due today</div>
        <div class="ref-item">Warp 9: ~18 submitted · Red Alert: ~4</div>
        <div class="ref-item">Partial class progress varies by preset</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  collection, addDoc, setDoc, doc, getDocs, deleteDoc,
  query, where, writeBatch, serverTimestamp, Timestamp,
} from '@/data/db'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { SCHOOL_YEAR_ID } from '@/config/schoolYear'

const { userInfo } = useAuth()

// ── State ─────────────────────────────────────────────────────────────────────
const running     = ref(false)
const currentStep = ref('')
const progressPct = ref(0)
const doneMessage = ref('')
const doneError   = ref(false)
const log         = ref<{ type: 'ok'|'skip'|'err'|'info'; msg: string }[]>([])

const teachers = ref<{ email: string; displayName?: string }[]>([])
const selectedTeacherEmails = ref<string[]>([])
const selectedPeriods = ref<string[]>([
  'period-1','period-2','period-3','period-4',
  'period-5','period-6','period-7','period-8',
])
const selectedCategories = ref({
  missions:      true,
  cadets:        true,
  assignments:   true,
  submissions:   true,
  shipStatus:    true,
  typingResults: true,
  conduct:       true,
  seatingChart:  true,
})

onMounted(async () => {
  try {
    const snap = await getDocs(collection(db, 'approvedUsers'))
    teachers.value = snap.docs
      .filter(d => d.data().role === 'staff')
      .map(d => ({ email: d.id, displayName: d.data().displayName as string }))
      .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email))

    const currentEmail = userInfo.value?.email
    if (currentEmail && teachers.value.some(t => t.email === currentEmail)) {
      selectedTeacherEmails.value = [currentEmail]
    } else {
      selectedTeacherEmails.value = teachers.value.map(t => t.email)
    }
  } catch (e) {
    console.error('Failed to fetch teachers:', e)
    selectedTeacherEmails.value = ['demo@teacher.local']
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function addLog(type: 'ok'|'skip'|'err'|'info', msg: string) {
  log.value.push({ type, msg })
}
function step(msg: string, pct: number) {
  currentStep.value = msg
  progressPct.value = pct
}
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function pastDate(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}
function makeUid() {
  return 'demo_' + Math.random().toString(36).slice(2, 12)
}
function daysAgoTimestamp(daysAgo: number, sessionIndex: number): Timestamp {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(8 + (sessionIndex % 3), 5 + (sessionIndex * 7) % 50, 0, 0)
  return Timestamp.fromDate(d)
}

// ── Period metadata ───────────────────────────────────────────────────────────
const PERIOD_METADATA: Record<string, { franchise: string; defaultPreset: string }> = {
  'period-1': { franchise: 'TOS Crew',             defaultPreset: 'warp9'       },
  'period-2': { franchise: 'Prequels / Clone Wars', defaultPreset: 'on-course'   },
  'period-3': { franchise: 'TNG Crew',              defaultPreset: 'warp9'       },
  'period-4': { franchise: 'OT / Rogue One',        defaultPreset: 'on-course'   },
  'period-5': { franchise: 'Voyager Crew',           defaultPreset: 'mixed'       },
  'period-6': { franchise: 'Sequel Trilogy',         defaultPreset: 'hull-breach' },
  'period-7': { franchise: 'Battlestar Galactica',   defaultPreset: 'mixed'       },
  'period-8': { franchise: 'Firefly Crew',           defaultPreset: 'red-alert'   },
}

const PERIOD_IDS_LIST = Object.keys(PERIOD_METADATA)

// ── Grade archetypes ──────────────────────────────────────────────────────────
type GradeType = 'A' | 'B' | 'C' | 'D' | 'F'

const GRADE_PROFILES: Record<GradeType, {
  scoreFraction: number
  baseWpm: number
  accuracy: number
  conductRating: { participation: number; respect: number; onTask: number; effort: number }
}> = {
  A: { scoreFraction: 0.97, baseWpm: 65, accuracy: 96, conductRating: { participation: 5, respect: 5, onTask: 5, effort: 5 } },
  B: { scoreFraction: 0.87, baseWpm: 52, accuracy: 92, conductRating: { participation: 4, respect: 4, onTask: 4, effort: 4 } },
  C: { scoreFraction: 0.76, baseWpm: 41, accuracy: 87, conductRating: { participation: 3, respect: 4, onTask: 3, effort: 3 } },
  D: { scoreFraction: 0.62, baseWpm: 31, accuracy: 81, conductRating: { participation: 2, respect: 3, onTask: 2, effort: 2 } },
  F: { scoreFraction: 0.44, baseWpm: 22, accuracy: 74, conductRating: { participation: 1, respect: 2, onTask: 1, effort: 2 } },
}

// ── Grade presets (25-student distributions) ──────────────────────────────────
// Health is derived at seed time from actual score fractions:
//   Warp 9      → ~90.5% → blue   (12A 10B 3C)
//   On Course   → ~83.9% → green  (5A 11B 7C 2D)
//   Mixed Sig.  → ~76.7% → yellow (2A 7B 10C 5D 1F)
//   Hull Breach → ~65.9% → orange (3B 8C 9D 5F)
//   Red Alert   → ~57.3% → red    (1B 4C 9D 11F)
const GRADE_PRESETS: Record<string, {
  label: string
  icon: string
  dist: GradeType[]
  overdueCount: number
  currentSubmittedCount: number
}> = {
  'warp9': {
    label: 'Warp 9', icon: '🔵',
    dist: ['A','A','A','A','A','A','A','A','A','A','A','A','B','B','B','B','B','B','B','B','B','B','C','C','C'],
    overdueCount: 1, currentSubmittedCount: 18,
  },
  'on-course': {
    label: 'On Course', icon: '🟢',
    dist: ['A','A','A','A','A','B','B','B','B','B','B','B','B','B','B','B','C','C','C','C','C','C','C','D','D'],
    overdueCount: 3, currentSubmittedCount: 14,
  },
  'mixed': {
    label: 'Mixed Signals', icon: '🟡',
    dist: ['A','A','B','B','B','B','B','B','B','C','C','C','C','C','C','C','C','C','C','D','D','D','D','D','F'],
    overdueCount: 6, currentSubmittedCount: 10,
  },
  'hull-breach': {
    label: 'Hull Breach', icon: '🟠',
    dist: ['B','B','B','C','C','C','C','C','C','C','C','D','D','D','D','D','D','D','D','D','F','F','F','F','F'],
    overdueCount: 11, currentSubmittedCount: 7,
  },
  'red-alert': {
    label: 'Red Alert', icon: '🔴',
    dist: ['B','C','C','C','C','D','D','D','D','D','D','D','D','D','F','F','F','F','F','F','F','F','F','F','F'],
    overdueCount: 17, currentSubmittedCount: 4,
  },
}

// ── Per-period preset selection (initialized from defaults) ───────────────────
const selectedPresets = ref<Record<string, string>>(
  Object.fromEntries(
    Object.entries(PERIOD_METADATA).map(([pid, m]) => [pid, m.defaultPreset])
  )
)

// ── Cadet names (25 per period, franchise-themed) ─────────────────────────────
const CADET_NAMES: Record<string, string[]> = {
  // Star Trek: The Original Series
  'period-1': [
    'James Kirk', 'Spock', 'Leonard McCoy', 'Nyota Uhura', 'Hikaru Sulu',
    'Montgomery Scott', 'Pavel Chekov', 'Christine Chapel', 'Janice Rand', 'Kevin Riley',
    'M\'Benga', 'Lt. Kyle', 'Marlena Moreau', 'Gary Mitchell', 'Elizabeth Dehner',
    'Sarek', 'Harry Mudd', 'Lt. Leslie', 'Arex', 'Edith Keeler',
    'Ben Finney', 'Commodore Decker', 'Roger Korby', 'Marla McGivers', 'Carol Marcus',
  ],
  // Star Wars: Prequels / Clone Wars
  'period-2': [
    'Anakin Skywalker', 'Obi-Wan Kenobi', 'Padmé Amidala', 'Yoda', 'Mace Windu',
    'Qui-Gon Jinn', 'Ahsoka Tano', 'Captain Rex', 'Plo Koon', 'Ki-Adi-Mundi',
    'Aayla Secura', 'Kit Fisto', 'Shaak Ti', 'Luminara Unduli', 'Count Dooku',
    'General Grievous', 'Asajj Ventress', 'Wilhuff Tarkin', 'Bail Organa', 'Jar Jar Binks',
    'Fives', 'Echo', 'Commander Cody', 'Jango Fett', 'Dexter Jettster',
  ],
  // Star Trek: The Next Generation
  'period-3': [
    'Jean-Luc Picard', 'William Riker', 'Data', 'Deanna Troi', 'Geordi La Forge',
    'Worf', 'Beverly Crusher', 'Wesley Crusher', 'Tasha Yar', 'Miles O\'Brien',
    'Guinan', 'Ro Laren', 'Reginald Barclay', 'Keiko O\'Brien', 'Katherine Pulaski',
    'Lwaxana Troi', 'Alexander Rozhenko', 'Lore', 'Q', 'Thomas Riker',
    'Gowron', 'K\'Ehleyr', 'Sela', 'Hugh', 'Vash',
  ],
  // Star Wars: Original Trilogy / Rogue One
  'period-4': [
    'Luke Skywalker', 'Princess Leia', 'Han Solo', 'Chewbacca', 'Darth Vader',
    'Ben Kenobi', 'Lando Calrissian', 'R2-D2', 'C-3PO', 'Boba Fett',
    'Admiral Ackbar', 'Mon Mothma', 'Wedge Antilles', 'Jyn Erso', 'Cassian Andor',
    'Chirrut Imwe', 'Baze Malbus', 'Bodhi Rook', 'K-2SO', 'Galen Erso',
    'Orson Krennic', 'General Dodonna', 'Biggs Darklighter', 'Nien Nunb', 'Greedo',
  ],
  // Star Trek: Voyager
  'period-5': [
    'Kathryn Janeway', 'Chakotay', 'Tuvok', 'B\'Elanna Torres', 'Tom Paris',
    'Harry Kim', 'Seven of Nine', 'The Doctor', 'Neelix', 'Kes',
    'Naomi Wildman', 'Samantha Wildman', 'Seska', 'Joe Carey', 'Vorik',
    'Lon Suder', 'Icheb', 'Q Junior', 'Ayala', 'Gerron',
    'Tal Celes', 'William Telfer', 'Noah Lessing', 'Chell', 'Mortimer Harren',
  ],
  // Star Wars: Sequel Trilogy
  'period-6': [
    'Rey', 'Finn', 'Poe Dameron', 'Kylo Ren', 'General Hux',
    'Maz Kanata', 'Snoke', 'Rose Tico', 'Jannah', 'Zorri Bliss',
    'Allegiant Pryde', 'Captain Phasma', 'BB-8', 'Kaydel Connix', 'Snap Wexley',
    'Beaumont Kin', 'Kazuda Xiono', 'Temmin Wexley', 'Paige Tico', 'Tallie Lintra',
    'Lt. Mitaka', 'Major Ematt', 'Ello Asty', 'Sidon Ithano', 'Unkar Plutt',
  ],
  // Battlestar Galactica
  'period-7': [
    'William Adama', 'Lee Adama', 'Kara Thrace', 'Gaius Baltar', 'Laura Roslin',
    'Saul Tigh', 'Karl Agathon', 'Sharon Valerii', 'Caprica Six', 'Sam Anders',
    'Felix Gaeta', 'Cally Henderson', 'Galen Tyrol', 'Anastasia Dualla', 'Billy Keikeya',
    'Ellen Tigh', 'Tom Zarek', 'Brother Cavil', 'Leoben Conoy', 'D\'Anna Biers',
    'Margaret Edmondson', 'Louanne Katraine', 'Brendan Costanza', 'Kendra Shaw', 'Hamish McCall',
  ],
  // Firefly
  'period-8': [
    'Malcolm Reynolds', 'Zoe Washburne', 'Hoban Washburne', 'Inara Serra', 'Jayne Cobb',
    'Kaylee Frye', 'Simon Tam', 'River Tam', 'Derrial Book', 'Saffron',
    'Badger', 'Jubal Early', 'Niska', 'Tracey Smith', 'Patience',
    'Harrow', 'Durran Haymer', 'Fanty', 'Mingo', 'Nandi',
    'Petaline', 'Magistrate Higgins', 'Fess Higgins', 'Mr. Universe', 'Monty',
  ],
}

// ── Seating chart empty seats (5×6 grid, 5 empty per period) ─────────────────
// All 25 students are placed; these 5 seats per period are left null.
const EMPTY_SEATS: Record<string, string[]> = {
  'period-1': ['r1c3', 'r2c1', 'r3c5', 'r4c2', 'r4c4'],
  'period-2': ['r0c5', 'r2c3', 'r3c1', 'r3c4', 'r4c0'],
  'period-3': ['r0c2', 'r1c5', 'r2c4', 'r4c1', 'r4c3'],
  'period-4': ['r0c0', 'r1c2', 'r3c3', 'r4c4', 'r4c5'],
  'period-5': ['r0c4', 'r2c0', 'r2c5', 'r3c2', 'r4c1'],
  'period-6': ['r0c1', 'r1c4', 'r2c2', 'r3c0', 'r4c5'],
  'period-7': ['r0c3', 'r1c0', 'r2c5', 'r3c4', 'r4c2'],
  'period-8': ['r0c5', 'r1c1', 'r3c3', 'r4c0', 'r4c4'],
}

// Replicates useSeatingChart's doc-ID logic without importing the composable
function seatingChartDocId(teacherEmail: string, periodId: string): string {
  return `${teacherEmail.replace(/[@.]/g, '_')}__${periodId}`
}

// ── Feedback notes ────────────────────────────────────────────────────────────
const FEEDBACK_NOTES = [
  'Great work! Keep it up.',
  'Good effort — solid understanding.',
  'Well done! Nice attention to detail.',
  'Good thinking through the problem.',
  'Getting there — keep working on the fundamentals.',
]

// ── Mission definitions ───────────────────────────────────────────────────────
type MissionKey = 'warmUp' | 'lesson1' | 'extension1' | 'lesson2' | 'extension2' | 'lesson3'
const MISSION_DEFS: { key: MissionKey; title: string; description: string; pointsPossible: number; unitId: string }[] = [
  { key: 'warmUp',     title: 'Daily Typing Warm-Up',  description: 'Complete today\'s typing drill and screenshot your WPM score.',               pointsPossible: 10, unitId: 'unit-1' },
  { key: 'lesson1',   title: 'Intro to Variables Lab', description: 'Follow the guided lab to declare and use variables in JavaScript.',            pointsPossible: 50, unitId: 'unit-1' },
  { key: 'extension1', title: 'Variables Challenge',   description: 'Apply your knowledge — build a small program using at least 5 variables.',     pointsPossible: 20, unitId: 'unit-2' },
  { key: 'lesson2',   title: 'Functions & Parameters', description: 'Learn how to write reusable functions and pass arguments in JavaScript.',       pointsPossible: 40, unitId: 'unit-2' },
  { key: 'extension2', title: 'Loop Design Challenge', description: 'Use for-loops and while-loops to solve the provided coding challenges.',        pointsPossible: 30, unitId: 'unit-3' },
  { key: 'lesson3',   title: 'Conditional Logic Lab',  description: 'Practice if/else logic by coding decision-making programs with multiple conditions.', pointsPossible: 35, unitId: 'unit-3' },
]

// ── Assignment layout (same for every period) ─────────────────────────────────
type AssignSlot = 'hist1' | 'hist2' | 'queue1' | 'queue2' | 'current'
const ASSIGN_SLOTS: { slot: AssignSlot; missionKey: MissionKey; daysAgo: number; quarterId: string }[] = [
  { slot: 'hist1',   missionKey: 'lesson1',    daysAgo: 28, quarterId: '2026-Q3' },
  { slot: 'hist2',   missionKey: 'lesson2',    daysAgo: 14, quarterId: '2026-Q3' },
  { slot: 'queue1',  missionKey: 'extension1', daysAgo:  7, quarterId: '2026-Q4' },
  { slot: 'queue2',  missionKey: 'warmUp',     daysAgo:  3, quarterId: '2026-Q4' },
  { slot: 'current', missionKey: 'lesson3',    daysAgo:  0, quarterId: '2026-Q4' },
]

// ── Typing session schedule ───────────────────────────────────────────────────
const TYPING_SESSION_DAYS = [22, 18, 15, 11, 7, 4, 1]

const KEY_ERROR_SETS = [
  { f: 3, j: 2, k: 4, semicolon: 1 },
  { j: 5, u: 3, m: 2, k: 2 },
  { f: 6, g: 4, h: 3, b: 2, y: 2 },
  { l: 3, o: 2, p: 1, semicolon: 3 },
  { f: 2, j: 3, n: 4, m: 3, h: 2 },
]

// ── Conduct seed data ──────────────────────────────────────────────────────────
const CURRENT_QUARTER_ID = '2026-Q4'

const CONDUCT_ENTRIES_POS = [
  'Helped a classmate debug their code without being asked.',
  'Stayed completely on task the entire period — excellent focus today.',
  'Asked thoughtful questions during the lesson.',
  'Finished early and used extra time productively on extension work.',
  'Showed great problem-solving skills — kept trying instead of giving up.',
]

const CONDUCT_ENTRIES_NEG = [
  'Using phone during independent work time.',
  'Talking out of turn repeatedly during direct instruction.',
  'Off-task browsing on computer during assignment time.',
  'Slow to transition — needed several reminders to get started.',
]

// ── Seed function ─────────────────────────────────────────────────────────────
async function runSeed() {
  running.value     = true
  doneMessage.value = ''
  doneError.value   = false
  log.value         = []

  try {
    const today   = todayStr()
    const cats    = selectedCategories.value
    const periods = selectedPeriods.value
    const emails  = selectedTeacherEmails.value

    const totalSteps = emails.length * periods.length
    let   stepsDone  = 0

    for (const teacherEmail of emails) {
      addLog('info', `── Teacher: ${teacherEmail} ──`)

      // 1. Missions (once per teacher)
      const missionIds = new Map<MissionKey, string>()

      if (cats.missions) {
        step(`[${teacherEmail}] Creating missions…`, Math.round((stepsDone / totalSteps) * 90))
        for (const m of MISSION_DEFS) {
          const ref = await addDoc(collection(db, 'missions'), {
            title: m.title, description: m.description, type: 'file',
            pointsPossible: m.pointsPossible, rubric: [], attachments: [],
            teacherEmail, schoolYearId: SCHOOL_YEAR_ID, archived: false,
            unitId: m.unitId, isDemoData: true, createdAt: serverTimestamp(),
          })
          missionIds.set(m.key, ref.id)
          addLog('ok', `Mission: ${m.title}`)
        }
      } else {
        addLog('info', 'Skipping missions — searching for existing…')
        const snap = await getDocs(query(
          collection(db, 'missions'),
          where('teacherEmail', '==', teacherEmail),
          where('isDemoData', '==', true),
        ))
        snap.forEach(d => {
          const found = MISSION_DEFS.find(m => m.title === d.data().title)
          if (found) missionIds.set(found.key, d.id)
        })
        addLog(missionIds.size > 0 ? 'ok' : 'info', `Found ${missionIds.size} existing demo missions.`)
      }

      // 2–8. Per-period data
      for (const periodId of periods) {
        const names     = CADET_NAMES[periodId] ?? []
        const presetKey = selectedPresets.value[periodId] ?? 'on-course'
        const preset    = GRADE_PRESETS[presetKey]
        addLog('info', `  Period: ${periodId} [${preset.label}]`)

        // 2. Cadets
        const periodCadetUids: string[] = []
        if (cats.cadets) {
          step(`[${periodId}] Creating cadets…`, Math.round((stepsDone / totalSteps) * 90) + 2)
          const batch = writeBatch(db)
          for (const name of names) {
            const uid    = makeUid()
            const email  = name.toLowerCase().replace(/[^a-z]/g, '') + '@demo.cadet'
            const docRef = doc(collection(db, 'approvedUsers'))
            batch.set(docRef, {
              uid, displayName: name, email, role: 'cadet',
              periodId, schoolYearId: SCHOOL_YEAR_ID, teacherEmail,
              conductScore: 4, isDemoData: true, createdAt: serverTimestamp(),
            })
            periodCadetUids.push(uid)
          }
          await batch.commit()
          addLog('ok', `  Cadets: ${periodId} (${names.length})`)
        } else {
          const snap = await getDocs(query(
            collection(db, 'approvedUsers'),
            where('teacherEmail', '==', teacherEmail),
            where('isDemoData', '==', true),
            where('role', '==', 'cadet'),
            where('periodId', '==', periodId),
          ))
          snap.forEach(d => periodCadetUids.push(d.data().uid))
          addLog('info', `  Cadets: found ${periodCadetUids.length} existing`)
        }

        // 3. Assignments
        const assignIds = new Map<string, string>()
        if (cats.assignments) {
          if (missionIds.size === 0) throw new Error('No missions — seed missions first.')
          step(`[${periodId}] Creating assignments…`, Math.round((stepsDone / totalSteps) * 90) + 4)
          for (const { slot, missionKey, daysAgo, quarterId } of ASSIGN_SLOTS) {
            const mId = missionIds.get(missionKey)
            if (!mId) continue
            const dueDate = daysAgo === 0 ? today : pastDate(daysAgo)
            const ref = await addDoc(collection(db, 'assignments'), {
              missionId: mId, periodId, dueDate, quarterId,
              schoolYearId: SCHOOL_YEAR_ID, teacherEmail,
              assignedAt: serverTimestamp(),
              isDemoData: true, _demoSlot: `${teacherEmail}:${periodId}:${slot}`,
            })
            assignIds.set(slot, ref.id)
          }
          addLog('ok', `  Assignments: ${periodId} (${ASSIGN_SLOTS.length})`)
        } else {
          const snap = await getDocs(query(
            collection(db, 'assignments'),
            where('teacherEmail', '==', teacherEmail),
            where('isDemoData', '==', true),
            where('periodId', '==', periodId),
          ))
          snap.forEach(d => {
            const raw = d.data()._demoSlot as string | undefined
            if (raw) {
              const slot = raw.split(':').slice(-1)[0]
              assignIds.set(slot, d.id)
            }
          })
          addLog('info', `  Assignments: found ${assignIds.size} existing`)
        }

        // 4. Submissions
        if (cats.submissions && assignIds.size > 0 && periodCadetUids.length > 0) {
          step(`[${periodId}] Creating submissions…`, Math.round((stepsDone / totalSteps) * 90) + 6)
          const batch = writeBatch(db)
          const submittedInCurrent = preset.currentSubmittedCount
          for (const { slot, missionKey, quarterId } of ASSIGN_SLOTS) {
            const assignId = assignIds.get(slot)
            const mId      = missionIds.get(missionKey) ?? ''
            const mDef     = MISSION_DEFS.find(m => m.key === missionKey)!
            if (!assignId) continue
            for (let i = 0; i < periodCadetUids.length; i++) {
              const studentId = periodCadetUids[i]
              const gradeType = preset.dist[i % preset.dist.length]
              const scoreFrac = GRADE_PROFILES[gradeType].scoreFraction
              const earned    = Math.round(scoreFrac * mDef.pointsPossible)
              const feedback  = FEEDBACK_NOTES[i % FEEDBACK_NOTES.length]
              let status: string
              let extraFields: Record<string, any>
              if (slot === 'hist1' || slot === 'hist2') {
                status = 'graded'
                extraFields = { pointsEarned: earned, pointsPossible: mDef.pointsPossible, feedbackNote: feedback, data: { url: 'https://example.com/demo', fileName: 'assignment.pdf' }, submittedAt: serverTimestamp() }
              } else if (slot === 'queue1' || slot === 'queue2') {
                status = 'submitted'
                extraFields = { pointsEarned: null, pointsPossible: mDef.pointsPossible, feedbackNote: '', data: { url: 'https://example.com/demo', fileName: 'assignment.pdf' }, submittedAt: serverTimestamp() }
              } else {
                const hasSubmitted = i < submittedInCurrent
                status = hasSubmitted ? 'submitted' : 'assigned'
                extraFields = { pointsEarned: null, pointsPossible: mDef.pointsPossible, feedbackNote: '', data: hasSubmitted ? { url: 'https://example.com/demo', fileName: 'assignment.pdf' } : {}, submittedAt: hasSubmitted ? serverTimestamp() : null }
              }
              const newRef = doc(collection(db, 'submissions'))
              batch.set(newRef, { studentId, assignmentId: assignId, missionId: mId, periodId, quarterId, schoolYearId: SCHOOL_YEAR_ID, type: 'file', status, dueDateOverride: null, isDemoData: true, ...extraFields })
            }
          }
          await batch.commit()
          addLog('ok', `  Submissions: ${periodId} — ${periodCadetUids.length * 2} graded, ${periodCadetUids.length * 2} in queue, ${submittedInCurrent}/${periodCadetUids.length} in-flight`)
        } else if (cats.submissions) {
          addLog('info', '  Skipping submissions — no assignments or cadets.')
        }

        // 5. Ship Status (derived from grade distribution)
        if (cats.shipStatus) {
          const histPoints = [
            MISSION_DEFS.find(m => m.key === 'lesson1')!.pointsPossible,  // 50
            MISSION_DEFS.find(m => m.key === 'lesson2')!.pointsPossible,  // 40
          ]
          const totalPossible = preset.dist.length * histPoints.reduce((a, b) => a + b, 0)
          let totalEarned = 0
          for (const g of preset.dist) {
            const frac = GRADE_PROFILES[g].scoreFraction
            for (const pp of histPoints) totalEarned += Math.round(frac * pp)
          }
          const health      = Math.round(totalEarned / totalPossible * 100)
          const gradedCount = preset.dist.length * histPoints.length
          await setDoc(doc(db, 'shipStatus', periodId), {
            health, gradedCount, overdueCount: preset.overdueCount,
            totalEarned, totalPossible,
            isDemoData: true, lastUpdated: serverTimestamp(),
          })
          addLog('ok', `  ShipStatus: ${periodId} → ${health}% (${preset.label})`)
        }

        // 6. Typing Results
        if (cats.typingResults && periodCadetUids.length > 0) {
          step(`[${periodId}] Creating typing results…`, Math.round((stepsDone / totalSteps) * 90) + 7)
          const batch = writeBatch(db)
          for (let i = 0; i < periodCadetUids.length; i++) {
            const uid         = periodCadetUids[i]
            const displayName = names[i]
            const gradeType   = preset.dist[i % preset.dist.length]
            const profile     = GRADE_PROFILES[gradeType]
            const keyErrors   = KEY_ERROR_SETS[i % KEY_ERROR_SETS.length]
            for (let j = 0; j < TYPING_SESSION_DAYS.length; j++) {
              const daysAgo    = TYPING_SESSION_DAYS[j]
              const improvement = 1 + ((TYPING_SESSION_DAYS.length - 1 - j) / TYPING_SESSION_DAYS.length) * 0.12
              const wpm        = Math.round(profile.baseWpm * improvement * (0.92 + Math.random() * 0.16))
              const accuracy   = Math.min(99, Math.round(profile.accuracy + (Math.random() * 4 - 2)))
              const newRef     = doc(collection(db, 'typingResults'))
              batch.set(newRef, {
                uid, displayName, periodId, schoolYearId: SCHOOL_YEAR_ID, teacherEmail,
                mode: j % 3 === 0 ? 'speed-test' : 'lesson',
                wpm, accuracy, duration: 120, charsTyped: wpm * 10, keyErrors,
                completedAt: daysAgoTimestamp(daysAgo, j), isDemoData: true,
              })
            }
          }
          await batch.commit()
          addLog('ok', `  Typing: ${periodId} (${periodCadetUids.length} × ${TYPING_SESSION_DAYS.length} sessions)`)
        }

        // 7. Conduct Data
        if (cats.conduct && periodCadetUids.length > 0) {
          step(`[${periodId}] Creating conduct data…`, Math.round((stepsDone / totalSteps) * 90) + 8)
          const batch = writeBatch(db)
          const entryDaysAgo = [2, 5, 10, 16]
          for (let i = 0; i < periodCadetUids.length; i++) {
            const studentId   = periodCadetUids[i]
            const studentName = names[i]
            const gradeType   = preset.dist[i % preset.dist.length]
            const profile     = GRADE_PROFILES[gradeType]
            const rp          = profile.conductRating

            // Entry pattern: better students get more positives
            const entryTypes: ('positive'|'negative')[] =
              gradeType === 'A' || gradeType === 'B'
                ? ['positive','positive','positive','negative']
                : gradeType === 'C'
                  ? ['positive','positive','negative','negative']
                  : ['positive','negative','negative','negative']

            for (let e = 0; e < entryDaysAgo.length; e++) {
              const isPos = entryTypes[e] === 'positive'
              const note  = isPos
                ? CONDUCT_ENTRIES_POS[(i + e) % CONDUCT_ENTRIES_POS.length]
                : CONDUCT_ENTRIES_NEG[(i + e) % CONDUCT_ENTRIES_NEG.length]
              batch.set(doc(collection(db, 'conductEntries')), {
                studentId, studentName, teacherEmail, periodId,
                schoolYearId: SCHOOL_YEAR_ID, quarterId: CURRENT_QUARTER_ID,
                type: entryTypes[e], note,
                loggedAt: daysAgoTimestamp(entryDaysAgo[e], i), isDemoData: true,
              })
            }

            const jitter = (v: number) => Math.min(5, Math.max(1, v + Math.round(Math.random() * 2 - 1)))
            for (let r = 0; r < 2; r++) {
              const ratings = r === 0
                ? { participation: jitter(rp.participation - 1), respect: jitter(rp.respect - 1), onTask: jitter(rp.onTask - 1), effort: jitter(rp.effort - 1) }
                : { participation: rp.participation, respect: rp.respect, onTask: rp.onTask, effort: rp.effort }
              batch.set(doc(collection(db, 'conductRatings')), {
                studentId, studentName, teacherEmail, periodId,
                schoolYearId: SCHOOL_YEAR_ID, quarterId: CURRENT_QUARTER_ID,
                date: pastDate(r === 0 ? 10 : 3), ratings,
                ratedAt: daysAgoTimestamp(r === 0 ? 10 : 3, i), isDemoData: true,
              })
            }
          }
          await batch.commit()
          addLog('ok', `  Conduct: ${periodId} (${periodCadetUids.length} students)`)
        }

        // 8. Seating Chart (5 × 6 grid, 25 students, 5 empty seats)
        if (cats.seatingChart && periodCadetUids.length > 0) {
          step(`[${periodId}] Creating seating chart…`, Math.round((stepsDone / totalSteps) * 90) + 9)
          const emptySet = new Set(EMPTY_SEATS[periodId] ?? [])
          const seats: Record<string, { uid: string; displayName: string } | null> = {}
          let studentIdx = 0
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 6; c++) {
              const key = `r${r}c${c}`
              if (emptySet.has(key)) {
                seats[key] = null
              } else {
                seats[key] = studentIdx < periodCadetUids.length
                  ? { uid: periodCadetUids[studentIdx], displayName: names[studentIdx] }
                  : null
                studentIdx++
              }
            }
          }
          await setDoc(doc(db, 'seatingCharts', seatingChartDocId(teacherEmail, periodId)), {
            periodId, teacherEmail,
            schoolYearId: SCHOOL_YEAR_ID,
            layout: { rows: 5, cols: 6, label: '5 × 6' },
            seats,
            updatedAt: new Date(),
          })
          addLog('ok', `  Seating chart: ${periodId} (${periodCadetUids.length} placed)`)
        }

        stepsDone++
        step(`[${periodId}] Done`, Math.round((stepsDone / totalSteps) * 90))
      }
    }

    step('Complete', 100)
    doneMessage.value = `✓ Seeded ${emails.length} teacher(s) × ${periods.length} period(s). Open the Admin Dashboard to review.`
    doneError.value = false

  } catch (e: any) {
    console.error('Seed error:', e)
    addLog('err', String(e?.message ?? e))
    doneMessage.value = `Seed failed: ${e?.message ?? 'unknown error'}`
    doneError.value = true
  } finally {
    running.value = false
  }
}

// ── Clear (scoped to selected teachers × selected periods) ────────────────────
async function runClear() {
  running.value     = true
  doneMessage.value = ''
  doneError.value   = false
  log.value         = []

  try {
    const emails  = selectedTeacherEmails.value
    const periods = selectedPeriods.value
    const periodScoped = ['approvedUsers', 'assignments', 'submissions', 'typingResults', 'conductEntries', 'conductRatings']
    let total = 0

    for (let i = 0; i < periods.length; i++) {
      const periodId = periods[i]
      step(`Clearing ${periodId}…`, Math.round((i / (periods.length + 1)) * 80))

      for (const col of periodScoped) {
        const snap = await getDocs(query(collection(db, col), where('isDemoData', '==', true), where('periodId', '==', periodId)))
        if (snap.size > 0) {
          const batch = writeBatch(db)
          snap.forEach(d => batch.delete(d.ref))
          await batch.commit()
        }
        total += snap.size
        if (snap.size) addLog('ok', `Deleted ${snap.size} from ${col} (${periodId})`)
      }

      await setDoc(doc(db, 'shipStatus', periodId), {
        health: 100, gradedCount: 0, overdueCount: 0,
        totalEarned: 0, totalPossible: 0,
        lastUpdated: serverTimestamp(),
      })
      addLog('ok', `Reset shipStatus: ${periodId}`)

      for (const teacherEmail of emails) {
        const chartRef = doc(db, 'seatingCharts', seatingChartDocId(teacherEmail, periodId))
        await deleteDoc(chartRef)
        addLog('ok', `Cleared seating chart: ${periodId} (${teacherEmail})`)
      }
    }

    for (const teacherEmail of emails) {
      step(`Clearing missions for ${teacherEmail}…`, 88)
      const snap = await getDocs(query(collection(db, 'missions'), where('isDemoData', '==', true), where('teacherEmail', '==', teacherEmail)))
      if (snap.size > 0) {
        const batch = writeBatch(db)
        snap.forEach(d => batch.delete(d.ref))
        await batch.commit()
      }
      total += snap.size
      if (snap.size) addLog('ok', `Deleted ${snap.size} missions for ${teacherEmail}`)
    }

    step('Complete', 100)
    doneMessage.value = `✓ Cleared ${total} demo documents across ${periods.length} period(s).`
    doneError.value = false

  } catch (e: any) {
    console.error('Clear error:', e)
    addLog('err', String(e?.message ?? e))
    doneMessage.value = `Clear failed: ${e?.message ?? 'unknown error'}`
    doneError.value = true
  } finally {
    running.value = false
  }
}
</script>

<style scoped>
.seed-page {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

.sub-label {
  color: #99ccff;
  font-size: 0.9rem;
  margin-bottom: 1.75rem;
  opacity: 0.8;
}

/* ── Progress ── */
.progress-panel {
  background: rgba(0,20,40,0.6);
  border: 1px solid rgba(77,153,238,0.3);
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.progress-label { color: #4d99ee; font-size: 0.85rem; letter-spacing: 0.1em; }
.progress-bar-track {
  height: 6px;
  background: rgba(77,153,238,0.15);
  border-radius: 3px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: #4d99ee;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.progress-pct { color: #4d99ee; font-size: 0.8rem; text-align: right; }

/* ── Done banner ── */
.done-banner {
  padding: 0.75rem 1rem;
  border-radius: 0.4rem;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  margin-bottom: 1rem;
  line-height: 1.5;
}
.done-ok    { background: rgba(80,200,120,0.1); border: 1px solid rgba(80,200,120,0.4); color: #69f0ae; }
.done-error { background: rgba(255,100,100,0.1); border: 1px solid rgba(255,100,100,0.4); color: #ff6e6e; }

/* ── Log ── */
.log-panel {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  max-height: 220px;
  overflow-y: auto;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.log-line {
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.log-icon { font-size: 0.7rem; opacity: 0.7; flex-shrink: 0; }
.log-line.ok   { color: #69f0ae; }
.log-line.err  { color: #ff6e6e; }
.log-line.skip { color: #445; }
.log-line.info { color: #99ccff; }

/* ── Options ── */
.options-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: rgba(77,153,238,0.05);
  border: 1px solid rgba(77,153,238,0.2);
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.options-container.is-running {
  opacity: 0.6;
  pointer-events: none;
}
.option-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.option-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #4d99ee;
}
.option-help {
  font-size: 0.75rem;
  color: #99ccff;
  opacity: 0.6;
}
.lcars-select {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(77,153,238,0.4);
  color: #99ccff;
  padding: 0.35rem 0.5rem;
  border-radius: 0.4rem;
  font-family: inherit;
  font-size: 0.85rem;
}
.checkbox-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2rem;
  padding: 0.5rem 0;
}
.cb-label {
  font-size: 0.85rem;
  color: #99ccff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}
.cb-label input {
  accent-color: #4d99ee;
  width: 1.1rem;
  height: 1.1rem;
}

/* ── Period / preset grid ── */
.period-preset-grid {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.25rem 0;
}
.period-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.period-cb {
  flex-shrink: 0;
}
.period-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 18rem;
}
.period-num {
  font-size: 0.78rem;
  font-weight: 700;
  color: #4d99ee;
  letter-spacing: 0.08em;
  min-width: 2rem;
}
.period-franchise {
  font-size: 0.82rem;
  color: #99ccff;
  opacity: 0.85;
}
.preset-select {
  min-width: 11rem;
}

/* ── Controls ── */
.controls {
  display: flex;
  gap: 0;
  margin-bottom: 2rem;
  background: rgba(0,20,40,0.5);
  border: 1px solid rgba(77,153,238,0.2);
  border-radius: 0.75rem;
  overflow: hidden;
}
.control-group {
  flex: 1;
  padding: 1.25rem 1.5rem;
}
.divider {
  width: 1px;
  background: rgba(77,153,238,0.15);
}
.control-label {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #4d99ee;
  margin-bottom: 0.5rem;
}
.control-desc {
  font-size: 0.82rem;
  color: #99ccff;
  line-height: 1.5;
  margin-bottom: 1rem;
  opacity: 0.85;
}
.control-desc code {
  background: rgba(77,153,238,0.12);
  border-radius: 0.2rem;
  padding: 0.05em 0.3em;
  font-size: 0.9em;
  color: #4d99ee;
}
.control-desc strong { color: #ff9900; }

.action-btn {
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 0.55rem 1.4rem;
  border-radius: 0.4rem;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn--seed {
  background: linear-gradient(90deg, #1e6aaa, #4d99ee);
  color: #000;
}
.action-btn--seed:hover:not(:disabled) { opacity: 0.85; }
.action-btn--clear {
  background: transparent;
  border: 1px solid rgba(255,100,100,0.4);
  color: #ff6e6e;
}
.action-btn--clear:hover:not(:disabled) { background: rgba(255,100,100,0.08); }

/* ── Reference grid ── */
.reference-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}
.ref-card {
  background: rgba(0,20,40,0.4);
  border: 1px solid rgba(77,153,238,0.12);
  border-radius: 0.5rem;
  padding: 0.9rem 1rem;
}
.ref-title {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #4d99ee;
  margin-bottom: 0.5rem;
}
.ref-item {
  font-size: 0.78rem;
  color: #99ccff;
  opacity: 0.75;
  line-height: 1.7;
}
</style>
