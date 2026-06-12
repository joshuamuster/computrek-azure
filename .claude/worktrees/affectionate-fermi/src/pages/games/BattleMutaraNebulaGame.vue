<template>
  <div class="battleship-game-container" :class="{ show: isVisible }">

    <!-- ═══════════════════════════════════════════════════
         HEADER
    ════════════════════════════════════════════════════ -->
    <div class="game-header">
      <div class="header-left">
        <!-- Phase indicator -->
        <!--        <div class="status-box phase-box">-->
        <!--          <span class="label">PHASE</span>-->
        <!--          <span class="value">{{ phaseLabel }}</span>-->
        <!--        </div>-->
        <!-- Turn indicator (battle phase only) -->
        <div
            v-if="gameState.phase === 'battle' || gameState.phase === 'over'"
            class="status-box turn-box"
            :class="gameState.turn === 'host' ? 'host-turn' : 'guest-turn'"
        >
          <span class="label">TURN</span>
          <span class="value">{{ turnLabel }}</span>
        </div>
        <!-- "You are" indicator (multiplayer) -->
        <div class="status-box color-indicator" v-if="isMultiplayer">
          <span class="label">YOU ARE</span>
          <span class="value">{{ playerRole?.toUpperCase() }}</span>
        </div>
      </div>

      <div class="logo-wrapper" @click="goToGames">
        <img :src="battleshipLogo" alt="Battleship" class="game-logo-small" />
      </div>

      <div class="header-right">
        <div class="status-box multiplayer-info" v-if="isMultiplayer">
          <span class="label">JOIN CODE</span>
          <span class="value code-value">{{ joinCode }}</span>
        </div>
        <button @click="resetGame" class="pill reset-btn">Reset</button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         MULTIPLAYER ERROR
    ════════════════════════════════════════════════════ -->
    <div v-if="multiplayerError" class="multiplayer-error-banner">
      {{ multiplayerError }}
    </div>

    <!-- ═══════════════════════════════════════════════════
         PLACEMENT PHASE
    ════════════════════════════════════════════════════ -->
    <!-- ═══════════════════════════════════════════════════
         PLACEMENT PHASE
    ════════════════════════════════════════════════════ -->
    <div v-if="gameState.phase === 'placement'" class="placement-area">

      <!-- LOCAL: show "waiting for player 2" screen when player 1 has confirmed -->
      <div v-if="!isMultiplayer && localPlacementStep === 'waiting'" class="waiting-screen">
        <div class="waiting-box">
          <h2>PLAYER 1 READY</h2>
          <p>Pass the workstation to Player 2, then press the button below.</p>
          <button class="pill confirm-btn" @click="localPlacementStep = 'player2'">
            PLAYER 2: BEGIN PLACEMENT
          </button>
        </div>
      </div>

      <!-- MULTIPLAYER: I've confirmed, waiting on opponent -->
      <div v-else-if="isMultiplayer && myPlacementDone" class="waiting-screen">
        <div class="waiting-box">
          <h2>FLEET CONFIRMED</h2>
          <p>Waiting for opponent to finish placement...</p>
          <div class="waiting-msg">STANDBY</div>
        </div>
      </div>

      <!-- Active placement UI — only shown when I haven't confirmed yet -->
      <div v-else class="placement-ui">


        <div class="topperly">
          <div class="placement-header">
            <h2 v-if="!isMultiplayer">
              {{ localPlacementStep === 'player1' ? 'PLAYER 1' : 'PLAYER 2' }} — PLACE YOUR FLEET
            </h2>
            <h2 v-else>PLACE YOUR FLEET</h2>
            <!--            <p class="placement-hint">Click a ship below to select it. Click the grid to place it. Press <kbd>R</kbd> to rotate.</p>-->
          </div>

          <!-- Ship selector tray -->
          <div class="ship-tray">
            <button
                v-for="ship in SHIP_DEFS"
                :key="ship.id"
                class="pill ship-btn"
                :class="{
                selected: selectedShipId === ship.id,
                placed: isShipPlaced(ship.id)
              }"
                :disabled="isShipPlaced(ship.id)"
                @click="selectShip(ship.id)"
            >
              <span class="ship-label">{{ ship.label }}</span>
              <span class="ship-cells">
                <span
                    v-for="i in ship.size"
                    :key="i"
                    class="cell-pip"
                    :class="{ active: !isShipPlaced(ship.id) }"
                ></span>
              </span>
            </button>
          </div>

        </div>

        <!-- Placement grid -->
        <div class="grids-row">
          <div class="grid-panel">
            <div class="grid-label">YOUR GRID</div>
            <div class="grid-wrapper">
              <div class="grid-col-headers">
                <div class="corner-cell"></div>
                <div v-for="col in COLS" :key="col" class="header-cell col-header">{{ col }}</div>
              </div>
              <div class="grid-rows">
                <div v-for="row in ROWS" :key="row" class="grid-row">
                  <div class="header-cell row-header">{{ row }}</div>
                  <div
                      v-for="col in COLS"
                      :key="col"
                      class="grid-cell"
                      :class="placementCellClass(col, row)"
                      @click="handlePlacementClick(col, row)"
                      @mouseover="handlePlacementHover(col, row)"
                      @mouseleave="clearPreview"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Orientation toggle & ready button -->
        <div class="placement-actions">
          <button class="pill" @click="toggleOrientation">
            ROTATE ({{ horizontal ? 'HORIZONTAL' : 'VERTICAL' }})
          </button>
          <button
              class="pill confirm-btn"
              :disabled="localShips.length < SHIP_DEFS.length"
              @click="confirmPlacement"
          >
            {{ localShips.length < SHIP_DEFS.length
              ? `PLACE ${SHIP_DEFS.length - localShips.length} MORE SHIP${SHIP_DEFS.length - localShips.length !== 1 ? 'S' : ''}`
              : 'CONFIRM FLEET' }}
          </button>
        </div>
      </div>

    </div>

    <!-- ═══════════════════════════════════════════════════
         BATTLE PHASE
    ════════════════════════════════════════════════════ -->
    <div v-if="gameState.phase === 'battle' || gameState.phase === 'over'" class="battle-area">

      <!-- LOCAL PASS-AND-PLAY: screen-hide between turns -->
      <div v-if="!isMultiplayer && localBattleBlocked" class="waiting-screen">
        <div class="waiting-box">
          <h2>{{ lastFiringPlayer === 'host' ? 'PLAYER 1' : 'PLAYER 2' }} — TURN COMPLETE</h2>
          <p>Pass the workstation to {{ lastFiringPlayer === 'host' ? 'Player 2' : 'Player 1' }}.</p>
          <button class="pill confirm-btn" @click="localBattleBlocked = false">
            {{ gameState.turn === 'host' ? 'PLAYER 1' : 'PLAYER 2' }}: BEGIN TURN
          </button>
        </div>
      </div>

      <div v-else class="battle-ui">
        <div class="grids-row battle-grids">

          <!-- MY GRID (defense view) -->
          <div class="grid-panel">
            <div class="grid-label">
              {{ isMultiplayer ? 'YOUR FLEET' : (gameState.turn === 'host' ? 'PLAYER 1 FLEET' : 'PLAYER 2 FLEET') }}
            </div>
            <div class="grid-wrapper">
              <div class="grid-col-headers">
                <div class="corner-cell"></div>
                <div v-for="col in COLS" :key="col" class="header-cell col-header">{{ col }}</div>
              </div>
              <div class="grid-rows">
                <div v-for="row in ROWS" :key="row" class="grid-row">
                  <div class="header-cell row-header">{{ row }}</div>
                  <div
                      v-for="col in COLS"
                      :key="col"
                      class="grid-cell"
                      :class="myDefenseCellClass(col, row)"
                  ></div>
                </div>
              </div>
            </div>
            <!-- My fleet status -->
            <div class="fleet-status">
              <div
                  v-for="ship in myShipsWithStatus"
                  :key="ship.id"
                  class="fleet-ship"
                  :class="{ sunk: ship.sunk }"
              >
                <span class="fleet-ship-label">{{ ship.label }}</span>
                <span class="fleet-ship-cells">
                  <span
                      v-for="(cell, i) in ship.cells"
                      :key="i"
                      class="cell-pip"
                      :class="{ hit: isCellHit(cell, incomingShots), sunk: ship.sunk }"
                  ></span>
                </span>
              </div>
            </div>
          </div>

          <!-- OPPONENT GRID (offense view) -->
          <div class="grid-panel">
            <div class="grid-label">
              {{ isMultiplayer ? 'ENEMY WATERS' : (gameState.turn === 'host' ? 'PLAYER 2 WATERS' : 'PLAYER 1 WATERS') }}
            </div>
            <div class="grid-wrapper">
              <div class="grid-col-headers">
                <div class="corner-cell"></div>
                <div v-for="col in COLS" :key="col" class="header-cell col-header">{{ col }}</div>
              </div>
              <div class="grid-rows">
                <div v-for="row in ROWS" :key="row" class="grid-row">
                  <div class="header-cell row-header">{{ row }}</div>
                  <div
                      v-for="col in COLS"
                      :key="col"
                      class="grid-cell offense-cell"
                      :class="offenseCellClass(col, row)"
                      @click="handleShot(col, row)"
                  ></div>
                </div>
              </div>
            </div>
            <!-- Enemy fleet sunk status -->
            <div class="fleet-status">
              <div
                  v-for="ship in enemyShipsWithStatus"
                  :key="ship.id"
                  class="fleet-ship"
                  :class="{ sunk: ship.sunk }"
              >
                <span class="fleet-ship-label">{{ ship.label }}</span>
                <span class="fleet-ship-cells">
                  <span
                      v-for="(cell, i) in ship.cells"
                      :key="i"
                      class="cell-pip"
                      :class="{ hit: isCellHit(cell, myShots), sunk: ship.sunk }"
                  ></span>
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         OVERLAYS
    ════════════════════════════════════════════════════ -->

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
    <div v-if="showGameOver" class="game-status-overlay game-over win">
      <h2>{{ gameOverMessage }}</h2>
      <p class="confirm-sub">{{ gameOverSubtext }}</p>
      <div class="confirm-actions">
        <button @click="resetGame" class="pill confirm-btn">NEW SIMULATION</button>
        <button @click="showGameOver = false" class="pill abort-btn">CLOSE</button>
      </div>
    </div>

    <!-- Status Messages (e.g., Sunk Ship) -->
    <div v-if="statusMessage" class="status-toast">
      {{ statusMessage }}
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useMultiplayer } from '@/composables/useMultiplayer';
import { useGameScores } from '@/composables/useGameScores';
import {
  COLS, ROWS, SHIP_DEFS,
  type Engine, type PlacedShip, type Cell, type PlayerRole,
  createInitialBattleshipState, getCells, hasConflict, updateSunkFlags, allSunk, isShipSunk
} from '@/components/games/BattleMutaraNebula/engine';
import battleshipLogo from '@/assets/images/games/title-battlemutaranebula.svg';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import soundError from '@/assets/sounds/SFX-Computer/inputfailed1.wav';

