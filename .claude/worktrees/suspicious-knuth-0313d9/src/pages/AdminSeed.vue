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
        <div class="option-label">TARGET TEACHER</div>
        <select v-model="selectedTeacherEmail" class="lcars-select" :disabled="running">
          <option v-for="t in teachers" :key="t.email" :value="t.email">
            {{ t.displayName || t.email }}
          </option>
        </select>
        <p class="option-help">Data will be assigned to this teacher's periods.</p>
      </div>

      <div class="option-section">
        <div class="option-label">WHAT TO SEED</div>
        <div class="checkbox-grid">
          <label class="cb-label">
            <input type="checkbox" v-model="selectedCategories.missions" :disabled="running"> Missions
          </label>
          <label class="cb-label">
            <input type="checkbox" v-model="selectedCategories.cadets" :disabled="running"> Cadets
          </label>
          <label class="cb-label">
            <input type="checkbox" v-model="selectedCategories.assignments" :disabled="running"> Assignments
          </label>
          <label class="cb-label">
            <input type="checkbox" v-model="selectedCategories.submissions" :disabled="running"> Submissions
          </label>
          <label class="cb-label">
            <input type="checkbox" v-model="selectedCategories.shipStatus" :disabled="running"> Ship Status
          </label>
          <label class="cb-label">
            <input type="checkbox" v-model="selectedCategories.typingResults" :disabled="running"> Typing Results
          </label>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls">
      <div class="control-group">
        <div class="control-label">SEED DEMO DATA</div>
        <p class="control-desc">
          Creates 6 missions across 3 units, 30 demo cadets (5 per period), 30 assignments (5 per period),
          and 450 submissions — every student has graded history, items in the grading queue,
          and a live in-flight session today. ShipStatus scores show the <strong>Odd Chain cascade active</strong>.
          Also seeds 210 typing results (5 students × 7 sessions × 6 periods) visible in the Typing → Period Progress tab.
        </p>
        <button class="action-btn action-btn--seed" :disabled="running" @click="runSeed">
          {{ running ? 'RUNNING…' : 'RUN SEED' }}
        </button>
      </div>

      <div class="divider"></div>

      <div class="control-group">
        <div class="control-label">CLEAR DEMO DATA</div>
        <p class="control-desc">
          Deletes all documents tagged <code>isDemoData: true</code> from missions,
          approvedUsers, assignments, submissions, typingResults, and resets shipStatus to defaults.
        </p>
        <button class="action-btn action-btn--clear" :disabled="running" @click="runClear">
          {{ running ? 'RUNNING…' : 'CLEAR DEMO DATA' }}
        </button>
      </div>
    </div>

    <!-- What will be created reference -->
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
        <div class="ref-title">CADETS (5 per period)</div>
        <div class="ref-item">Periods 1–6 · 30 total</div>
        <div class="ref-item">role: cadet · schoolYear: 2025-2026</div>
        <div class="ref-item">Realistic names, random UIDs</div>
      </div>
      <div class="ref-card">
        <div class="ref-title">HISTORY (graded) — per period</div>
        <div class="ref-item">📋 Variables Lab · 28 days ago · all graded</div>
        <div class="ref-item">📋 Functions &amp; Parameters · 14 days ago · all graded</div>
        <div class="ref-item">Varied scores · feedback notes</div>
      </div>
      <div class="ref-card">
        <div class="ref-title">GRADING QUEUE — per period</div>
        <div class="ref-item">📬 Variables Challenge · 7 days ago · all submitted</div>
        <div class="ref-item">📬 Typing Warm-Up · 3 days ago · all submitted</div>
        <div class="ref-item">Every student awaiting a grade</div>
      </div>
      <div class="ref-card">
        <div class="ref-title">IN-FLIGHT SESSION — per period</div>
        <div class="ref-item">📡 Conditional Logic Lab · due today</div>
        <div class="ref-item">1–5 students submitted per period</div>
        <div class="ref-item">Shows partial class progress</div>
      </div>
      <div class="ref-card">
        <div class="ref-title">SHIP HEALTH (6 periods)</div>
        <div class="ref-item">P1 92% · P2 75% · P3 85%</div>
        <div class="ref-item">P4 55% · P5 72% · P6 88%</div>
        <div class="ref-item" style="color:#ff9900">ODD CHAIN ACTIVE (P1/P3/P5 ≥ 70%)</div>
      </div>
      <div class="ref-card">
        <div class="ref-title">TYPING RESULTS (per period)</div>
        <div class="ref-item">5 students × 7 sessions = 35 docs/period</div>
        <div class="ref-item">⌨️ WPM range: 31–64 base · gradual improvement</div>
        <div class="ref-item">Sessions span last 22 days · realistic key errors</div>
        <div class="ref-item">Visible in Typing → Period Progress tab</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  collection, addDoc, setDoc, doc, getDocs,
  query, where, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore'
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
const selectedTeacherEmail = ref('')
const selectedCategories = ref({
  missions: true,
  cadets: true,
  assignments: true,
  submissions: true,
  shipStatus: true,
  typingResults: true,
})

