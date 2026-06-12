<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>Game Leaderboards</span></div>

    <!-- Access denied -->
    <div v-if="!isStaff && !isAdmin && !isAudit" class="denied-container">
      <div class="denied-icon">⛔</div>
      <h2 class="denied-title">ACCESS DENIED</h2>
      <p class="denied-sub">This section is restricted to staff.</p>
    </div>

    <div v-else class="games-admin-container">

      <!-- ── Period pills ─────────────────────────────────────────────────── -->
      <div class="tab-bar">
        <span class="tab-bar-heading">PERIOD</span>
        <div class="tab-bar-spacer"></div>
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
          @click="selectPeriod(p.id)"
        >{{ periodShortLabel(p.id) }}</button>
      </div>

      <!-- No period selected -->
      <div v-if="!selectedPeriodId" class="status-msg">
        Select a period using the pills above to view game standings.
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="status-msg">SCANNING LEADERBOARDS…</div>

      <!-- ── Leaderboard layout ────────────────────────────────────────────── -->
      <div v-else class="boards-layout">

        <!-- Row 1: single-board games (4-up) -->
        <div class="single-games-row">
          <div class="game-card" v-for="g in SINGLE_GAMES" :key="g.gameId">
            <div class="game-card-title">{{ g.title }}</div>
            <div v-if="!boards[g.gameId]?.length" class="board-empty">No scores yet</div>
            <ol v-else class="board-list">
              <li
                v-for="(entry, i) in boards[g.gameId]"
                :key="entry.uid"
                class="board-entry"
              >
                <span class="board-rank">{{ i + 1 }}</span>
                <span class="board-name">{{ firstName(entry.displayName) }}</span>
                <span class="board-score">{{ formatScore(entry.highScore, g.format) }}</span>
              </li>
            </ol>
          </div>
        </div>

        <!-- Row 2+: multi-difficulty games (full-width) -->
        <div
          v-for="g in MULTI_GAMES"
          :key="g.title"
          class="game-card game-card--wide"
        >
          <div class="game-card-title">{{ g.title }}</div>
          <div class="diff-columns">
            <div class="diff-col" v-for="sec in g.sections" :key="sec.gameId">
              <div class="diff-label" :class="sec.labelClass">{{ sec.label }}</div>
              <div v-if="!boards[sec.gameId]?.length" class="board-empty">No scores yet</div>
              <ol v-else class="board-list">
                <li
                  v-for="(entry, i) in boards[sec.gameId]"
                  :key="entry.uid"
                  class="board-entry"
                >
                  <span class="board-rank">{{ i + 1 }}</span>
                  <span class="board-name">{{ firstName(entry.displayName) }}</span>
                  <span class="board-score">{{ formatScore(entry.highScore, sec.format) }}</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  collection, query, where, orderBy, limit, getDocs,
} from '@/data/db'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useBroadcast } from '@/composables/useBroadcast'
import { PERIOD_IDS } from '@/config/schoolYear'

const { isStaff, isAdmin, isAudit, userInfo } = useAuth()
const { isBroadcasting, selectedPeriodId: broadcastPeriodId } = useBroadcast()

// ── Period selection ──────────────────────────────────────────────────────────

const myPeriodIds  = computed<string[]>(() => userInfo.value?.periodIds ?? [])
const selectedPeriodId = ref('')

function periodShortLabel(id: string): string {
  return id.replace('period-', 'P')
}

function selectPeriod(id: string) {
  selectedPeriodId.value = id
}

// Auto-select period on mount:
// • If currently broadcasting → jump straight to the broadcast period
// • Otherwise → first accessible period for this teacher
onMounted(() => {
  if (isBroadcasting.value && broadcastPeriodId.value) {
    selectedPeriodId.value = broadcastPeriodId.value
    return
  }
  const first = (isAdmin.value || isAudit.value)
    ? PERIOD_IDS[0]?.id
    : PERIOD_IDS.find(p => myPeriodIds.value.includes(p.id))?.id
  if (first) selectedPeriodId.value = first
})

// ── Game definitions ──────────────────────────────────────────────────────────

type FormatType = 'wins' | 'time' | 'moves' | 'pts'

interface SingleGame {
  title:         string
  gameId:        string
  lowerIsBetter: boolean
  format:        FormatType
}

