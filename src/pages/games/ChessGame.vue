<template>
  <div class="chess-game-container" :class="{ show: isVisible }">

    <!-- ── Full-width header bar spanning all three columns ── -->
    <div class="game-header-bar">

      <!-- Left: Join Code — always visible, greyed in single-player -->
      <div class="header-bar-left">
        <div
          v-if="currentVariant !== 'standard'"
          class="status-box variant-badge-box"
          :style="{ '--variant-color': variantBadgeColor }"
        >
          <span class="label">VARIANT</span>
          <span class="value variant-value">{{ variantBadge }}</span>
        </div>
        <div class="status-box join-code-box" :class="{ 'join-code-inactive': !isMultiplayer }">
          <span class="label">JOIN CODE</span>
          <span class="value code-value">{{ joinCode || '——' }}</span>
        </div>
      </div>

      <!-- Center: logo (click to return to /games) -->
      <div class="header-bar-center">
        <div class="logo-wrapper" @click="goToGames">
          <img :src="chessLogo" alt="Chess" class="game-logo-small" />
        </div>
      </div>

      <!-- Right: Reset button -->
      <div class="header-bar-right">
        <button @click="resetGame" class="pill reset-btn board-reset-btn">Reset</button>
      </div>

    </div><!-- /.game-header-bar -->

    <!-- ── Three columns row ── -->
    <div class="columns-row">

      <!-- White Column (left) -->
      <div class="player-column white-column">
        <div class="status-box turn-indicator" :class="turnColor === 'WHITE' ? 'white-turn' : 'idle-turn'">
          <span class="label">{{ isMultiplayer && playerColor === 'white' ? 'WHITE (YOU)' : 'WHITE' }}</span>
          <span class="value">{{ turnColor === 'WHITE' ? 'ACTIVE' : '—' }}</span>
        </div>
        <!-- Black pieces captured by White (standard variants) -->
        <div class="captured-pieces" v-if="!isCrazyhouse">
          <template v-for="pt in CAPTURE_ORDER" :key="'wc-' + pt">
            <span
              v-for="i in whiteCaptured[pt]"
              :key="pt + '-' + i"
              class="cap-piece cap-white"
            >{{ PIECE_UNICODE[pt].w }}</span>
          </template>
          <span class="cap-empty" v-if="!hasCaptured(whiteCaptured)">—</span>
        </div>
        <!-- Crazyhouse: White's pocket -->
        <div class="column-pocket" v-if="isCrazyhouse" :class="{ 'active-pocket': turnColor === 'WHITE' }">
          <div class="pocket-label">IN HAND</div>
          <div class="column-pocket-pieces">
            <template v-for="type in POCKET_PIECE_ORDER" :key="'w-' + type">
              <button
                v-if="pocketStore.white[type] > 0"
                class="pocket-piece-btn white-piece"
                :class="{ selected: selectedDropPiece?.type === type && selectedDropPiece?.color === 'w' }"
                :disabled="!canDropWhite"
                @click="toggleDropPiece('w', type as PocketPieceType)"
              >
                <span class="piece-icon">{{ PIECE_UNICODE[type as PocketPieceType].w }}</span>
                <span class="piece-count" v-if="pocketStore.white[type] > 1">×{{ pocketStore.white[type] }}</span>
              </button>
            </template>
            <span class="pocket-empty" v-if="!hasPocketPieces('w')">—</span>
          </div>
          <span class="pocket-hint" v-if="!hasPocketPieces('w')">capture to fill</span>
          <span v-if="selectedDropPiece?.color === 'w'" class="drop-mode-label">DROP MODE</span>
        </div>
        <button
          v-if="!showGameOver && moveCount > 0 && (!isMultiplayer || playerColor === 'white')"
          class="pill forfeit-btn"
          @click="forfeitGame('white')"
        >Forfeit</button>
      </div>

      <!-- Board center -->
      <div class="board-center">

        <!-- Board + optional Crazyhouse pocket side-by-side -->
        <div class="main-game-area">

          <div class="chess-board-wrapper">
            <div ref="boardRef" class="chess-board cg-hologram"></div>

            <!-- Drop-mode overlay -->
            <div
              v-if="selectedDropPiece"
              class="drop-overlay"
              @click.stop="onDropOverlayClick"
              @touchend.stop.prevent="onDropOverlayTouch"
            ></div>

            <!-- Multiplayer Error Message -->
            <div v-if="multiplayerError" class="multiplayer-error-overlay">
              {{ multiplayerError }}
            </div>
          </div>

        </div><!-- /.main-game-area -->

        <!-- Promotion Modal — overlays the board area -->
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

      </div><!-- /.board-center -->

      <!-- Black Column (right) -->
      <div class="game-header player-column black-column">
        <div class="status-box turn-indicator" :class="turnColor === 'BLACK' ? 'black-active' : 'idle-turn'">
          <span class="label">{{ isMultiplayer && playerColor === 'black' ? 'BLACK (YOU)' : 'BLACK' }}</span>
          <span class="value">{{ turnColor === 'BLACK' ? 'ACTIVE' : '—' }}</span>
        </div>

        <!-- White pieces captured by Black (standard variants) -->
        <div class="captured-pieces" v-if="!isCrazyhouse">
          <template v-for="pt in CAPTURE_ORDER" :key="'bc-' + pt">
            <span
              v-for="i in blackCaptured[pt]"
              :key="pt + '-' + i"
              class="cap-piece cap-black"
            >{{ PIECE_UNICODE[pt].b }}</span>
          </template>
          <span class="cap-empty" v-if="!hasCaptured(blackCaptured)">—</span>
        </div>
        <!-- Crazyhouse: Black's pocket -->
        <div class="column-pocket" v-if="isCrazyhouse" :class="{ 'active-pocket': turnColor === 'BLACK' }">
          <div class="pocket-label">IN HAND</div>
          <div class="column-pocket-pieces">
            <template v-for="type in POCKET_PIECE_ORDER" :key="'b-' + type">
              <button
                v-if="pocketStore.black[type] > 0"
                class="pocket-piece-btn black-piece"
                :class="{ selected: selectedDropPiece?.type === type && selectedDropPiece?.color === 'b' }"
                :disabled="!canDropBlack"
                @click="toggleDropPiece('b', type as PocketPieceType)"
              >
                <span class="piece-icon">{{ PIECE_UNICODE[type as PocketPieceType].b }}</span>
                <span class="piece-count" v-if="pocketStore.black[type] > 1">×{{ pocketStore.black[type] }}</span>
              </button>
            </template>
            <span class="pocket-empty" v-if="!hasPocketPieces('b')">—</span>
          </div>
          <span class="pocket-hint" v-if="!hasPocketPieces('b')">capture to fill</span>
          <span v-if="selectedDropPiece?.color === 'b'" class="drop-mode-label">DROP MODE</span>
        </div>

        <div class="header-left">
          <div class="status-box" v-if="gameStatus">
            <span class="label">STATUS</span>
            <span class="value status-text">{{ gameStatus }}</span>
          </div>
        </div>
        <button
          v-if="!showGameOver && moveCount > 0 && (!isMultiplayer || playerColor === 'black')"
          class="pill forfeit-btn"
          @click="forfeitGame('black')"
        >Forfeit</button>

      </div><!-- /.black-column -->

    </div><!-- /.columns-row -->

    <!-- Session Restore Modal (fixed, overlays everything) -->
    <div v-if="showSessionModal" class="game-status-overlay session-restore">
      <h2>SESSION FOUND</h2>
      <p class="confirm-sub">You have a {{ savedVariantLabel }} game in progress.</p>
      <div class="confirm-actions">
        <button @click="continueSavedSession" class="pill confirm-btn">CONTINUE SESSION</button>
        <button @click="startNewLocalGame" class="pill abort-btn">NEW GAME</button>
      </div>
    </div>

    <!-- Confirmation Modal (fixed, overlays everything) -->
    <div v-if="showConfirm" class="game-status-overlay confirmation">
      <h2>{{ confirmMessage }}</h2>
      <p class="confirm-sub">{{ confirmSubtext }}</p>
      <div class="confirm-actions">
        <button @click="handleConfirm" class="pill confirm-btn">PROCEED</button>
        <button @click="handleCancel" class="pill abort-btn">ABORT</button>
      </div>
    </div>

    <!-- Game Over Modal (fixed, overlays everything) -->
    <div v-if="showGameOver" class="game-status-overlay game-over" :class="gameOverType">
      <h2>{{ gameOverMessage }}</h2>
      <p class="confirm-sub">{{ gameOverSubtext }}</p>
      <div class="confirm-actions">
        <button @click="resetGame" class="pill confirm-btn">PLAY AGAIN</button>
        <button @click="goToVariantChooser" class="pill abort-btn">NEW VARIANT</button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import { useMultiplayer } from '@/composables/useMultiplayer';