onMounted(async () => {
  try {
    const snap = await getDocs(collection(db, 'approvedUsers'))
    // Email is the document ID — it is NOT stored as a field in the document body
    teachers.value = snap.docs
      .filter(d => d.data().role === 'staff')
      .map(d => ({ email: d.id, displayName: d.data().displayName as string }))
      .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email))

    // Default to current user if they're a teacher, otherwise first in list
    const currentEmail = userInfo.value?.email
    if (currentEmail && teachers.value.some(t => t.email === currentEmail)) {
      selectedTeacherEmail.value = currentEmail
    } else if (teachers.value.length > 0) {
      selectedTeacherEmail.value = teachers.value[0].email
    } else {
      selectedTeacherEmail.value = 'demo@teacher.local'
    }
  } catch (e) {
    console.error('Failed to fetch teachers:', e)
    selectedTeacherEmail.value = 'demo@teacher.local'
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

// ── Demo data definitions ─────────────────────────────────────────────────────

const CADET_NAMES: Record<string, string[]> = {
  'period-1': ['Zara Chen', 'Marcus Webb', 'Yuki Tanaka', 'Devon Mills', 'Asha Patel'],
  'period-2': ['Liam Torres', 'Sofia Nguyen', 'Ethan Brooks', 'Maya Singh', 'Noah Carter'],
  'period-3': ['Ava Martinez', 'Lucas Kim', 'Isla Robinson', 'Finn O\'Brien', 'Chloe Adams'],
  'period-4': ['Jasper Lee', 'Ruby Hall', 'Oliver Grant', 'Mia Scott', 'Caleb Rivera'],
  'period-5': ['Nora Fleming', 'Samuel Park', 'Elena Voss', 'James Cooper', 'Lily Chen'],
  'period-6': ['Owen Taylor', 'Amara Diallo', 'Carter White', 'Zoe Harris', 'Elijah Moss'],
}

// Ship health targets per period (drives shipStatus writes)
const HEALTH_TARGETS: Record<string, { health: number; gradedCount: number; overdueCount: number; totalEarned: number; totalPossible: number }> = {
  'period-1': { health: 92, gradedCount: 24, overdueCount: 1, totalEarned: 1288, totalPossible: 1400 },
  'period-2': { health: 75, gradedCount: 18, overdueCount: 2, totalEarned:  900, totalPossible: 1200 },
  'period-3': { health: 85, gradedCount: 22, overdueCount: 1, totalEarned: 1105, totalPossible: 1300 },
  'period-4': { health: 55, gradedCount: 15, overdueCount: 6, totalEarned:  605, totalPossible: 1100 },
  'period-5': { health: 72, gradedCount: 20, overdueCount: 2, totalEarned:  864, totalPossible: 1200 },
  'period-6': { health: 88, gradedCount: 21, overdueCount: 1, totalEarned: 1232, totalPossible: 1400 },
}

// Score fractions by student index — realistic spread without pure randomness
const SCORE_FRACTIONS = [0.95, 0.88, 0.78, 0.85, 0.70]

const FEEDBACK_NOTES = [
  'Great work! Keep it up.',
  'Good effort — solid understanding.',
  'Well done! Nice attention to detail.',
  'Good thinking through the problem.',
  'Getting there — keep working on the fundamentals.',
]

// How many students have submitted the in-flight (current) assignment per period
const CURRENT_SUBMITTED_COUNT: Record<string, number> = {
  'period-1': 3, 'period-2': 4, 'period-3': 2,
  'period-4': 1, 'period-5': 3, 'period-6': 5,
}

// ── Mission definitions ───────────────────────────────────────────────────────

type MissionKey = 'warmUp' | 'lesson1' | 'extension1' | 'lesson2' | 'extension2' | 'lesson3'
const MISSION_DEFS: { key: MissionKey; title: string; description: string; pointsPossible: number; unitId: string }[] = [
  // Unit 1: Intro to Programming
  { key: 'warmUp',     title: 'Daily Typing Warm-Up',   description: 'Complete today\'s typing drill and screenshot your WPM score.',                          pointsPossible: 10, unitId: 'unit-1' },
  { key: 'lesson1',   title: 'Intro to Variables Lab',  description: 'Follow the guided lab to declare and use variables in JavaScript.',                       pointsPossible: 50, unitId: 'unit-1' },
  // Unit 2: Functions & Loops
  { key: 'extension1', title: 'Variables Challenge',    description: 'Apply your knowledge — build a small program using at least 5 variables.',                pointsPossible: 20, unitId: 'unit-2' },
  { key: 'lesson2',   title: 'Functions & Parameters',  description: 'Learn how to write reusable functions and pass arguments in JavaScript.',                  pointsPossible: 40, unitId: 'unit-2' },
  // Unit 3: Control Flow
  { key: 'extension2', title: 'Loop Design Challenge',  description: 'Use for-loops and while-loops to solve the provided coding challenges.',                   pointsPossible: 30, unitId: 'unit-3' },
  { key: 'lesson3',   title: 'Conditional Logic Lab',   description: 'Practice if/else logic by coding decision-making programs with multiple conditions.',      pointsPossible: 35, unitId: 'unit-3' },
]

// ── Assignment layout per period ──────────────────────────────────────────────
// Each period gets exactly these 5 assignments.
// Submissions determine what shows in History vs Queue vs in-flight.

type AssignSlot = 'hist1' | 'hist2' | 'queue1' | 'queue2' | 'current'
const ASSIGN_SLOTS: { slot: AssignSlot; missionKey: MissionKey; daysAgo: number; quarterId: string }[] = [
  { slot: 'hist1',   missionKey: 'lesson1',    daysAgo: 28, quarterId: '2026-Q3' }, // history: all graded
  { slot: 'hist2',   missionKey: 'lesson2',    daysAgo: 14, quarterId: '2026-Q3' }, // history: all graded
  { slot: 'queue1',  missionKey: 'extension1', daysAgo:  7, quarterId: '2026-Q4' }, // queue:   all submitted
  { slot: 'queue2',  missionKey: 'warmUp',     daysAgo:  3, quarterId: '2026-Q4' }, // queue:   all submitted
  { slot: 'current', missionKey: 'lesson3',    daysAgo:  0, quarterId: '2026-Q4' }, // in-flight: partial
]

// ── Typing results seed data ──────────────────────────────────────────────────

// One profile per student index (cycles if more than 5 students per period).
// baseWpm is the student's "typical" speed; sessions show gradual improvement.
const TYPING_PROFILES = [
  { baseWpm: 64, accuracy: 95 },  // strong typist
  { baseWpm: 47, accuracy: 91 },  // above average
  { baseWpm: 31, accuracy: 86 },  // developing
  { baseWpm: 55, accuracy: 93 },  // solid
  { baseWpm: 40, accuracy: 89 },  // average
]

// Days ago for each session — spread across ~3 weeks, most recent last
const TYPING_SESSION_DAYS = [22, 18, 15, 11, 7, 4, 1]

// Common key-error patterns: home-row learners frequently miss these
const KEY_ERROR_SETS = [
  { f: 3, j: 2, k: 4, semicolon: 1 },
  { j: 5, u: 3, m: 2, k: 2 },
  { f: 6, g: 4, h: 3, b: 2, y: 2 },
  { l: 3, o: 2, p: 1, semicolon: 3 },
  { f: 2, j: 3, n: 4, m: 3, h: 2 },
]

// Creates a Timestamp for N days ago at a realistic school-hour time
function daysAgoTimestamp(daysAgo: number, sessionIndex: number): Timestamp {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  // Stagger times across the school day so they look like warmups at the start of class
  d.setHours(8 + (sessionIndex % 3), 5 + (sessionIndex * 7) % 50, 0, 0)
  return Timestamp.fromDate(d)
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function runSeed() {
  running.value     = true
  doneMessage.value = ''
  doneError.value   = false
  log.value         = []

  try {
    const today = todayStr()
    const teacherEmail = selectedTeacherEmail.value

    // ── 1. Missions ─────────────────────────────────────────────────────────
    const missionIds = new Map<MissionKey, string>()

    if (selectedCategories.value.missions) {
      step('Creating missions…', 5)
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
      addLog('info', 'Skipping mission creation — searching for existing demo missions…')
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

    // ── 2. Approved Users (demo cadets) ─────────────────────────────────────
    const cadetUids: Record<string, string[]> = {}

    if (selectedCategories.value.cadets) {
      step('Creating demo cadets…', 20)
      for (const [periodId, names] of Object.entries(CADET_NAMES)) {
        cadetUids[periodId] = []
        const batch = writeBatch(db)
        for (const name of names) {
          const uid    = makeUid()
          const email  = name.toLowerCase().replace(/[^a-z]/g, '') + '@demo.cadet'
          const docRef = doc(collection(db, 'approvedUsers'))
          batch.set(docRef, {
            uid, displayName: name, email, role: 'cadet',
            periodId, schoolYearId: SCHOOL_YEAR_ID, teacherEmail,
            isDemoData: true, createdAt: serverTimestamp(),
          })
          cadetUids[periodId].push(uid)
        }
        await batch.commit()
        addLog('ok', `Cadets: ${periodId} (${names.length} students)`)
      }
    } else {
      addLog('info', 'Skipping cadet creation — searching for existing demo cadets…')
      const snap = await getDocs(query(
        collection(db, 'approvedUsers'),
        where('teacherEmail', '==', teacherEmail),
        where('isDemoData', '==', true),
        where('role', '==', 'cadet'),
      ))
      snap.forEach(d => {
        const data = d.data()
        if (!cadetUids[data.periodId]) cadetUids[data.periodId] = []
        cadetUids[data.periodId].push(data.uid)
      })
      const totalFound = Object.values(cadetUids).reduce((s, c) => s + c.length, 0)
      addLog(totalFound > 0 ? 'ok' : 'info', `Found ${totalFound} existing demo cadets.`)
    }

    // ── 3. Assignments — 5 per period ────────────────────────────────────────
    // assignIds[`${periodId}:${slot}`] = firestoreDocId
    const assignIds = new Map<string, string>()

    if (selectedCategories.value.assignments) {
      if (missionIds.size === 0) {
        throw new Error('Cannot seed assignments: No missions available. Please seed missions first.')
      }
      step('Creating assignments…', 40)

      for (const periodId of Object.keys(CADET_NAMES)) {
        for (const { slot, missionKey, daysAgo, quarterId } of ASSIGN_SLOTS) {
          const mId = missionIds.get(missionKey)
          if (!mId) continue
          const dueDate = daysAgo === 0 ? today : pastDate(daysAgo)
          const ref = await addDoc(collection(db, 'assignments'), {
            missionId: mId, periodId, dueDate, quarterId,
            schoolYearId: SCHOOL_YEAR_ID, teacherEmail,
            assignedAt: serverTimestamp(),
            isDemoData: true, _demoSlot: `${periodId}:${slot}`,
          })
          assignIds.set(`${periodId}:${slot}`, ref.id)
        }
        addLog('ok', `Assignments: ${periodId} (${ASSIGN_SLOTS.length} created)`)
      }
    } else {
      addLog('info', 'Skipping assignment creation — searching for existing demo assignments…')
      const snap = await getDocs(query(
        collection(db, 'assignments'),
        where('teacherEmail', '==', teacherEmail),
        where('isDemoData', '==', true),
      ))
      snap.forEach(d => {
        const slot = d.data()._demoSlot
        if (slot) assignIds.set(slot, d.id)
      })
      addLog(assignIds.size > 0 ? 'ok' : 'info', `Found ${assignIds.size} existing demo assignments.`)
    }

    // ── 4. Submissions ───────────────────────────────────────────────────────
    if (selectedCategories.value.submissions) {
      if (assignIds.size === 0) {
        throw new Error('Cannot seed submissions: No assignments available. Please seed assignments first.')
      }
      const totalCadets = Object.values(cadetUids).reduce((s, c) => s + c.length, 0)
      if (totalCadets === 0) {
        throw new Error('Cannot seed submissions: No cadets available. Please seed cadets first.')
      }

      step('Creating submissions…', 60)

      for (const [periodId, cadets] of Object.entries(cadetUids)) {
        const batch = writeBatch(db)
        let subCount = 0

        for (const { slot, missionKey, quarterId } of ASSIGN_SLOTS) {
          const assignId = assignIds.get(`${periodId}:${slot}`)
          const mId      = missionIds.get(missionKey) ?? ''
          const mDef     = MISSION_DEFS.find(m => m.key === missionKey)!
          if (!assignId) continue

          const submittedInCurrent = CURRENT_SUBMITTED_COUNT[periodId] ?? 3

          for (let i = 0; i < cadets.length; i++) {
            const studentId = cadets[i]
            const scoreFrac = SCORE_FRACTIONS[i % SCORE_FRACTIONS.length]
            const earned    = Math.round(scoreFrac * mDef.pointsPossible)
            const feedback  = FEEDBACK_NOTES[i % FEEDBACK_NOTES.length]

            let status: string
            let extraFields: Record<string, any>

            if (slot === 'hist1' || slot === 'hist2') {
              // History: graded
              status = 'graded'
              extraFields = {
                pointsEarned: earned, pointsPossible: mDef.pointsPossible,
                feedbackNote: feedback,
                data: { url: 'https://example.com/demo', fileName: 'assignment.pdf' },
                submittedAt: serverTimestamp(),
              }
            } else if (slot === 'queue1' || slot === 'queue2') {
              // Queue: submitted, awaiting grade
              status = 'submitted'
              extraFields = {
                pointsEarned: null, pointsPossible: mDef.pointsPossible,
                feedbackNote: '',
                data: { url: 'https://example.com/demo', fileName: 'assignment.pdf' },
                submittedAt: serverTimestamp(),
              }
            } else {
              // current: in-flight — some submitted, rest assigned
              const hasSubmitted = i < submittedInCurrent
              status = hasSubmitted ? 'submitted' : 'assigned'
              extraFields = {
                pointsEarned: null, pointsPossible: mDef.pointsPossible,
                feedbackNote: '',
                data: hasSubmitted ? { url: 'https://example.com/demo', fileName: 'assignment.pdf' } : {},
                submittedAt: hasSubmitted ? serverTimestamp() : null,
              }
            }

            const newRef = doc(collection(db, 'submissions'))
            batch.set(newRef, {
              studentId, assignmentId: assignId, missionId: mId,
              periodId, quarterId, schoolYearId: SCHOOL_YEAR_ID,
              type: 'file', status,
              dueDateOverride: null, isDemoData: true,
              ...extraFields,
            })
            subCount++
          }
        }

        await batch.commit()
        const inQueue   = cadets.length * 2  // queue1 + queue2 slots
        const inHistory = cadets.length * 2  // hist1 + hist2 slots
        addLog('ok', `Submissions: ${periodId} — ${inHistory} graded, ${inQueue} in queue, ${cadets.length} in-flight`)
      }
    } else {
      addLog('info', 'Skipping submission creation.')
    }

    // ── 5. Ship Status ───────────────────────────────────────────────────────
    if (selectedCategories.value.shipStatus) {
      step('Writing ship health scores…', 85)
      for (const [periodId, data] of Object.entries(HEALTH_TARGETS)) {
        await setDoc(doc(db, 'shipStatus', periodId), {
          ...data, isDemoData: true, lastUpdated: serverTimestamp(),
        })
        addLog('ok', `ShipStatus: ${periodId} → ${data.health}%`)
      }
    } else {
      addLog('info', 'Skipping ship status updates.')
    }

    // ── 6. Typing Results ────────────────────────────────────────────────────
    if (selectedCategories.value.typingResults) {
      step('Creating typing results…', 92)
      for (const [periodId, cadets] of Object.entries(cadetUids)) {
        const names  = CADET_NAMES[periodId]
        const batch  = writeBatch(db)
        for (let i = 0; i < cadets.length; i++) {
          const uid         = cadets[i]
          const displayName = names[i]
          const profile     = TYPING_PROFILES[i % TYPING_PROFILES.length]
          const keyErrors   = KEY_ERROR_SETS[i % KEY_ERROR_SETS.length]
          for (let j = 0; j < TYPING_SESSION_DAYS.length; j++) {
            const daysAgo    = TYPING_SESSION_DAYS[j]
            // Slight improvement over time: sessions later in the list (index 0 = oldest) are slower
            const improvement = 1 + ((TYPING_SESSION_DAYS.length - 1 - j) / TYPING_SESSION_DAYS.length) * 0.12
            const wpm        = Math.round(profile.baseWpm * improvement * (0.92 + Math.random() * 0.16))
            const accuracy   = Math.min(99, Math.round(profile.accuracy + (Math.random() * 4 - 2)))
            const charsTyped = wpm * 5 * 2  // rough estimate: wpm × chars-per-word × ~2 min
            const newRef     = doc(collection(db, 'typingResults'))
            batch.set(newRef, {
              uid, displayName, periodId,
              schoolYearId: SCHOOL_YEAR_ID,
              teacherEmail,
              mode: j % 3 === 0 ? 'speed-test' : 'lesson',
              wpm, accuracy, duration: 120, charsTyped, keyErrors,
              completedAt: daysAgoTimestamp(daysAgo, j),
              isDemoData: true,
            })
          }
        }
        await batch.commit()
        addLog('ok', `Typing results: ${periodId} (${cadets.length} students × ${TYPING_SESSION_DAYS.length} sessions)`)
      }
    } else {
      addLog('info', 'Skipping typing results creation.')
    }

    // ── Done ─────────────────────────────────────────────────────────────────
    step('Complete', 100)
    doneMessage.value = '✓ Demo data seeded. Open the Admin Dashboard, Systems page, and Student Dashboard (log in as a Period 2 cadet) to see everything in action.'
    doneError.value   = false

  } catch (e: any) {
    console.error('Seed error:', e)
    addLog('err', String(e?.message ?? e))
    doneMessage.value = `Seed failed: ${e?.message ?? 'unknown error'}`
    doneError.value   = true
  } finally {
    running.value = false
  }
}

// ── Clear ─────────────────────────────────────────────────────────────────────

async function runClear() {
  running.value     = true
  doneMessage.value = ''
  doneError.value   = false
  log.value         = []

  try {
    const collections = ['missions', 'approvedUsers', 'assignments', 'submissions', 'typingResults']
    let total = 0

    for (let i = 0; i < collections.length; i++) {
      const col = collections[i]
      step(`Clearing ${col}…`, Math.round((i / (collections.length + 1)) * 90))
      const snap = await getDocs(query(collection(db, col), where('isDemoData', '==', true)))
      const batch = writeBatch(db)
      snap.forEach(d => batch.delete(d.ref))
      if (snap.size > 0) await batch.commit()
      total += snap.size
      addLog('ok', `Deleted ${snap.size} docs from ${col}`)
    }

    // shipStatus — reset to default (100 health)
    step('Resetting ship status…', 90)
    for (const periodId of Object.keys(HEALTH_TARGETS)) {
      await setDoc(doc(db, 'shipStatus', periodId), {
        health: 100, gradedCount: 0, overdueCount: 0,
        totalEarned: 0, totalPossible: 0, lastUpdated: serverTimestamp(),
      })
    }
    addLog('ok', 'Reset shipStatus docs to health 100')

    step('Complete', 100)
    doneMessage.value = `✓ Cleared ${total} demo documents. Ship health reset to 100%.`
    doneError.value   = false

  } catch (e: any) {
    console.error('Clear error:', e)
    addLog('err', String(e?.message ?? e))
    doneMessage.value = `Clear failed: ${e?.message ?? 'unknown error'}`
    doneError.value   = true
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
.done-ok  { background: rgba(80,200,120,0.1); border: 1px solid rgba(80,200,120,0.4); color: #69f0ae; }
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
  padding: 0.5rem;
  border-radius: 0.4rem;
  font-family: inherit;
  font-size: 0.9rem;
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
