<template>
  <div class="mancala-game-container" :class="{ show: isVisible }">
    <div class="game-header">
      <div class="header-left">
        <div class="status-box turn-indicator" :class="turnPlayerName.toLowerCase() + '-turn'">
          <span class="label">TURN</span>
          <span class="value">{{ turnPlayerName }}</span>
        </div>
        <div class="status-box score-box">
          <span class="label">LATINUM</span>
          <span class="value">{{ state.pits[6] }} - {{ state.pits[13] }}</span>
        </div>
        <div class="status-box color-indicator" v-if="isMultiplayer">
          <span class="label">YOU ARE</span>
          <span class="value">{{ playerSideName }}</span>
        </div>
      </div>

      <div class="logo-wrapper" @click="goToGames">
        <img :src="mancalaLogo" alt="Rules of Acquisition" class="game-logo-small" />
      </div>

      <div class="header-right">
        <div class="status-box multiplayer-info" v-if="isMultiplayer">
          <span class="label">JOIN CODE</span>
          <span class="value code-value">{{ joinCode }}</span>
        </div>
        <button @click="handleReset" class="pill reset-btn">Reset</button>
      </div>
    </div>

    <div class="mancala-board-container">
      <RulesOfAcquisitionBoard
          :pits="state.pits"
          :turn="state.turn"
          :playable="isMyTurn"
          :myColor="isMultiplayer ? (playerColor === 'white' ? Player.P1 : Player.P2) : undefined"
          @move="onMove"
      />

      <div v-if="multiplayerError" class="multiplayer-error-overlay">
        {{ multiplayerError }}
      </div>
    </div>

    <!-- Status Messages (e.g., Extra Turn) -->
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
        <div class="summary-item p1">PLAYER 1: {{ state.pits[6] }}</div>
        <div class="summary-item p2">PLAYER 2: {{ state.pits[13] }}</div>
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
  boardToString,
  stringToBoard,
  Player,
  type BoardState
} from '@/components/games/RulesOfAcquisition/engine';
import RulesOfAcquisitionBoard from '@/components/games/RulesOfAcquisition/RulesOfAcquisitionBoard.vue';
import mancalaLogo from '@/assets/images/games/title-rulesofacquisition.svg';
import soundOk from '@/assets/sounds/SFX-Computer/keyok1.wav';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';

const router = useRouter();
const route = useRoute();
const isVisible = ref(false);
const statusMessage = ref('');
const showConfirm = ref(false);
const showGameOver = ref(false);

// Game State
const state = ref<BoardState>(getInitialBoard());

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

const scoreComposable = useGameScores('rules_of_acquisition', { lowerIsBetter: false });
const { logEvent } = useActivityLog();
const gameStartLogged = ref(false);
// This is to keep consistency with useMultiplayer which uses 'white'/'black'

const isMyTurn = computed(() => {
  if (state.value.gameOver) return false;
  if (!isMultiplayer.value) return true;

  const currentTurnColor = state.value.turn === Player.P1 ? 'white' : 'black';
  return playerColor.value === currentTurnColor;
});

const turnPlayerName = computed(() => {
  return state.value.turn === Player.P1 ? 'PLAYER 1' : 'PLAYER 2';
});

const playerSideName = computed(() => {
  return playerColor.value === 'white' ? 'PLAYER 1' : 'PLAYER 2';
});

const winnerMessage = computed(() => {
  if (state.value.winner === 'tie') return "IT'S A TIE! PROFITS ARE SPLIT EQUALLY.";
  if (state.value.winner === Player.P1) return "PLAYER 1 DOMINATES THE SECTOR!";
  if (state.value.winner === Player.P2) return "PLAYER 2 CLAIMS ALL THE LATINUM!";
  return "";
});

onMounted(async () => {
  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  requestAnimationFrame(() => { isVisible.value = true; });

  if (route.query.mode === 'online') {
    await tryReconnect('mancala');
  } else {
    resetState();
    logEvent('game_start', { gameId: 'rules_of_acquisition' });
    gameStartLogged.value = true;
  }
});

onBeforeUnmount(() => {
  stopListening();
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
});

