<template>
  <div class="minesweeper-container" :class="{ show: isVisible }">
    <div class="game-header">
      <div class="header-left difficulty-selector">
        <button
            v-for="(diff, key) in difficulties"
            :key="key"
            @click="selectDifficulty(key)"
            :class="[key, { active: selectedDifficulty === key }]"
            class="pill"
        >
          {{ diff.name }}
        </button>
        <button @click="resetGame" class="pill reset-btn">Reset</button>
      </div>

      <div class="logo-wrapper" @click="goToGames">
        <img :src="minesweeperLogo" alt="Minesweeper" class="game-logo-small" />
      </div>

      <div class="header-right game-stats">
        <div class="mode-toggle">
          <button
              @click="toggleFlagMode"
              class="pill flag-toggle"
              :class="{ active: gameMode === 'flag' }"
              :aria-pressed="gameMode === 'flag'"
              title="Toggle Flag Mode"
          >
            <img :src="flagIcon" alt="Flag" class="flag-icon-svg" />
          </button>
        </div>
        <div class="stat-box">
          <span class="label">Mines:</span>
          <span class="value">{{ minesRemaining }}</span>
        </div>
        <div class="stat-box">
          <span class="label">Flags:</span>
          <span class="value">{{ totalFlags }}</span>
        </div>
        <div class="stat-box">
          <span class="label">Time:</span>
          <span class="value">{{ timer }}</span>
        </div>
        <div class="stat-box">
          <span class="label">Best:</span>
          <span class="value">{{ myBestTime !== null ? formatTime(myBestTime) : '—' }}</span>
        </div>
      </div>
    </div>

    <div v-if="gameState !== 'playing'" class="game-status-overlay" :class="gameState">
      <h2>{{ gameState === 'won' ? 'MISSION ACCOMPLISHED' : 'SIMULATION FAILED' }}</h2>
      <p v-if="gameState === 'won' && activeScores.submitError.value" class="score-note error">
        Score save failed — check your connection.
      </p>
      <p v-else-if="gameState === 'won' && myBestTime === timer" class="score-note new-record">
        ⭐ New personal best: {{ formatTime(timer) }}!
      </p>
      <p v-else-if="gameState === 'won' && myBestTime !== null" class="score-note">
        Your best: {{ formatTime(myBestTime) }} &nbsp;·&nbsp; This run: {{ formatTime(timer) }}
      </p>
      <button @click="resetGame" class="pill">Try Again</button>
    </div>

    <div v-if="showConfirm" class="game-status-overlay confirmation">
      <h2>{{ confirmMessage }}</h2>
      <p class="confirm-sub">Current simulation progress will be lost.</p>
      <div class="confirm-actions">
        <button @click="handleConfirm" class="pill confirm-btn">PROCEED</button>
        <button @click="handleCancel" class="pill abort-btn">ABORT</button>
      </div>
    </div>

    <div
        class="minesweeper-board"
        @contextmenu.prevent
    >
      <div
          v-for="(row, r) in board"
          :key="r"
          class="board-row"
      >
        <div
            v-for="(cell, c) in row"
            :key="c"
            class="cell"
            :class="{
            revealed: cell.revealed,
            flagged: cell.flagged,
            mine: cell.revealed && cell.mine,
            exploded: cell.exploded
          }"
            @mousedown="handleMouseDown($event, r, c)"
            @mouseup="handleMouseUp($event, r, c)"
            @contextmenu.prevent="toggleFlag(r, c)"
        >
          <template v-if="cell.revealed">
            <span v-if="cell.mine" class="mine-icon">✦</span>
            <span v-else-if="cell.neighborMines > 0" :class="'mines-' + cell.neighborMines">
              {{ cell.neighborMines }}
            </span>
          </template>
          <template v-else-if="cell.flagged">
            <span class="flag-icon">⚑</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMinesweeper } from '@/composables/useMinesweeper';
import { useGameScores } from '@/composables/useGameScores';
import soundOk from '@/assets/sounds/SFX-Computer/keyok1.wav';
import soundError from '@/assets/sounds/SFX-Computer/inputfailed1.wav';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import minesweeperLogo from '@/assets/images/games/title-minesweeper.svg';
import flagIcon from '@/assets/images/games/flag.svg';

type Difficulty = {
  name: string;
  rows: number;
  cols: number;
  mines: number;
  // New: control first-click safe zone radius (in cells, Chebyshev distance)
  safeZoneRadius: number;
};

