<!--
  CadetSlideOver.vue
  ──────────────────
  Slide-over panel opened from the seating chart when a teacher clicks a student.

  Shows:
    • Conduct score (0-4 pips, color-coded, +/− buttons)
    • Direction toggle (+1 / −1) → pick reason → optional note → Submit
      This logs a conductEntry AND updates the score in one tap sequence.
    • Recent entry log for the current quarter

  Props:
    student  — { uid, displayName, periodId, docId, conductScore }
    teacherEmail — the teacher whose records to write/read
  Emits:
    close
-->

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConductLog } from '@/composables/useConductLog'
import { pipColor, pipFilled, pipLabel, clampScore, updateConductScore } from '@/composables/useConductScore'
import { useExtensions } from '@/composables/useExtensions'
import { formatClassDate } from '@/composables/useAcademicCalendar'
import type { OutstandingItem, } from '@/composables/useExtensions'
import type { ExtensionType } from '@/composables/useAssignments'

// ── Props / emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  student: {
    uid:          string
    displayName:  string
    periodId:     string
    docId:        string    // approvedUsers doc ID (email) — for score writes
    conductScore: number    // live 0-4 from parent's onSnapshot
  } | null
  teacherEmail: string
}>()

const emit = defineEmits<{ close: [] }>()
const router = useRouter()

// ── Conduct log ───────────────────────────────────────────────────────────────

const { entries, loading, fetchEntries, logEntry, saving } = useConductLog()

// Declared here (before the immediate watcher below) to avoid TDZ crash
const expandedExtend = ref<string | null>(null)

watch(
  () => props.student,
  async (s) => {
    expandedExtend.value = null
    if (!s || !props.teacherEmail) return
    resetForm()
    localScore.value = s.conductScore ?? 4
    await Promise.all([
      fetchEntries(s.uid, props.teacherEmail),
      fetchOutstanding(s.uid, s.periodId),
    ])
  },
  { immediate: true },
)

// ── Conduct score (local mirror, optimistic) ──────────────────────────────────

const localScore    = ref(4)
const scoreUpdating = ref(false)

watch(() => props.student?.conductScore, (v) => {
  // Only sync from parent when we're not mid-update (avoids flicker)
  if (!scoreUpdating.value) localScore.value = v ?? 4
}, { immediate: true })

// ── Reason-entry form ─────────────────────────────────────────────────────────

// The 4 categories — used as reasons for score changes in both directions
const REASONS = [
  { key: 'participation', label: 'Participation',   negLabel: 'Not Participating' },
  { key: 'respect',       label: 'Respect',         negLabel: 'Disruptive'        },
  { key: 'onTask',        label: 'On Task',         negLabel: 'Off Task'           },
  { key: 'effort',        label: 'Effort',          negLabel: 'Low Effort'         },
] as const

type ReasonKey = typeof REASONS[number]['key']

const pendingDirection = ref<'+1' | '-1' | null>(null)
const pendingReason    = ref<ReasonKey | null>(null)
const pendingNote      = ref('')
const entrySaved       = ref(false)

const resetForm = () => {
  pendingDirection.value = null
  pendingReason.value    = null
  pendingNote.value      = ''
  entrySaved.value       = false
}

const selectDirection = (dir: '+1' | '-1') => {
  if (pendingDirection.value === dir) {
    resetForm()   // tap same button again → collapse
  } else {
    pendingDirection.value = dir
    pendingReason.value    = null
  }
}

const canSubmit = computed(() =>
  pendingDirection.value !== null && pendingReason.value !== null,
)

