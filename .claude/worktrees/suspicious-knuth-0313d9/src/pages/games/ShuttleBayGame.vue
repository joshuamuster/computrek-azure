<template>
  <div class="game-container" :class="{ show: isVisible }">
    <div class="game-header">
      <div class="header-left">
        <button @click="resetPuzzle" class="pill reset-btn">Reset</button>
        <div class="stat-box">
          <span class="label">Moves:</span>
          <span class="value">{{ moves }}</span>
        </div>
        <div class="stat-box">
          <span class="label">Difficulty:</span>
          <span class="value">{{ currentPuzzle?.difficulty }}</span>
        </div>
      </div>

      <div class="logo-wrapper" @click="goToGames">
        <img :src="shuttleBayLogo" alt="Shuttle Bay" class="game-logo-small" />
      </div>

      <div class="header-right">
      </div>
    </div>

    <div class="level-selector">
      <div class="level-grid">
        <button
            v-for="p in puzzles"
            :key="p.id"
            @click="selectPuzzle(p.id)"
            :disabled="isLevelLocked(p.id)"
            :class="['level-bubble', { active: currentPuzzleId === p.id, completed: isLevelCompleted(p.id), locked: isLevelLocked(p.id) }, p.difficulty.toLowerCase().replace(' ', '-')]"
        >
          {{ p.id }}
        </button>
      </div>
    </div>

    <div v-if="hasWon" class="game-status-overlay won">
      <h2>MISSION ACCOMPLISHED</h2>
      <p>The shuttle has cleared the cargo bay.</p>
      <div class="status-actions">
        <button @click="nextLevel" class="pill active" v-if="hasNextLevel">Next Level</button>
        <button @click="resetPuzzle" class="pill" v-else>Replay</button>
        <button @click="goToGames" class="pill">Back to Games</button>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showConfirm" class="game-status-overlay confirmation">
      <h2>{{ confirmMessage }}</h2>
      <p class="confirm-sub">Current simulation progress will be lost.</p>
      <div class="confirm-actions">
        <button @click="handleConfirm" class="pill confirm-btn">PROCEED</button>
        <button @click="handleCancel" class="pill abort-btn">ABORT</button>
      </div>
    </div>

    <div class="board-container">
      <ShuttleBayBoard
        v-if="currentPuzzle"
        :key="boardKey"
        :initial-pieces="currentPuzzle.pieces"
        :cell-size="60"
        @win="handleWin"
        @move="handleMove"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { puzzles } from '@/components/games/ShuttleBay/puzzles';
import ShuttleBayBoard from '@/components/games/ShuttleBay/ShuttleBayBoard.vue';
import soundOk from '@/assets/sounds/SFX-Computer/keyok1.wav';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import shuttleBayLogo from '@/assets/images/games/title-shuttlebay.svg';

const router = useRouter();
const isVisible = ref(false);
const currentPuzzleId = ref(1);
const moves = ref(0);
const hasWon = ref(false);
const completedLevels = ref<number[]>([]);
const boardKey = ref(0);

const showConfirm = ref(false);
const confirmMessage = ref('');
const confirmAction = ref<'reset' | 'select' | null>(null);
const pendingPuzzleId = ref<number | null>(null);

const currentPuzzle = computed(() => puzzles.find(p => p.id === currentPuzzleId.value));
const hasNextLevel = computed(() => puzzles.some(p => p.id === currentPuzzleId.value + 1));

function isLevelCompleted(id: number) {
  return completedLevels.value.includes(id);
}

function isLevelLocked(id: number) {
  if (id === 1) return false;
  return !isLevelCompleted(id - 1);
}

onMounted(() => {
  const saved = localStorage.getItem('shuttlebay-completed-levels');
  if (saved) {
    try {
      completedLevels.value = JSON.parse(saved);
    } catch (e) {
      completedLevels.value = [];
    }
  }
  setTimeout(() => isVisible.value = true, 100);
});