const difficulties: Record<string, Difficulty> = {
  cadet:     { name: 'Cadet',     rows: 9,  cols: 9,  mines: 10, safeZoneRadius: 1 }, // 3×3 safe zone
  standard:  { name: 'Standard',  rows: 16, cols: 16, mines: 40, safeZoneRadius: 1 }, // 3×3 safe zone
  'red-alert': { name: 'Red Alert', rows: 16, cols: 30, mines: 99, safeZoneRadius: 0 }, // only the clicked cell
};

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  neighborMines: number;
  exploded?: boolean;
};

const { selectedDifficulty, setDifficulty } = useMinesweeper();
const router = useRouter();

// ── Score tracking — one composable instance per difficulty ────────────────
const SCORE_OPTIONS = { lowerIsBetter: true }
const scores = {
  cadet:       useGameScores('minesweeper_cadet',     SCORE_OPTIONS),
  standard:    useGameScores('minesweeper_standard',  SCORE_OPTIONS),
  'red-alert': useGameScores('minesweeper_red-alert', SCORE_OPTIONS),
}

/** Active score instance for the currently selected difficulty. */
const activeScores = computed(() => scores[selectedDifficulty.value as keyof typeof scores])

/** Personal best time (seconds) for the current difficulty, null if none yet. */
const myBestTime = computed(() => activeScores.value.myHighScore.value)

/** Fetch personal best whenever difficulty changes. */
watch(selectedDifficulty, () => activeScores.value?.fetchMyScore(), { immediate: true })

const board = ref<Cell[][]>([]);
const gameState = ref<'playing' | 'won' | 'lost'>('playing');
const gameMode = ref<'reveal' | 'flag'>('reveal');
function toggleFlagMode() {
  gameMode.value = gameMode.value === 'flag' ? 'reveal' : 'flag';
}
const timer = ref(0);
const minesRemaining = ref(0);
const firstClick = ref(true);
let timerInterval: number | null = null;

// UI enter animation
const isVisible = ref(false);

function goToGames() {
  router.push('/games');
}

/** Formats seconds as M:SS — e.g. 83 → "1:23" */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Confirmation overlay state
const showConfirm = ref(false);
const confirmMessage = ref('');
let confirmActionCallback: (() => void) | null = null;

function playSound(src: string) {
  try {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {}
}

function initBoard() {
  const diff = difficulties[selectedDifficulty.value];
  const newBoard: Cell[][] = [];
  for (let r = 0; r < diff.rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < diff.cols; c++) {
      row.push({
        mine: false,
        revealed: false,
        flagged: false,
        neighborMines: 0
      });
    }
    newBoard.push(row);
  }
  board.value = newBoard;
  minesRemaining.value = diff.mines;
  gameState.value = 'playing';
  timer.value = 0;
  firstClick.value = true;
  stopTimer();
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = window.setInterval(() => {
    timer.value++;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function selectDifficulty(key: keyof typeof difficulties) {
  if (selectedDifficulty.value === key) return;

  const action = () => {
    setDifficulty(key as any);
    initBoard();
  };

  if (gameState.value === 'playing' && !firstClick.value) {
    confirmMessage.value = 'ARE YOU SURE YOU WANT TO CHANGE DIFFICULTY?';
    confirmActionCallback = action;
    showConfirm.value = true;
    stopTimer();
  } else {
    action();
  }
}

function resetGame() {
  const action = () => {
    initBoard();
  };

  if (gameState.value === 'playing' && !firstClick.value) {
    confirmMessage.value = 'ARE YOU SURE YOU WANT TO RESET?';
    confirmActionCallback = action;
    showConfirm.value = true;
    stopTimer();
  } else {
    action();
  }
}

function handleConfirm() {
  showConfirm.value = false;
  if (confirmActionCallback) {
    confirmActionCallback();
    confirmActionCallback = null;
  }
}

function handleCancel() {
  showConfirm.value = false;
  confirmActionCallback = null;
  if (gameState.value === 'playing' && !firstClick.value) {
    startTimer();
  }
}


/**
 * Difficulty-aware first-click placement.
 * - Respects a safe zone whose radius depends on difficulty.
 *   radius=1 => 3×3 zone around the first click is guaranteed safe, which also guarantees neighborMines===0 for that first cell.
 *   radius=0 => only the clicked cell is safe (classic expert-style harsh start).
 */
function placeMines(excludeR: number, excludeC: number) {
  const diff = difficulties[selectedDifficulty.value];

  const isInSafeZone = (r: number, c: number) => {
    const dr = Math.abs(r - excludeR);
    const dc = Math.abs(c - excludeC);
    return Math.max(dr, dc) <= diff.safeZoneRadius; // Chebyshev distance
  };

  let minesPlaced = 0;
  while (minesPlaced < diff.mines) {
    const r = Math.floor(Math.random() * diff.rows);
    const c = Math.floor(Math.random() * diff.cols);

    // Don't place mine in safe zone or already occupied cell
    if (!isInSafeZone(r, c) && !board.value[r][c].mine) {
      board.value[r][c].mine = true;
      minesPlaced++;
    }
  }

  // Calculate neighbor mines for all non-mine cells
  for (let r = 0; r < diff.rows; r++) {
    for (let c = 0; c < diff.cols; c++) {
      if (!board.value[r][c].mine) {
        board.value[r][c].neighborMines = countNeighborMines(r, c);
      }
    }
  }
}

/** Count mines in the 8 neighbors (excludes the center cell). */
function countNeighborMines(r: number, c: number) {
  const diff = difficulties[selectedDifficulty.value];
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue; // skip center
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < diff.rows && nc >= 0 && nc < diff.cols) {
        if (board.value[nr][nc].mine) count++;
      }
    }
  }
  return count;
}