const submitEntry = async () => {
  if (!props.student || !props.teacherEmail || !canSubmit.value) return
  if (saving.value || scoreUpdating.value) return

  const delta  = pendingDirection.value === '+1' ? 1 : -1
  const type   = delta > 0 ? 'positive' as const : 'negative' as const
  const reason = pendingReason.value!

  // Optimistic score update
  const next = clampScore(localScore.value + delta)
  localScore.value = next
  scoreUpdating.value = true

  try {
    await Promise.all([
      logEntry({
        studentId:    props.student.uid,
        studentName:  props.student.displayName,
        teacherEmail: props.teacherEmail,
        periodId:     props.student.periodId,
        type,
        reason,
        scoreDelta:   delta,
        note:         pendingNote.value.trim(),
      }),
      updateConductScore(props.student.docId, next),
    ])

    entrySaved.value = true
    setTimeout(async () => {
      entrySaved.value = false
      resetForm()
      await fetchEntries(props.student!.uid, props.teacherEmail)
    }, 1200)
  } catch (e) {
    console.error('[CadetSlideOver] submitEntry error:', e)
    localScore.value = clampScore(next - delta)   // revert
  } finally {
    scoreUpdating.value = false
  }
}

// ── Extensions ────────────────────────────────────────────────────────────────

const { items: outstandingItems, isLoading: extLoading, isSaving: extSaving, fetchOutstanding, grantExtension } = useExtensions()

// Which submission is showing the Sick/Sports picker (null = none)
const toggleExtend = (submissionId: string) => {
  expandedExtend.value = expandedExtend.value === submissionId ? null : submissionId
}

const confirmExtension = async (item: OutstandingItem, type: ExtensionType) => {
  if (!props.teacherEmail) return
  const ok = await grantExtension(item, type, props.teacherEmail)
  if (ok) expandedExtend.value = null
}

const fmtDue = (date: string | null) => {
  if (!date) return 'No due date'
  return formatClassDate(date)
}

const extensionCount = (item: OutstandingItem) => item.extensionLog.length

// ── Recent entries ────────────────────────────────────────────────────────────

const recentEntries = computed(() => entries.value.slice(0, 8))

const reasonLabel = (entry: { reason: string; type: string }) => {
  const r = REASONS.find(r => r.key === entry.reason)
  if (!r) return entry.reason || '—'
  return entry.type === 'negative' ? r.negLabel : r.label
}