const router = useRouter();
const route = useRoute();
const isVisible = ref(false);
const statusMessage = ref('');

const {
  isMultiplayer,
  playerColor,   // we repurpose this as 'host'/'guest' role string
  joinCode,
  remoteRoom,
  submitMove,
  resetGame: resetRemoteGame,
  tryReconnect,
  stopListening,
  resetState,
  error: multiplayerError
} = useMultiplayer();

const scoreComposable = useGameScores('battle_mutara_nebula', { lowerIsBetter: false });
const playerRole = computed<PlayerRole | null>(() => {
  if (!isMultiplayer.value || !remoteRoom.value) return null;
  // useMultiplayer sets playerColor to 'white' for host and 'black' for guest
  // Map those back to the Battleship role names
  if (playerColor.value === 'white') return 'host';
  if (playerColor.value === 'black') return 'guest';
  return null;
});

// ─── Game state ──────────────────────────────────────────────────────────────

const gameState = ref<Engine>(createInitialBattleshipState());

// ─── Placement phase state ────────────────────────────────────────────────────

// For local (pass-and-play): which player is currently placing
const localPlacementStep = ref<'player1' | 'waiting' | 'player2'>('player1');

// Ships placed so far in the current local session (reset between p1 and p2)
const localShips = ref<PlacedShip[]>([]);

