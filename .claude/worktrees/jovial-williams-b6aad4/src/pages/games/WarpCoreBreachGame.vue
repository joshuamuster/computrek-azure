<template>
  <div class="df-game-container" :class="{ show: isVisible }">

    <!-- ─── Header ──────────────────────────────────────────────────────────── -->
    <div class="game-header">
      <div class="header-left">
        <div class="status-box">
          <span class="label">SCORE</span>
          <span class="value">{{ score }}</span>
        </div>
        <div class="status-box">
          <span class="label">PIPES</span>
          <span class="value">{{ filledCount }}</span>
        </div>
        <div class="status-box">
          <span class="label">PAR</span>
          <span class="value">{{ currentPuzzle?.parLength ?? '—' }}</span>
        </div>
      </div>

      <div class="logo-wrapper" @click="goToGames">
        <img :src="warpCoreBreachLogo" alt="Warp Core Breach" class="game-logo-small" />
      </div>

      <div class="header-right">
        <div class="status-box diff-box">
          <div class="inline-logo-grid" :class="currentPuzzle?.difficulty.toLowerCase()">
            <div
                v-for="(lit, i) in logoPattern"
                :key="i"
                class="inline-logo-cell"
                :class="{ lit }"
            />
          </div>
          <span class="value diff-value" :class="currentPuzzle?.difficulty.toLowerCase()">
            {{ currentPuzzle?.difficulty ?? '—' }}
          </span>
        </div>
        <button @click="handleReset" class="pill reset-btn">Reset</button>
      </div>
    </div>

    <!-- ─── Countdown bar ─────────────────────────────────────────────────── -->
    <div class="countdown-bar-wrapper">
      <div
          class="countdown-bar"
          :class="{ urgent: countdownPct < 0.25, flowing: isFlowing }"
          :style="{ width: `${countdownPct * 100}%` }"
      />
      <span class="countdown-label">
        <template v-if="!isFlowing">
          FLOW IN {{ countdownSecStr }}s
        </template>
        <template v-else>
          FLOWING — SPACEBAR TO ACCELERATE
        </template>
      </span>
    </div>

    <!-- ─── Queue + Board row ──────────────────────────────────────────────── -->
    <div class="df-play-row">

      <!-- Pipe Queue -->
      <div class="pipe-queue">
        <div class="queue-label">NEXT</div>
        <div
            v-for="(ptype, i) in queue.slice(0, 5)"
            :key="i"
            class="queue-item"
            :class="{ 'queue-next': i === 0 }"
        >
          <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" class="queue-svg">
            <QueuePipeSvg :type="ptype" />
          </svg>
        </div>
      </div>

      <!-- Level Selector -->
      <div class="df-center-col">
        <div class="level-selector">
          <div class="level-grid">
            <button
                v-for="p in puzzles"
                :key="p.id"
                @click="selectPuzzle(p.id)"
                :disabled="isLevelLocked(p.id)"
                :class="[
                'level-bubble',
                p.difficulty.toLowerCase(),
                {
                  active:    currentPuzzleId === p.id,
                  completed: isLevelCompleted(p.id),
                  locked:    isLevelLocked(p.id),
                }
              ]"
            >
              {{ p.id }}
            </button>
          </div>
        </div>

        <!-- Board -->
        <div class="df-board-container">
          <WarpCoreBreachBoard
              :cells="cells"
              :cols="currentPuzzle?.cols ?? 7"
              :rows="currentPuzzle?.rows ?? 7"
              :playable="!gameOver && !showConfirm"
              :flow-idx="flowIdx"
              :exit-idx="exitIdx"
              :exit-dir="exitDir"
              :exit-reached="exitReached"
              :warp-core-icon="warpCoreIcon"
              @place="onPlace"
          />
        </div>
      </div>
    </div>

    <!-- ─── Confirmation Modal ────────────────────────────────────────────── -->
    <div v-if="showConfirm" class="game-status-overlay confirmation">
      <h2>{{ confirmMessage }}</h2>
      <p class="confirm-sub">Current simulation progress will be lost.</p>
      <div class="confirm-actions">
        <button @click="confirmAction" class="pill confirm-btn">PROCEED</button>
        <button @click="showConfirm = false" class="pill abort-btn">ABORT</button>
      </div>
    </div>

    <!-- ─── Game Over Modal ───────────────────────────────────────────────── -->
    <div v-if="gameOver" class="game-status-overlay" :class="victory ? 'game-over' : 'game-fail'">
      <h2 v-if="victory">WARP CORE BREACH — PIPELINE SECURED</h2>
      <h2 v-else>WARP CORE BREACH — CONTAINMENT BREACH</h2>
      <p class="confirm-sub">
        <template v-if="victory">
          {{ filledCount }} pipe{{ filledCount === 1 ? '' : 's' }} connected · Score: {{ score }}
          <template v-if="currentPuzzle && filledCount >= currentPuzzle.parLength"> · Par achieved! ⭐</template>
        </template>
        <template v-else>
          Flow escaped after {{ filledCount }} pipe{{ filledCount === 1 ? '' : 's' }}.
        </template>
      </p>
      <p v-if="victory && myBestScore !== null && score > myBestScore" class="score-note new-record">
        ⭐ New personal best for {{ currentPuzzle?.difficulty }}!
      </p>
      <p v-else-if="victory && myBestScore !== null && score < myBestScore" class="score-note">
        Your best: {{ myBestScore }} pts
      </p>
      <div class="confirm-actions">
        <button @click="resetLocal" class="pill abort-btn">RESET</button>
        <button v-if="hasNextLevel && victory" @click="nextLevel" class="pill confirm-btn">NEXT LEVEL</button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, defineComponent, h } from 'vue';