import { useGameScores } from '@/composables/useGameScores';
import { useActivityLog } from '@/composables/useActivityLog.js';
import { useChessPieceTheme } from '@/composables/useChessPieceTheme';
import { generateChess960FEN, is960FEN } from '@/utils/chess960';
import {
  POCKET_PIECE_ORDER,
  PIECE_UNICODE,
  type PocketPieceType,
  type PocketStore,
  emptyPocketStore,
} from '@/utils/crazyhouse';
import {
  type ChessVariant,
  createPosition, getFen, pocketToStore, getDropDestsForPiece, detectCapture,
  chessgroundDests,
  parseSquare, makeSquare, charToRole, roleToChar, opposite,
  INITIAL_FEN, VARIANT_LABELS, VARIANT_BADGES, VARIANT_BADGE_COLORS,
} from '@/utils/chess-variants';
import type { Position, NormalMove, DropMove, Role } from '@/utils/chess-variants';
import chessLogo from '@/assets/images/games/title-chess.svg';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import soundError from '@/assets/sounds/SFX-Computer/inputfailed1.wav';

// Import Chessground styles
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';

const router = useRouter();
const route = useRoute();
const boardRef = ref<HTMLElement | null>(null);
let pos: Position = createPosition('standard');
let cgApi: Api | null = null;
const isVisible = ref(false);

// ── Variant state ──────────────────────────────────────────────────────────
const currentVariant = ref<ChessVariant>('standard');
const isCrazyhouse = computed(() => currentVariant.value === 'crazyhouse');
const is960       = computed(() => currentVariant.value === '960');

// Variant display helpers
const variantBadge      = computed(() => VARIANT_BADGES[currentVariant.value]);
const variantBadgeColor = computed(() => VARIANT_BADGE_COLORS[currentVariant.value]);

// Used for activity logging and mission matching
const chessVariant = computed(() => currentVariant.value);

// The FEN this game session started from — used to confirm resets / detect variant.
const sessionStartFEN = ref(INITIAL_FEN);

// ── Move / history tracking ────────────────────────────────────────────────
const moveCount  = ref(0);
const fenHistory = ref<string[]>([]); // position-only FEN fragments for threefold rep

// ── Pocket state (Crazyhouse) ──────────────────────────────────────────────
const pocketStore       = ref<PocketStore>(emptyPocketStore());
const selectedDropPiece = ref<{ type: PocketPieceType; color: 'w' | 'b' } | null>(null);

// ── Captured pieces tracking ───────────────────────────────────────────────
// Shown in the player columns for standard / 960 games only.
// whiteCaptured = Black pieces taken by White; blackCaptured = White pieces taken by Black.
type CaptureSet = Record<PocketPieceType, number>
const CAPTURE_ORDER: PocketPieceType[] = ['q', 'r', 'b', 'n', 'p']
function emptyCaptureSet(): CaptureSet { return { p: 0, n: 0, b: 0, r: 0, q: 0 } }
const whiteCaptured = ref<CaptureSet>(emptyCaptureSet())
const blackCaptured = ref<CaptureSet>(emptyCaptureSet())
function hasCaptured(set: CaptureSet): boolean {
  return CAPTURE_ORDER.some(pt => set[pt] > 0)
}

// ── Local session persistence ──────────────────────────────────────────────
// Saves state to localStorage after every move so students can navigate away
// and return to a "Continue Session / New Game" prompt.
// Active for pass-and-play only; multiplayer is driven by Firebase.
const LOCAL_SESSION_KEY = 'chessLocalSession'

interface LocalChessSession {
  fen: string         // Full position FEN (includes pocket notation for Crazyhouse)
  startFen: string
  variant: ChessVariant
  whiteCaptured: CaptureSet
  blackCaptured: CaptureSet
  fenHistory?: string[]
}