// Track whether the current player (multiplayer) has already placed
const myPlacementDone = computed<boolean>(() => {
  if (!isMultiplayer.value) return false;
  return playerRole.value === 'host' ? gameState.value.hostReady : gameState.value.guestReady;
});

const isMyTurnToPlace = computed<boolean>(() => {
  if (!isMultiplayer.value) return true;
  return !myPlacementDone.value;
});

// Can the current user interact with the placement grid?
const canPlace = computed<boolean>(() => {
  if (gameState.value.phase !== 'placement') return false;
  if (isMultiplayer.value) return !myPlacementDone.value;
  return localPlacementStep.value !== 'waiting';
});

const selectedShipId = ref<string | null>(null);
const horizontal = ref(true);
const previewCells = ref<Cell[]>([]);
const previewValid = ref(true);

function selectShip(id: string) {
  if (isShipPlaced(id)) return;
  selectedShipId.value = id;
}

function isShipPlaced(id: string): boolean {
  return localShips.value.some(s => s.id === id);
}

function toggleOrientation() {
  horizontal.value = !horizontal.value;
  previewCells.value = [];
}

function handlePlacementHover(col: string, row: number) {
  if (!selectedShipId.value || !canPlace.value) { previewCells.value = []; return; }
  const ship = SHIP_DEFS.find(s => s.id === selectedShipId.value)!;
  const cells = getCells(col, row, ship.size, horizontal.value);
  if (!cells) { previewCells.value = []; return; }
  previewCells.value = cells;
  previewValid.value = !hasConflict(cells, localShips.value);
}

