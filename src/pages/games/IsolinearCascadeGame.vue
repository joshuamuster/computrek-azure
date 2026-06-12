<template>
  <div class="isolinear-cascade-game-container" :class="{ show: isVisible }">

    <!-- ─── Header ──────────────────────────────────────────────────────────── -->
    <div class="game-header">
      <div class="header-left">
        <div class="status-box">
          <span class="label">MOVES</span>
          <span class="value">{{ moves }}</span>
        </div>
        <div class="status-box">
          <span class="label">LIT</span>
          <span class="value" :class="{ 'zero-lit': litCount === 0 }">{{ litCount }}</span>
        </div>
        <div class="status-box">
          <span class="label">PAR</span>
          <span class="value">{{ currentPuzzle?.parMoves ?? '—' }}</span>
        </div>
      </div>

      <div class="logo-wrapper" @click="goToGames">
        <img :src="isolinearCascadeLogo" alt="Isolinear Cascade" class="game-logo-small" />
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
          <!--          <span class="label">DIFFICULTY</span>-->
          <span class="value diff-value" :class="currentPuzzle?.difficulty.toLowerCase()">
            {{ currentPuzzle?.difficulty ?? '—' }}
          </span>
        </div>
        <button @click="handleReset" class="pill reset-btn">Reset</button>
      </div>
    </div>

    <!-- ─── Level Selector ─────────────────────────────────────────────────── -->
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

    <!-- ─── Board ────────────────────────────────────────────────────────────── -->
    <div class="ic-board-container">
      <IsolinearCascadeBoard
          :board="board"
          :size="currentPuzzle?.size ?? 5"
          :playable="!showGameOver"
          @toggle="onToggle"
      />
    </div>

    <!-- ─── Resume Modal ─────────────────────────────────────────────────────── -->
    <div v-if="showResumeModal" class="game-status-overlay resume-modal">
      <h2>MISSION IN PROGRESS</h2>
      <p class="confirm-sub">An unfinished puzzle was found (Puzzle {{ resumeSaveData?.currentPuzzleId }}, {{ resumeSaveData?.moves }} move{{ resumeSaveData?.moves === 1 ? '' : 's' }} made).</p>
      <p v-if="resumeSaveData?.savedAt" class="save-timestamp">{{ formatSavedAt(resumeSaveData.savedAt) }}</p>
      <div class="confirm-actions">
        <button @click="continueMission" class="pill confirm-btn">CONTINUE MISSION</button>
        <button @click="newMission" class="pill abort-btn">NEW MISSION</button>
      </div>
    </div>

    <!-- ─── Confirmation Modal ──────────────────────────────────────────────── -->
    <div v-if="showConfirm" class="game-status-overlay confirmation">
      <h2>{{ confirmMessage }}</h2>
      <p class="confirm-sub">Current simulation progress will be lost.</p>
      <div class="confirm-actions">
        <button @click="confirmAction" class="pill confirm-btn">PROCEED</button>
        <button @click="showConfirm = false" class="pill abort-btn">ABORT</button>
      </div>
    </div>

    <!-- ─── Game Over Modal ─────────────────────────────────────────────────── -->
    <div v-if="showGameOver" class="game-status-overlay game-over">
      <h2>ISOLINEAR CASCADE — MISSION ACCOMPLISHED</h2>
      <p class="confirm-sub">
        Solved in {{ moves }} move{{ moves === 1 ? '' : 's' }}
        <template v-if="currentPuzzle && moves <= currentPuzzle.parMoves"> · Under par! ⭐</template>
      </p>
      <p v-if="myBestMoves !== null && moves < myBestMoves" class="score-note new-record">
        ⭐ New personal best for {{ currentPuzzle?.difficulty }}!
      </p>
      <p v-else-if="myBestMoves !== null && moves > myBestMoves" class="score-note">
        Your best: {{ myBestMoves }} move{{ myBestMoves === 1 ? '' : 's' }}
      </p>
      <div class="confirm-actions">
        <button @click="resetLocal" class="pill abort-btn">RESET</button>
        <button v-if="hasNextLevel" @click="nextLevel" class="pill confirm-btn">NEXT LEVEL</button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { applyToggle, checkWin, countLit, boardToString } from '@/components/games/IsolinearCascade/engine';