import { useRouter } from 'vue-router';
import { useGameScores } from '@/composables/useGameScores';
import type { PipeType, Direction } from '@/components/games/WarpCoreBreach/engine';
import {
  makeEmptyGrid, placePipe, advanceFlow, generateQueue, rcToIdx, neighbourIdx,
  scoreForPipe, getOpposite,
} from '@/components/games/WarpCoreBreach/engine';
import type { WarpCoreBreachPuzzle } from '@/components/games/WarpCoreBreach/WarpCoreBreachPuzzles';
import { puzzles } from '@/components/games/WarpCoreBreach/WarpCoreBreachPuzzles';
import WarpCoreBreachBoard from '@/components/games/WarpCoreBreach/WarpCoreBreachBoard.vue';
import warpCoreBreachLogo from '@/assets/images/games/title-warpcorebreach.svg';
import warpCoreIcon from '@/assets/images/games/Icon-WarpCore.svg';
import soundOk      from '@/assets/sounds/SFX-Computer/keyok1.wav';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import soundFail    from '@/assets/sounds/SFX-Computer/keyerror.wav';
import '@/assets/styles/gameLanding.css';

// ── Inline queue SVG component ────────────────────────────────────────────────
const QueuePipeSvg = defineComponent({
  name: 'QueuePipeSvg',
  props: { type: { type: String as () => PipeType, required: true } },
  setup(props) {
    return () => {
      const t = props.type;
      const color = 'rgba(168,216,255,0.75)';
      const w = 12;
      const nodes: any[] = [];
      if (t === 'EW' || t === 'CROSS')
        nodes.push(h('rect', { x: 0, y: 14, width: 40, height: w, rx: 2, fill: color }));
      if (t === 'NS' || t === 'CROSS')
        nodes.push(h('rect', { x: 14, y: 0, width: w, height: 40, rx: 2, fill: color }));
      if (t === 'NE')
        nodes.push(h('path', { d: 'M20 0 A20 20 0 0 0 40 20', 'stroke-width': w, stroke: color, fill: 'none', 'stroke-linecap': 'butt' }));
      if (t === 'NW')
        nodes.push(h('path', { d: 'M20 0 A20 20 0 0 1 0 20',  'stroke-width': w, stroke: color, fill: 'none', 'stroke-linecap': 'butt' }));
      if (t === 'SE')
        nodes.push(h('path', { d: 'M20 40 A20 20 0 0 1 40 20', 'stroke-width': w, stroke: color, fill: 'none', 'stroke-linecap': 'butt' }));
      if (t === 'SW')
        nodes.push(h('path', { d: 'M20 40 A20 20 0 0 0 0 20',  'stroke-width': w, stroke: color, fill: 'none', 'stroke-linecap': 'butt' }));
      return h('g', nodes);
    };
  },
});

// ── Router ────────────────────────────────────────────────────────────────────
const router = useRouter();

// ── Visibility ────────────────────────────────────────────────────────────────
const isVisible = ref(false);