const fmtTime = (d: Date | null) => {
  if (!d) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <!-- Backdrop -->
  <Transition name="backdrop">
    <div v-if="student" class="slideover-backdrop" @click="emit('close')" />
  </Transition>

  <!-- Panel -->
  <Transition name="slideover">
    <div v-if="student" class="slideover-panel" role="dialog" :aria-label="`${student.displayName} — conduct panel`">

      <!-- ── Header ──────────────────────────────────────────────────── -->
      <div class="panel-header">
        <div class="panel-student">
          <div class="panel-avatar">{{ student.displayName.charAt(0).toUpperCase() }}</div>
          <div>
            <div class="panel-name">{{ student.displayName }}</div>
            <div class="panel-period">{{ student.periodId.replace('period-', 'Period ') }}</div>
          </div>
        </div>
        <div class="panel-header-actions">
          <button class="detail-link" @click="router.push(`/admin/cadet/${student.uid}`)">Full Profile →</button>
          <button class="close-btn" @click="emit('close')" aria-label="Close">✕</button>
        </div>
      </div>

      <!-- ── Conduct score ───────────────────────────────────────────── -->
      <div class="conduct-score-bar">
        <div class="cs-pips">
          <span
            v-for="i in 4"
            :key="i"
            class="cs-pip"
            :style="pipFilled(localScore, i) ? { background: pipColor(localScore) } : {}"
          ></span>
        </div>
        <div class="cs-info">
          <span class="cs-value" :style="{ color: pipColor(localScore) }">{{ localScore }}/4</span>
          <span class="cs-label" :style="{ color: pipColor(localScore) }">{{ pipLabel(localScore) }}</span>
        </div>
        <div class="cs-btns">
          <button
            class="cs-btn cs-btn--down"
            :class="{ 'cs-btn--active': pendingDirection === '-1' }"
            :disabled="localScore <= 0 || scoreUpdating"
            title="Deduct one point"
            @click="selectDirection('-1')"
          >−</button>
          <button
            class="cs-btn cs-btn--up"
            :class="{ 'cs-btn--active': pendingDirection === '+1' }"
            :disabled="localScore >= 4 || scoreUpdating"
            title="Restore one point"
            @click="selectDirection('+1')"
          >+</button>
        </div>
      </div>

      <!-- ── Reason picker (expands when + or − is tapped) ──────────── -->
      <Transition name="expand">
        <div v-if="pendingDirection" class="reason-panel">
          <div class="reason-label">
            {{ pendingDirection === '-1' ? '− REASON' : '+ REASON' }}
          </div>
          <div class="reason-grid">
            <button
              v-for="r in REASONS"
              :key="r.key"
              class="reason-btn"
              :class="{
                'reason-btn--selected': pendingReason === r.key,
                'reason-btn--neg': pendingDirection === '-1',
                'reason-btn--pos': pendingDirection === '+1',
              }"
              @click="pendingReason = r.key"
            >
              {{ pendingDirection === '-1' ? r.negLabel : r.label }}
            </button>
          </div>

          <div class="note-row">
            <input
              v-model="pendingNote"
              type="text"
              placeholder="Add a note… (optional)"
              class="note-input"
              @keydown.enter="canSubmit && submitEntry()"
            />
            <button
              class="submit-btn"
              :class="{
                'submit-btn--neg':   pendingDirection === '-1',
                'submit-btn--pos':   pendingDirection === '+1',
                'submit-btn--saved': entrySaved,
                'submit-btn--dim':   !canSubmit,
              }"
              :disabled="!canSubmit || saving || scoreUpdating"
              @click="submitEntry"
            >
              <span v-if="entrySaved">✓</span>
              <span v-else-if="saving || scoreUpdating">…</span>
              <span v-else>Log</span>
            </button>
          </div>
        </div>
      </Transition>

      <div class="panel-divider"></div>

      <!-- ── Outstanding missions ──────────────────────────────────────── -->
      <div class="outstanding-section">
        <div class="entries-header">OUTSTANDING MISSIONS</div>

        <div v-if="extLoading" class="entries-empty">Loading…</div>
        <div v-else-if="outstandingItems.length === 0" class="entries-empty">No outstanding missions.</div>

        <div v-else class="outstanding-list">
          <div
            v-for="item in outstandingItems"
            :key="item.submissionId"
            class="outstanding-item"
          >
            <!-- Mission row -->
            <div class="outstanding-row">
              <div class="outstanding-info">
                <span class="outstanding-title">{{ item.missionTitle }}</span>
                <span class="outstanding-due" :class="{ 'outstanding-due--overridden': !!item.dueDateOverride }">
                  Due {{ fmtDue(item.effectiveDueDate) }}
                  <span v-if="extensionCount(item) > 0" class="ext-badge" :title="`Extended ${extensionCount(item)} time(s)`">×{{ extensionCount(item) }}</span>
                </span>
              </div>
              <button
                class="extend-btn"
                :class="{ 'extend-btn--active': expandedExtend === item.submissionId }"
                :disabled="extSaving || !item.nextClassDay"
                :title="item.nextClassDay ? 'Grant extension' : 'No future class day found'"
                @click="toggleExtend(item.submissionId)"
              >Extend</button>
            </div>

            <!-- Inline extend picker -->
            <Transition name="expand">
              <div v-if="expandedExtend === item.submissionId" class="extend-picker">
                <div class="extend-preview">
                  {{ fmtDue(item.effectiveDueDate) }} → <strong>{{ fmtDue(item.nextClassDay) }}</strong>
                </div>
                <div class="extend-choices">
                  <button
                    class="extend-choice extend-choice--sick"
                    :disabled="extSaving"
                    @click="confirmExtension(item, 'sick')"
                  >🤒 Sick Day</button>
                  <button
                    class="extend-choice extend-choice--sports"
                    :disabled="extSaving"
                    @click="confirmExtension(item, 'sports')"
                  >🏅 Sports</button>
                </div>
                <!-- Extension history -->
                <div v-if="item.extensionLog.length > 0" class="ext-history">
                  <div
                    v-for="(log, i) in item.extensionLog"
                    :key="i"
                    class="ext-history-row"
                  >
                    <span class="ext-type">{{ log.type === 'sick' ? '🤒' : '🏅' }}</span>
                    <span class="ext-dates">{{ formatClassDate(log.fromDate) }} → {{ formatClassDate(log.toDate) }}</span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <div class="panel-divider"></div>

      <!-- ── Entry log ───────────────────────────────────────────────── -->
      <div class="entries-section">
        <div class="entries-header">THIS QUARTER</div>

        <div v-if="loading" class="entries-empty">Loading…</div>
        <div v-else-if="recentEntries.length === 0" class="entries-empty">No entries yet this quarter.</div>

        <div v-else class="entries-list">
          <div
            v-for="e in recentEntries"
            :key="e.id"
            class="entry-row"
            :class="{ 'entry-row--pos': e.type === 'positive', 'entry-row--neg': e.type === 'negative' }"
          >
            <span class="entry-delta" :style="{ color: e.scoreDelta > 0 ? '#4caf50' : '#f44336' }">
              {{ e.scoreDelta > 0 ? '+1' : '−1' }}
            </span>
            <div class="entry-body">
              <span class="entry-reason">{{ reasonLabel(e) }}</span>
              <span v-if="e.note" class="entry-note">{{ e.note }}</span>
            </div>
            <span class="entry-time">{{ fmtTime(e.loggedAt) }}</span>
          </div>
        </div>
      </div>

    </div>
  </Transition>