const showSessionModal = ref(false)
const pendingSession   = ref<LocalChessSession | null>(null)

const savedVariantLabel = computed(() =>
  pendingSession.value ? (VARIANT_LABELS[pendingSession.value.variant] ?? 'STANDARD') : 'STANDARD'
)

function saveLocalSession(): void {
  if (isMultiplayer.value) return
  if (showGameOver.value) { localStorage.removeItem(LOCAL_SESSION_KEY); return }
  const session: LocalChessSession = {
    fen: getFen(pos),            // includes pocket bracket notation for Crazyhouse
    startFen: sessionStartFEN.value,
    variant: currentVariant.value,
    whiteCaptured: { ...whiteCaptured.value },
    blackCaptured: { ...blackCaptured.value },
    fenHistory: [...fenHistory.value].slice(-30),
  }
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session))
}

function clearLocalSession(): void {
  localStorage.removeItem(LOCAL_SESSION_KEY)
}

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
const { logEvent }    = useActivityLog();
const { initTheme }   = useChessPieceTheme();
const gameStartLogged = ref(false);
const showConfirm     = ref(false);
const confirmMessage  = ref('');
const confirmSubtext  = ref('Current simulation progress will be lost.');
let confirmActionCallback: (() => void) | null = null;

// ── Crazyhouse: computed drop permissions ──────────────────────────────────
// Use turnColor (reactive ref) rather than pos.turn (non-reactive plain field).
const canDropWhite = computed(() => {
  if (turnColor.value !== 'WHITE') return false;
  if (isMultiplayer.value && playerColor.value !== 'white') return false;
  return true;
});

const canDropBlack = computed(() => {
  if (turnColor.value !== 'BLACK') return false;
  if (isMultiplayer.value && playerColor.value !== 'black') return false;
  return true;
});

// ── Crazyhouse: pocket helpers ─────────────────────────────────────────────
function hasPocketPieces(color: 'w' | 'b'): boolean {
  const pocket = color === 'w' ? pocketStore.value.white : pocketStore.value.black;
  return POCKET_PIECE_ORDER.some(t => pocket[t] > 0);
}

function cancelDrop() {
  selectedDropPiece.value = null;
  cgApi?.setAutoShapes([]);
}

function toggleDropPiece(color: 'w' | 'b', type: PocketPieceType) {
  if (selectedDropPiece.value?.type === type && selectedDropPiece.value?.color === color) {
    cancelDrop();
    return;
  }
  selectedDropPiece.value = { type, color };
  const role = charToRole(type)!;
  const dests = getDropDestsForPiece(pos, role);
  cgApi?.setAutoShapes(dests.map(sq => ({ orig: sq as any, brush: 'blue' })));
}

async function executeDrop(square: string) {
  if (!selectedDropPiece.value) return;
  const { type, color } = selectedDropPiece.value;

  const cgColor = color === 'w' ? 'white' : 'black';
  if (pos.turn !== cgColor) { cancelDrop(); return; }

  const role       = charToRole(type)!;
  const validDests = getDropDestsForPiece(pos, role);
  if (!validDests.includes(square as any)) { cancelDrop(); return; }

  // chessops plays the drop and automatically updates pos.pockets
  const sq: number = parseSquare(square)!;
  const move: DropMove = { role, to: sq };
  pos.play(move);
  moveCount.value++;

  pocketStore.value = pocketToStore(pos.pockets);
  cancelDrop();

  const newFen   = getFen(pos);
  const turnStr  = pos.turn === 'white' ? 'w' : 'b';
  const syntheticMove = { from: square, to: square, piece: type, color };

  if (isMultiplayer.value) {
    await submitMove(syntheticMove, newFen, turnStr);
  }

  cgApi?.set({
    fen: newFen,
    turnColor: pos.turn,
    movable: {
      color: isMultiplayer.value ? (playerColor.value || 'white') : pos.turn,
      dests: getDests(),
    },
    lastMove: [square as any, square as any],
    check: pos.isCheck(),
  });
  updateStatus();
  saveLocalSession();
}

function onDropOverlayClick(e: MouseEvent) {
  if (!cgApi || !selectedDropPiece.value || !boardRef.value) { cancelDrop(); return; }

  const cgBoardEl = boardRef.value.querySelector('cg-board') as HTMLElement | null;
  const rect      = (cgBoardEl ?? boardRef.value).getBoundingClientRect();

  const x    = e.clientX - rect.left;
  const y    = e.clientY - rect.top;
  const size = rect.width / 8;

  const fileIdx = Math.floor(x / size);
  const rankIdx = Math.floor(y / size);
  if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) { cancelDrop(); return; }

  const orientation = playerColor.value || 'white';
  const file = orientation === 'white' ? fileIdx : 7 - fileIdx;
  const rank = orientation === 'white' ? 7 - rankIdx : rankIdx;
  const sq   = 'abcdefgh'[file] + (rank + 1);

  executeDrop(sq);
}

