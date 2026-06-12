<template>
  <div class="picard-maneuver-game-container" :class="{ show: isVisible }">
    <div class="game-header">
      <div class="header-left">
        <div class="status-box turn-indicator" :class="turnColor.toLowerCase() + '-turn'">
          <span class="label">TURN</span>
          <span class="value">{{ turnColor }}</span>
        </div>
        <div class="status-box score-box">
          <span class="label">SCORE</span>
          <span class="value">{{ scores.black }} - {{ scores.white }}</span>
        </div>
        <div class="status-box color-indicator" v-if="isMultiplayer">
          <span class="label">YOU ARE</span>
          <span class="value">{{ playerColor?.toUpperCase() }}</span>
        </div>
      </div>

      <div class="logo-wrapper" @click="goToGames">
        <img :src="picardManeuverLogo" alt="Picard Maneuver" class="game-logo-small" />
      </div>

      <div class="header-right">
        <div class="status-box multiplayer-info" v-if="isMultiplayer">
          <span class="label">JOIN CODE</span>
          <span class="value code-value">{{ joinCode }}</span>
        </div>
        <button @click="handleReset" class="pill reset-btn">Reset</button>
      </div>
    </div>

    <div class="picard-maneuver-board-container">
      <PicardManeuverBoard
          :board="board"
          :turn="turn"
          :playable="isMyTurn"
          @move="onMove"
      />

      <div v-if="multiplayerError" class="multiplayer-error-overlay">
        {{ multiplayerError }}
      </div>
    </div>

    <!-- Status Messages (e.g., Passed Turn) -->
    <div v-if="statusMessage" class="status-toast">
      {{ statusMessage }}
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showConfirm" class="game-status-overlay confirmation">
      <h2>RESET SIMULATION?</h2>
      <p class="confirm-sub">Current simulation progress will be lost.</p>
      <div class="confirm-actions">
        <button @click="confirmReset" class="pill confirm-btn">PROCEED</button>
        <button @click="showConfirm = false" class="pill abort-btn">ABORT</button>
      </div>
    </div>

    <!-- Game Over Modal -->
    <div v-if="showGameOver" class="game-status-overlay game-over">
      <h2>MISSION ACCOMPLISHED</h2>
      <p class="confirm-sub">{{ winnerMessage }}</p>
      <div class="score-summary">
        <div class="summary-item black">BLACK: {{ scores.black }}</div>
        <div class="summary-item white">WHITE: {{ scores.white }}</div>
      </div>
      <div class="confirm-actions">
        <button @click="handleReset" class="pill confirm-btn">NEW SIMULATION</button>
        <button @click="showGameOver = false" class="pill abort-btn">CLOSE</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useMultiplayer } from '@/composables/useMultiplayer';
import { useGameScores } from '@/composables/useGameScores';
import { useActivityLog } from '@/composables/useActivityLog.js';
import {
  getInitialBoard,
  makeMove,
  countDiscs,
  boardToString,
  stringToBoard,
  PieceColor,
  getAllValidMoves
} from '@/components/games/PicardManeuver/engine';
import PicardManeuverBoard from '@/components/games/PicardManeuver/PicardManeuverBoard.vue';
import picardManeuverLogo from '@/assets/images/games/title-picardmaneuver.svg';
import soundOk from '@/assets/sounds/SFX-Computer/keyok1.wav';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import '@/assets/styles/gameLanding.css';

const router = useRouter();
const route = useRoute();
const isVisible = ref(false);
const statusMessage = ref('');
const showConfirm = ref(false);
const showGameOver = ref(false);

// Game State
const board = ref<PieceColor[][]>(getInitialBoard());
const turn = ref<PieceColor>(2); // 2: Black starts

const {
  isMultiplayer,
  playerColor,
  joinCode,
  remoteRoom,
  submitMove,
  resetGame: resetRemoteGame,
  tryReconnect,
  stopListening,
  resetState,
  error: multiplayerError
} = useMultiplayer();

const scoreComposable = useGameScores('picard_maneuver', { lowerIsBetter: false });
const { logEvent } = useActivityLog();
const gameStartLogged = ref(false);

const turnColor = computed(() => turn.value === 1 ? 'WHITE' : 'BLACK');
const scores = computed(() => countDiscs(board.value));

const isMyTurn = computed(() => {
  if (showGameOver.value) return false;
  if (!isMultiplayer.value) return true;
  const myColorNum = playerColor.value === 'white' ? 1 : 2;
  return turn.value === myColorNum;
});

const winnerMessage = computed(() => {
  if (scores.value.black > scores.value.white) return 'BLACK VICTORIOUS';
  if (scores.value.white > scores.value.black) return 'WHITE VICTORIOUS';
  return 'SIMULATION TIE';
});

onMounted(async () => {
  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  setTimeout(() => { isVisible.value = true; }, 100);

  if (route.query.mode === 'online') {
    await tryReconnect('picard-maneuver');
  } else {
    resetState();
    logEvent('game_start', { gameId: 'picard_maneuver' });
    gameStartLogged.value = true;
  }
});

onBeforeUnmount(() => {
  stopListening();
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
});

