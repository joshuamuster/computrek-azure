<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useSubmissions, type StudentRecord } from '@/composables/useSubmissions'
import { useTypingResults } from '@/composables/useTypingResults'
import { useConductLog } from '@/composables/useConductLog'
import { useMissions } from '@/composables/useMissions'
import { useAssignments } from '@/composables/useAssignments'
import { pipColor, pipFilled, pipLabel, clampScore, updateConductScore, CONDUCT_COLORS } from '@/composables/useConductScore'
import { SCHOOL_YEAR_ID, QUARTERS } from '@/config/schoolYear'

// ── Router ────────────────────────────────────────────────────────────────────

const route  = useRoute()
const router = useRouter()
const uid    = computed(() => route.params.uid as string)

// ── Auth ──────────────────────────────────────────────────────────────────────

const { userInfo, isAdmin, effectiveTeacherEmail } = useAuth()

// ── Student record ────────────────────────────────────────────────────────────

const student        = ref<StudentRecord | null>(null)
const loadingStudent = ref(true)
const conductScore   = ref(4)   // live 0-4 score; updated optimistically on button tap
const scoreUpdating  = ref(false)

const loadStudent = async (targetUid: string) => {
  loadingStudent.value = true
  try {
    const q    = query(collection(db, 'approvedUsers'), where('uid', '==', targetUid))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const d = snap.docs[0]
      student.value = {
        uid:          d.data().uid          ?? targetUid,
        docId:        d.id,
        displayName:  d.data().displayName  ?? 'Unknown Cadet',
        periodId:     d.data().periodId     ?? '',
        studentId:    d.data().studentId    ?? '',
        teacherEmail: d.data().teacherEmail ?? '',
      }
      conductScore.value = d.data().conductScore ?? 4
    }
  } catch (e) {
    console.error('[AdminCadetDetail] loadStudent:', e)
  } finally {
    loadingStudent.value = false
  }
}

const adjustScore = async (delta: number) => {
  if (!student.value?.docId || scoreUpdating.value) return
  const next = clampScore(conductScore.value + delta)
  if (next === conductScore.value) return
  conductScore.value = next   // optimistic
  scoreUpdating.value = true
  try {
    await updateConductScore(student.value.docId, next)
  } catch (e) {
    console.error('[AdminCadetDetail] score update failed:', e)
    conductScore.value = clampScore(conductScore.value - delta)
  } finally {
    scoreUpdating.value = false
  }
}

// ── Tab state ─────────────────────────────────────────────────────────────────

const activeTab = ref<'missions' | 'typing' | 'conduct' | 'logs'>('missions')

// ── Missions tab ──────────────────────────────────────────────────────────────

const { submissions, isLoading: loadingSubs, fetchAllByStudent, gradeSubmission, returnSubmission, setDueDateOverride } = useSubmissions()
const { fetchMissionsByIds }   = useMissions()
const { fetchAssignmentsByIds } = useAssignments()

const missionMap    = ref<Map<string, any>>(new Map())
const assignmentMap = ref<Map<string, any>>(new Map())

const loadMissions = async () => {
  if (!uid.value) return
  await fetchAllByStudent(uid.value)

  const missionIds    = [...new Set(submissions.value.map(s => s.missionId).filter(Boolean))]
  const assignmentIds = [...new Set(submissions.value.map(s => s.assignmentId).filter(Boolean))]

  const [missions, assignments] = await Promise.all([
    fetchMissionsByIds(missionIds),
    fetchAssignmentsByIds(assignmentIds),
  ])

  missionMap.value    = new Map(missions.map((m: any)    => [m.id, m]))
  assignmentMap.value = new Map(assignments.map((a: any) => [a.id, a]))
}

// Quick-grade state
const gradingId  = ref<string | null>(null)
const gradeForm  = ref({ points: 0, feedback: '', action: 'grade' as 'grade' | 'return' })
const gradeSaving = ref(false)

const openGrade = (sub: any) => {
  gradingId.value = sub.id
  gradeForm.value = {
    points:   sub.pointsEarned ?? 0,
    feedback: sub.feedbackNote ?? '',
    action:   'grade',
  }
}

const submitGrade = async () => {
  if (!gradingId.value || !student.value) return
  gradeSaving.value = true
  const ctx = {
    teacherEmail: student.value.teacherEmail,
    periodId:     student.value.periodId,
    schoolYearId: SCHOOL_YEAR_ID,
  }
  const ok = gradeForm.value.action === 'grade'
    ? await gradeSubmission(gradingId.value, gradeForm.value.points, gradeForm.value.feedback, ctx)
    : await returnSubmission(gradingId.value, gradeForm.value.points, gradeForm.value.feedback, undefined, ctx)
  if (ok) gradingId.value = null
  gradeSaving.value = false
}

// Due date extension state
const extendingId   = ref<string | null>(null)
const extendDate    = ref('')
const extendSaving  = ref(false)