function onDropOverlayTouch(e: TouchEvent) {
  const touch = e.changedTouches[0];
  if (!touch) { cancelDrop(); return; }
  onDropOverlayClick({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
}

// ── Game over overlay ──────────────────────────────────────────────────────
const showGameOver   = ref(false);
const gameOverMessage = ref('');
const gameOverSubtext = ref('');
const gameOverType   = ref<'win' | 'draw'>('win');

const showPromotionModal = ref(false);
let pendingMove: { from: string; to: string } | null = null;

// turnColor is the reactive source-of-truth for whose turn it is.
// pos.turn is a plain field (not reactive), so all template bindings go through here.
const turnColor = ref<'WHITE' | 'BLACK'>('WHITE');
const gameStatus = ref('');

function goToGames() { router.push('/games/chess'); }

/** Returns to the variant chooser pre-selecting the same mode (P&P or Host). */
function goToVariantChooser() {
  const mode = isMultiplayer.value ? 'host' : 'local';
  router.push(`/games/chess?relaunch=${mode}`);
}

function playSound(src: string) {
  try {
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {}
}

// ── Reset ──────────────────────────────────────────────────────────────────
function resetGame() {
  const action = async () => {
    // Chess 960 generates a fresh random position each reset.
    // All other variants use their canonical starting position.
    if (currentVariant.value === '960') {
      const newFen = generateChess960FEN();
      pos = createPosition('960', newFen);
      sessionStartFEN.value = newFen;
    } else {
      pos = createPosition(currentVariant.value);
      sessionStartFEN.value = getFen(pos);
    }

    showGameOver.value = false;
    moveCount.value    = 0;
    fenHistory.value   = [];

    if (isCrazyhouse.value) {
      pocketStore.value = pocketToStore(pos.pockets); // empty at game start
      cancelDrop();
    }
    whiteCaptured.value = emptyCaptureSet();
    blackCaptured.value = emptyCaptureSet();
    clearLocalSession();

    const boardFen = getFen(pos);
    const turnStr  = pos.turn === 'white' ? 'w' : 'b';

    if (isMultiplayer.value) {
      await resetRemoteGame(boardFen, turnStr, sessionStartFEN.value, false);
      cgApi?.set({
        fen: boardFen,
        turnColor: pos.turn,
        movable: { color: playerColor.value || 'white', dests: getDests() },
        lastMove: undefined,
        check: false,
      });
    } else {
      cgApi?.set({
        fen: boardFen,
        turnColor: pos.turn,
        movable: { color: pos.turn, dests: getDests() },
        lastMove: undefined,
        check: false,
      });
    }
    applyKothShapes();
    updateStatus();
  };

  // Never confirm when the game is already over — the user is on the game-over
  // screen and has nothing left to lose. The confirm dialog would open behind
  // the game-over overlay anyway (same z-index, later DOM order wins).
  const shouldConfirm = !showGameOver.value && (isMultiplayer.value
    ? !!(remoteRoom.value && ((remoteRoom.value.moveHistory?.length || 0) > 0
        || remoteRoom.value.boardState !== sessionStartFEN.value))
    : (moveCount.value > 0 && !pos.isEnd()));

  if (shouldConfirm) {
    confirmMessage.value  = 'ARE YOU SURE YOU WANT TO RESET?';
    confirmSubtext.value  = 'Current simulation progress will be lost.';
    confirmActionCallback = action;
    showConfirm.value     = true;
  } else {
    action();
  }
}

function handleConfirm() {
  showConfirm.value = false;
  if (confirmActionCallback) { confirmActionCallback(); confirmActionCallback = null; }
}

function handleCancel() {
  showConfirm.value = false;
  confirmActionCallback = null;
}

function forfeitGame(color: 'white' | 'black') {
  const winner = color === 'white' ? 'black' : 'white';
  confirmMessage.value = `${color.toUpperCase()} FORFEITS THE MATCH?`;
  confirmSubtext.value = `${winner.toUpperCase()} will be declared the winner.`;
  confirmActionCallback = () => {
    gameOverMessage.value = 'FORFEIT';
    gameOverSubtext.value = `${winner.toUpperCase()} WINS BY FORFEIT`;
    gameOverType.value    = 'win';
    showGameOver.value    = true;
    gameStatus.value      = '';
    clearLocalSession();
    playSound(soundSuccess);
    if (isMultiplayer.value) {
      // Record a loss for the forfeiting player on their own device.
      scoreComposable.autoLogCompletion(
        scoreComposable.myHighScore.value ?? 0, 'loss', { variant: chessVariant.value }
      );
    }
  };
  showConfirm.value = true;
}

function getDests() {
  return chessgroundDests(pos);
}

// ── King of the Hill: goal-square markers ─────────────────────────────────
// Stamps green circle highlights on the four center squares so students
// always know where the King needs to go. Called after every board init/reset.
// Safe to call for non-KOTH variants — it exits immediately.
const KOTH_GOAL_SQUARES = ['d4', 'e4', 'd5', 'e5'] as const;

function applyKothShapes() {
  if (currentVariant.value !== 'koth' || !cgApi) return;
  cgApi.setAutoShapes(
    KOTH_GOAL_SQUARES.map(sq => ({ orig: sq as any, brush: 'green' }))
  );
}

// ── Status / game-over detection ───────────────────────────────────────────
function updateStatus() {
  turnColor.value = pos.turn === 'white' ? 'WHITE' : 'BLACK';

  // Track position FEN (without clocks) for threefold-repetition detection
  const posFen = getFen(pos).split(' ').slice(0, 4).join(' ');
  fenHistory.value.push(posFen);

  const is50Move     = pos.halfmoves >= 100;
  const isRepetition = fenHistory.value.filter(f => f === posFen).length >= 3;
  const isInsuff     = pos.isInsufficientMaterial();

  // ── Chessops detects game-over for all variants ──────────────────────────
  if (pos.isEnd()) {
    const outcome = pos.outcome();
    const winner  = outcome?.winner; // 'white' | 'black' | undefined

    if (winner) {
      const winnerUpper = winner.toUpperCase();
      gameOverMessage.value = getVariantWinMessage(currentVariant.value);
      gameOverSubtext.value = `${winnerUpper} WINS THE SIMULATION`;
      gameOverType.value    = 'win';
      if (!showGameOver.value) {
        playSound(soundSuccess);
        // Only log for multiplayer — pass-and-play doesn't count for assignments.
        if (isMultiplayer.value) {
          if (playerColor.value?.toUpperCase() === winnerUpper) {
            scoreComposable.incrementScore({ variant: chessVariant.value });
          } else {
            scoreComposable.autoLogCompletion(
              scoreComposable.myHighScore.value ?? 0, 'loss', { variant: chessVariant.value }
            );
          }
        }
      }
    } else {
      // Draw by game-over (stalemate, variant-specific draw)
      gameOverMessage.value = 'SIMULATION ENDED';
      gameOverSubtext.value = getVariantDrawReason(currentVariant.value, pos);
      gameOverType.value    = 'draw';
      if (!showGameOver.value) {
        playSound(soundError);
        // Only log for multiplayer — pass-and-play doesn't count for assignments.
        if (isMultiplayer.value) {
          scoreComposable.autoLogCompletion(
            scoreComposable.myHighScore.value ?? 0, 'draw', { variant: chessVariant.value }
          );
        }
      }
    }
    showGameOver.value = true;
    gameStatus.value   = '';
    return;
  }

  // ── Non-game-over draw conditions ────────────────────────────────────────
  if (isRepetition || is50Move || isInsuff) {
    gameOverMessage.value = 'SIMULATION ENDED';
    if (isRepetition)  gameOverSubtext.value = 'DRAW - THREEFOLD REPETITION';
    else if (isInsuff) gameOverSubtext.value = 'DRAW - INSUFFICIENT MATERIAL';
    else               gameOverSubtext.value = 'DRAW - 50-MOVE RULE';
    gameOverType.value    = 'draw';
    if (!showGameOver.value) {
      playSound(soundError);
      // Only log for multiplayer — pass-and-play doesn't count for assignments.
      if (isMultiplayer.value) {
        scoreComposable.autoLogCompletion(
          scoreComposable.myHighScore.value ?? 0, 'draw', { variant: chessVariant.value }
        );
      }
    }
    showGameOver.value = true;
    gameStatus.value   = '';
    return;
  }

  showGameOver.value = false;

  // Variant-specific status text
  if (currentVariant.value === 'threecheck' && pos.remainingChecks) {
    const r = pos.remainingChecks;
    gameStatus.value = pos.isCheck()
      ? `CHECK · W:${r.white} B:${r.black}`
      : `W:${r.white} B:${r.black}`;
  } else {
    gameStatus.value = pos.isCheck() ? 'CHECK' : '';
  }
}

function getVariantWinMessage(variant: ChessVariant): string {
  switch (variant) {
    case 'koth':        return 'HILL CONQUERED';
    case 'threecheck':  return 'THREE CHECKS';
    case 'antichess':   return 'FREEDOM ACHIEVED';
    case 'racingkings': return 'RACE COMPLETE';
    default:            return 'CHECKMATE';
  }
}

function getVariantDrawReason(variant: ChessVariant, p: Position): string {
  if (variant === 'racingkings') return 'DRAW - BOTH KINGS REACHED';
  if (variant === 'antichess')   return 'STALEMATE';
  return p.isCheck() ? 'STALEMATE' : 'STALEMATE - NO LEGAL MOVES';
}

// ── Move handling ──────────────────────────────────────────────────────────
async function onMove(orig: string, dest: string) {
  const fromSq = parseSquare(orig);
  const toSq   = parseSquare(dest);
  if (fromSq === undefined || toSq === undefined) return;

  // Promotion detection (pawn reaching the back rank)
  const piece = pos.board.get(fromSq);
  const isPromotion = piece?.role === 'pawn' && (
    (piece.color === 'white' && dest[1] === '8') ||
    (piece.color === 'black' && dest[1] === '1')
  );
  if (isPromotion) {
    pendingMove = { from: orig, to: dest };
    showPromotionModal.value = true;
    return;
  }

  const move: NormalMove = { from: fromSq, to: toSq };
  const capturedRole  = detectCapture(pos, move); // must check before play()
  const movingColor   = pos.turn;

  pos.play(move);
  moveCount.value++;

  // Track captures for the captured-pieces columns (non-Crazyhouse only)
  if (!isCrazyhouse.value && capturedRole && capturedRole !== 'king') {
    const side = movingColor === 'white' ? whiteCaptured : blackCaptured;
    const pt   = roleToChar(capturedRole) as PocketPieceType;
    side.value = { ...side.value, [pt]: side.value[pt] + 1 };
  }
  // Sync pocket for Crazyhouse (chessops updates pos.pockets automatically)
  if (isCrazyhouse.value) pocketStore.value = pocketToStore(pos.pockets);

  const newFen  = getFen(pos);
  const turnStr = pos.turn === 'white' ? 'w' : 'b';

  if (isMultiplayer.value) {
    await submitMove({ from: orig, to: dest }, newFen, turnStr);
  }

  cgApi?.set({
    fen: newFen,
    turnColor: pos.turn,
    movable: {
      color: isMultiplayer.value ? (playerColor.value || 'white') : pos.turn,
      dests: getDests(),
    },
    check: pos.isCheck(),
  });
  updateStatus();
  saveLocalSession();
}

async function promote(promotion: string) {
  if (!pendingMove) return;

  const fromSq    = parseSquare(pendingMove.from)!;
  const toSq      = parseSquare(pendingMove.to)!;
  const promoRole = charToRole(promotion as any)!;
  const move: NormalMove = { from: fromSq, to: toSq, promotion: promoRole };

  const capturedRole = detectCapture(pos, move);
  const movingColor  = pos.turn;

  pos.play(move);
  moveCount.value++;

  if (!isCrazyhouse.value && capturedRole && capturedRole !== 'king') {
    const side = movingColor === 'white' ? whiteCaptured : blackCaptured;
    const pt   = roleToChar(capturedRole) as PocketPieceType;
    side.value = { ...side.value, [pt]: side.value[pt] + 1 };
  }
  if (isCrazyhouse.value) pocketStore.value = pocketToStore(pos.pockets);

  const newFen  = getFen(pos);
  const turnStr = pos.turn === 'white' ? 'w' : 'b';

  if (isMultiplayer.value) {
    await submitMove({ from: pendingMove.from, to: pendingMove.to, promotion }, newFen, turnStr);
  }

  cgApi?.set({
    fen: newFen,
    turnColor: pos.turn,
    movable: {
      color: isMultiplayer.value ? (playerColor.value || 'white') : pos.turn,
      dests: getDests(),
    },
    check: pos.isCheck(),
  });
  updateStatus();
  saveLocalSession();

  pendingMove = null;
  showPromotionModal.value = false;
}

// ── Board / session helpers ────────────────────────────────────────────────

/** Creates (or recreates) the Chessground instance from the current position. */
function initBoardInstance(): void {
  if (!boardRef.value) return;
  const config: Config = {
    fen: getFen(pos),
    orientation: playerColor.value || 'white',
    turnColor: pos.turn,
    movable: {
      color: isMultiplayer.value ? (playerColor.value || 'white') : pos.turn,
      free: false,
      dests: getDests(),
    },
    events: { move: onMove },
    draggable: { enabled: false },
    selectable: { enabled: true },
    addGhostPiece: true,
    highlight: { lastMove: true, check: true },
  };
  cgApi = Chessground(boardRef.value, config);
  applyKothShapes();
}

/** Reads variant / FEN from URL query params and initialises the position. */
function applyRouteVariant(): void {
  const variantParam = route.query.variant as string | undefined;
  const fenParam     = route.query.fen    as string | undefined;

  if (variantParam === '960' && fenParam) {
    const fen = decodeURIComponent(fenParam);
    currentVariant.value  = '960';
    pos                   = createPosition('960', fen);
    sessionStartFEN.value = fen;
  } else if (variantParam && variantParam !== 'standard') {
    currentVariant.value  = variantParam as ChessVariant;
    pos                   = createPosition(currentVariant.value);
    sessionStartFEN.value = getFen(pos);
  } else {
    currentVariant.value  = 'standard';
    pos                   = createPosition('standard');
    sessionStartFEN.value = INITIAL_FEN;
  }
}

/** User chose to pick up where they left off. */
function continueSavedSession(): void {
  const s = pendingSession.value;
  if (!s) { startNewLocalGame(); return; }

  showSessionModal.value = false;
  currentVariant.value   = s.variant;

  // createPosition parses bracket pocket notation for Crazyhouse automatically
  pos                   = createPosition(s.variant, s.fen);
  sessionStartFEN.value = s.startFen;
  moveCount.value       = 1;   // signal that moves have been made (for reset confirm)

  if (isCrazyhouse.value) pocketStore.value = pocketToStore(pos.pockets);
  whiteCaptured.value = s.whiteCaptured ?? emptyCaptureSet();
  blackCaptured.value = s.blackCaptured ?? emptyCaptureSet();
  if (s.fenHistory) fenHistory.value = s.fenHistory;

  logEvent('game_start', { gameId: 'chess', variant: chessVariant.value });
  gameStartLogged.value = true;
  initBoardInstance();
  updateStatus();
}

/** User chose to discard the saved session and start fresh. */
function startNewLocalGame(): void {
  showSessionModal.value = false;
  clearLocalSession();
  applyRouteVariant();
  logEvent('game_start', { gameId: 'chess', variant: chessVariant.value });
  gameStartLogged.value = true;
  initBoardInstance();
  updateStatus();
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
  initTheme();
  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  requestAnimationFrame(() => { isVisible.value = true; });

  if (route.query.mode === 'online') {
    // Multiplayer: Firebase drives state, no local session needed.
    // Do NOT initialise the board here — the remoteRoom watch does it on
    // the first Firestore snapshot so the variant is always read from the
    // authoritative room document rather than guessed from the URL.
    await tryReconnect('chess');
  } else {
    // Local (pass-and-play)
    resetState();

    // Board init is deferred to the handler so there's no flash of the
    // start position before the saved state is applied.
    let savedSession: LocalChessSession | null = null;
    const savedRaw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (savedRaw) {
      try {
        const s = JSON.parse(savedRaw) as LocalChessSession;
        // Only restore if moves have been made AND the saved variant matches
        // the variant the student is trying to launch.  Without this check a
        // saved Standard game would silently replace Crazyhouse (or any other
        // variant), making it appear as though the variant was ignored.
        const urlVariant = (route.query.variant as string) || 'standard';
        if (s?.fen && s.startFen && s.fen !== s.startFen && s.variant === urlVariant) {
          savedSession = s;
        }
      } catch {}
    }

    if (savedSession) {
      pendingSession.value  = savedSession;
      showSessionModal.value = true;
    } else {
      applyRouteVariant();
      logEvent('game_start', { gameId: 'chess', variant: chessVariant.value });
      gameStartLogged.value = true;
      initBoardInstance();
      updateStatus();
    }
  }
});

// ── Multiplayer remote-update watch ───────────────────────────────────────
watch(remoteRoom, (newRoom) => {
  if (!newRoom) return;

  // ── Step 1: sync variant from the room document (authoritative source) ──
  // This MUST happen before pos/board init so the correct variant is used.
  if (newRoom.variant && (newRoom.variant as ChessVariant) !== currentVariant.value) {
    currentVariant.value = newRoom.variant as ChessVariant;
  }

  // Detect Chess 960 from startFen — only as a fallback for legacy rooms that
  // don't carry an explicit `variant` field.  For rooms that DO have a variant
  // (e.g. 'horde') we must NOT infer '960' just because the FEN differs from
  // the standard starting position — every non-standard variant does that.
  if (newRoom.startFen && newRoom.startFen !== sessionStartFEN.value) {
    sessionStartFEN.value = newRoom.startFen;
    if (!newRoom.variant && is960FEN(newRoom.startFen) && currentVariant.value !== '960') {
      currentVariant.value = '960';
    }
  }

  // Fire game_start once when both players have joined
  if (!gameStartLogged.value && newRoom.players?.white && newRoom.players?.black) {
    gameStartLogged.value = true;
    logEvent('game_start', { gameId: 'chess', variant: chessVariant.value });
  }

  // ── Step 2: build the position from the room's board state ─────────────
  try {
    pos = createPosition(currentVariant.value, newRoom.boardState);
  } catch {
    pos = createPosition(currentVariant.value);
  }

  // ── Step 3: initialise the board on the very first snapshot ────────────
  // The board is NOT initialised in onMounted for online games so that the
  // variant is always sourced from the room document, not guessed from the
  // URL.  Both the host (who has the variant in the URL) and the joiner
  // (who may not) are handled identically this way.
  if (!cgApi) {
    // Sync Crazyhouse pocket before init so the UI is correct immediately.
    if (isCrazyhouse.value) {
      if (pos.pockets) pocketStore.value = pocketToStore(pos.pockets);
      else if (newRoom.pocket) pocketStore.value = newRoom.pocket as PocketStore;
    }
    initBoardInstance();
    return; // initBoardInstance already renders the current pos
  }

  // Sync pocket for Crazyhouse (subsequent snapshots)
  if (isCrazyhouse.value) {
    if (pos.pockets) {
      pocketStore.value = pocketToStore(pos.pockets);
    } else if (newRoom.pocket) {
      // Legacy rooms store pockets separately
      pocketStore.value = newRoom.pocket as PocketStore;
    }
  }

  // Replay move history to reconstruct the captured-pieces display
  if (!isCrazyhouse.value) {
    const wc = emptyCaptureSet();
    const bc = emptyCaptureSet();
    if (newRoom.moveHistory?.length > 0) {
      try {
        let tmpPos = createPosition(currentVariant.value, newRoom.startFen ?? INITIAL_FEN);
        for (const m of newRoom.moveHistory) {
          if (m.from === m.to) continue; // skip Crazyhouse drop synthetics
          const fromSq = parseSquare(m.from);
          const toSq   = parseSquare(m.to);
          if (fromSq === undefined || toSq === undefined) continue;
          const mv: NormalMove = { from: fromSq, to: toSq };
          if (m.promotion) {
            const pr = charToRole(m.promotion);
            if (pr) (mv as any).promotion = pr;
          }
          const capturedRole = detectCapture(tmpPos, mv);
          const movingColor  = tmpPos.turn;
          tmpPos.play(mv);
          if (capturedRole && capturedRole !== 'king') {
            const pt = roleToChar(capturedRole) as PocketPieceType;
            if (movingColor === 'white') wc[pt]++;
            else                         bc[pt]++;
          }
        }
      } catch {}
    }
    whiteCaptured.value = wc;
    blackCaptured.value = bc;
  }

  cgApi?.set({
    fen: getFen(pos),
    turnColor: pos.turn,
    movable: {
      color: isMultiplayer.value ? (playerColor.value || 'white') : pos.turn,
      dests: getDests(),
    },
    check: pos.isCheck(),
    lastMove: newRoom.moveHistory?.length > 0 ? [
      newRoom.moveHistory[newRoom.moveHistory.length - 1].from,
      newRoom.moveHistory[newRoom.moveHistory.length - 1].to,
    ] : undefined,
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
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  gap: 0.9375rem;
  opacity: 0;
  transform: translateY(0.375rem);
  transition: opacity 1s ease, transform 1s ease;
  width: 100%;
  /*
   * --board-size drives the chess board dimensions so the whole game fits
   * on screen without scrolling.  98vh matches the app's wrap-everything
   * height; 20rem accounts for the topbar (12.5rem) + gap-row margin +
   * chess header-bar + board margins.  clamp() keeps the board between a
   * playable minimum and the original 600px maximum.
   */
  --board-size: clamp(16rem, calc(98vh - 20rem), 37.5rem);
}

.chess-game-container.show {
  opacity: 1;
  transform: none;
}

/* ─── Outer container — now a column so the header bar sits above the columns ── */
.chess-game-container {
  flex-direction: column;
  align-items: center;
}

/* ─── Full-width header bar ─────────────────────────────────────────────── */
.game-header-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  //background: rgba(20, 30, 40, 0.6);
  //outline: 0.0625rem solid rgba(170, 210, 255, 0.4);
  border-radius: 0.75rem;
  //backdrop-filter: blur(0.625rem);
  //box-shadow: 0 0 2.5rem rgba(0, 0, 0, 0.6), inset 0 0 1.25rem rgba(153, 204, 255, 0.05);
  padding: 0.45rem 0.9rem;
}

.header-bar-left,
.header-bar-right {
  flex: 1;
  display: flex;
  align-items: center;
}

.header-bar-right {
  justify-content: flex-end;
}

.header-bar-center {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Join code — always rendered, greyed when single-player */
.join-code-box {
  //min-width: unset;
  margin-left: 1.5rem;
  padding: 0.3rem 0.7rem;
  transition: opacity 0.3s ease, filter 0.3s ease;
}

.join-code-box.join-code-inactive {
  opacity: 0.28;
  filter: grayscale(0.6);
}

/* Logo in the header bar */
.logo-wrapper {
  justify-content: center;
  cursor: pointer;
  filter: drop-shadow(0 0 0.5rem rgba(153, 204, 255, 0.25));
  transition: transform 0.2s ease;
}
.logo-wrapper:hover { transform: scale(1.05); }

.game-logo-small {
  height: 1.75rem;
  width: auto;
  display: block;
}

/* Reset in the header bar */
.board-reset-btn {
  font-size: 0.8rem !important;
  padding: 0.3rem 1.25rem !important;
  min-width: unset !important;
  letter-spacing: 0.08rem;
}

/* ─── Three columns row ─────────────────────────────────────────────────── */
.columns-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0.9375rem;
  width: 100%;
  justify-content: center;
}

/* Shared glass-panel — both player columns */
.player-column {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 0.6rem;
  width: 8.5rem;
  min-width: 8.5rem;
  align-self: stretch;
  background: rgba(20, 30, 40, 0.6);
  outline: 0.0625rem solid rgba(170, 210, 255, 0.4);
  border-radius: 0.75rem;
  backdrop-filter: blur(0.625rem);
  box-shadow: 0 0 2.5rem rgba(0, 0, 0, 0.6), inset 0 0 1.25rem rgba(153, 204, 255, 0.05);
  padding: 0.75rem 0.5rem;
}

/* Right column overrides gameLanding.css horizontal game-header */
.game-header {
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  margin-bottom: 0;
  width: 8.5rem;
  min-width: 8.5rem;
  padding: 0.75rem 0.5rem;
  background: rgba(20, 30, 40, 0.6);
  outline: 0.0625rem solid rgba(170, 210, 255, 0.4);
  border-radius: 0.75rem;
  backdrop-filter: blur(0.625rem);
  box-shadow: 0 0 2.5rem rgba(0, 0, 0, 0.6), inset 0 0 1.25rem rgba(153, 204, 255, 0.05);
}

/* Board center — just the board, no logo or reset anymore */
.board-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.header-left,
.header-right {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.6rem;
  width: auto;
}

.header-right {
  margin-top: auto;
}

.status-box {
  //min-width: unset;
  //width: 100%;
  padding: 0.4rem 0.5rem;
}

/* ─── Turn indicators ───────────────────────────────────────────────────── */

/* Column title (WHITE / BLACK) — larger and more prominent than status text */
.turn-indicator .label {
  font-size: 1.15rem !important;
  letter-spacing: 0.12rem;
  margin-bottom: 0.05rem;
}

/* Status text (ACTIVE / —) — smaller, secondary */
.turn-indicator .value {
  font-size: 0.7rem !important;
  letter-spacing: 0.1rem;
  opacity: 0.85;
}

/* White column active */
.status-box.white-turn {
  background: rgba(130, 150, 185, 1) !important;
  border: 0.125rem solid #ffc400;
  box-shadow: 0 0 1.25rem rgba(255, 255, 255, 0.4);
}
.status-box.white-turn .label { color: #ffc400; opacity: 1; }
.status-box.white-turn .value { color: #fff; text-shadow: none; }

/* Black column active */
.status-box.black-active {
  background: rgba(30, 50, 80, 1) !important;
  border: 0.125rem solid #99ccff;
  box-shadow: 0 0 1.25rem rgba(153, 204, 255, 0.45);
}
.status-box.black-active .label { color: #99ccff; opacity: 1; }
.status-box.black-active .value { color: #fff; text-shadow: none; }

/* Inactive — same box, just quiet */
.status-box.idle-turn {
  background: rgba(20, 30, 40, 0.35) !important;
  border-color: rgba(153, 204, 255, 0.15);
  box-shadow: none;
  opacity: 0.5;
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
  width: var(--board-size);
  height: var(--board-size);
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

/* ─── Captured pieces display ────────────────────────────────────────────── */
.captured-pieces {
  display: flex;
  flex-wrap: wrap;
  gap: 0.08rem 0.04rem;
  padding: 0.3rem 0.25rem;
  min-height: 1.75rem;
  align-content: flex-start;
}

.cap-piece {
  font-size: 3rem;
  line-height: 1;
  display: inline-block;
}

/* Vibrant / bright treatment — used for White pieces in Black's column */
.cap-black {
  filter: drop-shadow(0 0.05rem 0.15rem rgba(153, 204, 255, 0.25));
}

/* Muted / darker treatment — used for Black pieces in White's column */
.cap-white {
  opacity: 0.88;
  filter: drop-shadow(0 0.05rem 0.15rem rgba(0, 0, 0, 0.55));
}

.cap-empty {
  color: rgba(153, 204, 255, 0.18);
  font-size: 0.85rem;
  padding: 0.15rem 0.2rem;
  font-family: 'Antonio', sans-serif;
}

@media (max-width: 50rem) {
  .chess-game-container {
    flex-direction: column;
    align-items: center;
  }

  .player-column,
  .game-header {
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
    min-width: unset;
    align-self: auto;
  }

  .header-right {
    margin-top: 0;
  }

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

/* ── Variant badge (all variants) — colour driven by --variant-color ──── */
.variant-badge-box {
  border-color: var(--variant-color, #ffc400) !important;
  background: color-mix(in srgb, var(--variant-color, #ffc400) 8%, transparent) !important;
}

.variant-badge-box .label {
  color: var(--variant-color, #ffc400) !important;
}

.variant-value {
  color: var(--variant-color, #ffc400) !important;
  font-size: 1.1rem !important;
  letter-spacing: 0.05rem;
}

/* ── Forfeit button ──────────────────────────────────────────────────── */
.forfeit-btn {
  margin-top: auto;
  font-size: 0.72rem !important;
  padding: 0.28rem 0.75rem !important;
  letter-spacing: 0.06rem;
  border-color: rgba(244, 67, 54, 0.3) !important;
  color: rgba(244, 67, 54, 0.55) !important;
  background: rgba(244, 67, 54, 0.05) !important;
  min-width: auto;
  transition: border-color 0.18s, color 0.18s, background 0.18s, box-shadow 0.18s !important;
}

.forfeit-btn:hover {
  border-color: rgba(244, 67, 54, 0.7) !important;
  color: #f44336 !important;
  background: rgba(244, 67, 54, 0.12) !important;
  box-shadow: 0 0 0.5rem rgba(244, 67, 54, 0.2) !important;
}

/* ── Board flex wrapper ───────────────────────────────────────────────── */
.main-game-area {
  display: flex;
  align-items: stretch;
  gap: 0.6rem;
}

/* ── Crazyhouse column pocket ─────────────────────────────────────────── */
.column-pocket {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.35rem 0.25rem;
  border-radius: 0.5rem;
  outline: 0.0625rem solid transparent;
  transition: background 0.2s, outline-color 0.2s;
}

.column-pocket.active-pocket {
  background: rgba(153, 204, 255, 0.07);
  outline-color: rgba(153, 204, 255, 0.2);
}

.column-pocket-pieces {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

/* Make buttons fill two-per-row inside the column */
.column-pocket .pocket-piece-btn {
  width: calc(50% - 0.125rem);
}

/* ── Drop overlay (sits over the board wrapper while a pocket piece is selected) */
.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  cursor: crosshair;
}


.pocket-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.55rem;
  letter-spacing: 0.1rem;
  color: rgba(153, 204, 255, 0.45);
  text-transform: uppercase;
  text-align: center;
  white-space: nowrap;
}

.pocket-pieces {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
}

.pocket-piece-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(153, 204, 255, 0.07);
  border: 0.0625rem solid rgba(153, 204, 255, 0.25);
  border-radius: 0.4rem;
  padding: 0.2rem 0.35rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  width: 3.2rem;
  font-family: inherit;
}

.pocket-piece-btn:hover:not(:disabled) {
  background: rgba(153, 204, 255, 0.18);
  border-color: rgba(153, 204, 255, 0.55);
}

.pocket-piece-btn.selected {
  background: rgba(100, 180, 255, 0.22);
  border-color: #99ccff;
  box-shadow: 0 0 0.5rem rgba(153, 204, 255, 0.45);
}

.pocket-piece-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.piece-icon {
  font-size: 1.45rem;
  line-height: 1;
}

.black-piece .piece-icon {
  filter: drop-shadow(0 0 0.1rem rgba(153, 204, 255, 0.4));
}

.piece-count {
  font-family: 'Antonio', sans-serif;
  font-size: 0.65rem;
  color: rgba(153, 204, 255, 0.65);
  line-height: 1;
}

.pocket-empty {
  color: rgba(153, 204, 255, 0.2);
  font-size: 1.1rem;
  text-align: center;
  padding: 0.4rem 0;
}

.pocket-hint {
  font-family: 'Antonio', sans-serif;
  font-size: 0.5rem;
  letter-spacing: 0.08rem;
  color: rgba(153, 204, 255, 0.25);
  text-align: center;
  text-transform: uppercase;
  margin-top: -0.15rem;
}


.drop-mode-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.55rem;
  letter-spacing: 0.18rem;
  color: #99ccff;
  background: rgba(20, 30, 40, 0.95);
  padding: 0.1rem 0.35rem;
  position: relative;
  z-index: 1;
  animation: pulse-drop 0.9s infinite alternate ease-in-out;
}

@keyframes pulse-drop {
  from { opacity: 0.55; }
  to   { opacity: 1; }
}

@media (max-width: 50rem) {
  .pocket-panel {
    min-width: 3.5rem;
    padding: 0.4rem 0.3rem;
  }

  .pocket-piece-btn {
    width: 2.8rem;
  }

  .piece-icon {
    font-size: 1.2rem;
  }
}
</style>