function revealCell(r: number, c: number) {
  if (gameState.value !== 'playing' || board.value[r][c].revealed || board.value[r][c].flagged) return;

  if (firstClick.value) {
    // Place mines considering the difficulty-specific safe zone policy
    placeMines(r, c);
    firstClick.value = false;
    startTimer();
  }

  const cell = board.value[r][c];
  cell.revealed = true;

  if (cell.mine) {
    cell.exploded = true;
    gameOver(false);
    return;
  }

  // Flood fill when zero
  if (cell.neighborMines === 0) {
    const diff = difficulties[selectedDifficulty.value];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < diff.rows && nc >= 0 && nc < diff.cols) {
          revealCell(nr, nc);
        }
      }
    }
  }

  checkWin();
}

function toggleFlag(r: number, c: number) {
  if (gameState.value !== 'playing' || board.value[r][c].revealed) return;
  const cell = board.value[r][c];
  cell.flagged = !cell.flagged;
  minesRemaining.value += cell.flagged ? -1 : 1; // classic behavior: counter = mines - flags
  playSound(soundOk);
}

/** Chording: if a revealed number has exactly that many flagged neighbors, open the rest. */
function chordOpen(r: number, c: number) {
  if (gameState.value !== 'playing') return;
  const cell = board.value[r][c];
  if (!cell.revealed || cell.neighborMines === 0) return;

  const diff = difficulties[selectedDifficulty.value];
  let flaggedNeighbors = 0;
  const neighbors: [number, number][] = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < diff.rows && nc >= 0 && nc < diff.cols) {
        neighbors.push([nr, nc]);
        if (board.value[nr][nc].flagged) flaggedNeighbors++;
      }
    }
  }

  if (flaggedNeighbors === cell.neighborMines) {
    neighbors.forEach(([nr, nc]) => {
      const ncell = board.value[nr][nc];
      if (!ncell.flagged && !ncell.revealed) {
        revealCell(nr, nc);
      }
    });
  }
}

function checkWin() {
  const diff = difficulties[selectedDifficulty.value];
  let revealedCount = 0;
  for (let r = 0; r < diff.rows; r++) {
    for (let c = 0; c < diff.cols; c++) {
      if (board.value[r][c].revealed) revealedCount++;
    }
  }
  if (revealedCount === (diff.rows * diff.cols) - diff.mines) {
    gameOver(true);
  }
}

function gameOver(won: boolean) {
  gameState.value = won ? 'won' : 'lost';
  stopTimer();
  if (!won) {
    playSound(soundError);
    // Reveal all mines
    board.value.forEach(row => {
      row.forEach(cell => {
        if (cell.mine) cell.revealed = true;
      });
    });
  } else {
    playSound(soundSuccess);
    // Submit time to Firestore — only saves if it's a personal best
    activeScores.value.submitScore(timer.value);
  }
}

function handleMouseDown(e: MouseEvent, r: number, c: number) {
  // Left handled on mouseup to reduce accidental reveals
  // Middle / right handled in mouseup/contextmenu
}

function handleMouseUp(e: MouseEvent, r: number, c: number) {
  if (gameState.value !== 'playing') return;

  // 0 = left, 1 = middle, 2 = right
  if (e.button === 0) {
    if (gameMode.value === 'flag') {
      toggleFlag(r, c);
    } else {
      revealCell(r, c);
    }
  } else if (e.button === 1) {
    // Middle-click chord: try to open neighbors if flags match the number
    chordOpen(r, c);
  }
}