function clearPreview() {
  previewCells.value = [];
}

function handlePlacementClick(col: string, row: number) {
  if (!selectedShipId.value || !canPlace.value) return;
  const ship = SHIP_DEFS.find(s => s.id === selectedShipId.value)!;
  const cells = getCells(col, row, ship.size, horizontal.value);
  if (!cells) return;
  if (hasConflict(cells, localShips.value)) return;
  localShips.value = [...localShips.value, { id: ship.id, cells, sunk: false }];
  selectedShipId.value = null;
  previewCells.value = [];
  // Auto-select next unplaced ship
  const next = SHIP_DEFS.find(s => !localShips.value.some(p => p.id === s.id));
  if (next) selectedShipId.value = next.id;
}

async function confirmPlacement() {
  if (localShips.value.length < SHIP_DEFS.length) return;

  if (isMultiplayer.value) {
    // Base the write on the freshest remote state to avoid clobbering the
    // opponent's ships if their placement write arrived after our local snapshot.
    const remoteBase = remoteRoom.value?.boardState
        ? JSON.parse(remoteRoom.value.boardState) as Engine
        : JSON.parse(JSON.stringify(gameState.value)) as Engine;
    const newState: Engine = { ...remoteBase };
    if (playerRole.value === 'host') {
      newState.hostShips = localShips.value;
      newState.hostReady = true;
    } else {
      newState.guestShips = localShips.value;
      newState.guestReady = true;
    }
    // If both ready, transition to battle
    if (newState.hostReady && newState.guestReady) {
      newState.phase = 'battle';
    }
    await submitMove({ type: 'placement' }, JSON.stringify(newState), newState.turn);
    gameState.value = newState;
  } else {
    // Local: store player ships and advance step
    if (localPlacementStep.value === 'player1') {
      gameState.value.hostShips = localShips.value;
      gameState.value.hostReady = true;
      localShips.value = [];
      selectedShipId.value = null;
      localPlacementStep.value = 'waiting';
    } else {
      gameState.value.guestShips = localShips.value;
      gameState.value.guestReady = true;
      localShips.value = [];
      selectedShipId.value = null;
      // Both ready: begin battle
      gameState.value.phase = 'battle';
    }
  }
}

// CSS classes for placement grid cells
function placementCellClass(col: string, row: number): Record<string, boolean> {
  const cell = `${col}${row}`;
  const isOccupied = localShips.value.some(s => s.cells.includes(cell));
  const isPreview = previewCells.value.includes(cell);
  return {
    'cell-ship': isOccupied,
    'cell-preview': isPreview && !isOccupied,
    'cell-preview-invalid': isPreview && !isOccupied && !previewValid.value,
    'cell-preview-valid': isPreview && !isOccupied && previewValid.value,
  };
}

// ─── Battle phase state ───────────────────────────────────────────────────────

// Local pass-and-play: block screen between turns
const localBattleBlocked = ref(false);
const lastFiringPlayer = ref<PlayerRole>('host');

// Whose shots are "my shots" (the ones I fire at the enemy)?
const myShots = computed<Cell[]>(() => {
  if (isMultiplayer.value) {
    return playerRole.value === 'host' ? gameState.value.hostShots : gameState.value.guestShots;
  }
  return gameState.value.turn === 'host' ? gameState.value.hostShots : gameState.value.guestShots;
});

// Shots incoming against me
const incomingShots = computed<Cell[]>(() => {
  if (isMultiplayer.value) {
    return playerRole.value === 'host' ? gameState.value.guestShots : gameState.value.hostShots;
  }
  return gameState.value.turn === 'host' ? gameState.value.guestShots : gameState.value.hostShots;
});

// My ships (defense)
const myFleet = computed<PlacedShip[]>(() => {
  if (isMultiplayer.value) {
    return playerRole.value === 'host' ? gameState.value.hostShips : gameState.value.guestShips;
  }
  return gameState.value.turn === 'host' ? gameState.value.hostShips : gameState.value.guestShips;
});

