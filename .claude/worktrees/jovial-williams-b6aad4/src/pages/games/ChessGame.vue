<template>
  <div class="chess-game-container" :class="{ show: isVisible }">
    <div class="game-header">
      <div class="header-left">
        <div class="status-box turn-indicator" :class="turnColor.toLowerCase() + '-turn'">
          <span class="label">TURN</span>
          <span class="value">{{ turnColor }}</span>
        </div>
        <div class="status-box" v-if="gameStatus">
          <span class="label">STATUS</span>
          <span class="value status-text">{{ gameStatus }}</span>
        </div>
        <div class="status-box color-indicator" v-if="isMultiplayer">
          <span class="label">YOU ARE</span>
          <span class="value">{{ playerColor?.toUpperCase() }}</span>
        </div>
      </div>

      <div class="logo-wrapper" @click="goToGames">
        <img :src="chessLogo" alt="Chess" class="game-logo-small" />
      </div>

      <div class="header-right">
        <div class="status-box multiplayer-info" v-if="isMultiplayer">
          <span class="label">JOIN CODE</span>
          <span class="value code-value">{{ joinCode }}</span>
        </div>
        <button @click="resetGame" class="pill reset-btn">Reset</button>
      </div>
    </div>

    <div class="chess-board-wrapper">
      <div ref="boardRef" class="chess-board cg-hologram"></div>

      <!-- Multiplayer Error Message -->
      <div v-if="multiplayerError" class="multiplayer-error-overlay">
        {{ multiplayerError }}
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

    <!-- Game Over Modal -->
    <div v-if="showGameOver" class="game-status-overlay game-over" :class="gameOverType">
      <h2>{{ gameOverMessage }}</h2>
      <p class="confirm-sub">{{ gameOverSubtext }}</p>
      <div class="confirm-actions">
        <button @click="resetGame" class="pill confirm-btn">NEW SIMULATION</button>
        <button @click="showGameOver = false" class="pill abort-btn">CLOSE</button>
      </div>
    </div>

    <!-- Promotion Modal -->
    <div v-if="showPromotionModal" class="modal-overlay">
      <div class="modal-content">
        <h3>Select Promotion</h3>
        <div class="promotion-options">
          <button @click="promote('q')" class="pill">Queen</button>
          <button @click="promote('r')" class="pill">Rook</button>
          <button @click="promote('b')" class="pill">Bishop</button>
          <button @click="promote('n')" class="pill">Knight</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Chess, type Color, type PieceSymbol, SQUARES } from 'chess.js';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import { useMultiplayer } from '@/composables/useMultiplayer';
import { useGameScores } from '@/composables/useGameScores';
import chessLogo from '@/assets/images/games/title-chess.svg';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import soundError from '@/assets/sounds/SFX-Computer/inputfailed1.wav';

// Import Chessground styles
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';

const router = useRouter();
const route = useRoute();
const boardRef = ref<HTMLElement | null>(null);
const chess = new Chess();
const START_FEN = new Chess().fen();
let cgApi: Api | null = null;
const isVisible = ref(false);

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

const scoreComposable = useGameScores('chess', { lowerIsBetter: false });
const showConfirm = ref(false);
const confirmMessage = ref('');
let confirmActionCallback: (() => void) | null = null;

// Game Over overlay state
const showGameOver = ref(false);
const gameOverMessage = ref('');
const gameOverSubtext = ref('');
const gameOverType = ref<'win' | 'draw'>('win');

const showPromotionModal = ref(false);
let pendingMove: { from: string; to: string } | null = null;

const turnColor = ref(chess.turn() === 'w' ? 'WHITE' : 'BLACK');
const gameStatus = ref('');

function goToGames() {
  router.push('/games');
}