import { puzzles } from '@/components/games/IsolinearCascade/IsolinearCascadePuzzles';
import { useGameScores } from '@/composables/useGameScores';
import { useActivityLog } from '@/composables/useActivityLog.js';
import { useGameSave } from '@/composables/useGameSave';
import { useGraphicsMode } from '@/composables/useGraphicsMode';
import IsolinearCascadeBoard from '@/components/games/IsolinearCascade/IsolinearCascadeBoard.vue';
import isolinearCascadeLogo from '@/assets/images/games/title-isolinearcascade.svg';
import soundOk      from '@/assets/sounds/SFX-Computer/keyok1.wav';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import '@/assets/styles/gameLanding.css';

// ── Router ────────────────────────────────────────────────────────────────────
const router = useRouter();

// ── Save / restore + activity logging ─────────────────────────────────────────
const gameSave = useGameSave('isolinear');
const { logEvent } = useActivityLog();
const { graphicsMode } = useGraphicsMode();
const gameStartLogged = ref(false);

// ── Visibility ────────────────────────────────────────────────────────────────
const isVisible = ref(false);

// ── Resume modal state ────────────────────────────────────────────────────────
const showResumeModal = ref(false);
const resumeSaveData  = ref<any>(null);

// ── Game state ────────────────────────────────────────────────────────────────
const currentPuzzleId = ref(1);
const board           = ref<boolean[]>([]);
const moves           = ref(0);
const showGameOver    = ref(false);
const completedLevels = ref<number[]>([]);

// ── Confirmation ──────────────────────────────────────────────────────────────
const showConfirm    = ref(false);
const confirmMessage = ref('');
let   pendingAction: (() => void) | null = null;

// ── Decorative logo ───────────────────────────────────────────────────────────
const logoPattern = ref([true, false, true, false, false, true, false, true]);
let logoInterval: ReturnType<typeof setInterval> | null = null;

// ── Computed ──────────────────────────────────────────────────────────────────
const currentPuzzle = computed(() => puzzles.find(p => p.id === currentPuzzleId.value));
const hasNextLevel  = computed(() => puzzles.some(p => p.id === currentPuzzleId.value + 1));
const litCount      = computed(() => countLit(board.value));

// ── Score tracking — one composable per difficulty ────────────────────────────
const SCORE_OPTIONS = { lowerIsBetter: true }
const scores = {
  easy:   useGameScores('isolinear_easy',   SCORE_OPTIONS),
  medium: useGameScores('isolinear_medium', SCORE_OPTIONS),
  hard:   useGameScores('isolinear_hard',   SCORE_OPTIONS),
}

type DiffKey = keyof typeof scores

/** Active composable for the current puzzle's difficulty. */
const activeScores = computed(() => {
  const diff = (currentPuzzle.value?.difficulty?.toLowerCase() ?? 'easy') as DiffKey
  return scores[diff] ?? scores.easy
})

/** Personal best move count for the current puzzle's difficulty. */
const myBestMoves = computed(() => activeScores.value.myHighScore.value)

/** Fetch personal best whenever difficulty changes. */
watch(currentPuzzle, () => activeScores.value.fetchMyScore(), { immediate: true })

function isLevelCompleted(id: number) { return completedLevels.value.includes(id); }
function isLevelLocked(id: number) {
  if (id === 1) return false;
  return !isLevelCompleted(id - 1);
}