// ── Game state ────────────────────────────────────────────────────────────────
const currentPuzzleId = ref(1);
const cells           = ref(makeEmptyGrid(7, 7));
const queue           = ref<PipeType[]>([]);
const score           = ref(0);
const filledCount     = ref(0);
const gameOver        = ref(false);
const victory         = ref(false);
const completedLevels = ref<number[]>([]);

// ── Puzzle lookup (declared here so score tracking block can reference it) ─────
const currentPuzzle = computed(() => puzzles.find(p => p.id === currentPuzzleId.value));
const hasNextLevel  = computed(() => puzzles.some(p => p.id === currentPuzzleId.value + 1));

// ── Score tracking — one composable per difficulty ────────────────────────────
const scores = {
  easy:   useGameScores('warp_easy'),
  medium: useGameScores('warp_medium'),
  hard:   useGameScores('warp_hard'),
}

type DiffKey = keyof typeof scores

const activeScores = computed(() => {
  const diff = (currentPuzzle.value?.difficulty?.toLowerCase() ?? 'easy') as DiffKey
  return scores[diff] ?? scores.easy
})

const myBestScore = computed(() => activeScores.value.myHighScore.value)

watch(currentPuzzle, () => activeScores.value.fetchMyScore(), { immediate: true })

// Flow state
const isFlowing      = ref(false);
const isSpeedy       = ref(false);
const flowIdx        = ref(-1);
const flowExitDir    = ref<Direction>('E');
const countdownMs    = ref(30000);
const countdownLeft  = ref(30000);

// Confirmation
const showConfirm    = ref(false);
const confirmMessage = ref('');
let   pendingAction: (() => void) | null = null;

// Decorative logo
const logoPattern = ref([true, false, true, false, false, true, false, true]);
let logoInterval: ReturnType<typeof setInterval> | null = null;

// RAF loop
let lastTs     = 0;
let rafId      = 0;
let fillBuffer = 0; // accumulated fill progress

// ── Computed ──────────────────────────────────────────────────────────────────
const countdownPct   = computed(() => Math.max(0, countdownLeft.value / countdownMs.value));
const countdownSecStr = computed(() => (countdownLeft.value / 1000).toFixed(1));
const exitIdx        = computed(() => {
  const p = currentPuzzle.value;
  if (!p) return -1;
  return rcToIdx(p.exitR, p.exitC, p.cols);
});
const exitDir        = computed(() => currentPuzzle.value?.exitDir ?? 'E' as Direction);
const exitReached    = ref(false);

function isLevelCompleted(id: number) { return completedLevels.value.includes(id); }
function isLevelLocked(id: number) {
  if (id === 1) return false;
  return !isLevelCompleted(id - 1);
}

// ── Board initialisation ──────────────────────────────────────────────────────
function initBoard(puzzleId: number) {
  const p = puzzles.find(x => x.id === puzzleId);
  if (!p) return;

  const grid = makeEmptyGrid(p.cols, p.rows);
  const startI = rcToIdx(p.startR, p.startC, p.cols);

  // Place start cell
  grid[startI] = {
    content: {
      kind: 'start',
      openings: [getOpposite(p.startDir), p.startDir],
      filled: false,
    },
  };

  // Place pre-placed pipes
  for (const pp of p.prePlaced) {
    const i = rcToIdx(pp.r, pp.c, p.cols);
    grid[i] = { content: { kind: 'pipe', type: pp.type, filled: false, fillPct: 0 } };
  }

  cells.value      = grid;
  flowIdx.value    = startI;
  flowExitDir.value = p.startDir;
  countdownMs.value   = p.countdown ?? 30000;
  countdownLeft.value = countdownMs.value;
  isFlowing.value  = false;
  isSpeedy.value   = false;
  score.value      = 0;
  filledCount.value = 0;
  gameOver.value   = false;
  exitReached.value  = false;
  victory.value    = false;
  fillBuffer       = 0;

  // Fill the start cell visually
  cells.value[startI] = {
    content: {
      kind: 'start',
      openings: [getOpposite(p.startDir), p.startDir],
      filled: true,
    },
  };

  // Generate queue
  queue.value = generateQueue(20);
}