const openExtend = (sub: any) => {
  extendingId.value = sub.id
  extendDate.value  = sub.dueDateOverride ?? assignmentMap.value.get(sub.assignmentId)?.dueDate ?? ''
}

const submitExtend = async () => {
  if (!extendingId.value) return
  extendSaving.value = true
  await setDueDateOverride(extendingId.value, extendDate.value || null)
  extendingId.value = null
  extendSaving.value = false
}

const missionTitle = (sub: any) =>
  missionMap.value.get(sub.missionId)?.title ?? sub.missionId ?? '—'

const pointsPossible = (sub: any) =>
  missionMap.value.get(sub.missionId)?.pointsPossible ?? '?'

const dueDate = (sub: any) =>
  sub.dueDateOverride ?? assignmentMap.value.get(sub.assignmentId)?.dueDate ?? '—'

const sortedSubs = computed(() =>
  [...submissions.value].sort((a, b) => {
    const order = { submitted: 0, returned: 1, started: 2, assigned: 3, graded: 4 }
    return (order[a.status] ?? 9) - (order[b.status] ?? 9)
  })
)

const missionGradeTotal = computed(() => {
  let earned = 0, possible = 0
  for (const s of submissions.value) {
    if (s.status === 'graded' && s.pointsEarned != null) {
      earned   += s.pointsEarned
      possible += missionMap.value.get(s.missionId)?.pointsPossible ?? 0
    }
  }
  return { earned, possible }
})

// ── Typing tab ────────────────────────────────────────────────────────────────

const { fetchResultsByStudent } = useTypingResults()
const typingHistory  = ref<any[]>([])
const loadingTyping  = ref(false)

const loadTyping = async () => {
  if (!uid.value) return
  loadingTyping.value = true
  typingHistory.value = await fetchResultsByStudent(uid.value, 50)
  loadingTyping.value = false
}

const bestWpm = computed(() =>
  typingHistory.value.length ? Math.max(...typingHistory.value.map(r => r.wpm)) : null
)
const avgWpm = computed(() => {
  if (!typingHistory.value.length) return null
  return Math.round(typingHistory.value.reduce((s, r) => s + r.wpm, 0) / typingHistory.value.length)
})
const avgAccuracy = computed(() => {
  if (!typingHistory.value.length) return null
  return (typingHistory.value.reduce((s, r) => s + r.accuracy, 0) / typingHistory.value.length).toFixed(1)
})

// ── Conduct tab ───────────────────────────────────────────────────────────────

const CONDUCT_REASONS = [
  { key: 'participation', label: 'Participation',   negLabel: 'Not Participating' },
  { key: 'respect',       label: 'Respect',         negLabel: 'Disruptive'        },
  { key: 'onTask',        label: 'On Task',         negLabel: 'Off Task'          },
  { key: 'effort',        label: 'Effort',          negLabel: 'Low Effort'        },
] as const

const { entries: conductEntries, loading: loadingConduct, fetchEntries } = useConductLog()

const selectedQuarterId = ref(QUARTERS[QUARTERS.length - 1].id)

const loadConduct = async () => {
  if (!uid.value || !student.value) return
  await fetchEntries(uid.value, student.value.teacherEmail, selectedQuarterId.value)
}

watch(selectedQuarterId, loadConduct)

const conductReasonLabel = (entry: { reason: string; type: string }) => {
  const r = CONDUCT_REASONS.find(r => r.key === entry.reason)
  if (!r) return entry.reason || '—'
  return entry.type === 'negative' ? r.negLabel : r.label
}

// ── Workstation Logs tab ──────────────────────────────────────────────────────

const activityLogs  = ref<any[]>([])
const loadingLogs   = ref(false)

const loadLogs = async () => {
  if (!uid.value) return
  loadingLogs.value = true
  try {
    const snap = await getDocs(
      query(
        collection(db, 'activityLogs'),
        where('uid', '==', uid.value),
        orderBy('timestamp', 'desc'),
        limit(100),
      )
    )
    activityLogs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error('[AdminCadetDetail] loadLogs:', e)
  } finally {
    loadingLogs.value = false
  }
}

const LOG_META: Record<string, { icon: string; label: string }> = {
  sign_in:         { icon: '🔑', label: 'Signed In'        },
  game_complete:   { icon: '🎮', label: 'Game Completed'   },
  typing_complete: { icon: '⌨️',  label: 'Typing Completed' },
}

const GAME_NAMES: Record<string, string> = {
  chess:                  'Chess',
  picard_maneuver:        'Picard Maneuver',
  battle_mutara_nebula:   'Battle of Mutara Nebula',
  rules_of_acquisition:   'Rules of Acquisition',
  minesweeper_cadet:      'Minesweeper (Cadet)',
  minesweeper_standard:   'Minesweeper (Standard)',
  'minesweeper_red-alert':'Minesweeper (Red Alert)',
  isolinear_cascade:      'Isolinear Cascade',
  warp_core_breach:       'Warp Core Breach',
  shuttle_bay:            'Shuttle Bay',
}