// Watch for remote moves
watch(remoteRoom, (newRoom) => {
  if (!gameStartLogged.value && newRoom?.players?.white && newRoom?.players?.black) {
    gameStartLogged.value = true;
    logEvent('game_start', { gameId: 'rules_of_acquisition' });
  }
  if (newRoom && newRoom.gameType === 'mancala') {
    const newPits = stringToBoard(newRoom.boardState);
    const pitsMatch = state.value.pits.every((p, i) => p === newPits[i]);

    if (!pitsMatch) {
      // Check for game over based on pits
      const p1Empty = newPits.slice(0, 6).every(p => p === 0);
      const p2Empty = newPits.slice(7, 13).every(p => p === 0);
      const isGameOver = p1Empty || p2Empty;

      let winner: Player | 'tie' | null = null;
      if (isGameOver) {
        if (newPits[6] > newPits[13]) winner = Player.P1;
        else if (newPits[13] > newPits[6]) winner = Player.P2;
        else winner = 'tie';
      }

      state.value = {
        pits: newPits,
        turn: newRoom.currentTurn === 'white' ? Player.P1 : Player.P2,
        gameOver: isGameOver,
        winner
      };

      if (isGameOver && !showGameOver.value) {
        showGameOver.value = true;
        playSound(soundSuccess);
        // Multiplayer: win = increment score; loss/tie = log participation.
        const myPlayer = playerColor.value === 'white' ? Player.P1 : Player.P2;
        if (winner !== 'tie' && winner === myPlayer) {
          scoreComposable.incrementScore();
        } else {
          const roaResult = winner === 'tie' ? 'draw' : 'loss';
          scoreComposable.autoLogCompletion(scoreComposable.myHighScore.value ?? 0, roaResult);
        }
      }
    }
  }

  // Sync a reset from the other player: moveHistory is cleared to [] by resetOnlineGame,
  // which is the only reliable signal that a new game was requested. Checking
  // status === 'playing' is NOT safe because it never changes away from 'playing'
  // during normal game flow, causing this block to fire immediately on the
  // game-ending snapshot and instantly wipe the board and dismiss the popup.
  if (state.value.gameOver && !showConfirm.value && newRoom?.moveHistory?.length === 0) {
    state.value = getInitialBoard();
    showGameOver.value = false;
  }
});

function onMove(pitIndex: number) {
  if (!isMyTurn.value) return;

  applyMove(pitIndex, true);
}

function applyMove(pitIndex: number, isLocal: boolean) {
  const { state: newState, extraTurn } = makeMove(state.value, pitIndex);
  state.value = newState;

  if (extraTurn && !state.value.gameOver) {
    showStatus("EXTRA TURN! THE GRAND NAGUS IS PLEASED.");
  }

  if (isLocal && isMultiplayer.value) {
    const boardStr = boardToString(state.value.pits);
    const turnStr = state.value.turn === Player.P1 ? 'white' : 'black';
    submitMove({ move: pitIndex }, boardStr, turnStr);
  }

  if (state.value.gameOver) {
    setTimeout(() => {
      showGameOver.value = true;
      playSound(soundSuccess);
      // Multiplayer: win = increment score; loss/tie = log participation. Solo = nothing.
      if (isMultiplayer.value) {
        const myPlayer = playerColor.value === 'white' ? Player.P1 : Player.P2;
        if (state.value.winner !== 'tie' && state.value.winner === myPlayer) {
          scoreComposable.incrementScore();
        } else {
          const roaResult = state.value.winner === 'tie' ? 'draw' : 'loss';
          scoreComposable.autoLogCompletion(scoreComposable.myHighScore.value ?? 0, roaResult);
        }
      }
    }, 1000);
  } else {
    playSound(soundOk);
  }
}

function showStatus(msg: string) {
  statusMessage.value = msg;
  setTimeout(() => {
    if (statusMessage.value === msg) statusMessage.value = '';
  }, 3000);
}

function handleReset() {
  if (state.value.gameOver) {
    confirmReset();
  } else {
    showConfirm.value = true;
  }
}

function confirmReset() {
  state.value = getInitialBoard();
  showConfirm.value = false;
  showGameOver.value = false;

  if (isMultiplayer.value) {
    const initialStateStr = boardToString(state.value.pits);
    resetRemoteGame(initialStateStr, 'white');
  }

  playSound(soundOk);
}

function goToGames() {
  router.push('/games');
}

function playSound(file: string) {
  try {
    const audio = new Audio(file);
    audio.play().catch(() => {});
  } catch (e) {}
}
</script>

<style scoped>
.mancala-game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  opacity: 0;
  transform: translateY(1.25rem);
  transition: all 0.8s ease;
  width: 100%;
  height: 100%;
}

.mancala-game-container.show {
  opacity: 1;
  transform: translateY(0);
}

/* ─── Header (game-header, status-box, logo-wrapper shared via gameLanding.css) ── */
.player-1-turn { border-color: #ffc400; box-shadow: 0 0 0.625rem rgba(255, 196, 0, 0.3); }
.player-2-turn { border-color: #ffc400; opacity: 0.8; }

/* ─── Pill Buttons ────────────────────────────────────────────────────────── */
.pill {
  background: #ffc400;
  color: #000;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6.25rem;
  font-family: 'Antonio', sans-serif;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  font-size: 0.9rem;
}

.mancala-board-container {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
}

/* status-toast, game-status-overlay, confirm-sub, confirm-actions shared via gameLanding.css */

.score-summary {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
}

.summary-item {
  font-family: 'Antonio', sans-serif;
  font-size: 1.5rem;
  font-weight: bold;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  border: 0.125rem solid;
}

.summary-item.p1 { border-color: #ffc400; color: #ffc400; }
.summary-item.p2 { border-color: #ffc400; color: #fff; }

/* confirm-actions, responsive game-header shared via gameLanding.css */

.multiplayer-error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(196, 68, 68, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
  font-weight: bold;
  pointer-events: none;
  border-radius: 1rem;
}


</style>