// ── Pipe placement ────────────────────────────────────────────────────────────
function onPlace(idx: number) {
  if (gameOver.value) return;
  const c = cells.value[idx].content;
  if (c.kind === 'start' || c.kind === 'wall') return;

  // Pop from queue
  const ptype = queue.value[0];
  if (!ptype) return;
  queue.value = [...queue.value.slice(1), ...generateQueue(1)];

  cells.value = placePipe(cells.value, idx, ptype);
  playSound(soundOk);
}

// ── Flow tick (via RAF) ───────────────────────────────────────────────────────
const FILL_RATE_PX_PER_MS = 0.035; // fraction of a cell per ms at normal speed
const SPEEDY_MULT = 3;

function tick(ts: number) {
  if (gameOver.value) return;
  const dt = lastTs ? ts - lastTs : 16;
  lastTs = ts;

  if (!isFlowing.value) {
    // Countdown phase
    countdownLeft.value = Math.max(0, countdownLeft.value - dt);
    if (countdownLeft.value <= 0) {
      isFlowing.value = true;
    }
    rafId = requestAnimationFrame(tick);
    return;
  }

  // Flow phase
  const rate = FILL_RATE_PX_PER_MS * (isSpeedy.value ? SPEEDY_MULT : 1);
  fillBuffer += rate * dt;

  const currentCell = cells.value[flowIdx.value];

  // Advance fill on current cell
  if (fillBuffer < 1) {
    // Still filling current cell
    if (currentCell.content.kind === 'pipe') {
      const updated = cells.value.map((c, i) => {
        if (i !== flowIdx.value) return c;
        return { content: { ...c.content as any, fillPct: fillBuffer } };
      });
      cells.value = updated;
    }
    rafId = requestAnimationFrame(tick);
    return;
  }

  // Cell is fully filled — mark it
  const nextCells = cells.value.map((c, i) => {
    if (i !== flowIdx.value) return c;
    const cont = c.content;
    if (cont.kind === 'pipe')  return { content: { ...cont, filled: true, fillPct: 1 } };
    if (cont.kind === 'start') return { content: { ...cont, filled: true } };
    return c;
  });
  cells.value = nextCells;
  filledCount.value++;
  score.value += scoreForPipe(isSpeedy.value);
  fillBuffer -= 1;

  // Try to advance to the next cell
  const state = {
    cols: currentPuzzle.value!.cols,
    rows: currentPuzzle.value!.rows,
    cells: cells.value,
    startIdx: rcToIdx(currentPuzzle.value!.startR, currentPuzzle.value!.startC, currentPuzzle.value!.cols),
    startDir: currentPuzzle.value!.startDir,
    queue: queue.value,
    flowCountdown: countdownLeft.value,
    flowing: true,
    flowIdx: flowIdx.value,
    flowPct: 1,
    score: score.value,
    gameOver: false,
    victory: false,
  };

  // Check if the very next cell the flow would enter IS the exit — win before
  // advanceFlow rejects it as "empty".
  const nextNeighbour = neighbourIdx(flowIdx.value, flowExitDir.value, currentPuzzle.value!.cols, currentPuzzle.value!.rows);
  if (nextNeighbour === exitIdx.value) {
    exitReached.value = true;
    endGame(true);
    return;
  }

  const result = advanceFlow(state, flowIdx.value, flowExitDir.value);
  if (result.next) {
    flowIdx.value    = result.next.cellIdx;
    flowExitDir.value = result.next.exitDir;
  } else {
    // Flow escaped or blocked
    endGame(false);
    return;
  }

  rafId = requestAnimationFrame(tick);
}

// ── Game end ──────────────────────────────────────────────────────────────────
function endGame(won: boolean) {
  cancelAnimationFrame(rafId);
  gameOver.value = true;
  victory.value  = won;

  if (won) {
    playSound(soundSuccess);
    // Submit score — only saves if it beats the personal best for this difficulty
    activeScores.value.submitScore(score.value);
    if (!completedLevels.value.includes(currentPuzzleId.value)) {
      completedLevels.value.push(currentPuzzleId.value);
      localStorage.setItem('warp-core-breach-completed-levels', JSON.stringify(completedLevels.value));
    }
  } else {
    playSound(soundFail);
  }
}

// ── Reset / navigation ────────────────────────────────────────────────────────
function handleReset() {
  confirmMessage.value = 'RESET SIMULATION?';
  pendingAction = () => resetLocal();
  showConfirm.value = true;
}