interface MultiSection {
  label:         string
  labelClass:    string
  gameId:        string
  lowerIsBetter: boolean
  format:        FormatType
}

interface MultiGame {
  title:    string
  sections: MultiSection[]
}

const SINGLE_GAMES: SingleGame[] = [
  { title: 'Chess',                   gameId: 'chess',                lowerIsBetter: false, format: 'wins' },
  { title: 'Picard Maneuver',         gameId: 'picard_maneuver',      lowerIsBetter: false, format: 'wins' },
  { title: 'Battle of Mutara Nebula', gameId: 'battle_mutara_nebula', lowerIsBetter: false, format: 'wins' },
  { title: 'Rules of Acquisition',    gameId: 'rules_of_acquisition', lowerIsBetter: false, format: 'wins' },
]

const MULTI_GAMES: MultiGame[] = [
  {
    title: 'Minesweeper',
    sections: [
      { label: 'Cadet',     labelClass: 'diff-cadet',     gameId: 'minesweeper_cadet',     lowerIsBetter: true, format: 'time' },
      { label: 'Standard',  labelClass: 'diff-standard',  gameId: 'minesweeper_standard',  lowerIsBetter: true, format: 'time' },
      { label: 'Red Alert', labelClass: 'diff-red-alert', gameId: 'minesweeper_red-alert', lowerIsBetter: true, format: 'time' },
    ],
  },
  {
    title: 'Isolinear Cascade',
    sections: [
      { label: 'Easy',   labelClass: 'diff-easy',   gameId: 'isolinear_easy',   lowerIsBetter: true, format: 'moves' },
      { label: 'Medium', labelClass: 'diff-medium', gameId: 'isolinear_medium', lowerIsBetter: true, format: 'moves' },
      { label: 'Hard',   labelClass: 'diff-hard',   gameId: 'isolinear_hard',   lowerIsBetter: true, format: 'moves' },
    ],
  },
  {
    title: 'Warp Core Breach',
    sections: [
      { label: 'Easy',   labelClass: 'diff-easy',   gameId: 'warp_easy',   lowerIsBetter: false, format: 'pts' },
      { label: 'Medium', labelClass: 'diff-medium', gameId: 'warp_medium', lowerIsBetter: false, format: 'pts' },
      { label: 'Hard',   labelClass: 'diff-hard',   gameId: 'warp_hard',   lowerIsBetter: false, format: 'pts' },
    ],
  },
]

// Flat list of all game/difficulty IDs for batch-fetching
const ALL_SECTIONS = [
  ...SINGLE_GAMES.map(g => ({ gameId: g.gameId, lowerIsBetter: g.lowerIsBetter })),
  ...MULTI_GAMES.flatMap(g => g.sections.map(s => ({ gameId: s.gameId, lowerIsBetter: s.lowerIsBetter }))),
]

// ── Data ──────────────────────────────────────────────────────────────────────

interface ScoreEntry { uid: string; displayName: string; highScore: number }

const loading = ref(false)
const boards  = ref<Record<string, ScoreEntry[]>>({})

async function loadBoards(periodId: string) {
  loading.value = true
  try {
    const results = await Promise.all(
      ALL_SECTIONS.map(async ({ gameId, lowerIsBetter }) => {
        const q = query(
          collection(db, 'gameScores'),
          where('gameId',   '==', gameId),
          where('periodId', '==', periodId),
          orderBy('highScore', lowerIsBetter ? 'asc' : 'desc'),
          limit(5),
        )
        const snap = await getDocs(q)
        return [gameId, snap.docs.map(d => d.data() as ScoreEntry)] as const
      })
    )
    boards.value = Object.fromEntries(results)
  } finally {
    loading.value = false
  }
}

watch(selectedPeriodId, id => { if (id) loadBoards(id) })

// ── Formatting ────────────────────────────────────────────────────────────────

function firstName(name: string): string {
  return name?.split(' ')[0] ?? name
}

function formatScore(score: number, format: FormatType): string {
  switch (format) {
    case 'time': {
      const m = Math.floor(score / 60)
      const s = score % 60
      return `${m}:${String(s).padStart(2, '0')}`
    }
    case 'moves': return `${score} mv`
    case 'pts':   return `${score} pts`
    case 'wins':  return `${score} W`
  }
}
</script>

<style scoped>
@import '../assets/styles/classic.css';

.games-admin-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem 2rem 3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