// ── Board toggle ──────────────────────────────────────────────────────────────
function onToggle(idx: number) {
  if (showGameOver.value || showResumeModal.value) return;

  // Log game_start on the very first toggle of a fresh game
  if (!gameStartLogged.value) {
    gameStartLogged.value = true;
    logEvent('game_start', { gameId: 'isolinear_cascade', difficulty: currentPuzzle.value?.difficulty ?? 'easy' });
  }

  board.value = applyToggle(board.value, idx, currentPuzzle.value?.size ?? 5);
  moves.value++;
  playSound(soundOk);

  if (checkWin(board.value)) {
    showGameOver.value = true;
    playSound(soundSuccess);
    gameSave.clearSave(); // puzzle solved — no need to keep a save

    // Submit move count — only saves if it's a personal best; also logs 'win'
    activeScores.value.submitScore(moves.value);

    if (!completedLevels.value.includes(currentPuzzleId.value)) {
      completedLevels.value.push(currentPuzzleId.value);
      localStorage.setItem('isolinear-cascade-completed-levels', JSON.stringify(completedLevels.value));
    }
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function handleReset() {
  const initialStr = currentPuzzle.value ? boardToString(currentPuzzle.value.board) : '';
  const currentStr = boardToString(board.value);
  if (currentStr !== initialStr) {
    confirmMessage.value = 'RESET SIMULATION?';
    pendingAction = () => resetLocal();
    showConfirm.value = true;
  } else {
    resetLocal();
  }
}

function confirmAction() {
  showConfirm.value = false;
  if (pendingAction) { pendingAction(); pendingAction = null; }
}

function resetLocal() {
  gameSave.clearSave();
  gameStartLogged.value = false;
  board.value        = [...(currentPuzzle.value?.board ?? [])];
  moves.value        = 0;
  showGameOver.value = false;
  playSound(soundOk);
}

// ── Puzzle selection ──────────────────────────────────────────────────────────
function selectPuzzle(id: number) {
  if (id === currentPuzzleId.value) return;

  const doSwitch = () => {
    gameSave.clearSave();
    gameStartLogged.value = false;
    currentPuzzleId.value = id;
    board.value = [...(puzzles.find(p => p.id === id)?.board ?? [])];
    moves.value = 0;
    showGameOver.value = false;
    playSound(soundOk);
  };

  const initialStr = currentPuzzle.value ? boardToString(currentPuzzle.value.board) : '';
  const currentStr = boardToString(board.value);
  if (currentStr !== initialStr) {
    confirmMessage.value = 'CHANGE PUZZLE?';
    pendingAction = doSwitch;
    showConfirm.value = true;
  } else {
    doSwitch();
  }
}

function nextLevel() {
  if (!hasNextLevel.value) return;
  gameSave.clearSave();
  gameStartLogged.value = false;
  const id = currentPuzzleId.value + 1;
  currentPuzzleId.value = id;
  board.value = [...(puzzles.find(p => p.id === id)?.board ?? [])];
  moves.value = 0;
  showGameOver.value = false;
  playSound(soundOk);
}

// ── Resume / New mission ───────────────────────────────────────────────────────
function continueMission() {
  const save = resumeSaveData.value;
  if (!save) return;
  showResumeModal.value = false;
  resumeSaveData.value  = null;

  currentPuzzleId.value = save.currentPuzzleId;
  board.value           = save.board;
  moves.value           = save.moves;
  showGameOver.value    = false;
  gameStartLogged.value = true; // already started before the save

  gameSave.clearSave();
  logEvent('game_continue', { gameId: 'isolinear_cascade', puzzleId: save.currentPuzzleId });
}

function newMission() {
  showResumeModal.value = false;
  resumeSaveData.value  = null;
  gameSave.clearSave();
  gameStartLogged.value = false;
  // board stays at the default puzzle loaded in onMounted
}

// ── Sound ─────────────────────────────────────────────────────────────────────
function playSound(src: string) {
  try {
    const audio = new Audio(src);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  } catch (e) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatSavedAt(ts: number): string {
  const d = new Date(ts);
  return `Last saved: ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goToGames() { router.push('/games'); }

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  try {
    const saved = localStorage.getItem('isolinear-cascade-completed-levels');
    if (saved) completedLevels.value = JSON.parse(saved);
  } catch (e) { completedLevels.value = []; }

  board.value = [...(currentPuzzle.value?.board ?? [])];

  // Check for an in-progress save
  const save = gameSave.loadSave();
  if (save) {
    resumeSaveData.value = save;
    showResumeModal.value = true;
  }

  setTimeout(() => { isVisible.value = true; }, 100);

  if (graphicsMode.value === 'standard') {
    logoInterval = setInterval(() => {
      const idx = Math.floor(Math.random() * logoPattern.value.length);
      logoPattern.value[idx] = !logoPattern.value[idx];
    }, 650);
  }

  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
});

onBeforeUnmount(() => {
  // Save if a puzzle is in progress (moves made, not yet won)
  if (moves.value > 0 && !showGameOver.value) {
    gameSave.saveGame({
      currentPuzzleId: currentPuzzleId.value,
      board: board.value,
      moves: moves.value,
    });
  }
  if (logoInterval) clearInterval(logoInterval);
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
});
</script>

<style scoped>

.diff-box {
  align-items: center !important;
  background: none;
  border: none;
  flex-direction: row !important;
  gap: 1rem !important;
}

.status-box {
  min-height: 3.5rem;
}

.pill {
  border-radius: 4rem;
  background: inherit;
}

/* ─── Container ─────────────────────────────────────────────────────────────── */
.isolinear-cascade-game-container {
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

.isolinear-cascade-game-container.show {
  opacity: 1;
  transform: none;
}

/* ─── Header status boxes ────────────────────────────────────────────────────── */
.status-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  min-width: 4.5rem;
}

.status-box .label {
  font-size: 0.7rem;
  color: rgba(255, 215, 64, 0.55);
  text-transform: uppercase;
  font-family: 'Antonio', sans-serif;
  letter-spacing: 0.08rem;
  line-height: 1;
}

.status-box .value {
  font-size: 1.35rem;
  font-weight: bold;
  color: #ffd740;
  font-family: 'Antonio', sans-serif;
  line-height: 1;
}

.status-box .value.zero-lit {
  color: #69f0ae;
  text-shadow: 0 0 0.5rem rgba(105, 240, 174, 0.6);
}

.diff-value.easy   { color: #69f0ae; }
.diff-value.medium { color: #ffd740; }
.diff-value.hard   { color: #ff6e6e; }

/* ─── Inline logo grid (header-right) ───────────────────────────────────────── */
.inline-logo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.2rem;
}

/* Default (unlit) cell — neutral */
.inline-logo-cell {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 0.1rem;
  background: rgba(255, 255, 255, 0.07);
  border: 0.0625rem solid rgba(255, 255, 255, 0.12);
  transition: background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

/* Lit cell colours per difficulty */
.inline-logo-grid.easy .inline-logo-cell.lit {
  background: #69f0ae;
  border-color: #69f0ae;
  box-shadow: 0 0 0.3rem rgba(105, 240, 174, 0.85);
  animation: bulb-glow-easy 2.6s ease-in-out infinite alternate;
}

.inline-logo-grid.medium .inline-logo-cell.lit {
  background: #ffd740;
  border-color: #ffd740;
  box-shadow: 0 0 0.3rem rgba(255, 215, 64, 0.85);
  animation: bulb-glow-medium 2.6s ease-in-out infinite alternate;
}

.inline-logo-grid.hard .inline-logo-cell.lit {
  background: #ff6e6e;
  border-color: #ff6e6e;
  box-shadow: 0 0 0.3rem rgba(255, 110, 110, 0.85);
  animation: bulb-glow-hard 2.6s ease-in-out infinite alternate;
}

@keyframes bulb-glow-easy {
  from { box-shadow: 0 0 0.2rem rgba(105, 240, 174, 0.7); }
  to   { box-shadow: 0 0 0.55rem rgba(105, 240, 174, 1), 0 0 1rem rgba(105, 240, 174, 0.4); }
}

@keyframes bulb-glow-medium {
  from { box-shadow: 0 0 0.2rem rgba(255, 215, 64, 0.7); }
  to   { box-shadow: 0 0 0.55rem rgba(255, 215, 64, 1), 0 0 1rem rgba(255, 215, 64, 0.4); }
}

@keyframes bulb-glow-hard {
  from { box-shadow: 0 0 0.2rem rgba(255, 110, 110, 0.7); }
  to   { box-shadow: 0 0 0.55rem rgba(255, 110, 110, 1), 0 0 1rem rgba(255, 110, 110, 0.4); }
}

/* ─── Level selector ─────────────────────────────────────────────────────────── */
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

.level-bubble.easy   { border-color: #69f0ae; color: #69f0ae; background: rgba(105, 240, 174, 0.1); }
.level-bubble.medium { border-color: #ffd740; color: #ffd740; background: rgba(255, 215, 64,  0.1); }
.level-bubble.hard   { border-color: #ff6e6e; color: #ff6e6e; background: rgba(255, 110, 110, 0.1); }

.level-bubble.easy:hover,   .level-bubble.easy.completed   { background: #69f0ae; color: #000; }
.level-bubble.medium:hover, .level-bubble.medium.completed { background: #ffd740; color: #000; }
.level-bubble.hard:hover,   .level-bubble.hard.completed   { background: #ff6e6e; color: #000; }

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

/* ─── Board container ────────────────────────────────────────────────────────── */
.ic-board-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* game-status-overlay, confirm-sub, confirm-actions, confirm-btn, abort-btn
   shared via gameLanding.css import above */

.save-timestamp {
  font-family: 'Antonio', sans-serif;
  font-size: 0.9rem;
  color: rgba(153, 204, 255, 0.65);
  margin: -0.75rem 0 1.25rem;
  letter-spacing: 0.04em;
}

.score-note {
  font-family: 'Antonio', sans-serif;
  font-size: 0.95rem;
  color: rgba(153, 204, 255, 0.8);
  margin: 0.25rem 0 0.75rem;
  letter-spacing: 0.03em;
}
.score-note.new-record {
  color: #ffd740;
  text-shadow: 0 0 0.5rem rgba(255, 215, 64, 0.5);
}
</style>