function selectPuzzle(id: number) {
  if (id === currentPuzzleId.value) return;
  if (moves.value > 0 && !hasWon.value) {
    confirmMessage.value = 'CHANGE MISSION?';
    confirmAction.value = 'select';
    pendingPuzzleId.value = id;
    showConfirm.value = true;
  } else {
    currentPuzzleId.value = id;
    executeReset();
  }
}

function resetPuzzle() {
  if (moves.value > 0 && !hasWon.value) {
    confirmMessage.value = 'RESET MISSION?';
    confirmAction.value = 'reset';
    showConfirm.value = true;
  } else {
    executeReset();
  }
}

function executeReset() {
  moves.value = 0;
  hasWon.value = false;
  boardKey.value++;
  showConfirm.value = false;
  playSound(soundOk);
}

function handleConfirm() {
  if (confirmAction.value === 'select' && pendingPuzzleId.value !== null) {
    currentPuzzleId.value = pendingPuzzleId.value;
  }
  executeReset();
  confirmAction.value = null;
  pendingPuzzleId.value = null;
}

function handleCancel() {
  showConfirm.value = false;
  confirmAction.value = null;
  pendingPuzzleId.value = null;
}

function handleMove() {
  moves.value++;
}

function handleWin() {
  if (hasWon.value) return;
  hasWon.value = true;
  playSound(soundSuccess);

  if (!completedLevels.value.includes(currentPuzzleId.value)) {
    completedLevels.value.push(currentPuzzleId.value);
    localStorage.setItem('shuttlebay-completed-levels', JSON.stringify(completedLevels.value));
  }
}

function nextLevel() {
  if (hasNextLevel.value) {
    currentPuzzleId.value++;
    resetPuzzle();
  }
}

function playSound(src: string) {
  try {
    const audio = new Audio(src);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  } catch (e) {}
}

function goToGames() {
  router.push('/games');
}
</script>

<style scoped>

.pill:nth-child(1) {
  border-radius: 100vmax;
  background-color: inherit;
}
.game-container {
  padding: 2rem;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0;
  transition: opacity 1s ease;
}

.game-container.show {
  opacity: 1;
}

/* ─── Header (game-header, logo-wrapper shared via gameLanding.css) ──────── */
.stat-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat-box .label {
  font-size: 0.8rem;
  color: #9999ff;
  text-transform: uppercase;
}

.stat-box .value {
  font-size: 1.4rem;
  font-weight: bold;
  color: #ff9d00;
}

.board-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;
}

/* game-status-overlay, confirm-sub, confirm-actions, confirm-btn, abort-btn shared via gameLanding.css */

.status-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

/* pill shared via gameLanding.css */

.level-selector {
  display: flex;
  justify-content: center;
  width: 100%;
}

.level-grid {
  display: flex;
  /* grid-template-columns: repeat(10, 1fr); */
  gap: 0.5rem;
}

.level-bubble {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 0.125rem solid #3366ff;
  background: transparent;
  color: #3366ff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'LCARS', sans-serif;
  font-weight: bold;
  font-size: 1.1rem;
}

.level-bubble.easy {
  border-color: #417A58;
  color: #417A58;
  background: rgba(65, 122, 88, 0.2);
}

.level-bubble.medium {
  border-color: #F59D08;
  color: #F59D08;
  background: rgba(245, 157, 8, 0.2);
}

.level-bubble.very-difficult {
  border-color: #E35E5E;
  color: #E35E5E;
  background: rgba(227, 94, 94, 0.2);
}

.level-bubble.easy:hover, .level-bubble.easy.completed {
  background: #417A58;
  color: white;
}

.level-bubble.medium:hover, .level-bubble.medium.completed {
  background: #F59D08;
  color: white;
}

.level-bubble.very-difficult:hover, .level-bubble.very-difficult.completed {
  background: #E35E5E;
  color: white;
}

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
  0% { box-shadow: 0 0 0 0 currentColor; }
  50% { box-shadow: 0 0 0.9375rem 0.125rem currentColor; }
  100% { box-shadow: 0 0 0 0 currentColor; }
}
</style>