function onMove(x: number, y: number) {
  if (!isMyTurn.value) return;

  const nextBoard = makeMove(board.value, x, y, turn.value);
  if (nextBoard) {
    board.value = nextBoard;
    playSound(soundOk);

    const nextTurn = turn.value === 1 ? 2 : 1;
    finalizeMove(nextBoard, nextTurn, x, y);
  }
}

function finalizeMove(newBoard: PieceColor[][], nextTurn: PieceColor, x: number, y: number) {
  let finalTurn = nextTurn;

  // Check if next player has moves
  if (getAllValidMoves(newBoard, nextTurn).length === 0) {
    // Check if current player (who just moved) has moves
    const currentTurn = turn.value;
    if (getAllValidMoves(newBoard, currentTurn).length === 0) {
      // Game Over
      showGameOver.value = true;
      playSound(soundSuccess);
      // Multiplayer: win = increment score; loss/tie = log participation. Solo = nothing.
      if (isMultiplayer.value) {
        const { black, white } = countDiscs(newBoard);
        const iWon = (playerColor.value === 'black' && black > white) ||
            (playerColor.value === 'white' && white > black);
        if (iWon) {
          scoreComposable.incrementScore();
        } else {
          const pmResult = (black === white) ? 'draw' : 'loss';
          scoreComposable.autoLogCompletion(scoreComposable.myHighScore.value ?? 0, pmResult);
        }
      }
    } else {
      // Next player must pass
      statusMessage.value = `${nextTurn === 1 ? 'WHITE' : 'BLACK'} HAS NO MOVES. PASSING...`;
      setTimeout(() => { statusMessage.value = ''; }, 3000);
      finalTurn = currentTurn;
    }
  }

  turn.value = finalTurn;

  if (isMultiplayer.value) {
    const boardStr = boardToString(newBoard);
    const turnStr = finalTurn === 1 ? 'white' : 'black';
    submitMove({ x, y }, boardStr, turnStr);
  }
}

function handleReset() {
  const initialStr = boardToString(getInitialBoard());
  const currentStr = boardToString(board.value);
  const needsConfirm = currentStr !== initialStr;
  if (isMultiplayer.value || needsConfirm) {
    showConfirm.value = true;
  } else {
    resetLocal();
  }
}

function confirmReset() {
  showConfirm.value = false;
  const initialBoard = getInitialBoard();
  const boardStr = boardToString(initialBoard);
  resetRemoteGame(boardStr, 'black');
  resetLocal();
}

function resetLocal() {
  board.value = getInitialBoard();
  turn.value = 2; // Black starts
  showGameOver.value = false;
  playSound(soundOk);
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

// Watch for remote updates
watch(remoteRoom, (newRoom) => {
  if (!gameStartLogged.value && newRoom?.players?.white && newRoom?.players?.black) {
    gameStartLogged.value = true;
    logEvent('game_start', { gameId: 'picard_maneuver' });
  }
  if (newRoom && newRoom.gameType === 'picard-maneuver') {
    const newBoardStr = newRoom.boardState;
    const currentBoardStr = boardToString(board.value);

    if (newBoardStr !== currentBoardStr) {
      const newBoard = stringToBoard(newBoardStr);
      board.value = newBoard;
      turn.value = newRoom.currentTurn === 'white' ? 1 : 2;

      // Check game over on remote update too
      if (getAllValidMoves(newBoard, 1).length === 0 && getAllValidMoves(newBoard, 2).length === 0) {
        if (!showGameOver.value) {
          showGameOver.value = true;
          playSound(soundSuccess);
          // Multiplayer: win = increment score; loss/tie = log participation.
          const { black, white } = countDiscs(newBoard);
          const iWon = (playerColor.value === 'black' && black > white) ||
              (playerColor.value === 'white' && white > black);
          if (iWon) {
            scoreComposable.incrementScore();
          } else {
            const pmResult = (black === white) ? 'draw' : 'loss';
          scoreComposable.autoLogCompletion(scoreComposable.myHighScore.value ?? 0, pmResult);
          }
        }
      }
    }
  }
});
</script>

<style scoped>
.picard-maneuver-game-container {
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

.picard-maneuver-game-container.show {
  opacity: 1;
  transform: none;
}

/* ─── Header (game-header, status-box, logo-wrapper shared via gameLanding.css) ── */
.turn-indicator.black-turn { border-color: #444; }
.turn-indicator.white-turn { border-color: #fff; }

.picard-maneuver-board-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.multiplayer-error-overlay {
  position: absolute;
  top: -2.5rem;
  color: #f44336;
  font-weight: bold;
}

/* status-toast, game-status-overlay, confirm-sub, confirm-actions,
   confirm-btn, abort-btn shared via gameLanding.css */

/* ─── Pill Buttons ────────────────────────────────────────────────────────── */
.pill {
  border-radius: 1.25rem;
  border: 0.125rem solid #3366ff;
  background: transparent;
  color: #3366ff;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Antonio', sans-serif;
  text-transform: uppercase;
  font-weight: bold;
}

.pill:hover {
  background: #3366ff;
  color: white;
}

.score-summary {
  display: flex;
  justify-content: center;
  gap: 1.875rem;
  margin-bottom: 2rem;
}

.summary-item {
  font-family: 'Antonio', sans-serif;
  font-size: 1.5rem;
  font-weight: bold;
}

.summary-item.black { color: #888; }
.summary-item.white { color: #fff; }
</style>