// Enemy ships (only shown when sunk)
const enemyFleet = computed<PlacedShip[]>(() => {
  if (isMultiplayer.value) {
    return playerRole.value === 'host' ? gameState.value.guestShips : gameState.value.hostShips;
  }
  return gameState.value.turn === 'host' ? gameState.value.guestShips : gameState.value.hostShips;
});

// Ships with live sunk flags merged in from current shot data
const myShipsWithStatus = computed(() =>
    SHIP_DEFS.map(def => {
      const placed = myFleet.value.find(s => s.id === def.id);
      return {
        ...def,
        cells: placed?.cells ?? [],
        sunk: placed ? isShipSunk(placed, incomingShots.value) : false,
      };
    })
);

const enemyShipsWithStatus = computed(() =>
    SHIP_DEFS.map(def => {
      const placed = enemyFleet.value.find(s => s.id === def.id);
      const isSunk = placed ? isShipSunk(placed, myShots.value) : false;
      return {
        ...def,
        cells: isSunk ? (placed?.cells ?? []) : [], // hide cells until sunk
        sunk: isSunk,
      };
    })
);

function isCellHit(cell: Cell, shots: Cell[]): boolean {
  return shots.includes(cell);
}

// Is it my turn to fire?
const isMyFireTurn = computed<boolean>(() => {
  if (gameState.value.phase !== 'battle') return false;
  if (isMultiplayer.value) return gameState.value.turn === playerRole.value;
  return true; // local: always the current active player's turn
});

async function handleShot(col: string, row: number) {
  if (!isMyFireTurn.value) return;
  if (gameState.value.phase !== 'battle') return;

  const cell = `${col}${row}`;
  if (myShots.value.includes(cell)) return; // already shot here

  const newState: Engine = JSON.parse(JSON.stringify(gameState.value));
  const currentPlayer = newState.turn;

  if (currentPlayer === 'host') {
    newState.hostShots = [...newState.hostShots, cell];
    newState.guestShips = updateSunkFlags(newState.guestShips, newState.hostShots);

    // Check if a ship was newly sunk
    const newlySunk = newState.guestShips.find(s => s.sunk && !gameState.value.guestShips.find(os => os.id === s.id)?.sunk);
    if (newlySunk) {
      const label = SHIP_DEFS.find(d => d.id === newlySunk.id)?.label;
      statusMessage.value = `YOU SUNK THE ${label?.toUpperCase()}!`;
      setTimeout(() => { statusMessage.value = ''; }, 3000);
    }

    if (allSunk(newState.guestShips, newState.hostShots)) {
      newState.phase = 'over';
      newState.winner = 'host';
    } else {
      newState.turn = 'guest';
    }
  } else {
    newState.guestShots = [...newState.guestShots, cell];
    newState.hostShips = updateSunkFlags(newState.hostShips, newState.guestShots);

    // Check if a ship was newly sunk
    const newlySunk = newState.hostShips.find(s => s.sunk && !gameState.value.hostShips.find(os => os.id === s.id)?.sunk);
    if (newlySunk) {
      const label = SHIP_DEFS.find(d => d.id === newlySunk.id)?.label;
      statusMessage.value = `YOU SUNK THE ${label?.toUpperCase()}!`;
      setTimeout(() => { statusMessage.value = ''; }, 3000);
    }

    if (allSunk(newState.hostShips, newState.guestShots)) {
      newState.phase = 'over';
      newState.winner = 'guest';
    } else {
      newState.turn = 'host';
    }
  }

  if (isMultiplayer.value) {
    await submitMove({ type: 'shot', cell, firedBy: currentPlayer }, JSON.stringify(newState), newState.turn);
  }

  gameState.value = newState;

  if (newState.phase === 'over') {
    triggerGameOver(newState.winner!);
  } else if (!isMultiplayer.value) {
    // Local: block screen so current player can't peek
    lastFiringPlayer.value = currentPlayer;
    localBattleBlocked.value = true;
  } else {
    playSound(soundError); // shot fired sound
  }
}

// CSS classes for defense grid
function myDefenseCellClass(col: string, row: number): Record<string, boolean> {
  const cell = `${col}${row}`;
  const isShip = myFleet.value.some(s => s.cells.includes(cell));
  const isHit = incomingShots.value.includes(cell);
  const isMiss = !isShip && isHit;
  const isSunkShip = isHit && isShip && myShipsWithStatus.value.find(s => s.cells.includes(cell))?.sunk;
  return {
    'cell-ship': isShip && !isHit,
    'cell-hit': isHit && isShip,
    'cell-miss': isMiss,
    'cell-sunk': !!isSunkShip,
  };
}

