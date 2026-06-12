<template>
  <div class="panel acp-panel">
    <div class="panel-header">
      <div>
        <div class="panel-title">ACTIVE SIMULATIONS</div>
        <div class="panel-sub">
          Live student challenges —
          {{ showAll ? 'All Periods' : selectedPeriodLabel }}
        </div>
      </div>
      <div v-if="active.length > 0" class="panel-badge">{{ active.length }}</div>
    </div>

    <div v-if="loading" class="acp-empty">Scanning holodeck…</div>

    <div v-else-if="active.length === 0" class="acp-empty">
      <span class="acp-clear-icon">✓</span> No active challenges.
    </div>

    <div v-else class="acp-grid">
      <div
        v-for="ch in active"
        :key="ch.id"
        :class="['acp-card', `acp-card--${ch.status}`]"
      >
        <!-- Top: meta tags -->
        <div class="card-tags">
          <span v-if="showAll" class="acp-period">{{ shortPeriodLabel(ch.periodId) }}</span>
          <span class="acp-game">{{ GAME_LABELS[ch.game] ?? ch.game }}</span>
          <span v-if="ch.game === 'chess' && ch.variant !== 'standard'" class="acp-variant">
            {{ ch.variant }}
          </span>
          <span :class="['acp-status', `acp-status--${ch.status}`]">{{ ch.status }}</span>
        </div>

        <!-- Middle: player matchup -->
        <div class="card-matchup">
          <div class="card-player">
            <div class="player-first">{{ splitName(ch.challengerName).first }}</div>
            <div v-if="splitName(ch.challengerName).last" class="player-last">
              {{ splitName(ch.challengerName).last }}
            </div>
          </div>
          <div class="card-vs">VS</div>
          <div class="card-player card-player--right">
            <div class="player-first">
              {{ splitName(ch.challengedName || ch.challengedId).first }}
            </div>
            <div
              v-if="splitName(ch.challengedName || ch.challengedId).last"
              class="player-last player-last--right"
            >
              {{ splitName(ch.challengedName || ch.challengedId).last }}
            </div>
          </div>
        </div>

        <!-- Bottom: action -->
        <button
          v-if="ch.status === 'accepted' || ch.status === 'pending'"
          class="acp-kill-btn"
          :disabled="terminating === ch.id"
          @click="handleTerminate(ch)"
        >
          {{ terminating === ch.id ? '…' : 'Close Connection' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { usePeriodSelector } from '@/composables/usePeriodSelector'
import { useChallenges, type Challenge } from '@/composables/useChallenges'
import { PERIOD_IDS } from '@/config/schoolYear'

const props = withDefaults(defineProps<{
  /** When true, show challenges from all periods (used in the ALL view). */
  showAll?: boolean
  /** Single-period view: which period to scope challenges to. Falls back to
   *  the globally Active (HUD/broadcast) period when not provided. */
  periodId?: string | null
}>(), {
  showAll: false,
  periodId: null,
})

const { effectiveTeacherEmail } = useAuth()
const { selectedPeriodId } = usePeriodSelector()
const { terminateChallenge } = useChallenges()

const viewPeriodId = computed(() => props.periodId ?? selectedPeriodId.value)

const challenges = ref<Challenge[]>([])
const loading = ref(true)
const terminating = ref<string | null>(null)

const GAME_LABELS: Record<string, string> = {
  'chess':                       'Chess',
  'battle-of-the-mutara-nebula': 'Nebula',
  'picard-maneuver':             'Picard Maneuver',
  'rules-of-acquisition':        'Rules of Acq.',
  'fractured-frontier':          'Fractured Frontier',
}

const selectedPeriodLabel = computed(() =>
  PERIOD_IDS.find(p => p.id === viewPeriodId.value)?.label ?? viewPeriodId.value
)

function shortPeriodLabel(periodId: string): string {
  return periodId?.replace('period-', 'P') ?? '?'
}

/** Split a full name into first + rest-as-last. Handles single-word names gracefully. */
function splitName(full: string): { first: string; last: string } {
  if (!full) return { first: '?', last: '' }
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

const active = computed(() =>
  challenges.value
    .filter(c => c.status === 'pending' || c.status === 'accepted')
    .sort((a, b) => {
      const n = (id: string) => parseInt(id?.replace('period-', '') ?? '0', 10)
      return n(a.periodId) - n(b.periodId)
    })
)

let unsub: (() => void) | null = null

watch(
  [() => effectiveTeacherEmail.value, viewPeriodId],
  ([email, period]) => {
    if (unsub) { unsub(); unsub = null }
    if (!email) { loading.value = false; return }
    // showAll: query by teacherEmail only — no periodId constraint.
    // single-period: require a period to be selected.
    if (!props.showAll && !period) { loading.value = false; return }

    loading.value = true
    const constraints = [where('teacherEmail', '==', email)]
    if (!props.showAll) constraints.push(where('periodId', '==', period))

    const q = query(collection(db, 'challenges'), ...constraints)
    unsub = onSnapshot(q, snap => {
      challenges.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge))
      loading.value = false
    })
  },
  { immediate: true }
)

onUnmounted(() => { if (unsub) unsub() })

async function handleTerminate(ch: Challenge) {
  terminating.value = ch.id
  try {
    await terminateChallenge(ch)
  } finally {
    terminating.value = null
  }
}
</script>

<style scoped>
/* Inherits .panel, .panel-header, .panel-title, .panel-sub, .panel-badge from AdminDashboard */
.acp-panel {
  grid-column: 1 / -1;
}

/* ── Empty / loading states ───────────────────────────────────────────────── */
.acp-empty {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #6688aa;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  padding: 0.5rem 0;
}

.acp-clear-icon {
  color: #5e9f63;
  font-size: 1.1rem;
  font-weight: 700;
}

/* ── Card grid ────────────────────────────────────────────────────────────── */
.acp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

/* ── Individual card ──────────────────────────────────────────────────────── */
.acp-card {
  background: rgba(0, 15, 40, 0.65);
  border: 1px solid rgba(77, 153, 238, 0.18);
  border-radius: 0.6rem;
  padding: 0.875rem 1rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  transition: border-color 0.2s, background 0.2s;
  /* Left accent strip based on status */
  border-left-width: 3px;
}

.acp-card:hover {
  background: rgba(0, 20, 50, 0.75);
  border-color: rgba(77, 153, 238, 0.35);
}

.acp-card--pending  { border-left-color: rgba(77, 153, 238, 0.55); }
.acp-card--accepted { border-left-color: rgba(94, 159, 99, 0.55); }

/* ── Top meta row ─────────────────────────────────────────────────────────── */
.card-tags {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.acp-period {
  font-size: 0.65rem;
  font-weight: 700;
  color: #7799cc;
  background: rgba(77, 153, 238, 0.1);
  border: 1px solid rgba(77, 153, 238, 0.2);
  border-radius: 999px;
  padding: 0.1rem 0.4rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.acp-game {
  font-size: 0.7rem;
  font-weight: 700;
  color: #6688aa;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.acp-variant {
  font-size: 0.62rem;
  font-weight: 700;
  color: #ff9900;
  background: rgba(255, 153, 0, 0.1);
  border-radius: 999px;
  padding: 0.1rem 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.acp-status {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  margin-left: auto; /* push status to the right */
}
.acp-status--pending  { color: #4d99ee; background: rgba(77,153,238,0.12); }
.acp-status--accepted { color: #5e9f63; background: rgba(94,159,99,0.12); }

/* ── Player matchup ───────────────────────────────────────────────────────── */
.card-matchup {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.card-player {
  flex: 1;
  min-width: 0;
}

.card-player--right {
  text-align: right;
}

.player-first {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.45rem;
  font-weight: 700;
  color: #d0e8ff;
  letter-spacing: 0.03em;
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-last {
  font-size: 0.7rem;
  color: #556688;
  letter-spacing: 0.05em;
  margin-top: 0.15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

.player-last--right {
  text-align: right;
}

.card-vs {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.7rem;
  font-weight: 700;
  color: #2e3e55;
  letter-spacing: 0.18em;
  flex-shrink: 0;
  text-transform: uppercase;
  padding: 0 0.1rem;
}

/* ── Action button ────────────────────────────────────────────────────────── */
.acp-kill-btn {
  width: 100%;
  background: rgba(200, 40, 40, 0.1);
  border: 1px solid rgba(200, 40, 40, 0.28);
  border-radius: 0.35rem;
  color: #cc5555;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.4rem 0.75rem;
  transition: background 0.18s, border-color 0.18s, color 0.18s;
}
.acp-kill-btn:hover:not(:disabled) {
  background: rgba(200, 40, 40, 0.2);
  border-color: #cc5555;
  color: #ff7777;
}
.acp-kill-btn:disabled { opacity: 0.35; cursor: not-allowed; }
</style>