const logDetail = (log: any): string => {
  const d = log.detail ?? {}
  if (log.event === 'game_complete') {
    const name = GAME_NAMES[d.gameId] ?? d.gameId ?? 'Unknown Game'
    return `${name}${d.score != null ? ` · Score: ${d.score}` : ''}`
  }
  if (log.event === 'typing_complete') {
    const mode  = d.mode === 'speed-test' ? 'Speed Test'
                : d.mode === 'lesson'     ? `Lesson${d.lessonId ? ` ${d.lessonId}` : ''}`
                : d.mode === 'custom'     ? 'Custom Text'
                : d.mode ?? 'Typing'
    const wpm  = d.wpm  != null ? ` · ${d.wpm} WPM`       : ''
    const acc  = d.accuracy != null ? ` · ${d.accuracy}% acc` : ''
    const pass = d.passed === true ? ' ✓' : d.passed === false ? ' ✗' : ''
    return `${mode}${wpm}${acc}${pass}`
  }
  return ''
}

const fmtLogTime = (log: any): string => {
  const ts = log.timestamp?.toDate?.()
  if (!ts) return '—'
  const now   = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 86400000).toDateString()
  const time  = ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (ts.toDateString() === today)     return `Today ${time}`
  if (ts.toDateString() === yesterday) return `Yesterday ${time}`
  return ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${time}`
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const statusClass = (status: string) => ({
  'badge--assigned':  status === 'assigned',
  'badge--submitted': status === 'submitted',
  'badge--returned':  status === 'returned',
  'badge--graded':    status === 'graded',
})

const fmtDate = (d: Date | string | null) => {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const fmtDateTime = (d: Date | null) => {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Load orchestration ────────────────────────────────────────────────────────

watch(uid, async (newUid) => {
  if (!newUid) return
  await loadStudent(newUid)
  loadMissions()
  loadTyping()
  loadConduct()
  loadLogs()
}, { immediate: true })

watch(student, (s) => {
  if (s) loadConduct()
})

// Initialise quarter to current
onMounted(() => {
  const today = new Date().toISOString().slice(0, 10)
  const match = QUARTERS.find(q => today >= q.start && today <= q.end)
  if (match) selectedQuarterId.value = match.id
})
</script>

<template>
  <section class="adventure-page cadet-detail">

    <!-- Back -->
    <button class="back-btn" @click="router.back()">← Back</button>

    <!-- Loading -->
    <div v-if="loadingStudent" class="state-msg">Loading cadet record…</div>

    <!-- Not found -->
    <div v-else-if="!student" class="state-msg state-msg--error">Cadet not found.</div>

    <template v-else>

      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <div class="cadet-header">
        <div class="cadet-avatar">{{ student.displayName.charAt(0).toUpperCase() }}</div>
        <div class="cadet-info">
          <div class="cadet-name">{{ student.displayName }}</div>
          <div class="cadet-meta">
            <span class="meta-chip">{{ student.periodId.replace('period-', 'Period ') }}</span>
            <span class="meta-chip meta-chip--dim">ID: {{ student.studentId || '—' }}</span>
            <span class="meta-chip meta-chip--dim" :title="student.docId">{{ student.displayName }}</span>
          </div>
        </div>

        <!-- Conduct score pips + controls -->
        <div class="conduct-score-block">
          <div class="cs-pips">
            <span
              v-for="i in 4"
              :key="i"
              class="cs-pip"
              :style="pipFilled(conductScore, i) ? { background: pipColor(conductScore) } : {}"
            ></span>
          </div>
          <div class="cs-meta">
            <span class="cs-val" :style="{ color: pipColor(conductScore) }">{{ conductScore }}/4</span>
            <span class="cs-lbl" :style="{ color: pipColor(conductScore) }">{{ pipLabel(conductScore) }}</span>
          </div>
          <div class="cs-btns">
            <button class="cs-btn cs-btn--down" :disabled="conductScore <= 0 || scoreUpdating" title="Deduct one point" @click="adjustScore(-1)">−</button>
            <button class="cs-btn cs-btn--up"   :disabled="conductScore >= 4 || scoreUpdating" title="Restore one point" @click="adjustScore(+1)">+</button>
          </div>
        </div>

        <div class="cadet-summary-stats">
          <div class="summary-stat" v-if="missionGradeTotal.possible > 0">
            <div class="summary-val">
              {{ Math.round((missionGradeTotal.earned / missionGradeTotal.possible) * 100) }}%
            </div>
            <div class="summary-label">Missions</div>
          </div>
          <div class="summary-stat" v-if="bestWpm !== null">
            <div class="summary-val">{{ bestWpm }}</div>
            <div class="summary-label">Best WPM</div>
          </div>
        </div>
      </div>

      <!-- ── Tabs ────────────────────────────────────────────────────────── -->
      <div class="tab-bar">
        <button class="tab" :class="{ 'is-active': activeTab === 'missions' }"  @click="activeTab = 'missions'">Missions</button>
        <button class="tab" :class="{ 'is-active': activeTab === 'typing' }"   @click="activeTab = 'typing'">Typing</button>
        <button class="tab" :class="{ 'is-active': activeTab === 'conduct' }"  @click="activeTab = 'conduct'">Conduct</button>
        <button class="tab" :class="{ 'is-active': activeTab === 'logs' }"     @click="activeTab = 'logs'">Logs</button>
      </div>

      <!-- ════════════════════════════════════════════════════════════════
           MISSIONS TAB
           ════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'missions'" class="tab-content">
        <div v-if="loadingSubs" class="state-msg">Loading missions…</div>
        <div v-else-if="sortedSubs.length === 0" class="state-msg">No submissions found.</div>

        <div v-else class="missions-summary">
          <span class="missions-summary-text">
            {{ missionGradeTotal.earned }} / {{ missionGradeTotal.possible }} pts graded
            · {{ submissions.filter(s => s.status === 'submitted').length }} awaiting review
          </span>
        </div>

        <div class="submission-list">
          <div
            v-for="sub in sortedSubs"
            :key="sub.id"
            class="submission-card"
            :class="{ 'is-grading': gradingId === sub.id, 'is-extending': extendingId === sub.id }"
          >
            <div class="sub-main">
              <div class="sub-left">
                <div class="sub-title">{{ missionTitle(sub) }}</div>
                <div class="sub-meta">
                  Due: {{ fmtDate(dueDate(sub)) }}
                  <span v-if="sub.dueDateOverride" class="extension-badge">EXTENDED</span>
                  <span v-if="sub.submittedAt" class="sub-date">· Submitted {{ fmtDateTime(sub.submittedAt?.toDate?.()) }}</span>
                </div>
              </div>
              <div class="sub-right">
                <span class="status-badge" :class="statusClass(sub.status)">{{ sub.status }}</span>
                <span class="sub-points" v-if="sub.pointsEarned != null">
                  {{ sub.pointsEarned }} / {{ pointsPossible(sub) }} pts
                </span>
                <span class="sub-points sub-points--dash" v-else>
                  — / {{ pointsPossible(sub) }} pts
                </span>
                <div class="sub-actions" v-if="sub.status !== 'assigned'">
                  <button class="action-btn" @click="openGrade(sub)" v-if="gradingId !== sub.id">
                    {{ sub.status === 'graded' ? 'Re-grade' : 'Grade' }}
                  </button>
                  <button class="action-btn action-btn--dim" @click="openExtend(sub)" v-if="extendingId !== sub.id">
                    Extend
                  </button>
                </div>
              </div>
            </div>

            <!-- Feedback (read-only) -->
            <div v-if="sub.feedbackNote" class="sub-feedback">
              <span class="feedback-label">Feedback:</span> {{ sub.feedbackNote }}
            </div>

            <!-- Grade form -->
            <div v-if="gradingId === sub.id" class="inline-form">
              <div class="inline-form-row">
                <label class="inline-label">Points</label>
                <input
                  v-model.number="gradeForm.points"
                  type="number" min="0" :max="pointsPossible(sub)"
                  class="inline-input inline-input--sm"
                />
                <span class="inline-pts">/ {{ pointsPossible(sub) }}</span>
              </div>
              <div class="inline-form-row">
                <label class="inline-label">Feedback</label>
                <input v-model="gradeForm.feedback" type="text" placeholder="Optional note…" class="inline-input" />
              </div>
              <div class="inline-form-actions">
                <select v-model="gradeForm.action" class="action-select">
                  <option value="grade">Finalize (Graded)</option>
                  <option value="return">Return for Revision</option>
                </select>
                <button class="action-btn action-btn--primary" :disabled="gradeSaving" @click="submitGrade">
                  {{ gradeSaving ? 'Saving…' : 'Save' }}
                </button>
                <button class="action-btn action-btn--ghost" @click="gradingId = null">Cancel</button>
              </div>
            </div>

            <!-- Extend form -->
            <div v-if="extendingId === sub.id" class="inline-form">
              <div class="inline-form-row">
                <label class="inline-label">New due date</label>
                <input v-model="extendDate" type="date" class="inline-input inline-input--sm" />
                <button class="action-btn action-btn--dim" @click="extendDate = ''; submitExtend()">Clear</button>
              </div>
              <div class="inline-form-actions">
                <button class="action-btn action-btn--primary" :disabled="extendSaving" @click="submitExtend">
                  {{ extendSaving ? 'Saving…' : 'Save Extension' }}
                </button>
                <button class="action-btn action-btn--ghost" @click="extendingId = null">Cancel</button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════════
           TYPING TAB
           ════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'typing'" class="tab-content">
        <div v-if="loadingTyping" class="state-msg">Loading typing history…</div>
        <div v-else-if="typingHistory.length === 0" class="state-msg">No typing sessions found.</div>

        <template v-else>
          <div class="typing-summary-row">
            <div class="typing-stat-card">
              <div class="tstat-val">{{ bestWpm }}</div>
              <div class="tstat-label">Best WPM</div>
            </div>
            <div class="typing-stat-card">
              <div class="tstat-val">{{ avgWpm }}</div>
              <div class="tstat-label">Avg WPM</div>
            </div>
            <div class="typing-stat-card">
              <div class="tstat-val">{{ avgAccuracy }}%</div>
              <div class="tstat-label">Avg Accuracy</div>
            </div>
            <div class="typing-stat-card">
              <div class="tstat-val">{{ typingHistory.length }}</div>
              <div class="tstat-label">Sessions</div>
            </div>
          </div>

          <div class="typing-table">
            <div class="typing-table-head">
              <span>Date</span><span>Mode</span><span>WPM</span><span>Accuracy</span><span>Duration</span>
            </div>
            <div
              v-for="r in typingHistory"
              :key="r.id"
              class="typing-table-row"
            >
              <span>{{ fmtDateTime(r.completedAt) }}</span>
              <span class="mode-chip">{{ r.mode }}</span>
              <span class="wpm-val">{{ r.wpm }}</span>
              <span>{{ r.accuracy.toFixed(1) }}%</span>
              <span>{{ Math.round(r.duration) }}s</span>
            </div>
          </div>
        </template>
      </div>

      <!-- ════════════════════════════════════════════════════════════════
           CONDUCT TAB
           ════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'conduct'" class="tab-content">

        <!-- Current score (large) -->
        <div class="conduct-score-hero">
          <div class="csh-pips">
            <span
              v-for="i in 4"
              :key="i"
              class="csh-pip"
              :style="(conductScore === 0 || conductScore >= i)
                ? { background: pipColor(conductScore) }
                : {}"
            ></span>
          </div>
          <div class="csh-meta">
            <span class="csh-val" :style="{ color: pipColor(conductScore) }">{{ conductScore }}/4</span>
            <span class="csh-lbl" :style="{ color: pipColor(conductScore) }">{{ pipLabel(conductScore) }}</span>
          </div>
          <div class="csh-btns">
            <button class="csh-btn csh-btn--down" :disabled="conductScore <= 0 || scoreUpdating" @click="adjustScore(-1)">−</button>
            <button class="csh-btn csh-btn--up"   :disabled="conductScore >= 4 || scoreUpdating" @click="adjustScore(+1)">+</button>
          </div>
        </div>

        <!-- Quarter selector -->
        <div class="quarter-tabs">
          <button
            v-for="q in QUARTERS"
            :key="q.id"
            class="quarter-tab"
            :class="{ 'is-active': selectedQuarterId === q.id }"
            @click="selectedQuarterId = q.id"
          >{{ q.label }}</button>
        </div>

        <div v-if="loadingConduct" class="state-msg">Loading conduct history…</div>

        <template v-else>
          <div v-if="conductEntries.length === 0" class="state-msg state-msg--dim">
            No entries recorded for this quarter.
          </div>

          <!-- Entry log -->
          <div v-else class="conduct-entry-list">
            <div
              v-for="e in conductEntries"
              :key="e.id"
              class="conduct-entry"
              :class="{ 'ce--pos': e.type === 'positive', 'ce--neg': e.type === 'negative' }"
            >
              <span
                class="ce-delta"
                :style="{ color: e.scoreDelta > 0 ? CONDUCT_COLORS.pos : CONDUCT_COLORS.neg }"
              >{{ e.scoreDelta > 0 ? '+1' : '−1' }}</span>
              <div class="ce-body">
                <span class="ce-reason">{{ conductReasonLabel(e) }}</span>
                <span v-if="e.note" class="ce-note">{{ e.note }}</span>
              </div>
              <span class="ce-date">{{ fmtDateTime(e.loggedAt) }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- ════════════════════════════════════════════════════════════════
           LOGS TAB
           ════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'logs'" class="tab-content">
        <div v-if="loadingLogs" class="state-msg">Loading logs…</div>

        <div v-else-if="activityLogs.length === 0" class="state-msg">
          No activity logged yet. Logs are recorded going forward from when this feature was enabled.
        </div>

        <div v-else class="log-list">
          <div
            v-for="log in activityLogs"
            :key="log.id"
            class="log-row"
            :class="`log-row--${log.event}`"
          >
            <span class="log-icon">{{ LOG_META[log.event]?.icon ?? '📋' }}</span>
            <div class="log-body">
              <span class="log-label">{{ LOG_META[log.event]?.label ?? log.event }}</span>
              <span v-if="logDetail(log)" class="log-detail">{{ logDetail(log) }}</span>
            </div>
            <span class="log-time">{{ fmtLogTime(log) }}</span>
          </div>
        </div>
      </div>

    </template>
  </section>
</template>

<style scoped>

.cadet-detail { padding-bottom: 3rem; }

/* ── Back ─────────────────────────────────────────────────────────────────── */
.back-btn {
  background: none;
  border: none;
  color: #6688aa;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  padding: 0.25rem 0;
  margin-bottom: 0.75rem;
  transition: color 0.15s;
}
.back-btn:hover { color: #99ccff; }

/* ── State ────────────────────────────────────────────────────────────────── */
.state-msg {
  text-align: center; padding: 2.5rem; color: #6688aa;
  font-family: 'Antonio', 'Arial Narrow', sans-serif; letter-spacing: 0.08em;
}
.state-msg--error { color: #ff6644; }
.state-msg--dim   { color: #334455; }

/* ── Header ───────────────────────────────────────────────────────────────── */
.cadet-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(10, 18, 34, 0.6);
  border: 1px solid rgba(51, 102, 255, 0.15);
  border-radius: 0.4rem;
  margin-bottom: 1rem;
}

.cadet-avatar {
  width: 3rem; height: 3rem;
  border-radius: 50%;
  background: rgba(51, 102, 255, 0.2);
  border: 1px solid rgba(51, 102, 255, 0.4);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.4rem; color: #99ccff;
  flex-shrink: 0;
}

.cadet-name {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.3rem; letter-spacing: 0.1em; color: #cce0ff;
}

.cadet-meta { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.3rem; }

.meta-chip {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.7rem; letter-spacing: 0.08em;
  color: #ff9900; background: rgba(255, 153, 0, 0.1);
  border: 1px solid rgba(255, 153, 0, 0.25);
  padding: 0.1rem 0.5rem; border-radius: 0.2rem;
}
.meta-chip--dim { color: #6688aa; background: rgba(51, 102, 255, 0.05); border-color: rgba(51,102,255,0.15); }

/* ── Conduct score block in header ───────────────────────────────────────── */
.conduct-score-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.6rem 0.9rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0.4rem;
  flex-shrink: 0;
}

.conduct-score-block .cs-pips {
  display: flex; gap: 4px;
}

.conduct-score-block .cs-pip {
  width: 16px; height: 16px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  transition: background 0.2s;
}

.conduct-score-block .cs-meta {
  display: flex; align-items: baseline; gap: 0.4rem;
}

.conduct-score-block .cs-val {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1rem; line-height: 1;
  transition: color 0.2s;
}

.conduct-score-block .cs-lbl {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.6rem; letter-spacing: 0.1em; opacity: 0.75;
  transition: color 0.2s;
}

.conduct-score-block .cs-btns {
  display: flex; gap: 0.25rem;
}

.conduct-score-block .cs-btn {
  width: 1.6rem; height: 1.6rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #99ccff; font-size: 1rem; line-height: 1;
  cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

.conduct-score-block .cs-btn:disabled { opacity: 0.2; cursor: not-allowed; }

.conduct-score-block .cs-btn--down:not(:disabled):hover {
  background: rgba(185, 74, 72, 0.2); border-color: var(--conduct-neg); color: var(--conduct-neg);
}

.conduct-score-block .cs-btn--up:not(:disabled):hover {
  background: rgba(31, 120, 180, 0.2); border-color: var(--conduct-pos); color: var(--conduct-pos);
}

.cadet-summary-stats { display: flex; gap: 1.5rem; margin-left: auto; }
.summary-stat { text-align: center; }
.summary-val {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.5rem; color: #99ccff; line-height: 1;
}
.summary-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.62rem; letter-spacing: 0.1em; color: #445566; margin-top: 0.2rem;
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex; gap: 0; margin-bottom: 0;
  border-bottom: 1px solid rgba(51, 102, 255, 0.2);
}

.tab {
  background: none; border: none;
  border-bottom: 2px solid transparent;
  color: #6688aa;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.82rem; letter-spacing: 0.12em;
  padding: 0.6rem 1.2rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}
.tab:hover   { color: #99ccff; }
.tab.is-active { color: #ff9900; border-bottom-color: #ff9900; }

.tab-content { padding: 1rem 0; }

/* ── Missions ─────────────────────────────────────────────────────────────── */
.missions-summary {
  margin-bottom: 0.75rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.75rem; letter-spacing: 0.08em; color: #445566;
}

.submission-list { display: flex; flex-direction: column; gap: 0.5rem; }

.submission-card {
  background: rgba(10, 18, 34, 0.55);
  border: 1px solid rgba(51, 102, 255, 0.15);
  border-radius: 0.35rem;
  overflow: hidden;
  transition: border-color 0.15s;
}
.submission-card.is-grading  { border-color: rgba(51, 102, 255, 0.45); }
.submission-card.is-extending { border-color: rgba(255, 153, 0, 0.4); }

.sub-main {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 0.65rem 0.85rem; gap: 0.75rem;
}

.sub-title {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.88rem; letter-spacing: 0.05em; color: #cce0ff;
}
.sub-meta {
  font-size: 0.72rem; color: #445566; margin-top: 0.2rem;
  display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
}
.extension-badge {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.6rem; color: #ff9900; border: 1px solid #ff9900;
  padding: 0 0.3rem; border-radius: 0.2rem;
}
.sub-date { color: #334455; }

.sub-right {
  display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; flex-wrap: wrap;
  justify-content: flex-end;
}

.status-badge {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.65rem; letter-spacing: 0.1em;
  padding: 0.15rem 0.5rem; border-radius: 0.2rem; border: 1px solid;
}
.badge--assigned  { color: #6688aa; border-color: #6688aa; background: rgba(100,130,170,0.08); }
.badge--submitted { color: #ffcc00; border-color: #ffcc00; background: rgba(255,200,0,0.08); }
.badge--returned  { color: #ff8800; border-color: #ff8800; background: rgba(255,136,0,0.08); }
.badge--graded    { color: #00cc66; border-color: #00cc66; background: rgba(0,204,102,0.08); }

.sub-points { font-family: 'Antonio', 'Arial Narrow', sans-serif; font-size: 0.78rem; color: #99ccff; }
.sub-points--dash { color: #445566; }

.sub-actions { display: flex; gap: 0.3rem; }

.sub-feedback {
  padding: 0.4rem 0.85rem 0.5rem;
  font-size: 0.75rem; color: #6688aa;
  border-top: 1px solid rgba(51,102,255,0.08);
  background: rgba(51,102,255,0.03);
}
.feedback-label { color: #445566; font-weight: bold; }

/* ── Inline forms ─────────────────────────────────────────────────────────── */
.inline-form {
  padding: 0.75rem 0.85rem;
  border-top: 1px solid rgba(51, 102, 255, 0.15);
  background: rgba(51, 102, 255, 0.04);
  display: flex; flex-direction: column; gap: 0.5rem;
}
.inline-form-row { display: flex; align-items: center; gap: 0.6rem; }
.inline-label { font-family: 'Antonio', 'Arial Narrow', sans-serif; font-size: 0.72rem; color: #6688aa; width: 5rem; flex-shrink: 0; }
.inline-input {
  background: rgba(10, 18, 34, 0.8); border: 1px solid rgba(51,102,255,0.3);
  color: #cce0ff; padding: 0.3rem 0.5rem; border-radius: 0.25rem;
  font-size: 0.82rem; flex: 1;
}
.inline-input--sm { flex: 0 0 7rem; }
.inline-pts { font-size: 0.75rem; color: #445566; }
.inline-form-actions { display: flex; align-items: center; gap: 0.5rem; }
.action-select {
  background: rgba(10,18,34,0.8); border: 1px solid rgba(51,102,255,0.3);
  color: #99ccff; padding: 0.3rem 0.5rem; border-radius: 0.25rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif; font-size: 0.72rem;
}

/* ── Action buttons ───────────────────────────────────────────────────────── */
.action-btn {
  background: rgba(51,102,255,0.1); border: 1px solid rgba(51,102,255,0.3);
  color: #99ccff; padding: 0.25rem 0.7rem; border-radius: 0.25rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif; font-size: 0.72rem;
  letter-spacing: 0.07em; cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.action-btn:hover:not(:disabled) { background: rgba(51,102,255,0.25); }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn--primary { background: rgba(51,102,255,0.2); border-color: #3366ff; color: #99ccff; }
.action-btn--primary:hover:not(:disabled) { background: rgba(51,102,255,0.4); }
.action-btn--dim  { border-color: rgba(51,102,255,0.2); color: #6688aa; }
.action-btn--ghost { background: none; border-color: transparent; color: #445566; }
.action-btn--ghost:hover { color: #6688aa; }

/* ── Typing tab ───────────────────────────────────────────────────────────── */
.typing-summary-row { display: flex; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.typing-stat-card {
  flex: 1; min-width: 6rem;
  background: rgba(10,18,34,0.55); border: 1px solid rgba(51,102,255,0.15);
  border-radius: 0.35rem; padding: 0.75rem 1rem; text-align: center;
}
.tstat-val {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.6rem; color: #99ccff; line-height: 1;
}
.tstat-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.65rem; letter-spacing: 0.1em; color: #445566; margin-top: 0.3rem;
}

.typing-table { border: 1px solid rgba(51,102,255,0.15); border-radius: 0.35rem; overflow: hidden; }
.typing-table-head, .typing-table-row {
  display: grid;
  grid-template-columns: 10rem 6rem 4rem 6rem 5rem;
  align-items: center;
  padding: 0.45rem 0.85rem;
  gap: 0.5rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif; font-size: 0.72rem;
}
.typing-table-head {
  background: rgba(51,102,255,0.08); color: #445566; letter-spacing: 0.1em;
  border-bottom: 1px solid rgba(51,102,255,0.12);
}
.typing-table-row { color: #99bbcc; border-bottom: 1px solid rgba(51,102,255,0.06); }
.typing-table-row:last-child { border-bottom: none; }
.typing-table-row:hover { background: rgba(51,102,255,0.04); }
.wpm-val { color: #99ccff; font-size: 0.88rem; }
.mode-chip {
  font-size: 0.62rem; color: #6688aa;
  border: 1px solid rgba(51,102,255,0.2);
  padding: 0.1rem 0.35rem; border-radius: 0.2rem;
}

/* ── Conduct tab ──────────────────────────────────────────────────────────── */
.quarter-tabs { display: flex; gap: 0.3rem; margin-bottom: 1rem; flex-wrap: wrap; }
.quarter-tab {
  background: rgba(51,102,255,0.05); border: 1px solid rgba(51,102,255,0.2);
  color: #6688aa; padding: 0.3rem 0.8rem; border-radius: 0.25rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif; font-size: 0.72rem;
  letter-spacing: 0.08em; cursor: pointer; transition: all 0.15s;
}
.quarter-tab:hover { color: #99ccff; }
.quarter-tab.is-active { background: rgba(255,153,0,0.12); border-color: #ff9900; color: #ff9900; }

/* ── Conduct hero score (in conduct tab) ─────────────────────────────────── */
.conduct-score-hero {
  display: flex; align-items: center; gap: 1rem;
  padding: 1rem 1.25rem; margin-bottom: 1rem;
  background: rgba(10, 18, 34, 0.5);
  border: 1px solid rgba(51, 102, 255, 0.12);
  border-radius: 0.4rem;
}

.csh-pips { display: flex; gap: 6px; }
.csh-pip {
  width: 20px; height: 20px; border-radius: 4px;
  background: rgba(255,255,255,0.07); transition: background 0.2s;
}

.csh-meta { flex: 1; display: flex; flex-direction: column; gap: 0.1rem; }
.csh-val {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.4rem; line-height: 1; transition: color 0.2s;
}
.csh-lbl {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.65rem; letter-spacing: 0.12em; opacity: 0.8; transition: color 0.2s;
}

.csh-btns { display: flex; gap: 0.4rem; }
.csh-btn {
  width: 2.2rem; height: 2.2rem; border-radius: 0.3rem;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: #99ccff; font-size: 1.2rem; line-height: 1;
  cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}
.csh-btn:disabled { opacity: 0.2; cursor: not-allowed; }
.csh-btn--down:not(:disabled):hover { background: rgba(185,74,72,0.2); border-color: var(--conduct-neg); color: var(--conduct-neg); }
.csh-btn--up:not(:disabled):hover   { background: rgba(31,120,180,0.2); border-color: var(--conduct-pos); color: var(--conduct-pos); }

/* ── Conduct entry log ───────────────────────────────────────────────────── */
.conduct-entry-list { display: flex; flex-direction: column; gap: 0.3rem; }

.conduct-entry {
  display: flex; align-items: flex-start; gap: 0.6rem;
  padding: 0.4rem 0.75rem;
  background: rgba(10,18,34,0.4); border: 1px solid rgba(51,102,255,0.08);
  border-radius: 0.25rem;
}
.ce--pos { border-left: 3px solid var(--conduct-pos); }
.ce--neg { border-left: 3px solid var(--conduct-neg); }

.ce-delta {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.82rem; font-weight: bold;
  flex-shrink: 0; width: 1.8rem; text-align: center; padding-top: 0.1rem;
}
.ce-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.ce-reason {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.75rem; letter-spacing: 0.05em; color: #99bbcc;
}
.ce-note { font-size: 0.75rem; color: #556677; }
.ce-date { font-family: 'Antonio', 'Arial Narrow', sans-serif; font-size: 0.65rem; color: #334455; flex-shrink: 0; padding-top: 0.1rem; }

/* ── Workstation Logs ─────────────────────────────────────────────────────── */
.log-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.log-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.375rem;
  background: rgba(255,255,255,0.03);
  border-left: 3px solid transparent;
}

.log-row--sign_in         { border-left-color: #3366ff; }
.log-row--game_complete   { border-left-color: #22cc88; }
.log-row--typing_complete { border-left-color: #ffaa33; }

.log-icon {
  font-size: 1rem;
  flex-shrink: 0;
  width: 1.5rem;
  text-align: center;
}

.log-body {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
}

.log-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.85rem;
  font-weight: bold;
  color: #ccddef;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.log-detail {
  font-size: 0.8rem;
  color: #7799aa;
}

.log-time {
  font-family: 'Antonio', sans-serif;
  font-size: 0.72rem;
  color: #445566;
  flex-shrink: 0;
  white-space: nowrap;
}
</style>