function playSound(src: string) {
  try {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {}
}

function resetGame() {
  const action = async () => {
    chess.reset();
    showGameOver.value = false;
    if (isMultiplayer.value) {
      // Update remote state
      await resetRemoteGame(chess.fen());
      // Also update local board immediately
      cgApi?.set({
        fen: chess.fen(),
        turnColor: 'white',
        movable: {
          color: playerColor.value || 'white',
          dests: getDests()
        },
        lastMove: undefined,
        check: false
      });
      updateStatus();
    } else {
      cgApi?.set({
        fen: chess.fen(),
        turnColor: 'white',
        movable: {
          color: 'white',
          dests: getDests()
        },
        lastMove: undefined,
        check: false
      });
      updateStatus();
    }
  };

  const shouldConfirm = isMultiplayer.value
      ? !!(remoteRoom.value && ((remoteRoom.value.moveHistory?.length || 0) > 0 || remoteRoom.value.boardState !== START_FEN))
      : (chess.history().length > 0 && !chess.isGameOver());

  if (shouldConfirm) {
    confirmMessage.value = 'ARE YOU SURE YOU WANT TO RESET?';
    confirmActionCallback = action;
    showConfirm.value = true;
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
}

function getDests() {
  const dests = new Map();
  SQUARES.forEach(s => {
    const ms = chess.moves({ square: s, verbose: true });
    if (ms.length) dests.set(s, ms.map(m => m.to));
  });
  return dests;
}

function updateStatus() {
  turnColor.value = chess.turn() === 'w' ? 'WHITE' : 'BLACK';

  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'BLACK' : 'WHITE';
    gameOverMessage.value = 'CHECKMATE';
    gameOverSubtext.value = `${winner} WINS THE SIMULATION`;
    gameOverType.value = 'win';
    if (!showGameOver.value) {
      playSound(soundSuccess);
      // Submit score if local player won
      if (isMultiplayer.value) {
        const myColor = playerColor.value?.toUpperCase(); // 'WHITE' or 'BLACK'
        if (myColor === winner) scoreComposable.incrementScore();
      }
    }
    showGameOver.value = true;
    gameStatus.value = '';
  } else if (chess.isDraw()) {
    gameOverMessage.value = 'SIMULATION ENDED';
    if (chess.isStalemate()) {
      gameOverSubtext.value = 'STALEMATE - NO LEGAL MOVES';
    } else if (chess.isThreefoldRepetition()) {
      gameOverSubtext.value = 'DRAW - THREEFOLD REPETITION';
    } else if (chess.isInsufficientMaterial()) {
      gameOverSubtext.value = 'DRAW - INSUFFICIENT MATERIAL';
    } else {
      gameOverSubtext.value = 'DRAW - 50-MOVE RULE OR AGREEMENT';
    }
    gameOverType.value = 'draw';
    if (!showGameOver.value) playSound(soundError);
    showGameOver.value = true;
    gameStatus.value = '';
  } else {
    showGameOver.value = false;
    if (chess.isCheck()) {
      gameStatus.value = 'CHECK';
    } else {
      gameStatus.value = '';
    }
  }
}

async function onMove(orig: string, dest: string) {
  const moveData: any = { from: orig, to: dest };

  // Check for promotion
  const piece = chess.get(orig as any);
  if (piece?.type === 'p' && ((piece.color === 'w' && dest[1] === '8') || (piece.color === 'b' && dest[1] === '1'))) {
    pendingMove = { from: orig, to: dest };
    showPromotionModal.value = true;
    return;
  }

  const move = chess.move(moveData);
  if (move) {
    if (isMultiplayer.value) {
      await submitMove(move, chess.fen(), chess.turn());
    }

    cgApi?.set({
      fen: chess.fen(),
      turnColor: toCgColor(chess.turn()),
      movable: {
        color: isMultiplayer.value ? (playerColor.value || 'white') : toCgColor(chess.turn()),
        dests: getDests()
      },
      check: chess.isCheck()
    });
    updateStatus();
  }
}

async function promote(promotion: string) {
  if (pendingMove) {
    const move = chess.move({ ...pendingMove, promotion: promotion as PieceSymbol });

    if (isMultiplayer.value && move) {
      await submitMove(move, chess.fen(), chess.turn());
    }

    cgApi?.set({
      fen: chess.fen(),
      turnColor: toCgColor(chess.turn()),
      movable: {
        color: isMultiplayer.value ? (playerColor.value || 'white') : toCgColor(chess.turn()),
        dests: getDests()
      },
      check: chess.isCheck()
    });
    updateStatus();
    pendingMove = null;
    showPromotionModal.value = false;
  }
}

function toCgColor(c: Color): 'white' | 'black' {
  return c === 'w' ? 'white' : 'black';
}

onMounted(async () => {
  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  requestAnimationFrame(() => { isVisible.value = true; });

  // Handle multiplayer initialization
  if (route.query.mode === 'online') {
    await tryReconnect('chess');
  } else {
    resetState();
  }

  if (boardRef.value) {
    const config: Config = {
      fen: chess.fen(),
      orientation: playerColor.value || 'white',
      turnColor: toCgColor(chess.turn()),
      movable: {
        color: isMultiplayer.value ? (playerColor.value || 'white') : toCgColor(chess.turn()),
        free: false,
        dests: getDests(),
      },
      events: {
        move: onMove
      },
      // Disable drag, use clicks
      draggable: {
        enabled: false
      },
      selectable: {
        enabled: true
      },
      // Configure click-to-move
      addGhostPiece: true,
      highlight: {
        lastMove: true,
        check: true
      }
    };
    cgApi = Chessground(boardRef.value, config);
  }
});

// Watch for remote updates in multiplayer mode
watch(remoteRoom, (newRoom) => {
  if (!newRoom) return;
  // Always apply latest remote state, including resets
  chess.load(newRoom.boardState);
  cgApi?.set({
    fen: chess.fen(),
    turnColor: toCgColor(chess.turn()),
    movable: {
      color: isMultiplayer.value ? (playerColor.value || 'white') : toCgColor(chess.turn()),
      dests: getDests()
    },
    check: chess.isCheck(),
    lastMove: newRoom.moveHistory.length > 0 ? [
      newRoom.moveHistory[newRoom.moveHistory.length - 1].from,
      newRoom.moveHistory[newRoom.moveHistory.length - 1].to
    ] : undefined
  });
  updateStatus();
});

onBeforeUnmount(() => {
  stopListening();
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
});
</script>

<style scoped>
.chess-game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9375rem;
  opacity: 0;
  transform: translateY(0.375rem);
  transition: opacity 1s ease, transform 1s ease;
  width: 100%;
}