/* ── Tab bar / period pills ── */
.tab-bar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  border-bottom: 0.125rem solid rgba(255, 153, 0, 0.3);
  padding-bottom: 0.5rem;
  flex-wrap: wrap;
}

.tab-bar-heading {
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.14em;
  color: #556;
}

.tab-bar-spacer { flex: 1; }

.period-pill {
  background: transparent;
  border: 0.125rem solid rgba(85, 102, 85, 0.3);
  border-radius: 0.25rem;
  color: #445;
  cursor: default;
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.5rem;
  transition: all 0.15s;
}
.period-pill--mine {
  color: #69f0ae;
  border-color: rgba(105, 240, 174, 0.4);
  cursor: pointer;
}
.period-pill--mine:hover {
  border-color: #69f0ae;
  background: rgba(105, 240, 174, 0.08);
}
.period-pill--active {
  color: #ff9900 !important;
  border-color: #ff9900 !important;
  background: rgba(255, 153, 0, 0.1) !important;
  cursor: pointer;
}

/* ── Layout ── */
.status-msg {
  color: #99ccff;
  font-size: 1rem;
  text-align: center;
  padding: 3rem 0;
  opacity: 0.7;
}

.boards-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Row of 4 single-game cards */
.single-games-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

/* ── Game cards ── */
.game-card {
  background: rgba(0, 20, 50, 0.45);
  border: 0.0625rem solid rgba(153, 204, 255, 0.15);
  border-radius: 0.5rem;
  padding: 1rem 1.1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.game-card--wide {
  /* full-width via boards-layout column */
}

.game-card-title {
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 0.14em;
  color: #ff9900;
  text-transform: uppercase;
  padding-bottom: 0.4rem;
  border-bottom: 0.0625rem solid rgba(255, 153, 0, 0.2);
}

/* ── Difficulty columns (multi-game cards) ── */
.diff-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.diff-col {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.diff-label {
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.15rem 0.4rem;
  border-radius: 0.2rem;
  width: fit-content;
}

/* Minesweeper difficulty colours */
.diff-cadet     { color: #69f0ae; background: rgba(105, 240, 174, 0.1); border: 1px solid rgba(105, 240, 174, 0.3); }
.diff-standard  { color: #ff9900; background: rgba(255, 153,   0, 0.1); border: 1px solid rgba(255, 153,   0, 0.3); }
.diff-red-alert { color: #ff5555; background: rgba(255,  85,  85, 0.1); border: 1px solid rgba(255,  85,  85, 0.3); }

/* Generic easy/medium/hard colours (Isolinear Cascade, WCB) */
.diff-easy   { color: #69f0ae; background: rgba(105, 240, 174, 0.1); border: 1px solid rgba(105, 240, 174, 0.3); }
.diff-medium { color: #ff9900; background: rgba(255, 153,   0, 0.1); border: 1px solid rgba(255, 153,   0, 0.3); }
.diff-hard   { color: #ff5555; background: rgba(255,  85,  85, 0.1); border: 1px solid rgba(255,  85,  85, 0.3); }

/* ── Leaderboard list ── */
.board-empty {
  color: #445;
  font-size: 0.8rem;
  font-style: italic;
  padding: 0.4rem 0;
}

.board-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.board-entry {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.2rem 0;
  border-bottom: 0.0625rem solid rgba(153, 204, 255, 0.06);
}
.board-entry:last-child { border-bottom: none; }

.board-rank {
  width: 1.1rem;
  text-align: right;
  font-size: 0.72rem;
  color: #445;
  flex-shrink: 0;
}

.board-name {
  flex: 1;
  font-size: 0.92rem;
  color: #cce4ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board-score {
  font-size: 0.8rem;
  font-weight: bold;
  color: #69f0ae;
  flex-shrink: 0;
}

/* ── Denied ── */
.denied-container { text-align: center; padding: 4rem 2rem; }
.denied-icon      { font-size: 3rem; margin-bottom: 1rem; }
.denied-title     { color: #ff6e6e; font-size: 1.5rem; letter-spacing: 0.1em; margin: 0 0 0.5rem; }
.denied-sub       { color: #556; font-size: 0.9rem; }

/* ── Responsive ── */
@media (max-width: 900px) {
  .single-games-row { grid-template-columns: repeat(2, 1fr); }
  .diff-columns     { grid-template-columns: 1fr; }
}
</style>