const totalFlags = computed(() => {
  const diff = difficulties[selectedDifficulty.value];
  let flags = 0;
  for (let r = 0; r < diff.rows; r++) {
    for (let c = 0; c < diff.cols; c++) {
      if (board.value[r][c].flagged) flags++;
    }
  }
  return flags;
});

initBoard();

onMounted(() => {
  // Ensure the interface dims when the game loads
  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  // Trigger fade-in of the game UI
  requestAnimationFrame(() => { isVisible.value = true; });
});

onBeforeUnmount(() => {
  stopTimer();
  // Clear dimming when leaving the game
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
});
</script>

<style scoped>
/* game-logo-small shared via gameLanding.css */

/* ─── Header (game-header shared via gameLanding.css) ────────────────────── */
.difficulty-selector {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  flex-wrap: wrap;
  width: 18.75rem;
}

.mode-toggle {
  display: flex;
  gap: 0.625rem;
  justify-content: center;
}

.flag-toggle {
  min-width: 2.75rem !important;
  height: 2.75rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(120, 130, 150, 0.25);
  border: 0.0625rem solid rgba(153, 204, 255, 0.2);
  padding: 0;
  transition: all 0.3s ease;
  cursor: pointer;
  margin-right: 1.25rem;
}

.flag-icon-svg {
  width: 1.5rem;
  height: 1.5rem;
  transition: all 0.3s ease;
}

.flag-toggle.active .flag-icon-svg {
  filter: brightness(0);
  animation: pulse-flag 1s infinite alternate ease-in-out;
}

@keyframes pulse-flag {
  from { transform: scale(1); }
  to { transform: scale(1.1); }
}

.game-stats {
  display: flex;
  gap: 1.25rem;
  align-items: center;
  justify-content: flex-end;
  width: 18.75rem;
}

.stat-box {
  background: rgba(0, 0, 0, 0.6);
  padding: 0.3125rem 0.625rem;
  border-radius: 0.375rem;
  border: 0.0625rem solid #ffc400;
  min-width: 3.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0.625rem rgba(255, 196, 0, 0.1);
}

.stat-box .label {
  color: #ffc400;
  font-size: 0.7rem;
  text-transform: uppercase;
  font-family: 'Antonio', sans-serif;
  letter-spacing: 0.0625rem;
  line-height: 1;
  margin-bottom: 0.125rem;
}

.stat-box .value {
  color: #fff;
  font-family: 'Antonio', sans-serif;
  font-size: 1.1rem;
  font-weight: bold;
  text-shadow: 0 0 0.3125rem rgba(255, 255, 255, 0.5);
  line-height: 1;
}
.minesweeper-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9375rem;
  opacity: 0;
  transform: translateY(0.375rem);
  transition: opacity 1s ease, transform 1s ease;
}
.minesweeper-container.show {
  opacity: 1;
  transform: none;
}



.minesweeper-board {
  display: flex;
  flex-direction: column;
  background: rgba(10, 15, 25, 0.5);
  padding: 0.9375rem;
  border: 0.0625rem solid rgba(153, 204, 255, 0.3);
  border-radius: 0.75rem;
  user-select: none;
  backdrop-filter: blur(0.625rem);
  box-shadow: 0 0 2.5rem rgba(0, 0, 0, 0.6), inset 0 0 1.25rem rgba(153, 204, 255, 0.05);
}

.board-row {
  display: flex;
}

.cell {
  width: 2rem;
  height: 2rem;
  background: rgba(100, 110, 130, 0.35);
  border: 0.0625rem solid rgba(153, 204, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'Antonio', sans-serif;
  font-size: 1.2rem;
  margin: 0.0625rem;
  border-radius: 0.125rem;
  position: relative;
  overflow: hidden;
}

.cell::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
      to right,
      transparent,
      rgba(255, 255, 255, 0.05),
      transparent
  );
  transform: skewX(-25deg);
  transition: none;
}

.cell:hover::before {
  left: 200%;
  transition: left 0.6s ease;
}

.cell:hover:not(.revealed):not(.flagged) {
  background: rgba(153, 204, 255, 0.2);
  border-color: rgba(153, 204, 255, 0.6);
  box-shadow: 0 0 0.9375rem rgba(153, 204, 255, 0.3);
  transform: scale(1.05);
  z-index: 10;
}