.chess-game-container.show {
  opacity: 1;
  transform: none;
}

/* ─── Header (game-header, status-box, logo-wrapper shared via gameLanding.css) ── */

/* Turn indicators */
.status-box.white-turn {
  background: rgba(130, 150, 185, 1) !important;
  border: 0.125rem solid #ffc400;
  box-shadow: 0 0 1.25rem rgba(255, 255, 255, 0.4);
}

.status-box.white-turn .label {
  color: #ffc400;
}

.status-box.white-turn .value {
  color: #fff;
  text-shadow: none;
}

.status-box.black-turn {
  background: rgba(130, 150, 185, 0.5) !important;
  box-shadow: 0 0 1.25rem rgba(0, 0, 0, 0.4);
}

.status-text {
  color: #f44336 !important;
}

/*
 * FIX: Removed `padding` from .chess-board-wrapper and moved spacing to
 * `margin` on .chess-board instead. Chessground calculates square highlight
 * positions using getBoundingClientRect() on the board element itself — any
 * padding on the wrapper shifts the board's pixel origin without Chessground
 * knowing, causing the last-move glow box to render a few pixels off.
 * Using margin keeps the wrapper's visual appearance identical while ensuring
 * the board element's own top-left corner is the true layout origin.
 */
.chess-board-wrapper {
  background: rgba(20, 30, 40, 0.6);
  /* padding removed — see fix comment above */
  /*
   * FIX 2: Using `outline` instead of `border` here. A CSS border adds to the
   * element's box and shifts its content (the board) inward by the border width.
   * Chessground uses getBoundingClientRect() to position square highlights, so
   * even a 1px border causes the glow box to render offset from the actual piece.
   * `outline` renders outside the element's box and has zero effect on layout.
   */
  outline: 0.0625rem solid rgba(170, 210, 255, 0.4);
  border-radius: 0.75rem;
  backdrop-filter: blur(0.625rem);
  box-shadow: 0 0 2.5rem rgba(0, 0, 0, 0.6), inset 0 0 1.25rem rgba(153, 204, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.multiplayer-error-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(244, 67, 54, 0.9);
  color: white;
  padding: 0.9375rem 1.875rem;
  border-radius: 0.5rem;
  font-family: 'Antonio', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.0625rem;
  z-index: 50;
  box-shadow: 0 0 1.25rem rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.chess-board {
  width: 37.5rem;
  height: 37.5rem;
  /* Spacing that was previously padding on the wrapper lives here now */
  margin: 0.9375rem;
  display: block;
}

/* Custom Chessground Theme: Hologram */
:deep(cg-board) {
  background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyIDIiPjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InJnYmEoNTAsIDYwLCA4MCwgMC41KSIvPjxyZWN0IHg9IjEiIHk9IjEiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InJnYmEoNTAsIDYwLCA4MCwgMC41KSIvPjwvc3ZnPg==') !important;
  background-size: 25% 25% !important;
  background-color: rgba(130, 150, 185, 0.5) !important;
  border: 0.0625rem solid rgba(153, 204, 255, 0.2);
}

/* Highlight squares for move destinations and selected pieces */
:deep(square.move-dest) {
  background: radial-gradient(rgba(153, 204, 255, 0.3) 22%, transparent 0) !important;
}

:deep(square.move-dest:hover) {
  background: rgba(153, 204, 255, 0.2) !important;
}

:deep(cg-board square.last-move) {
  background-color: rgba(130, 150, 185, 0.5);
  animation: pulse-last-move 1s infinite alternate ease-in-out;
}

:deep(square.selected) {
  background-color: rgba(153, 204, 255, 0.25) !important;
}

:deep(square.check) {
  background: radial-gradient(ellipse at center, rgba(244, 67, 54, 0.6) 0%, rgba(244, 67, 54, 0) 80%) !important;
}

:deep(coords) {
  color: #99ccff !important;
  font-family: 'Antonio', sans-serif;
  text-shadow: 0 0 0.25rem rgba(0, 0, 0, 0.5);
}

:deep(piece) {
  filter: drop-shadow(0 0 0.125rem rgba(0, 0, 0, 0.4));
}

:deep(piece.white) {
  filter: drop-shadow(0 0 0.3125rem rgba(255, 255, 255, 0.2));
}

:deep(piece.black) {
  filter: drop-shadow(0 0 0.3125rem rgba(153, 204, 255, 0.2));
}

/* ─── Pill Buttons (shared via gameLanding.css) ───────────────────────────── */
.pill {
  background: rgba(153, 204, 255, 0.15);
  color: #9cf;
  border: 0.0625rem solid rgba(153, 204, 255, 0.4);
  padding: 0.3125rem 0.9375rem;
  border-radius: 62.4375rem;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  font-family: 'Antonio', sans-serif;
  transition: all 0.3s ease;
  letter-spacing: 0.0625rem;
}

.pill:hover {
  background: rgba(153, 204, 255, 0.3);
  border-color: #9cf;
  color: #fff;
  box-shadow: 0 0 0.625rem rgba(153, 204, 255, 0.3);
}

/* game-status-overlay, confirm-sub, confirm-actions, confirm-btn, abort-btn shared via gameLanding.css */

/* Modal */
.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(0.25rem);
}

.modal-content {
  background: #1a1a2e;
  padding: 1.875rem;
  border-radius: 1.25rem;
  border: 0.125rem solid #ffc400;
  text-align: center;
  box-shadow: 0 0 3.125rem rgba(0, 0, 0, 0.5);
}

.modal-content h3 {
  font-family: 'Antonio', sans-serif;
  color: #ffc400;
  margin-top: 0;
  margin-bottom: 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.125rem;
}

.promotion-options {
  display: flex;
  gap: 0.9375rem;
  justify-content: center;
}

@media (max-width: 50rem) {
  .chess-board {
    width: 90vw;
    height: 90vw;
  }
}

@keyframes pulse-last-move {
  0% {
    background-color: rgba(130, 150, 185, 0.5);
    box-shadow: inset 0 0 0.3125rem rgba(255, 255, 255, 0.2);
  }
  100% {
    background-color: rgba(130, 150, 185, 0.9);
    box-shadow: inset 0 0 1.25rem rgba(255, 255, 255, 0.4);
  }
}
</style>