</template>

<style scoped>

/* ── Transitions ──────────────────────────────────────────────────────────── */
.backdrop-enter-active, .backdrop-leave-active { transition: opacity 0.2s ease; }
.backdrop-enter-from, .backdrop-leave-to       { opacity: 0; }

.slideover-enter-active, .slideover-leave-active { transition: transform 0.25s ease; }
.slideover-enter-from, .slideover-leave-to       { transform: translateX(100%); }

.expand-enter-active, .expand-leave-active {
  transition: max-height 0.22s ease, opacity 0.18s ease;
  overflow: hidden;
}
.expand-enter-from, .expand-leave-to { max-height: 0; opacity: 0; }
.expand-enter-to, .expand-leave-from { max-height: 20rem; opacity: 1; }

/* ── Backdrop ─────────────────────────────────────────────────────────────── */
.slideover-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 200;
}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.slideover-panel {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 22rem;
  background: rgba(8, 14, 28, 0.97);
  backdrop-filter: blur(16px);
  border-left: 1px solid rgba(51, 102, 255, 0.25);
  z-index: 201;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: -0.5rem 0 2rem rgba(0, 0, 0, 0.5);
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid rgba(51, 102, 255, 0.15);
  flex-shrink: 0;
}

.panel-student { display: flex; align-items: center; gap: 0.6rem; }

.panel-avatar {
  width: 2.2rem; height: 2.2rem;
  border-radius: 50%;
  background: rgba(51, 102, 255, 0.2);
  border: 1px solid rgba(51, 102, 255, 0.4);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1rem; color: #99ccff; flex-shrink: 0;
}

.panel-name {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.95rem; letter-spacing: 0.06em; color: #cce0ff;
}
.panel-period {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.65rem; letter-spacing: 0.08em; color: #445566; margin-top: 0.1rem;
}

.panel-header-actions { display: flex; align-items: center; gap: 0.4rem; }

.detail-link {
  background: none; border: 1px solid rgba(51, 102, 255, 0.3);
  color: #6688aa; padding: 0.25rem 0.6rem; border-radius: 0.25rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif; font-size: 0.65rem;
  letter-spacing: 0.07em; cursor: pointer; transition: all 0.15s;
}
.detail-link:hover { color: #99ccff; border-color: #3366ff; }

.close-btn {
  background: none; border: none; color: #445566;
  font-size: 0.9rem; cursor: pointer; padding: 0.2rem;
  transition: color 0.15s; line-height: 1;
}
.close-btn:hover { color: #99ccff; }

/* ── Conduct score bar ────────────────────────────────────────────────────── */
.conduct-score-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: rgba(0, 0, 0, 0.2);
}

.cs-pips { display: flex; gap: 5px; align-items: center; }

.cs-pip {
  width: 16px; height: 16px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  transition: background 0.2s;
}

.cs-info {
  flex: 1;
  display: flex; flex-direction: column; gap: 0.05rem;
}

.cs-value {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.05rem; line-height: 1; letter-spacing: 0.04em;
  transition: color 0.2s;
}
.cs-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.6rem; letter-spacing: 0.1em; opacity: 0.75;
  transition: color 0.2s;
}