.cell.revealed {
  background: rgba(0, 0, 0, 0.35);
  border: 0.0625rem solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 0 0.625rem rgba(0, 0, 0, 0.5);
}

.cell.mine {
  background: rgba(255, 50, 50, 0.2);
  border-color: rgba(255, 50, 50, 0.4);
}

.cell.exploded {
  background: rgba(255, 0, 0, 0.4);
  border-color: #f00;
  box-shadow: 0 0 1.25rem #f00;
  animation: pulse-red 1s infinite alternate;
}

@keyframes pulse-red {
  from { box-shadow: 0 0 0.625rem #f00; opacity: 0.8; }
  to { box-shadow: 0 0 1.5625rem #f00; opacity: 1; }
}

.cell.flagged {
  background: rgba(255, 196, 0, 0.1);
}

.mine-icon {
  animation: pulse-mine 2s infinite ease-in-out;
  color: #ff4444;
  font-size: 1.4rem;
  margin-top: -0.5rem;
  text-shadow: 0 0 0.625rem #f00, 0 0 1.25rem #f00;
}

@keyframes pulse-mine {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
}

.flag-icon {
  color: #ffc400;
  font-size: 1.3rem;
  margin-top: -0.5rem;
  text-shadow: 0 0 0.5rem #ffc400, 0 0 0.9375rem #ffc400;
}

.mines-1 { color: #8cf; text-shadow: 0 0 0.3125rem rgba(136, 204, 255, 0.5); }
.mines-2 { color: #993; text-shadow: 0 0 0.3125rem rgba(153, 153, 51, 0.5); }
.mines-3 { color: #f55; text-shadow: 0 0 0.3125rem rgba(245, 85, 85, 0.5); }
.mines-4 { color: #c5f; text-shadow: 0 0 0.3125rem rgba(204, 85, 255, 0.5); }
.mines-5 { color: #f80; text-shadow: 0 0 0.3125rem rgba(255, 136, 0, 0.5); }
.mines-6 { color: #89f; text-shadow: 0 0 0.3125rem rgba(136, 153, 255, 0.5); }
.mines-7 { color: #fa0; text-shadow: 0 0 0.3125rem rgba(255, 160, 0, 0.5); }
.mines-8 { color: #f20; text-shadow: 0 0 0.3125rem rgba(255, 34, 0, 0.5); }

/* game-status-overlay, confirm-sub, confirm-actions, confirm-btn, abort-btn shared via gameLanding.css */

.score-note {
  font-family: 'Antonio', sans-serif;
  font-size: 0.95rem;
  color: rgba(153, 204, 255, 0.85);
  margin: 0.25rem 0 0.75rem;
  letter-spacing: 0.03em;
}
.score-note.new-record {
  color: #ffc400;
  text-shadow: 0 0 0.5rem rgba(255, 196, 0, 0.6);
}
.score-note.error {
  color: #f55;
}

/* ─── Pill Buttons ────────────────────────────────────────────────────────── */
.pill {
  background: rgba(153, 204, 255, 0.15);
  color: #9cf;
  border: 0.0625rem solid rgba(153, 204, 255, 0.4);
  padding: 0.3125rem 0.75rem;
  border-radius: 62.4375rem;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  font-family: 'Antonio', sans-serif;
  font-size: 0.8rem;
  transition: all 0.3s ease;
}

.pill:hover {
  background: rgba(153, 204, 255, 0.3);
  border-color: #9cf;
  color: #fff;
  box-shadow: 0 0 0.9375rem rgba(153, 204, 255, 0.3);
}

.pill.active.cadet {
  background: #ffc400;
  color: #000;
  border-color: #ffc400;
  box-shadow: 0 0 0.9375rem rgba(255, 196, 0, 0.4);
}

.pill.active.standard {
  background: #ff9800;
  color: #000;
  border-color: #ff9800;
  box-shadow: 0 0 0.9375rem rgba(255, 152, 0, 0.4);
}

.pill.active.red-alert {
  background: #f44336;
  color: #000;
  border-color: #f44336;
  box-shadow: 0 0 0.9375rem rgba(244, 67, 54, 0.4);
}

/* Ensure flag toggle active state wins over hover on touch devices */
.pill.flag-toggle.active,
.pill.flag-toggle.active:hover {
  background: rgba(255, 196, 0, 0.8);
  border-color: #ffc400;
  box-shadow: 0 0 1.875rem rgba(255, 196, 0, 1);
}

</style>