// CSS classes for offense grid
function offenseCellClass(col: string, row: number): Record<string, boolean> {
  const cell = `${col}${row}`;
  const isShot = myShots.value.includes(cell);
  if (!isShot) {
    return {
      'cell-targetable': isMyFireTurn.value && gameState.value.phase === 'battle',
    };
  }
  const isHit = enemyFleet.value.some(s => s.cells.includes(cell));
  const enemyShip = enemyFleet.value.find(s => s.cells.includes(cell));
  const isSunk = enemyShip ? allSunk([enemyShip], myShots.value) : false;
  return {
    'cell-hit': isHit,
    'cell-miss': !isHit,
    'cell-sunk': isSunk,
  };
}

// ─── Game over ────────────────────────────────────────────────────────────────

const showGameOver = ref(false);
const gameOverMessage = ref('');
const gameOverSubtext = ref('');

function triggerGameOver(winner: PlayerRole) {
  let winnerLabel: string;
  if (isMultiplayer.value) {
    const iWon = winner === playerRole.value;
    winnerLabel = iWon ? 'YOUR FLEET WINS' : 'ENEMY FLEET WINS';
    if (iWon) scoreComposable.incrementScore();
  } else {
    winnerLabel = winner === 'host' ? 'PLAYER 1 WINS' : 'PLAYER 2 WINS';
  }
  gameOverMessage.value = 'ENGAGEMENT COMPLETE';
  gameOverSubtext.value = winnerLabel;
  playSound(soundSuccess);
  showGameOver.value = true;
}

// ─── Reset ────────────────────────────────────────────────────────────────────

const showConfirm = ref(false);
const confirmMessage = ref('');
let confirmActionCallback: (() => void) | null = null;

function resetGame() {
  const action = async () => {
    const fresh = createInitialBattleshipState();
    showGameOver.value = false;
    localPlacementStep.value = 'player1';
    localShips.value = [];
    selectedShipId.value = null;
    localBattleBlocked.value = false;
    if (isMultiplayer.value) {
      await resetRemoteGame(JSON.stringify(fresh));
    }
    gameState.value = fresh;
  };

  const hasProgress =
      gameState.value.phase !== 'placement' ||
      gameState.value.hostReady ||
      gameState.value.guestReady ||
      localShips.value.length > 0;

  if (hasProgress) {
    confirmMessage.value = 'ARE YOU SURE YOU WANT TO RESET?';
    confirmActionCallback = action;
    showConfirm.value = true;
  } else {
    action();
  }
}

function handleConfirm() {
  showConfirm.value = false;
  confirmActionCallback?.();
  confirmActionCallback = null;
}

function handleCancel() {
  showConfirm.value = false;
  confirmActionCallback = null;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

const phaseLabel = computed(() => {
  switch (gameState.value.phase) {
    case 'placement': return 'DEPLOYMENT';
    case 'battle': return 'ENGAGEMENT';
    case 'over': return 'COMPLETE';
  }
});

const turnLabel = computed(() => {
  if (isMultiplayer.value) {
    return gameState.value.turn === playerRole.value ? 'YOUR TURN' : 'ENEMY TURN';
  }
  return gameState.value.turn === 'host' ? 'PLAYER 1' : 'PLAYER 2';
});

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

// ─── Keyboard handler ─────────────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent) {
  if ((e.key === 'r' || e.key === 'R') && gameState.value.phase === 'placement') {
    toggleOrientation();
  }
}

// ─── Multiplayer sync ─────────────────────────────────────────────────────────

watch(remoteRoom, (newRoom) => {
  if (!newRoom?.boardState) return;
  try {
    const parsed: Engine = JSON.parse(newRoom.boardState);
    gameState.value = parsed;
    if (parsed.phase === 'over' && parsed.winner && !showGameOver.value) {
      triggerGameOver(parsed.winner);
    }
  } catch (e) {
    console.error('BattleMutaraNebula: failed to parse remote board state', e);
  }
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  requestAnimationFrame(() => { isVisible.value = true; });

  if (route.query.mode === 'online') {
    await tryReconnect('battleship');
    // If reconnecting mid-game, load the latest state
    if (remoteRoom.value?.boardState) {
      try {
        gameState.value = JSON.parse(remoteRoom.value.boardState);
      } catch (e) {}
    }
  } else {
    resetState();
  }

  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  stopListening();
  window.removeEventListener('keydown', handleKeydown);
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
});
</script>