.cs-btns { display: flex; gap: 0.3rem; }

.cs-btn {
  width: 2.1rem; height: 2.1rem;
  border-radius: 0.3rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #99ccff; font-size: 1.2rem; line-height: 1;
  cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}
.cs-btn:disabled { opacity: 0.22; cursor: not-allowed; }

.cs-btn--down:not(:disabled):hover,
.cs-btn--down.cs-btn--active {
  background: rgba(244, 67, 54, 0.18);
  border-color: #f44336; color: #f44336;
}
.cs-btn--up:not(:disabled):hover,
.cs-btn--up.cs-btn--active {
  background: rgba(76, 175, 80, 0.18);
  border-color: #4caf50; color: #4caf50;
}

/* ── Reason picker ────────────────────────────────────────────────────────── */
.reason-panel {
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.15);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.reason-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.62rem; letter-spacing: 0.15em;
  color: #445566; margin-bottom: 0.5rem;
}

.reason-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
  margin-bottom: 0.6rem;
}

.reason-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #7799aa;
  padding: 0.45rem 0.5rem;
  border-radius: 0.3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.72rem; letter-spacing: 0.06em;
  cursor: pointer; transition: all 0.15s;
  text-align: center;
}

.reason-btn:hover { color: #aaccdd; border-color: rgba(255,255,255,0.25); }

.reason-btn--selected.reason-btn--neg {
  background: rgba(244, 67, 54, 0.15);
  border-color: #f44336; color: #f44336;
}
.reason-btn--selected.reason-btn--pos {
  background: rgba(76, 175, 80, 0.15);
  border-color: #4caf50; color: #4caf50;
}

.note-row { display: flex; gap: 0.4rem; }

.note-input {
  flex: 1;
  background: rgba(10, 18, 34, 0.8);
  border: 1px solid rgba(51, 102, 255, 0.25);
  color: #cce0ff; padding: 0.35rem 0.6rem;
  border-radius: 0.25rem; font-size: 0.8rem;
}
.note-input:focus { outline: none; border-color: rgba(51, 102, 255, 0.5); }
.note-input::placeholder { color: #334455; }

.submit-btn {
  background: rgba(51, 102, 255, 0.1);
  border: 1px solid rgba(51, 102, 255, 0.3);
  color: #99ccff; padding: 0.35rem 0.85rem;
  border-radius: 0.25rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.78rem; font-weight: bold;
  cursor: pointer; transition: all 0.15s; min-width: 3rem;
}
.submit-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.submit-btn--dim { opacity: 0.35; }

.submit-btn--neg:not(:disabled):not(.submit-btn--dim):not(.submit-btn--saved) {
  border-color: #f44336; color: #f44336; background: rgba(244,67,54,0.08);
}
.submit-btn--pos:not(:disabled):not(.submit-btn--dim):not(.submit-btn--saved) {
  border-color: #4caf50; color: #4caf50; background: rgba(76,175,80,0.08);
}
.submit-btn--saved {
  border-color: #4caf50; color: #4caf50; background: rgba(76,175,80,0.12);
}

/* ── Divider ──────────────────────────────────────────────────────────────── */
.panel-divider { height: 1px; background: rgba(51,102,255,0.12); flex-shrink: 0; }

/* ── Entry log ────────────────────────────────────────────────────────────── */
.entries-section { padding: 0.75rem 1rem; flex: 1; }

.entries-header {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.62rem; letter-spacing: 0.15em;
  color: #334455; margin-bottom: 0.6rem;
}

.entries-empty {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.72rem; color: #2a3a4a; font-style: italic;
}

.entries-list { display: flex; flex-direction: column; gap: 0.3rem; }

.entry-row {
  display: flex; align-items: flex-start; gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 0.25rem;
  border-left: 2px solid transparent;
}
.entry-row--neg { border-left-color: #f44336; }
.entry-row--pos { border-left-color: #4caf50; }

.entry-delta {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.75rem; font-weight: bold;
  flex-shrink: 0; line-height: 1.4;
  width: 1.6rem; text-align: center;
}

.entry-body {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 0.1rem;
}

.entry-reason {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.72rem; letter-spacing: 0.05em; color: #99bbcc;
}
.entry-note {
  font-size: 0.72rem; color: #556677; line-height: 1.3;
}

.entry-time {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.58rem; color: #2a3a4a; flex-shrink: 0; padding-top: 0.15rem;
}

/* ── Outstanding missions ─────────────────────────────────────────────────── */
.outstanding-section { padding: 0.75rem 1rem; }

.outstanding-list { display: flex; flex-direction: column; gap: 0.35rem; }

.outstanding-item {
  border: 1px solid rgba(51, 102, 255, 0.15);
  border-radius: 0.3rem;
  overflow: hidden;
}

.outstanding-row {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.45rem 0.55rem;
  background: rgba(51, 102, 255, 0.05);
}

.outstanding-info {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 0.1rem;
}

.outstanding-title {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.75rem; letter-spacing: 0.04em;
  color: #aaccdd;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.outstanding-due {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.62rem; letter-spacing: 0.05em; color: #445566;
}
.outstanding-due--overridden { color: #ff9900; }

.ext-badge {
  display: inline-block;
  background: rgba(255, 153, 0, 0.15);
  border: 1px solid rgba(255, 153, 0, 0.35);
  color: #ff9900;
  font-size: 0.55rem; padding: 0 0.3rem;
  border-radius: 0.2rem; margin-left: 0.35rem;
  vertical-align: middle;
}

.extend-btn {
  flex-shrink: 0;
  background: rgba(51, 102, 255, 0.08);
  border: 1px solid rgba(51, 102, 255, 0.3);
  color: #6688bb;
  padding: 0.25rem 0.6rem;
  border-radius: 0.25rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.65rem; letter-spacing: 0.07em;
  cursor: pointer; transition: all 0.15s;
}
.extend-btn:hover:not(:disabled)  { color: #99ccff; border-color: #3366ff; }
.extend-btn--active               { color: #99ccff; border-color: #3366ff; background: rgba(51,102,255,0.15); }
.extend-btn:disabled              { opacity: 0.3; cursor: not-allowed; }

/* Extend picker (inline dropdown) */
.extend-picker {
  padding: 0.55rem 0.55rem 0.45rem;
  background: rgba(0, 0, 0, 0.25);
  border-top: 1px solid rgba(51, 102, 255, 0.12);
}

.extend-preview {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.68rem; letter-spacing: 0.05em;
  color: #556677; margin-bottom: 0.45rem;
}
.extend-preview strong { color: #00cc66; }

.extend-choices { display: flex; gap: 0.4rem; margin-bottom: 0.35rem; }

.extend-choice {
  flex: 1;
  padding: 0.4rem 0.5rem;
  border-radius: 0.25rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.72rem; letter-spacing: 0.05em;
  cursor: pointer; transition: all 0.15s;
  border: 1px solid transparent;
}
.extend-choice:disabled { opacity: 0.4; cursor: not-allowed; }

.extend-choice--sick {
  background: rgba(255, 100, 80, 0.1);
  border-color: rgba(255, 100, 80, 0.35);
  color: #ff8877;
}
.extend-choice--sick:hover:not(:disabled) {
  background: rgba(255, 100, 80, 0.2); border-color: #ff6655;
}

.extend-choice--sports {
  background: rgba(51, 153, 255, 0.1);
  border-color: rgba(51, 153, 255, 0.35);
  color: #66aaff;
}
.extend-choice--sports:hover:not(:disabled) {
  background: rgba(51, 153, 255, 0.2); border-color: #3399ff;
}

/* Extension history (shown inside picker) */
.ext-history {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 0.35rem;
  display: flex; flex-direction: column; gap: 0.2rem;
}

.ext-history-row {
  display: flex; align-items: center; gap: 0.4rem;
}

.ext-type { font-size: 0.7rem; flex-shrink: 0; }

.ext-dates {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.6rem; letter-spacing: 0.04em; color: #334455;
}
</style>