function confirmAction() {
  showConfirm.value = false;
  if (pendingAction) { pendingAction(); pendingAction = null; }
}

function resetLocal() {
  cancelAnimationFrame(rafId);
  lastTs = 0;
  initBoard(currentPuzzleId.value);
  rafId = requestAnimationFrame(tick);
  playSound(soundOk);
}

function selectPuzzle(id: number) {
  if (id === currentPuzzleId.value) return;
  const doSwitch = () => {
    cancelAnimationFrame(rafId);
    lastTs = 0;
    currentPuzzleId.value = id;
    initBoard(id);
    rafId = requestAnimationFrame(tick);
    playSound(soundOk);
  };
  confirmMessage.value = 'CHANGE PUZZLE?';
  pendingAction = doSwitch;
  showConfirm.value = true;
}

function nextLevel() {
  if (!hasNextLevel.value) return;
  const id = currentPuzzleId.value + 1;
  currentPuzzleId.value = id;
  cancelAnimationFrame(rafId);
  lastTs = 0;
  initBoard(id);
  rafId = requestAnimationFrame(tick);
  playSound(soundOk);
}

// ── Spacebar acceleration ─────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.code === 'Space' && !gameOver.value) {
    e.preventDefault();
    isSpeedy.value = true;
  }
}
function onKeyup(e: KeyboardEvent) {
  if (e.code === 'Space') isSpeedy.value = false;
}

// ── Sound ─────────────────────────────────────────────────────────────────────
function playSound(src: string) {
  try {
    const a = new Audio(src);
    a.volume = 0.4;
    a.play().catch(() => {});
  } catch (e) {}
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goToGames() { router.push('/games'); }

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  try {
    const saved = localStorage.getItem('warp-core-breach-completed-levels');
    if (saved) completedLevels.value = JSON.parse(saved);
  } catch { completedLevels.value = []; }

  initBoard(currentPuzzleId.value);
  setTimeout(() => { isVisible.value = true; }, 100);

  rafId = requestAnimationFrame(tick);

  logoInterval = setInterval(() => {
    const i = Math.floor(Math.random() * logoPattern.value.length);
    logoPattern.value[i] = !logoPattern.value[i];
  }, 650);

  window.addEventListener('keydown', onKeydown);
  window.addEventListener('keyup',   onKeyup);
  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  if (logoInterval) clearInterval(logoInterval);
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('keyup',   onKeyup);
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
});
</script>

<style scoped>

/* ─── Layout ──────────────────────────────────────────────────────────────── */
.df-game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9375rem;
  opacity: 0;
  transform: translateY(0.375rem);
  transition: opacity 1s ease, transform 1s ease;
  width: 100%;
  padding: 1.25rem;
}

.df-game-container.show {
  opacity: 1;
  transform: none;
}

.df-play-row {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
}

.df-center-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

/* ─── Header ──────────────────────────────────────────────────────────────── */
.diff-box {
  align-items: center !important;
  background: none;
  border: none;
  flex-direction: row !important;
  gap: 1rem !important;
}

.status-box {
  min-height: 3.5rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  min-width: 4.5rem;
}

.status-box .label {
  font-size: 0.7rem;
  color: rgba(168, 216, 255, 0.55);
  text-transform: uppercase;
  font-family: 'Antonio', sans-serif;
  letter-spacing: 0.08rem;
  line-height: 1;
}

.status-box .value {
  font-size: 1.35rem;
  font-weight: bold;
  color: #a8d8ff;
  font-family: 'Antonio', sans-serif;
  line-height: 1;
}