<style scoped>
/* ─── Container & visibility ──────────────────────────────────────────────── */
.topperly {
  align-items: center;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 2rem;
}

.battleship-game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9375rem;
  opacity: 0;
  transform: translateY(0.375rem);
  transition: opacity 1s ease, transform 1s ease;
  width: 100%;
}

.battleship-game-container.show {
  opacity: 1;
  transform: none;
}

/* ─── Header (game-header, status-box, logo-wrapper shared via gameLanding.css) ── */
.host-turn {
  background: rgba(130, 150, 185, 1) !important;
  border: 0.125rem solid #ffc400;
  box-shadow: 0 0 1.25rem rgba(255, 255, 255, 0.4);
}

.guest-turn {
  background: rgba(130, 150, 185, 0.5) !important;
}

.multiplayer-error-banner {
  background: rgba(244, 67, 54, 0.9);
  color: white;
  padding: 0.625rem 1.875rem;
  border-radius: 0.5rem;
  font-family: 'Antonio', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.0625rem;
  margin-bottom: 0.5rem;
}

/* ─── Waiting / pass-and-play screen ─────────────────────────────────────── */
.waiting-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 28rem;
  width: 100%;
}

.waiting-box {
  background: rgba(10, 20, 30, 0.85);
  padding: 3rem 4rem;
  border-radius: 1.5rem;
  border: 0.125rem solid #ffc400;
  text-align: center;
  box-shadow: 0 0 4rem rgba(0, 0, 0, 0.9), 0 0 1.5rem rgba(255, 196, 0, 0.2);
}

.waiting-box h2 {
  font-family: 'Antonio', sans-serif;
  font-size: 2rem;
  color: #ffc400;
  margin-bottom: 1rem;
  letter-spacing: 0.1rem;
}

.waiting-box p {
  color: #ccc;
  margin-bottom: 1.5rem;
  font-size: 1rem;
}

.waiting-msg {
  color: #99ccff;
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05rem;
  margin-top: 1rem;
  text-align: center;
  animation: blink 1.5s infinite alternate ease-in-out;
}

@keyframes blink {
  from { opacity: 0.4; }
  to { opacity: 1; }
}

/* ─── Placement UI ────────────────────────────────────────────────────────── */
.placement-area,
.battle-area {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.placement-ui,
.battle-ui {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
}

.placement-header {
  text-align: center;
}

.placement-header h2 {
  font-family: 'Antonio', sans-serif;
  font-size: 1.75rem;
  color: #ffc400;
  letter-spacing: 0.1rem;
  margin: 0;
}

.placement-hint {
  color: #99ccff;
  font-size: 0.9rem;
}

.placement-hint kbd {
  background: rgba(153, 204, 255, 0.15);
  border: 0.0625rem solid rgba(153, 204, 255, 0.4);
  border-radius: 0.25rem;
  padding: 0.1rem 0.4rem;
  font-family: 'Antonio', sans-serif;
  color: #9cf;
}

/* ─── Ship tray ───────────────────────────────────────────────────────────── */
.ship-tray {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  height: fit-content;
}

.ship-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  min-width: 6rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ship-btn.selected {
  background: rgba(153, 204, 255, 0.3) !important;
  border-color: #9cf !important;
  color: #fff !important;
  box-shadow: 0 0 0.9375rem rgba(153, 204, 255, 0.4);
}

.ship-btn.placed {
  opacity: 0.3;
  cursor: not-allowed;
}

.ship-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05rem;
}

.ship-cells {
  display: flex;
  gap: 0.2rem;
}

.cell-pip {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 0.1rem;
  background: rgba(153, 204, 255, 0.2);
  border: 0.0625rem solid rgba(153, 204, 255, 0.3);
  transition: all 0.2s;
}

.cell-pip.active {
  background: rgba(153, 204, 255, 0.6);
  border-color: #9cf;
}

.cell-pip.hit {
  background: rgba(244, 67, 54, 0.7);
  border-color: #f44336;
}

.cell-pip.sunk {
  background: rgba(244, 67, 54, 1);
  border-color: #ff1744;
}

/* ─── Placement actions ───────────────────────────────────────────────────── */
.placement-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}

/* ─── Grid layout ─────────────────────────────────────────────────────────── */
.grids-row {
  display: flex;
  gap: 2.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.battle-grids {
  align-items: flex-start;
}

.grid-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.grid-label {
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  color: #ffc400;
  text-transform: uppercase;
  letter-spacing: 0.1rem;
}

.grid-wrapper {
  background: rgba(20, 30, 40, 0.6);
  padding: 0.75rem;
  border: 0.0625rem solid rgba(170, 210, 255, 0.4);
  border-radius: 0.75rem;
  backdrop-filter: blur(0.625rem);
  box-shadow: 0 0 2.5rem rgba(0, 0, 0, 0.6), inset 0 0 1.25rem rgba(153, 204, 255, 0.1);
}

.grid-col-headers {
  display: flex;
}

.corner-cell {
  width: 1.5rem;
  height: 1.5rem;
}

.header-cell {
  width: 2.25rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Antonio', sans-serif;
  font-size: 0.75rem;
  color: #99ccff;
  text-transform: uppercase;
}

.grid-rows {
  display: flex;
  flex-direction: column;
}

.grid-row {
  display: flex;
}

.row-header {
  width: 1.5rem;
  font-size: 0.75rem;
}

/* ─── Grid cells ──────────────────────────────────────────────────────────── */
.grid-cell {
  width: 2.25rem;
  height: 2.25rem;
  border: 0.0625rem solid rgba(153, 204, 255, 0.15);
  background: rgba(0, 20, 40, 0.4);
  transition: background 0.15s ease, box-shadow 0.15s ease;
  cursor: default;
}

.grid-cell.cell-ship {
  background: rgba(130, 150, 185, 0.6);
  border-color: rgba(153, 204, 255, 0.5);
  box-shadow: inset 0 0 0.3rem rgba(153, 204, 255, 0.3);
}

.grid-cell.cell-preview-valid {
  background: rgba(76, 175, 80, 0.35);
  border-color: rgba(76, 175, 80, 0.7);
}

.grid-cell.cell-preview-invalid {
  background: rgba(244, 67, 54, 0.3);
  border-color: rgba(244, 67, 54, 0.6);
}

.grid-cell.cell-hit {
  background: rgba(244, 67, 54, 0.7);
  border-color: #f44336;
  box-shadow: inset 0 0 0.5rem rgba(244, 67, 54, 0.5);
}

.grid-cell.cell-sunk {
  background: rgba(180, 0, 0, 0.9);
  border-color: #ff1744;
  box-shadow: inset 0 0 0.75rem rgba(255, 0, 0, 0.6);
}

.grid-cell.cell-miss {
  background: rgba(153, 204, 255, 0.1);
  border-color: rgba(153, 204, 255, 0.4);
}

.grid-cell.cell-miss::after {
  content: '·';
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgba(153, 204, 255, 0.5);
  font-size: 1.5rem;
  line-height: 2.25rem;
}

.offense-cell.cell-targetable {
  cursor: crosshair;
}

.offense-cell.cell-targetable:hover {
  background: rgba(255, 196, 0, 0.2);
  border-color: rgba(255, 196, 0, 0.6);
  box-shadow: inset 0 0 0.5rem rgba(255, 196, 0, 0.3);
}

/* ─── Fleet status strip ──────────────────────────────────────────────────── */
.fleet-status {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
}

.fleet-ship {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
  border: 0.0625rem solid rgba(153, 204, 255, 0.15);
  background: rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.fleet-ship.sunk {
  opacity: 0.5;
  text-decoration: line-through;
  border-color: rgba(244, 67, 54, 0.3);
  background: rgba(244, 67, 54, 0.05);
}

.fleet-ship.sunk .fleet-ship-label {
  color: #f44336;
  text-decoration: line-through;
}

.fleet-ship-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.75rem;
  color: #99ccff;
  text-transform: uppercase;
  width: 5.5rem;
  letter-spacing: 0.04rem;
}

.fleet-ship-cells {
  display: flex;
  gap: 0.2rem;
}

/* ─── Pill buttons ────────────────────────────────────────────────────────── */
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

.pill:hover:not(:disabled) {
  background: rgba(153, 204, 255, 0.3);
  border-color: #9cf;
  color: #fff;
  box-shadow: 0 0 0.625rem rgba(153, 204, 255, 0.3);
}

.pill:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ─── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 60rem) {
  .grids-row {
    flex-direction: column;
    align-items: center;
  }

  .grid-cell {
    width: 1.75rem;
    height: 1.75rem;
  }

  .header-cell {
    width: 1.75rem;
  }
}

@media (max-width: 35rem) {
  .grid-cell {
    width: 1.4rem;
    height: 1.4rem;
  }

  .header-cell {
    width: 1.4rem;
    font-size: 0.6rem;
  }

  .corner-cell {
    width: 1.2rem;
  }

  .row-header {
    width: 1.2rem;
  }
}

/* status-toast shared via gameLanding.css */
</style>