.diff-value.easy   { color: #00e5ff; }
.diff-value.medium { color: #a8d8ff; }
.diff-value.hard   { color: #b388ff; }

/* ─── Countdown bar ───────────────────────────────────────────────────────── */
.countdown-bar-wrapper {
  position: relative;
  width: 100%;
  max-width: 40rem;
  height: 0.5rem;
  background: rgba(168, 216, 255, 0.1);
  border-radius: 1rem;
  overflow: hidden;
}

.countdown-bar {
  height: 100%;
  background: #a8d8ff;
  border-radius: 1rem;
  transition: width 0.1s linear, background 0.3s ease;
}

.countdown-bar.urgent  { background: #b388ff; }
.countdown-bar.flowing { background: #00e5ff; }

.countdown-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-family: 'Antonio', sans-serif;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.06rem;
  pointer-events: none;
}

/* ─── Pipe Queue ──────────────────────────────────────────────────────────── */
.pipe-queue {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  background: rgba(8, 6, 0, 0.6);
  border: 0.0625rem solid rgba(168, 216, 255, 0.18);
  border-radius: 0.5rem;
  padding: 0.6rem 0.5rem;
  min-width: 3.5rem;
}

.queue-label {
  font-size: 0.6rem;
  color: rgba(168, 216, 255, 0.5);
  font-family: 'Antonio', sans-serif;
  letter-spacing: 0.08rem;
  margin-bottom: 0.2rem;
}

.queue-item {
  width: 2.4rem;
  height: 2.4rem;
  background: rgba(12, 10, 2, 0.8);
  border: 0.0625rem solid rgba(168, 216, 255, 0.12);
  border-radius: 0.25rem;
  overflow: hidden;
  opacity: 0.55;
  transition: opacity 0.2s;
}

.queue-item.queue-next {
  opacity: 1;
  border-color: rgba(168, 216, 255, 0.5);
  box-shadow: 0 0 0.5rem rgba(168, 216, 255, 0.3);
}

.queue-svg {
  width: 100%;
  height: 100%;
}

/* ─── Level selector ──────────────────────────────────────────────────────── */
.level-selector {
  display: flex;
  justify-content: center;
  width: 100%;
}

.level-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  max-width: 36rem;
}

.level-bubble {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 0.125rem solid;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Antonio', sans-serif;
  font-weight: bold;
  font-size: 1.1rem;
}

.level-bubble.easy   { border-color: #00e5ff; color: #00e5ff; background: rgba(0, 229, 255, 0.1); }
.level-bubble.medium { border-color: #a8d8ff; color: #a8d8ff; background: rgba(168, 216, 255,  0.1); }
.level-bubble.hard   { border-color: #b388ff; color: #b388ff; background: rgba(179, 136, 255, 0.1); }

.level-bubble.easy:hover,   .level-bubble.easy.completed   { background: #00e5ff; color: #000; }
.level-bubble.medium:hover, .level-bubble.medium.completed { background: #a8d8ff; color: #000; }
.level-bubble.hard:hover,   .level-bubble.hard.completed   { background: #b388ff; color: #000; }

.level-bubble.active:not(.completed) {
  animation: pulse-glow 2s infinite ease-in-out;
  border-width: 0.1875rem;
}

.level-bubble.locked {
  opacity: 0.2;
  cursor: not-allowed;
  pointer-events: none;
  filter: grayscale(1);
}

@keyframes pulse-glow {
  0%   { box-shadow: 0 0 0 0 currentColor; }
  50%  { box-shadow: 0 0 0.9375rem 0.125rem currentColor; }
  100% { box-shadow: 0 0 0 0 currentColor; }
}

/* ─── Board container ─────────────────────────────────────────────────────── */
.df-board-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* ─── Inline logo grid ────────────────────────────────────────────────────── */
.inline-logo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.2rem;
}

.inline-logo-cell {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 0.1rem;
  background: rgba(255, 255, 255, 0.07);
  border: 0.0625rem solid rgba(255, 255, 255, 0.12);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.inline-logo-grid.easy   .inline-logo-cell.lit { background: #00e5ff; border-color: #00e5ff; box-shadow: 0 0 0.3rem rgba(0,229,255,0.85); }
.inline-logo-grid.medium .inline-logo-cell.lit { background: #a8d8ff; border-color: #a8d8ff; box-shadow: 0 0 0.3rem rgba(168,216,255,0.85);  }
.inline-logo-grid.hard   .inline-logo-cell.lit { background: #b388ff; border-color: #b388ff; box-shadow: 0 0 0.3rem rgba(179,136,255,0.85); }

/* ─── Pill buttons ────────────────────────────────────────────────────────── */
.pill {
  border-radius: 4rem;
  background: inherit;
}

.score-note {
  font-family: 'Antonio', sans-serif;
  font-size: 0.95rem;
  color: rgba(153, 204, 255, 0.8);
  margin: 0.25rem 0 0.75rem;
  letter-spacing: 0.03em;
}
.score-note.new-record {
  color: #a8d8ff;
  text-shadow: 0 0 0.5rem rgba(168, 216, 255, 0.5);
}
</style>