<template>
  <div class="fractured-frontier-container" :class="{ show: isVisible }">
    <div class="scanlines" />

    <!-- ═══ Header HUD ═══ -->
    <div class="game-header">
      <div class="header-left">
        <div class="status-box turn-box" :class="gameState.turn === 'host' ? 'host-turn' : 'turn-idle'">
          <span class="label">PLAYER 1</span>
          <span class="value">ENTERPRISE</span>
        </div>
        <div class="status-box color-indicator" v-if="isMultiplayer && playerRole">
          <span class="label">YOU ARE</span>
          <span class="value">{{ FACTIONS[playerRole].shipName }}</span>
        </div>
      </div>

      <div class="logo-wrapper" @click="goToGames">
        <img :src="gameLogo" alt="Fractured Frontier" class="game-logo-small" />
      </div>

      <div class="header-right">
        <div class="status-box multiplayer-info" v-if="isMultiplayer">
          <span class="label">JOIN CODE</span>
          <span class="value code-value">{{ joinCode }}</span>
        </div>
        <div class="status-box turn-box" :class="gameState.turn === 'guest' ? 'guest-turn' : 'turn-idle'">
          <span class="label">PLAYER 2</span>
          <span class="value">HAAKONA</span>
        </div>
      </div>
    </div>

    <div v-if="multiplayerError" class="multiplayer-error-banner">{{ multiplayerError }}</div>

    <!-- ═══ Main Game Area — weapon panel | canvas | aim panel ═══ -->
    <div class="game-layout">

      <!-- LEFT: weapon loadout -->
      <div class="side-panel side-panel--weapons">
        <div class="side-label">WEAPONS</div>
        <div class="weapon-options">
          <button
              v-for="w in WEAPONS"
              :key="w.id"
              type="button"
              class="weapon-chip"
              :class="{ 'weapon-chip--active': selectedWeapon === w.id, 'weapon-chip--depleted': isWeaponDepleted(w) }"
              :style="{ '--wc': w.color }"
              :disabled="isWeaponDepleted(w)"
              :title="isWeaponDepleted(w) ? `${w.name} — out of ammo` : w.name"
              @click="selectedWeapon = w.id"
          >
            <div class="weapon-chip__head">
              <span class="weapon-chip__icon">{{ w.icon }}</span>
              <span class="weapon-chip__name">{{ w.name }}</span>
            </div>
            <div class="weapon-chip__desc">{{ w.desc }}</div>
            <div class="weapon-chip__pips">
              <span v-if="w.id === 'torpedo'" class="ammo-inf">∞</span>
              <template v-else>
                <span
                  v-for="i in (STARTING_AMMO[w.id] ?? 0)"
                  :key="i"
                  class="ammo-pip"
                  :class="{ 'ammo-pip--spent': i > getWeaponAmmo(w) }"
                ></span>
              </template>
            </div>
          </button>
        </div>
      </div>

      <!-- CENTER: battlefield canvas with HP bars overlaid -->
      <div class="canvas-wrapper">

        <!-- Fighting-game HP bars — badges in corners, bars fill inward toward centre -->
        <div class="player-bars">

          <!-- P1 (host / Enterprise) — badge far-left, bar fills L → R -->
          <div
              class="player-bar host"
              :class="{ active: gameState.turn === 'host' && gameState.phase !== 'over', eliminated: gameState.ships.host.health <= 0 }"
          >
            <img :src="FACTIONS.host.badge" class="faction-badge" :alt="FACTIONS.host.shipName" />
            <div class="pbar-content">
              <div class="pbar-meta">
                <span class="player-name">{{ FACTIONS.host.shipName }}</span>
                <span class="player-health">{{ Math.max(0, gameState.ships.host.health) }}%</span>
                <span class="player-shield" v-if="gameState.ships.host.shield > 0">🛡 {{ gameState.ships.host.shield }}</span>
              </div>
              <div class="health-bar">
                <div class="health-fill" :style="{ width: Math.max(0, gameState.ships.host.health) + '%', background: FACTIONS.host.color }" />
              </div>
            </div>
          </div>

          <!-- Centre: solar wind + round counter -->
          <div class="bars-center">
            <div class="wind-display">
              <div class="wind-top">
                <span class="wind-solar">SOLAR</span>
                <span class="wind-value">{{ gameState.wind >= 0 ? '+' : '' }}{{ gameState.wind.toFixed(1) }}</span>
                <span class="wind-winds">WINDS</span>
              </div>
              <div class="wind-arrows">
                <span class="wind-arrow" :style="{ transform: gameState.wind >= 0 ? 'scaleX(1)' : 'scaleX(-1)' }">
                  {{ '→'.repeat(Math.max(1, Math.min(5, Math.round(Math.abs(gameState.wind) * 2.5)))) }}
                </span>
              </div>
            </div>
            <div class="round-display">
              <span class="round-label">ROUND</span>
              <span class="round-value">{{ gameState.round }}/{{ gameState.maxRounds }}</span>
            </div>
          </div>

          <!-- P2 (guest / Haakona) — bar fills R → L, badge far-right -->
          <div
              class="player-bar guest"
              :class="{ active: gameState.turn === 'guest' && gameState.phase !== 'over', eliminated: gameState.ships.guest.health <= 0 }"
          >
            <div class="pbar-content pbar-content--rtl">
              <div class="pbar-meta pbar-meta--rtl">
                <span class="player-shield" v-if="gameState.ships.guest.shield > 0">🛡 {{ gameState.ships.guest.shield }}</span>
                <span class="player-health">{{ Math.max(0, gameState.ships.guest.health) }}%</span>
                <span class="player-name">{{ FACTIONS.guest.shipName }}</span>
              </div>
              <div class="health-bar health-bar--rtl">
                <div class="health-fill" :style="{ width: Math.max(0, gameState.ships.guest.health) + '%', background: FACTIONS.guest.color }" />
              </div>
            </div>
            <img :src="FACTIONS.guest.badge" class="faction-badge" :alt="FACTIONS.guest.shipName" />
          </div>

        </div>

        <canvas ref="gameCanvas" :width="CANVAS_W" :height="CANVAS_H" />

        <button @click="resetGame" class="reset-btn">↺ RESET</button>

        <div v-if="waitingForOpponent" class="waiting-overlay">
          <div class="waiting-box">
            <div class="waiting-title">AWAITING REINFORCEMENTS</div>
            <div class="waiting-sub">Share this join code with your opponent</div>
            <div class="waiting-code">{{ joinCode }}</div>
            <div class="waiting-spinner">● ● ●</div>
          </div>
        </div>
      </div>

      <!-- RIGHT: aim / movement controls -->
      <div class="side-panel side-panel--aim">
        <template v-if="gameState.phase === 'aiming' && canAct">
          <div class="current-player-label">
            <span class="dot" :style="{ background: FACTIONS[gameState.turn].color }" />
            {{ FACTIONS[gameState.turn].shipName }}
          </div>

          <!-- Fuel bar -->
          <div class="fuel-row">
            <div class="fuel-label-val">
              <span class="aim-label">FUEL</span>
              <span class="val fuel-val">{{ Math.round(fuelPct * 100) }}%</span>
            </div>
            <div class="fuel-bar">
              <div class="fuel-fill" :style="{ width: (fuelPct * 100) + '%', background: fuelBarColor }" />
            </div>
            <div class="move-hint">[A] ◀ DRIVE ▶ [D]</div>
          </div>

          <!-- Aim controls -->
          <div class="aim-controls">
            <div class="aim-row">
              <div class="aim-label-val">
                <span class="aim-label">ANGLE</span>
                <span class="val">{{ aimAngle }}°</span>
              </div>
              <div class="slider-row">
                <button class="aim-arrow-btn" :disabled="isAnimating || aimAngle <= 1"
                  @mousedown.prevent="startBtnHold(() => aimAngle = Math.max(1,   aimAngle - 1))"
                  @touchstart.prevent="startBtnHold(() => aimAngle = Math.max(1,   aimAngle - 1))"
                  @mouseup="_clearBtnRepeat()" @mouseleave="_clearBtnRepeat()" @touchend="_clearBtnRepeat()">◀</button>
                <input type="range" min="1" max="179" v-model.number="aimAngle" class="slider slider--full" />
                <button class="aim-arrow-btn" :disabled="isAnimating || aimAngle >= 179"
                  @mousedown.prevent="startBtnHold(() => aimAngle = Math.min(179, aimAngle + 1))"
                  @touchstart.prevent="startBtnHold(() => aimAngle = Math.min(179, aimAngle + 1))"
                  @mouseup="_clearBtnRepeat()" @mouseleave="_clearBtnRepeat()" @touchend="_clearBtnRepeat()">▶</button>
              </div>
            </div>
            <div class="aim-row">
              <div class="aim-label-val">
                <span class="aim-label">POWER</span>
                <span class="val">{{ aimPower }}</span>
              </div>
              <div class="slider-row">
                <button class="aim-arrow-btn" :disabled="isAnimating || aimPower <= 10"
                  @mousedown.prevent="startBtnHold(() => aimPower = Math.max(10,  aimPower - 1))"
                  @touchstart.prevent="startBtnHold(() => aimPower = Math.max(10,  aimPower - 1))"
                  @mouseup="_clearBtnRepeat()" @mouseleave="_clearBtnRepeat()" @touchend="_clearBtnRepeat()">▼</button>
                <input type="range" min="10" max="100" v-model.number="aimPower" class="slider slider--full" />
                <button class="aim-arrow-btn" :disabled="isAnimating || aimPower >= 100"
                  @mousedown.prevent="startBtnHold(() => aimPower = Math.min(100, aimPower + 1))"
                  @touchstart.prevent="startBtnHold(() => aimPower = Math.min(100, aimPower + 1))"
                  @mouseup="_clearBtnRepeat()" @mouseleave="_clearBtnRepeat()" @touchend="_clearBtnRepeat()">▲</button>
              </div>
            </div>
          </div>

          <button class="btn-fire" @click="fire" :disabled="isAnimating">🚀 FIRE</button>
        </template>

        <template v-else-if="gameState.phase === 'aiming'">
          <div class="waiting-turn-msg">
            <span class="dot" :style="{ background: FACTIONS[gameState.turn].color }" />
            AWAITING<br />{{ FACTIONS[gameState.turn].shipName }}…
          </div>
        </template>

        <template v-else-if="gameState.phase === 'firing'">
          <div class="firing-text">— INCOMING —</div>
        </template>

        <template v-else-if="gameState.phase === 'results'">
          <div class="firing-text">{{ resultMessage }}</div>
        </template>
      </div>

    </div>

    <!-- ═══ Overlays ═══ -->
    <div v-if="showConfirm" class="game-status-overlay confirmation">
      <h2>{{ confirmMessage }}</h2>
      <p class="confirm-sub">Current battle progress will be lost.</p>
      <div class="confirm-actions">
        <button @click="handleConfirm" class="pill confirm-btn">PROCEED</button>
        <button @click="handleCancel" class="pill abort-btn">ABORT</button>
      </div>
    </div>

    <div v-if="showGameOver" class="game-status-overlay" :class="gameOverClass">
      <h2>{{ gameOverMessage }}</h2>
      <p class="confirm-sub">{{ gameOverSubtext }}</p>
      <p class="confirm-sub score-sub" v-if="isMultiplayer && playerRole">CUMULATIVE SCORE EARNED: +{{ myMatchScore }}</p>
      <div class="confirm-actions">
        <button @click="resetGame" class="pill confirm-btn">NEW BATTLE</button>
        <button @click="router.push('/games')" class="pill abort-btn">CLOSE</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMultiplayer } from '@/composables/useMultiplayer'
import { useGameScores } from '@/composables/useGameScores'
import { useActivityLog } from '@/composables/useActivityLog.js'
import {
  CANVAS_W, CANVAS_H, GRAVITY, TANK_W, TANK_H, MAX_HEALTH, WEAPONS, STARTING_AMMO,
  FUEL_PER_TURN,
  type PlayerRole, type Engine, type WeaponDef, type Point,
  type ShotReplay, type FlightSegment, type ExplosionEvent, type LastShot,
  createInitialState, resolveShot, computeMatchScore, weaponById, opponentOf,
  serializeState, deserializeState,
} from '@/components/games/FracturedFrontier/engine'
import { rtdb } from '@/firebase'
import { ref as dbRef, update as dbUpdate, set as dbSet, onValue } from 'firebase/database'
import federationBadge from '@/assets/icons/starship1c.svg'
import romulanBadge from '@/assets/icons/drone-front1c.svg'
import gameLogo from '@/assets/images/games/title-fracturedfrontier.svg'
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav'

const router = useRouter()
const route = useRoute()
const isVisible = ref(false)

const roles: PlayerRole[] = ['host', 'guest']

// ─── Faction theming (display-only — the engine stays faction-agnostic) ──────
// Per Joshua: host (room creator) defaults to the Federation, guest (joiner)
// to the Romulans — same convention Chess uses for assigning sides — and BOTH
// factions use an IDENTICAL weapon roster so it's never confusing for a
// student no matter which side they end up playing.
const FACTIONS: Record<PlayerRole, { name: string; shipName: string; color: string; badge: string }> = {
  host: {
    name: 'United Federation of Planets',
    shipName: 'U.S.S. ENTERPRISE',
    color: '#5ec3ff',
    badge: federationBadge,
  },
  guest: {
    name: 'Romulan Star Empire',
    shipName: 'I.R.W. HAAKONA',
    color: '#39ff6a',
    badge: romulanBadge,
  },
}

// ─── Multiplayer wiring ───────────────────────────────────────────────────────
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
  error: multiplayerError,
} = useMultiplayer()

const scoreComposable = useGameScores('fractured_frontier', { lowerIsBetter: false })
const { logEvent } = useActivityLog()
const gameStartLogged = ref(false)
const scoreSubmitted = ref(false)

const playerRole = computed<PlayerRole | null>(() => {
  if (!isMultiplayer.value || !remoteRoom.value) return null
  // useMultiplayer assigns 'white' to the host and 'black' to the guest —
  // map those onto our Federation/Romulan roles.
  if (playerColor.value === 'white') return 'host'
  if (playerColor.value === 'black') return 'guest'
  return null
})

const waitingForOpponent = computed<boolean>(() => isMultiplayer.value && remoteRoom.value?.status === 'waiting')

const canAct = computed<boolean>(() => {
  if (gameState.value.phase !== 'aiming') return false
  if (isMultiplayer.value) return !!playerRole.value && gameState.value.turn === playerRole.value
  return true // pass & play — whichever seat is "up" controls the panel
})

const turnLabel = computed<string>(() => {
  if (isMultiplayer.value) {
    return gameState.value.turn === playerRole.value ? 'YOUR TURN' : 'ENEMY TURN'
  }
  return gameState.value.turn === 'host' ? 'PLAYER 1' : 'PLAYER 2'
})

// ─── Game state ───────────────────────────────────────────────────────────────
const gameState = ref<Engine>(createInitialState())
const DEFAULT_ANGLE = 45
const DEFAULT_POWER = 50

const aimAngle = ref(DEFAULT_ANGLE)
const aimPower = ref(DEFAULT_POWER)
const selectedWeapon = ref('torpedo')
const resultMessage = ref('')
const isAnimating = ref(false)

// Each captain's most recent angle/power "firing solution" — remembered across
// their own turns so a good shot (or a near-miss worth fine-tuning) doesn't
// have to be re-dialed-in from scratch every round. Weapon choice is
// intentionally NOT remembered: ammo is limited, so each turn defaults back to
// the always-available torpedo rather than silently re-arming a scarce weapon.
const lastAimByRole: Record<PlayerRole, { angle: number; power: number } | null> = {
  host: null,
  guest: null,
}

// Ghost aim line — drawn as a faint static reference during the next turn so
// the player can see where their previous shot originated.
const prevShotAimByRole: Record<PlayerRole, { angle: number; power: number; shipX: number; shipY: number } | null> = {
  host: null,
  guest: null,
}

// ─── Movement state ───────────────────────────────────────────────────────────
const fuelUsed = ref(0)   // fuel consumed this turn (resets each turn)

const fuelPct      = computed(() => Math.max(0, 1 - fuelUsed.value / FUEL_PER_TURN))
const fuelBarColor = computed(() => {
  const p = fuelPct.value
  if (p > 0.5)  return '#39ff6a'  // green
  if (p > 0.25) return '#ffd700'  // yellow
  if (p > 0.1)  return '#ff8c00'  // orange
  return '#ff3b3b'                // red
})

// ─── RTDB live cursor — opponent's realtime aim + position ────────────────────
/** Opponent's live aim angle/power (updated via RTDB while it's their turn). */
const opponentLiveAngle = ref<number | null>(null)
const opponentLivePower = ref<number | null>(null)
/** Used to update displayShips in real time when opponent moves. */
let liveUnsub: (() => void) | null = null

function resetAimDefaults() {
  aimAngle.value = DEFAULT_ANGLE
  aimPower.value = DEFAULT_POWER
  selectedWeapon.value = 'torpedo'
  fuelUsed.value = 0
}

/** Restores the upcoming shooter's last-used angle/power (or the defaults, on
 *  their first turn) and resets the weapon selector and fuel. */
function recallAimForTurn(role: PlayerRole) {
  const remembered = lastAimByRole[role]
  aimAngle.value = remembered ? remembered.angle : DEFAULT_ANGLE
  aimPower.value = remembered ? remembered.power : DEFAULT_POWER
  selectedWeapon.value = 'torpedo'
  fuelUsed.value = 0
}

/** Photon torpedoes are unlimited; every other weapon draws from a finite
 *  per-ship stockpile. A weapon with no rounds left for the active captain
 *  shows as greyed-out / unselectable in the loadout row. */
function isWeaponDepleted(w: WeaponDef): boolean {
  if (w.id === 'torpedo') return false
  return (gameState.value.ships[gameState.value.turn]?.ammo[w.id] ?? 0) <= 0
}

/** Current remaining ammo for the active shooter — drives the pip count. */
function getWeaponAmmo(w: WeaponDef): number {
  return gameState.value.ships[gameState.value.turn]?.ammo[w.id] ?? 0
}

// ─── Canvas + "live preview" battlefield ──────────────────────────────────────
// render() always draws from displayTerrain/displayShips rather than directly
// from gameState. They start as a clone of the pre-shot battlefield and snap to
// each explosion's authoritative checkpoint (see engine ExplosionEvent) the
// instant that impact lands — terrain carving + damage apply immediately, VFX
// plays on top — exactly mirroring the original sim, and identically on both
// clients since the checkpoints are part of the deterministic replay data.
const gameCanvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animFrame = 0
let turnTimeout: ReturnType<typeof setTimeout> | null = null

const displayTerrain = ref<number[]>(gameState.value.terrain.slice())
const displayShips = ref<Record<PlayerRole, { health: number; shield: number; x: number; y: number }>>({
  host: { ...gameState.value.ships.host },
  guest: { ...gameState.value.ships.guest },
})

function syncDisplayToState() {
  displayTerrain.value = gameState.value.terrain.slice()
  displayShips.value = {
    host: { ...gameState.value.ships.host },
    guest: { ...gameState.value.ships.guest },
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const n = parseInt(full, 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbaColor(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function render() {
  if (!ctx) return
  const t = displayTerrain.value
  const w = CANVAS_W
  const h = CANVAS_H

  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#000814')
  sky.addColorStop(0.55, '#001830')
  sky.addColorStop(1, '#03101f')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (let i = 0; i < 130; i++) {
    const sx = (i * 137.5) % w
    const sy = (i * 97.31) % (h * 0.62)
    const sz = i % 7 === 0 ? 2 : 1
    ctx.fillRect(Math.round(sx), Math.round(sy), sz, sz)
  }

  const terrainGrad = ctx.createLinearGradient(0, h * 0.4, 0, h)
  terrainGrad.addColorStop(0, '#2c2c46')
  terrainGrad.addColorStop(0.35, '#3c3c5e')
  terrainGrad.addColorStop(1, '#0a0a18')
  ctx.fillStyle = terrainGrad
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x < w; x++) ctx.lineTo(x, t[x])
  ctx.lineTo(w - 1, h)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(122,122,255,0.85)'
  ctx.lineWidth = 1.5
  ctx.shadowColor = '#7a7aff'
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.moveTo(0, t[0])
  for (let x = 1; x < w; x++) ctx.lineTo(x, t[x])
  ctx.stroke()
  ctx.shadowBlur = 0

  roles.forEach(role => {
    const ship = displayShips.value[role]
    if (!ship || ship.health <= 0) return
    drawShip(role, ship, role === gameState.value.turn && gameState.value.phase === 'aiming')
  })

  if (gameState.value.phase === 'aiming' && canAct.value) {
    drawAimLine()
  }

  // Opponent ghost aim — visible while waiting for their turn (multiplayer only)
  if (isMultiplayer.value && !canAct.value && gameState.value.phase === 'aiming') {
    drawOpponentGhostAim()
  }
}

function drawShip(role: PlayerRole, ship: { health: number; shield: number; x: number; y: number }, isActive: boolean) {
  if (!ctx) return
  const faction = FACTIONS[role]
  const { x, y } = ship
  const color = faction.color
  const dir = role === 'host' ? 1 : -1
  const barrelLen = 18

  ctx.save()
  if (isActive) {
    ctx.shadowColor = color
    ctx.shadowBlur = 12
  }

  ctx.fillStyle = color
  ctx.fillRect(x - TANK_W / 2, y, TANK_W, 12)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(x - TANK_W / 2, y + 9, TANK_W, 3)

  // Barrel: active ship aims live; idle ship rests at a fixed inward angle.
  // (Both cases reduce to the same formula — see engine drawShip note in
  // FracturedFrontierGame.vue history: cos(angle)*dir on x, sin(angle) on y.)
  const angle = isActive ? (aimAngle.value * Math.PI) / 180 : Math.PI / 4
  const tipX = x + Math.cos(angle) * barrelLen * dir
  const tipY = y + 6 - Math.sin(angle) * barrelLen

  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y + 6)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  if (ship.shield > 0) {
    ctx.strokeStyle = 'rgba(120,220,255,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y + 6, TANK_W, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  ctx.fillStyle = color
  ctx.font = '9px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(faction.shipName.split(' ').pop() || faction.shipName, x, y - 6)
}

function drawAimLine() {
  if (!ctx) return
  const role = gameState.value.turn
  const ship = displayShips.value[role]
  if (!ship || ship.health <= 0) return

  const angleRad = (aimAngle.value * Math.PI) / 180
  const power = aimPower.value * 0.12
  const dir = role === 'host' ? 1 : -1
  const wind = gameState.value.wind

  // ── Ghost line from previous shot (same role, stored ship position) ─────────
  {
    const ghost = prevShotAimByRole[role]
    if (ghost) {
      const gRad = (ghost.angle * Math.PI) / 180
      const gPow = ghost.power * 0.12
      let px = ghost.shipX, py = ghost.shipY
      let vx = Math.cos(gRad) * gPow * dir
      let vy = -Math.sin(gRad) * gPow
      ctx.setLineDash([2, 6])
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px, py)
      for (let step = 0; step < 80; step++) {
        px += vx; py += vy
        vy += GRAVITY; vx += wind * 0.01
        if (px < 0 || px >= CANVAS_W || py > CANVAS_H) break
        if (py < 0) { ctx.moveTo(px, 0); continue }
        ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // ── Short bright aim line (40 steps, from barrel tip) ─────────────────────
  {
    const barrelLen = 18
    let px = ship.x + Math.cos(angleRad) * barrelLen * dir
    let py = ship.y + 6 - Math.sin(angleRad) * barrelLen
    let vx = Math.cos(angleRad) * power * dir
    let vy = -Math.sin(angleRad) * power
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(255,255,160,0.65)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(px, py)
    for (let step = 0; step < 40; step++) {
      px += vx; py += vy
      vy += GRAVITY; vx += wind * 0.01
      if (px < 0 || px >= CANVAS_W || py > CANVAS_H) break
      if (py < 0) { ctx.moveTo(px, 0); continue }
      ctx.lineTo(px, py)
    }
    ctx.stroke()
    ctx.setLineDash([])
  }
}

// ── Opponent ghost aim (drawn on your screen while waiting for their turn) ────
// Shows a faint arc in the opponent's faction colour — you can watch them aim.

function drawOpponentGhostAim() {
  if (!ctx) return
  if (opponentLiveAngle.value === null || opponentLivePower.value === null) return
  if (!playerRole.value) return

  const opRole = opponentOf(playerRole.value)
  const opShip  = displayShips.value[opRole]
  if (!opShip || opShip.health <= 0) return

  const angle   = opponentLiveAngle.value
  const power   = opponentLivePower.value
  const gRad    = (angle * Math.PI) / 180
  const gPow    = power * 0.12
  const dir     = opRole === 'host' ? 1 : -1
  const wind    = gameState.value.wind
  const barrelLen = 18

  let px = opShip.x + Math.cos(gRad) * barrelLen * dir
  let py = opShip.y + 6 - Math.sin(gRad) * barrelLen
  let vx = Math.cos(gRad) * gPow * dir
  let vy = -Math.sin(gRad) * gPow

  const [r, g, b] = hexToRgb(FACTIONS[opRole].color)
  ctx.setLineDash([3, 6])
  ctx.strokeStyle = `rgba(${r},${g},${b},0.45)`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px, py)
  for (let step = 0; step < 60; step++) {
    px += vx; py += vy
    vy += GRAVITY; vx += wind * 0.01
    if (px < 0 || px >= CANVAS_W || py > CANVAS_H) break
    if (py < 0) { ctx.moveTo(px, 0); continue }
    ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

// ── Tank movement ─────────────────────────────────────────────────────────────
// Moves the active tank along the terrain surface, consuming fuel. Both keyboard
// (M-mode arrows) and the on-screen ◀▶ hold buttons call this.

const MOVE_STEP = 3   // pixels per repeat tick (same cadence as aim arrow repeat)
const MOVE_MARGIN = 24 // minimum X distance from canvas edge

function _stepMove(dir: 'left' | 'right') {
  if (!canAct.value || isAnimating.value) return
  if (fuelUsed.value >= FUEL_PER_TURN) return

  const role    = gameState.value.turn
  const ship    = gameState.value.ships[role]
  const terrain = gameState.value.terrain

  const remaining = FUEL_PER_TURN - fuelUsed.value
  const step      = Math.min(MOVE_STEP, remaining)
  const rawX      = ship.x + (dir === 'left' ? -step : step)
  const newX      = Math.max(MOVE_MARGIN, Math.min(CANVAS_W - MOVE_MARGIN, rawX))
  const dist      = Math.abs(newX - ship.x)
  if (dist === 0) return

  // Terrain follow: use the MINIMUM terrain value (= highest point on screen)
  // in a small window around the destination. This prevents the tank from being
  // embedded in a cliff face — if a wall is within ±3 px, the tank rises to sit
  // on top of it rather than halfway through it.
  const SMOOTH = 3
  let surfaceY = terrain[Math.round(newX)]
  for (let dx = -SMOOTH; dx <= SMOOTH; dx++) {
    const ix = Math.round(newX) + dx
    if (ix >= 0 && ix < CANVAS_W) surfaceY = Math.min(surfaceY, terrain[ix])
  }
  const newY = surfaceY - TANK_H

  // Slope-based fuel cost: uphill travel consumes extra fuel proportional to
  // the height gained, so climbing hills feels noticeably slower/costlier.
  // terrain[x] is screen-Y (smaller = higher on screen), so:
  //   oldSurface - surfaceY > 0  →  new position is higher  →  uphill
  const oldSurface  = terrain[Math.round(ship.x)]
  const heightGain  = Math.max(0, oldSurface - surfaceY)   // px climbed (0 on flat/downhill)
  const UPHILL_COST = 1.5                                   // extra fuel per px of elevation
  const fuelCost    = dist + heightGain * UPHILL_COST
  fuelUsed.value    = Math.min(FUEL_PER_TURN, fuelUsed.value + fuelCost)

  // Update both game state and display layer (movement is local until fire commits)
  gameState.value = {
    ...gameState.value,
    ships: { ...gameState.value.ships, [role]: { ...ship, x: newX, y: newY } },
  }
  displayShips.value = {
    ...displayShips.value,
    [role]: { ...displayShips.value[role], x: newX, y: newY },
  }

  // Stream live position to RTDB so the opponent sees the tank moving
  if (isMultiplayer.value && joinCode.value) {
    dbUpdate(dbRef(rtdb, `live/${joinCode.value}/${role}`), { x: newX, fuelUsed: fuelUsed.value })
  }

  render()
}

function drawTrail(trail: Point[], weapon: WeaponDef) {
  if (!ctx || !trail.length) return

  // Beam weapons draw a sweeping line from origin to current head rather than dots.
  if (weapon.beamWeapon) {
    const start = trail[0]
    const end = trail[trail.length - 1]
    ctx.save()
    ctx.strokeStyle = weapon.color
    ctx.lineWidth = 2.5
    ctx.shadowColor = weapon.color
    ctx.shadowBlur = 12
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    // Bright core line
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    ctx.restore()
    return
  }

  // Shots above the canvas (y < 0) are invisible — skip rendering them.
  trail.forEach((pt, i) => {
    if (pt.y < 0) return
    const alpha = (i + 1) / trail.length
    ctx!.fillStyle = rgbaColor(weapon.color, alpha * 0.7)
    ctx!.beginPath()
    ctx!.arc(pt.x, pt.y, 2, 0, Math.PI * 2)
    ctx!.fill()
  })
  const head = trail[trail.length - 1]
  if (head.y >= 0) {
    ctx.fillStyle = weapon.color
    ctx.shadowColor = weapon.color
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(head.x, head.y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

function drawExplosionFrame(exp: ExplosionEvent, frame: number, totalFrames: number) {
  if (!ctx) return
  const progress = frame / totalFrames
  const r = exp.radius * progress
  const alpha = 1 - progress

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = exp.color
  ctx.lineWidth = 3
  ctx.shadowColor = exp.color
  ctx.shadowBlur = 20
  ctx.beginPath()
  ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2)
  ctx.stroke()

  const inner = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, Math.max(1, r * 0.6))
  inner.addColorStop(0, `rgba(255,255,255,${alpha})`)
  inner.addColorStop(1, 'rgba(255,100,0,0)')
  ctx.fillStyle = inner
  ctx.beginPath()
  ctx.arc(exp.x, exp.y, r * 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ─── Replay playback (identical on both the firing client and the receiver) ──

function animateGroup(group: FlightSegment[]): Promise<void> {
  return new Promise(resolve => {
    if (!group.length) { resolve(); return }
    const trails: Point[][] = group.map(() => [])
    // Beam weapons advance 5 points per frame (fast sweep); others advance 1.
    const frameStep = group.some(f => weaponById(f.weaponId)?.beamWeapon) ? 5 : 1
    const maxLen = Math.max(1, ...group.map(f => Math.ceil(f.points.length / frameStep)))
    let frame = 0

    function step() {
      render()
      group.forEach((flight, i) => {
        if (!flight.points.length) return
        const idx = Math.min(frame * frameStep, flight.points.length - 1)
        trails[i].push(flight.points[idx])
        const w = weaponById(flight.weaponId)
        // Beam trails keep every point (drawn as a growing line); others cap at 28 dots.
        if (!w?.beamWeapon && trails[i].length > 28) trails[i].shift()
        if (w) drawTrail(trails[i], w)
      })

      frame++
      if (frame < maxLen) {
        animFrame = requestAnimationFrame(step)
        return
      }

      const explosions = group.map(f => f.explosion).filter((e): e is ExplosionEvent => !!e)
      if (!explosions.length) { resolve(); return }

      // Impacts apply instantly — terrain carve + damage land the moment the
      // projectile arrives, with the VFX playing on top (mirrors the original
      // sim). resolveShot() threads explosions sequentially, so the LAST
      // checkpoint already folds in every sibling's effect — snapping to it
      // captures this whole group's full outcome in one deterministic step.
      const final = explosions[explosions.length - 1]
      displayTerrain.value = final.resultingTerrain.slice()
      displayShips.value = {
        host: { ...final.resultingShips.host },
        guest: { ...final.resultingShips.guest },
      }
      animateExplosions(explosions, resolve)
    }
    animFrame = requestAnimationFrame(step)
  })
}

function animateExplosions(explosions: ExplosionEvent[], done: () => void) {
  let frame = 0
  const totalFrames = 18
  function drawFrame() {
    render()
    explosions.forEach(exp => drawExplosionFrame(exp, frame, totalFrames))
    frame++
    if (frame < totalFrames) {
      animFrame = requestAnimationFrame(drawFrame)
    } else {
      done()
    }
  }
  animFrame = requestAnimationFrame(drawFrame)
}

async function playReplay(replay: ShotReplay) {
  isAnimating.value = true
  for (const group of replay.groups) {
    await animateGroup(group)
  }
  isAnimating.value = false
}

function shipLabel(role: PlayerRole): string {
  return FACTIONS[role].shipName.split(' ').pop() || FACTIONS[role].shipName
}

function formatHitMessage(replay: ShotReplay): string {
  const parts: string[] = []
  if (replay.damageDealt.host > 0) parts.push(`${shipLabel('host')} -${replay.damageDealt.host}`)
  if (replay.damageDealt.guest > 0) parts.push(`${shipLabel('guest')} -${replay.damageDealt.guest}`)
  return parts.length ? `DIRECT HIT!  ${parts.join('   ')}` : 'MISSED — NO IMPACT'
}

// ─── Firing ───────────────────────────────────────────────────────────────────

async function fire() {
  if (gameState.value.phase !== 'aiming' || !canAct.value || isAnimating.value) return

  const weapon = weaponById(selectedWeapon.value)
  if (!weapon) return
  const firedBy = gameState.value.turn
  const shooter = gameState.value.ships[firedBy]
  if (weapon.id !== 'torpedo' && (shooter.ammo[weapon.id] ?? 0) <= 0) return

  // Remember this captain's firing solution — restored automatically the next
  // time it's their turn (see recallAimForTurn) so a good shot doesn't have to
  // be re-dialed-in from scratch.
  lastAimByRole[firedBy] = { angle: aimAngle.value, power: aimPower.value }

  // Snapshot for the static ghost aim line shown on the next turn.
  prevShotAimByRole[firedBy] = {
    angle: aimAngle.value,
    power: aimPower.value,
    shipX: shooter.x,
    shipY: shooter.y,
  }

  // Capture moved position (if the player repositioned before firing) so the
  // receiving client can replay the shot from the correct starting point.
  const movedToX = fuelUsed.value > 0 ? shooter.x : undefined

  const priorState = gameState.value
  const { nextState, replay } = resolveShot(priorState, firedBy, weapon.id, aimAngle.value, aimPower.value)

  gameState.value = { ...priorState, phase: 'firing' }
  resultMessage.value = ''
  syncDisplayToState()

  await playReplay(replay)
  resultMessage.value = formatHitMessage(replay)

  if (isMultiplayer.value) {
    // Clear live RTDB cursor now that the turn is committed
    if (joinCode.value && playerRole.value) {
      dbSet(dbRef(rtdb, `live/${joinCode.value}/${playerRole.value}`), null).catch(() => {})
    }
    try {
      await submitMove(
        { type: 'shot', firedBy, weaponId: weapon.id, angle: aimAngle.value, power: aimPower.value, movedToX },
        serializeState(nextState),
        nextState.turn,
      )
    } catch (e) {
      console.error('FracturedFrontier: failed to submit move', e)
    }
  }

  applyResolvedState(nextState)
}

function applyResolvedState(nextState: Engine) {
  gameState.value = nextState
  syncDisplayToState()
  render()

  if (nextState.phase === 'over') {
    handleGameOver(nextState)
    return
  }

  if (turnTimeout) clearTimeout(turnTimeout)
  turnTimeout = setTimeout(() => {
    if (gameState.value.phase === 'results') {
      gameState.value = { ...gameState.value, phase: 'aiming' }
      recallAimForTurn(gameState.value.turn)
      render()
    }
  }, 1800)
}

// ─── Game over ────────────────────────────────────────────────────────────────

const showGameOver = ref(false)
const gameOverMessage = ref('')
const gameOverSubtext = ref('')
const gameOverClass = ref('')
const myMatchScore = ref(0)

function handleGameOver(state: Engine) {
  let subtext: string
  let cls: string
  const draw = state.winner === null

  if (isMultiplayer.value && playerRole.value) {
    const won = state.winner === playerRole.value
    subtext = draw
        ? 'STALEMATE — BOTH FLEETS HOLD'
        : won
            ? 'VICTORY — ENEMY FLEET DESTROYED'
            : 'DEFEAT — YOUR FLEET HAS FALLEN'
    cls = draw ? 'draw' : (won ? 'win' : 'lost')

    // Cumulative scoring (per Joshua: every match counts, win or lose — total
    // damage dealt to the opponent, plus a flat bonus for winning, so playing
    // often outranks not playing at all).
    myMatchScore.value = computeMatchScore(state, playerRole.value)
    if (!scoreSubmitted.value) {
      scoreSubmitted.value = true
      scoreComposable.incrementScore(myMatchScore.value, { result: draw ? 'draw' : (won ? 'win' : 'loss') })
    }
  } else {
    subtext = draw ? 'STALEMATE — BOTH FLEETS HOLD' : `${FACTIONS[state.winner as PlayerRole].shipName} VICTORIOUS`
    cls = draw ? 'draw' : 'win'
  }

  gameOverMessage.value = 'BATTLE COMPLETE'
  gameOverSubtext.value = subtext
  gameOverClass.value = cls
  playSound(soundSuccess)
  showGameOver.value = true
}

// ─── Reset ────────────────────────────────────────────────────────────────────

const showConfirm = ref(false)
const confirmMessage = ref('')
let confirmActionCallback: (() => void) | null = null

function resetGame() {
  const action = async () => {
    showGameOver.value = false
    showConfirm.value = false
    scoreSubmitted.value = false
    if (turnTimeout) clearTimeout(turnTimeout)
    if (animFrame) cancelAnimationFrame(animFrame)
    isAnimating.value = false
    resultMessage.value = ''
    resetAimDefaults()
    lastAimByRole.host = null
    lastAimByRole.guest = null
    prevShotAimByRole.host = null
    prevShotAimByRole.guest = null

    const fresh = createInitialState()
    if (isMultiplayer.value) {
      await resetRemoteGame(serializeState(fresh))
    }
    gameState.value = fresh
    syncDisplayToState()
    render()
  }

  const hasProgress =
      gameState.value.phase !== 'over' &&
      (gameState.value.round > 1 ||
          gameState.value.ships.host.health < MAX_HEALTH ||
          gameState.value.ships.guest.health < MAX_HEALTH)

  if (hasProgress) {
    confirmMessage.value = 'ARE YOU SURE YOU WANT TO RESET?'
    confirmActionCallback = action
    showConfirm.value = true
  } else {
    action()
  }
}

function handleConfirm() {
  showConfirm.value = false
  confirmActionCallback?.()
  confirmActionCallback = null
}

function handleCancel() {
  showConfirm.value = false
  confirmActionCallback = null
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function goToGames() {
  router.push('/games/fractured-frontier')
}

function playSound(src: string) {
  try {
    const audio = new Audio(src)
    audio.volume = 0.5
    audio.play().catch(() => {})
  } catch (e) { /* ignore */ }
}

// ─── Multiplayer sync ─────────────────────────────────────────────────────────
// "Approach A" — full-state sync + deterministic replay. The firing client
// computes the authoritative outcome locally (resolveShot) and submits the
// resulting boardState; the receiving client recomputes the SAME shot against
// its own (identical, already-synced) prior state — producing a bit-identical
// replay — animates it, then snaps to the synced state as ground truth.

function shotsEqual(a?: LastShot | null, b?: LastShot | null): boolean {
  if (!a || !b) return a === b
  return a.firedBy === b.firedBy && a.weaponId === b.weaponId && a.angle === b.angle && a.power === b.power
}

const hasSyncedOnce = ref(false)

// Redraw whenever aim changes so the barrel and aim lines update live.
// Also push the new aim to RTDB so the opponent sees the ghost arc update.
watch([aimAngle, aimPower], () => {
  if (gameState.value.phase === 'aiming') {
    render()
    if (isMultiplayer.value && playerRole.value && joinCode.value) {
      dbUpdate(dbRef(rtdb, `live/${joinCode.value}/${playerRole.value}`), {
        angle: aimAngle.value,
        power: aimPower.value,
      })
    }
  }
})

// Reset weapon to torpedo the moment the next player gains control (canAct
// flips to true). Watching canAct instead of turn fires at exactly the right
// instant — when phase becomes 'aiming' — rather than during the results
// window, which is more robust across all code paths (local, multiplayer snap).
watch(canAct, (nowCanAct) => {
  if (nowCanAct) selectedWeapon.value = 'torpedo'
})

watch(remoteRoom, async (newRoom) => {
  if (!gameStartLogged.value && newRoom?.players?.white && newRoom?.players?.black) {
    gameStartLogged.value = true
    logEvent('game_start', { gameId: 'fractured_frontier' })
  }
  if (!newRoom?.boardState) return

  let parsed: Engine
  try {
    parsed = deserializeState(newRoom.boardState)
  } catch (e) {
    console.error('FracturedFrontier: failed to parse remote board state', e)
    return
  }

  // First sync (fresh room OR reconnect mid-game) — snap directly, no replay;
  // we have no "before" state to animate from.
  if (!hasSyncedOnce.value) {
    hasSyncedOnce.value = true
    gameState.value = parsed
    syncDisplayToState()
    render()
    if (parsed.phase === 'over' && !showGameOver.value) handleGameOver(parsed)
    return
  }

  const incoming = parsed.lastShot
  const isFreshOpponentShot =
      !!incoming &&
      !!playerRole.value &&
      incoming.firedBy !== playerRole.value &&
      !shotsEqual(incoming, gameState.value.lastShot)

  if (isFreshOpponentShot && incoming && !isAnimating.value) {
    let priorState = gameState.value

    // If the opponent moved before firing, patch their ship to the fired-from
    // position before running the replay — otherwise our resolveShot starts the
    // flight from the old (pre-move) coordinates and the trajectories diverge.
    if (incoming.movedToX !== undefined) {
      const terrain = priorState.terrain
      const SMOOTH  = 3
      let surfaceY  = terrain[Math.round(incoming.movedToX)]
      for (let dx = -SMOOTH; dx <= SMOOTH; dx++) {
        const ix = Math.round(incoming.movedToX) + dx
        if (ix >= 0 && ix < CANVAS_W) surfaceY = Math.min(surfaceY, terrain[ix])
      }
      const movedY = surfaceY - TANK_H
      priorState = {
        ...priorState,
        ships: {
          ...priorState.ships,
          [incoming.firedBy]: { ...priorState.ships[incoming.firedBy], x: incoming.movedToX, y: movedY },
        },
      }
      // Also update the display layer so the tank renders at the moved position
      displayShips.value = {
        ...displayShips.value,
        [incoming.firedBy]: { ...displayShips.value[incoming.firedBy], x: incoming.movedToX, y: movedY },
      }
      render()
    }

    try {
      const { replay } = resolveShot(priorState, incoming.firedBy, incoming.weaponId, incoming.angle, incoming.power)
      gameState.value = { ...priorState, phase: 'firing' }
      resultMessage.value = ''
      syncDisplayToState()
      await playReplay(replay)
      resultMessage.value = formatHitMessage(replay)
      applyResolvedState(parsed)
      return
    } catch (e) {
      console.error('FracturedFrontier: failed to recompute opponent shot for replay — snapping directly', e)
      // fall through to a direct snap below
    }
  }

  gameState.value = parsed
  syncDisplayToState()
  render()
  if (parsed.phase === 'over' && !showGameOver.value) handleGameOver(parsed)
})

// ─── RTDB live cursor subscription ───────────────────────────────────────────
// Subscribe to the OPPONENT's live node so we see their movement and aim arc
// in real time while waiting for their turn to complete.

watch(
  () => [playerRole.value, joinCode.value] as const,
  ([role, code]) => {
    // Clean up any previous subscription
    liveUnsub?.()
    liveUnsub = null
    opponentLiveAngle.value = null
    opponentLivePower.value  = null

    if (!role || !code) return

    const opRole  = opponentOf(role)
    const liveRef = dbRef(rtdb, `live/${code}/${opRole}`)

    liveUnsub = onValue(liveRef, (snap) => {
      const data = snap.val() as { x?: number; fuelUsed?: number; angle?: number; power?: number } | null

      if (!data) {
        // Opponent cleared their cursor after firing — wipe ghost aim
        opponentLiveAngle.value = null
        opponentLivePower.value  = null
        return
      }

      // Live position — update display layer so tank appears to move in real time
      if (typeof data.x === 'number') {
        const terrain = gameState.value.terrain
        const SMOOTH  = 3
        let surfaceY  = terrain[Math.round(data.x)]
        for (let dx = -SMOOTH; dx <= SMOOTH; dx++) {
          const ix = Math.round(data.x) + dx
          if (ix >= 0 && ix < CANVAS_W) surfaceY = Math.min(surfaceY, terrain[ix])
        }
        const newY = surfaceY - TANK_H
        displayShips.value = {
          ...displayShips.value,
          [opRole]: { ...displayShips.value[opRole], x: data.x, y: newY },
        }
      }

      // Live aim — drives the ghost trajectory arc
      if (typeof data.angle === 'number') opponentLiveAngle.value = data.angle
      if (typeof data.power === 'number') opponentLivePower.value  = data.power

      if (gameState.value.phase === 'aiming') render()
    })
  },
  { immediate: true },
)

// ─── Lifecycle ────────────────────────────────────────────────────────────────

// ── A/D movement key repeat — separate from aim-arrow repeat ─────────────────
// A/D always drive the tank regardless of what the arrow keys are doing,
// so they get their own timer set so both can be held simultaneously.

let _moveSlowTimer:  ReturnType<typeof setInterval>  | null = null
let _moveFastTimer:  ReturnType<typeof setInterval>  | null = null
let _moveAccelTimer: ReturnType<typeof setTimeout>   | null = null

function _clearMoveRepeat() {
  if (_moveSlowTimer)  { clearInterval(_moveSlowTimer);   _moveSlowTimer  = null }
  if (_moveFastTimer)  { clearInterval(_moveFastTimer);   _moveFastTimer  = null }
  if (_moveAccelTimer) { clearTimeout(_moveAccelTimer);   _moveAccelTimer = null }
}

// ── Arrow-key aim controls ────────────────────────────────────────────────────
// Left/Right → angle ±1°.  Up/Down → power ±1.
// Holding a key accelerates: slow repeat (120 ms) for 500 ms, then fast (40 ms).

let _keySlowTimer:  ReturnType<typeof setInterval>  | null = null
let _keyFastTimer:  ReturnType<typeof setInterval>  | null = null
let _keyAccelTimer: ReturnType<typeof setTimeout>   | null = null

function _clearKeyRepeat() {
  if (_keySlowTimer)  { clearInterval(_keySlowTimer);   _keySlowTimer  = null }
  if (_keyFastTimer)  { clearInterval(_keyFastTimer);   _keyFastTimer  = null }
  if (_keyAccelTimer) { clearTimeout(_keyAccelTimer);   _keyAccelTimer = null }
}

// ── Button hold-to-repeat (same two-speed ramp as keyboard) ─────────────────

let _btnSlowTimer:  ReturnType<typeof setInterval>  | null = null
let _btnFastTimer:  ReturnType<typeof setInterval>  | null = null
let _btnAccelTimer: ReturnType<typeof setTimeout>   | null = null

function _clearBtnRepeat() {
  if (_btnSlowTimer)  { clearInterval(_btnSlowTimer);   _btnSlowTimer  = null }
  if (_btnFastTimer)  { clearInterval(_btnFastTimer);   _btnFastTimer  = null }
  if (_btnAccelTimer) { clearTimeout(_btnAccelTimer);   _btnAccelTimer = null }
}

function startBtnHold(fn: () => void) {
  _clearBtnRepeat()
  fn()                                          // fire immediately on press
  _btnSlowTimer  = setInterval(fn, 120)
  _btnAccelTimer = setTimeout(() => {
    clearInterval(_btnSlowTimer!); _btnSlowTimer = null
    _btnFastTimer = setInterval(fn, 40)
  }, 500)
}

function _stepAim(key: string) {
  if (gameState.value.phase !== 'aiming' || !canAct.value) return
  if (key === 'ArrowLeft')  aimAngle.value = Math.max(1,   aimAngle.value - 1)
  if (key === 'ArrowRight') aimAngle.value = Math.min(179, aimAngle.value + 1)
  if (key === 'ArrowUp')    aimPower.value = Math.min(100, aimPower.value + 1)
  if (key === 'ArrowDown')  aimPower.value = Math.max(10,  aimPower.value - 1)
}

function _onKeyDown(e: KeyboardEvent) {
  // ── Spacebar → fire ───────────────────────────────────────────────────────
  if (e.key === ' ') {
    if (gameState.value.phase === 'aiming' && canAct.value && !isAnimating.value && !e.repeat) {
      e.preventDefault()
      fire()
    }
    return
  }

  // ── Number keys 1–6 → select weapon ──────────────────────────────────────
  if (e.key >= '1' && e.key <= '6') {
    if (gameState.value.phase === 'aiming' && canAct.value && !e.repeat) {
      const idx = Number(e.key) - 1
      const w = WEAPONS[idx]
      if (w && !isWeaponDepleted(w)) selectedWeapon.value = w.id
    }
    return
  }

  // ── A / D → drive tank left / right ──────────────────────────────────────
  if (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') {
    if (gameState.value.phase !== 'aiming' || !canAct.value || isAnimating.value) return
    e.preventDefault()
    if (e.repeat) return  // we handle our own repeat
    _clearMoveRepeat()
    const dir = (e.key === 'a' || e.key === 'A') ? 'left' : 'right'
    _stepMove(dir)
    _moveSlowTimer  = setInterval(() => _stepMove(dir), 120)
    _moveAccelTimer = setTimeout(() => {
      clearInterval(_moveSlowTimer!); _moveSlowTimer = null
      _moveFastTimer = setInterval(() => _stepMove(dir), 40)
    }, 500)
    return
  }

  // ── Arrow keys → adjust aim angle / power ────────────────────────────────
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
  if (gameState.value.phase !== 'aiming' || !canAct.value) return
  e.preventDefault()   // prevent page scroll
  if (e.repeat) return // suppress browser autorepeat — we manage our own

  _clearKeyRepeat()
  _stepAim(e.key)
  const key = e.key
  _keySlowTimer  = setInterval(() => _stepAim(key), 120)
  _keyAccelTimer = setTimeout(() => {
    clearInterval(_keySlowTimer!); _keySlowTimer = null
    _keyFastTimer = setInterval(() => _stepAim(key), 40)
  }, 500)
}

function _onKeyUp(e: KeyboardEvent) {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    _clearKeyRepeat()
  }
  if (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') {
    _clearMoveRepeat()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', _onKeyDown)
  window.addEventListener('keyup',   _onKeyUp)
  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }))
  requestAnimationFrame(() => { isVisible.value = true })

  if (route.query.mode === 'online') {
    await tryReconnect('fractured-frontier')
    if (remoteRoom.value?.boardState) {
      try {
        gameState.value = deserializeState(remoteRoom.value.boardState)
        hasSyncedOnce.value = true
      } catch (e) { /* ignore — watcher will catch the next snapshot */ }
    }
  } else {
    resetState()
    gameState.value = createInitialState()
    logEvent('game_start', { gameId: 'fractured_frontier' })
    gameStartLogged.value = true
  }

  syncDisplayToState()

  await nextTick()
  if (gameCanvas.value) {
    ctx = gameCanvas.value.getContext('2d')
    render()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', _onKeyDown)
  window.removeEventListener('keyup',   _onKeyUp)
  _clearKeyRepeat()
  _clearBtnRepeat()
  _clearMoveRepeat()
  // Unsubscribe from opponent's live RTDB cursor and clear our own node
  liveUnsub?.()
  liveUnsub = null
  if (isMultiplayer.value && playerRole.value && joinCode.value) {
    dbSet(dbRef(rtdb, `live/${joinCode.value}/${playerRole.value}`), null).catch(() => {})
  }
  stopListening()
  if (animFrame) cancelAnimationFrame(animFrame)
  if (turnTimeout) clearTimeout(turnTimeout)
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }))
})
</script>

<style scoped>
* { box-sizing: border-box; }

/* ─── Container & visibility ──────────────────────────────────────────────── */
.fractured-frontier-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9375rem;
  width: 100%;
  max-width: 85rem;
  margin: 0 auto;
  opacity: 0;
  transform: translateY(0.375rem);
  transition: opacity 1s ease, transform 1s ease;
  font-family: 'Antonio', sans-serif;
  color: #00cfff;
}

.fractured-frontier-container.show {
  opacity: 1;
  transform: none;
}

.scanlines {
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent, transparent 0.125rem, rgba(0, 0, 0, 0.06) 0.125rem, rgba(0, 0, 0, 0.06) 0.25rem);
  pointer-events: none;
  z-index: 5;
}

/* ─── Header (status-box / game-header / pill shared via gameLanding.css) ─── */
.host-turn {
  border-color: #5ec3ff !important;
  background: rgba(94, 195, 255, 0.18) !important;
  box-shadow: inset 0 0 0.625rem rgba(94, 195, 255, 0.25) !important;
}

.host-turn .label, .host-turn .value { color: #aee0ff; }

.guest-turn {
  border-color: #39ff6a !important;
  background: rgba(57, 255, 106, 0.14) !important;
  box-shadow: inset 0 0 0.625rem rgba(57, 255, 106, 0.2) !important;
}

.guest-turn .label, .guest-turn .value { color: #b8ffce; }

/* Idle (non-active) state for per-player turn boxes */
.turn-idle {
  border-color: rgba(0, 207, 255, 0.1) !important;
  background: rgba(0, 5, 15, 0.35) !important;
  box-shadow: none !important;
}
.turn-idle .label, .turn-idle .value { color: rgba(0, 207, 255, 0.2) !important; }


.multiplayer-error-banner {
  background: rgba(244, 67, 54, 0.9);
  color: white;
  padding: 0.625rem 1.875rem;
  border-radius: 0.5rem;
  font-family: 'Antonio', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.0625rem;
}

/* ─── Player bars ─────────────────────────────────────────────────────────── */
/* ─── Three-column game layout ────────────────────────────────────────────── */
.game-layout {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
  width: 100%;
}

/* ── Side panels (weapons left, aim right) ────────────────────────────────── */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: rgba(0, 207, 255, 0.03);
  border: 0.0625rem solid rgba(0, 207, 255, 0.15);
  border-radius: 0.375rem;
  padding: 0.5rem 0.4rem;
  width: 12rem;
  flex-shrink: 0;
  height: fit-content;
}

.side-label {
  font-size: 0.55rem;
  letter-spacing: 0.12rem;
  color: rgba(0, 207, 255, 0.45);
  text-transform: uppercase;
  padding-bottom: 0.2rem;
  border-bottom: 0.0625rem solid rgba(0, 207, 255, 0.1);
}

/* Weapon grid: single column in the left side panel */
.weapon-options {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.25rem;
  //flex: 1;
}

/* ── Player HP bars — fighting-game style, overlaid on canvas ────────────── */
.player-bars {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.3rem;
  pointer-events: none;
}

.player-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.15rem 1rem;
  transition: filter 0.2s ease;
}

/* Active player's badge pulses with their faction colour */
.player-bar.active.host .faction-badge {
  filter: drop-shadow(0 0 0.5rem rgba(94, 195, 255, 0.9));
}
.player-bar.active.guest .faction-badge {
  filter: drop-shadow(0 0 0.5rem rgba(57, 255, 106, 0.9));
}

.player-bar.eliminated {
  opacity: 0.35;
  filter: grayscale(0.6);
}

/* Large corner badges */
.faction-badge {
  height: 3rem;
  width: 3rem;
  object-fit: contain;
  flex-shrink: 0;
}

/* Content column (name+HP row above, health bar below) */
.pbar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.pbar-content--rtl {
  align-items: flex-end;
}

/* Meta row: name + HP% (+ optional shield) */
.pbar-meta {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.pbar-meta--rtl {
  flex-direction: row-reverse;
}

.player-name {
  font-size: 0.55rem;
  letter-spacing: 0.04rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}

/* P2 health bar depletes from right → left */
.health-bar--rtl {
  transform: scaleX(-1);
}

.health-bar {
  width: 100%;
  height: 0.3rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.25rem;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  border-radius: 0.25rem;
  transition: width 0.4s ease;
  box-shadow: 0 0 0.25rem currentColor;
}

.player-health {
  font-size: 0.6rem;
  min-width: 2rem;
  text-align: right;
  color: rgba(0, 207, 255, 0.7);
  flex-shrink: 0;
}

.player-shield {
  font-size: 0.6rem;
  color: #88ccff;
  flex-shrink: 0;
}

/* ─── Canvas ──────────────────────────────────────────────────────────────── */
.canvas-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

canvas {
  display: block;
  border: 0.0625rem solid rgba(0, 207, 255, 0.25);
  border-radius: 0.375rem;
  width: 100%;
  max-width: 100%;
  height: auto;
}

.wind-display {
  padding: 0.1rem 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wind-top {
  display: flex;
  flex-direction: row;
  gap: 0.3rem;
  align-items: baseline;
}

.wind-solar,
.wind-winds {
  font-size: 0.44rem;
  letter-spacing: 0.07rem;
  color: rgba(0, 207, 255, 0.4);
  text-transform: uppercase;
}

.wind-value { color: #00cfff; font-size: 0.72rem; letter-spacing: 0.03rem; }

.wind-arrows {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.wind-arrow {
  font-size: 2rem;
  color: #ffc400;
  letter-spacing: -0.15em;
  display: inline-block;
  line-height: 0.8;
}

/* Row wrapper that groups wind + round display in the player-bars centre */
.bars-center {
  display: flex;
  flex-direction: row;
  gap: 0.3rem;
  align-items: stretch;
  flex-shrink: 0;
}

.round-display {
  //background: rgba(0, 8, 20, 0.75);
  //border: 0.0625rem solid rgba(0, 207, 255, 0.3);
  //border-radius: 0.375rem;
  //padding: 0.2rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  //backdrop-filter: blur(2px);
}

.round-label {
  color: rgba(0, 207, 255, 0.5);
  font-size: 0.65rem;
  letter-spacing: 0.08rem;
  text-transform: uppercase;
}

.round-value {
  color: #00cfff;
  font-size: 1rem;
  letter-spacing: 0.04rem;
}

/* Reset button — centered below the canvas in normal flow */
.reset-btn {
  align-self: center;
  margin-top: 0.35rem;
  background: rgba(160, 20, 20, 0.18);
  border: 0.0625rem solid rgba(200, 50, 50, 0.5);
  color: rgba(220, 80, 80, 0.65);
  font-family: 'Antonio', sans-serif;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.1rem;
  padding: 0.18rem 0.75rem;
  border-radius: 62.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.reset-btn:hover {
  background: rgba(200, 40, 40, 0.35);
  border-color: rgba(255, 80, 80, 0.7);
  color: rgba(255, 110, 110, 0.95);
  box-shadow: 0 0 0.75rem rgba(200, 40, 40, 0.35);
}

/* ─── Waiting overlay (online — awaiting opponent) ────────────────────────── */
.waiting-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 8, 20, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
}

.waiting-box {
  text-align: center;
  background: rgba(0, 8, 20, 0.95);
  border: 0.0625rem solid rgba(255, 196, 0, 0.5);
  border-radius: 0.5rem;
  padding: 1.5rem 2.5rem;
  box-shadow: 0 0 2.5rem rgba(255, 196, 0, 0.15);
}

.waiting-title {
  font-family: 'Antonio', sans-serif;
  font-size: 1.1rem;
  letter-spacing: 0.2rem;
  color: #ffc400;
  margin-bottom: 0.5rem;
}

.waiting-sub {
  font-size: 0.75rem;
  color: #99ccff;
  margin-bottom: 0.5rem;
}

.waiting-code {
  font-family: 'Courier New', monospace;
  font-size: 1.5rem;
  letter-spacing: 0.3rem;
  color: #00cfff;
  text-shadow: 0 0 0.625rem #00cfff;
  margin-bottom: 0.75rem;
}

.waiting-spinner {
  color: rgba(0, 207, 255, 0.5);
  animation: blink 1.4s infinite alternate ease-in-out;
}

@keyframes blink {
  from { opacity: 0.3; }
  to { opacity: 1; }
}

/* ─── Right panel: aim controls ───────────────────────────────────────────── */
.current-player-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.62rem;
  letter-spacing: 0.08rem;
  color: #00cfff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  box-shadow: 0 0 0.3rem currentColor;
  flex-shrink: 0;
}

/* Stacked angle + power rows */
.aim-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.aim-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.aim-label-val {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: 'Tiny5', monospace;
  font-size: 1rem;
}

.aim-label {
  letter-spacing: 0.08rem;
  color: rgba(0, 207, 255, 1);
  text-transform: uppercase;
}

.val {
  color: #ffc400;
  min-width: 2rem;
  text-align: right;
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 7.5rem;
  height: 0.25rem;
  background: rgba(0, 207, 255, 0.2);
  border-radius: 0.125rem;
  outline: none;
}

/* Full-width variant for the stacked right-panel sliders */
.slider--full {
  width: 100%;
}

/* Arrow button + slider row */
.slider-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.aim-arrow-btn {
  flex-shrink: 0;
  width: 1.6rem;
  height: 1.6rem;
  background: rgba(0, 207, 255, 0.12);
  border: 1px solid rgba(0, 207, 255, 0.4);
  border-radius: 0.25rem;
  color: #00cfff;
  font-size: 0.7rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s;
  padding: 0;
}

.aim-arrow-btn:hover:not(:disabled) {
  background: rgba(0, 207, 255, 0.28);
  border-color: #00cfff;
}

.aim-arrow-btn:active:not(:disabled) {
  background: rgba(0, 207, 255, 0.45);
}

.aim-arrow-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 0.875rem;
  height: 0.875rem;
  background: #00cfff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 0.5rem #00cfff;
}

.slider::-moz-range-thumb {
  width: 0.875rem;
  height: 0.875rem;
  background: #00cfff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 0.5rem #00cfff;
}


/* ── Individual weapon chip ───────────────────────────────────────────────── */
/* Each chip is a two-line card: name row (checkbox + icon + label) on top,
 * ammo pip row on the bottom. Click to arm; greys out when stockpile hits 0. */
.weapon-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  background: rgba(0, 8, 20, 0.85);
  border: 0.0625rem solid rgba(0, 207, 255, 0.2);
  color: rgba(0, 207, 255, 1);
  font-family: 'Courier New', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.02em;
  padding: 0.3rem 0.45rem;
  border-radius: 0.25rem;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: border-color 0.15s, background-color 0.15s, color 0.15s, opacity 0.15s;
}

.weapon-chip:hover:not(:disabled):not(.weapon-chip--active) {
  border-color: rgba(0, 207, 255, 0.45);
  background: rgba(0, 207, 255, 0.06);
  color: #00cfff;
}

/* Header row: [□] icon name */
.weapon-chip__head {
  display: flex;
  align-items: center;
  gap: 0.28rem;
}

.weapon-chip__icon {
  font-size: 0.65rem;
  line-height: 1;
}

.weapon-chip__name {
  font-family: 'Tiny5', sans-serif;
  font-size: 1rem;
  white-space: nowrap;
  //overflow: hidden;
  //text-overflow: ellipsis;
  max-width: 7rem;
}

.weapon-chip__desc {
  font-family: 'Tiny5', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.02em;
  color: rgba(0, 207, 255, 0.5);
  line-height: 1;
  padding-left: 0.93rem;  /* align with icon */
}

.weapon-chip--active .weapon-chip__desc {
  color: color-mix(in srgb, var(--wc, #00cfff) 55%, rgba(255,255,255,0.2));
}

/* Ammo pip row */
.weapon-chip__pips {
  display: flex;
  align-items: center;
  gap: 0.18rem;
  padding-left: 0.93rem;  /* indent past the icon */
  flex-wrap: wrap;
}

.ammo-pip {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 0.06rem;
  background: rgba(0, 207, 255, 0.75);
  flex-shrink: 0;
  transition: background 0.15s, box-shadow 0.15s, opacity 0.15s;
}

/* Spent pip — round has been fired */
.ammo-pip--spent {
  background: rgba(0, 207, 255, 0.35);
  border: 1px solid rgba(0, 207, 255, 0.75);
  border-radius: 0.06rem;
  box-shadow: none;
  opacity: 0.4;
}

.weapon-chip--active .ammo-pip--spent {
  background: color-mix(in srgb, var(--wc, #00cfff) 8%, transparent);
  opacity: 0.35;
}

.ammo-inf {
  font-size: 0.7rem;
  line-height: 1;
  color: rgba(0, 207, 255, 0.45);
  letter-spacing: 0;
}

/* ── Active state ─────────────────────────────────────────────────────────── */
.weapon-chip--active {
  border-color: var(--wc, #00cfff);
  background: color-mix(in srgb, var(--wc, #00cfff) 14%, rgba(0, 8, 20, 0.85));
  color: var(--wc, #00cfff);
  box-shadow: 0 0 0.5rem color-mix(in srgb, var(--wc, #00cfff) 30%, transparent);
}

.weapon-chip--active .ammo-pip {
  background: var(--wc, #00cfff);
  box-shadow: 0 0 0.25rem var(--wc, #00cfff);
}

.weapon-chip--active .ammo-inf {
  color: var(--wc, #00cfff);
}

/* ── Depleted state ───────────────────────────────────────────────────────── */
.weapon-chip:disabled,
.weapon-chip--depleted {
  opacity: 0.28;
  filter: grayscale(0.65);
  cursor: not-allowed;
  border-color: rgba(0, 207, 255, 0.1);
  color: rgba(0, 207, 255, 0.3);
  background: rgba(0, 8, 20, 0.55);
  box-shadow: none;
}

/* ── Mode toggle button ─────────────────────────────────────────────────────── */
/* ── Fuel bar ────────────────────────────────────────────────────────────────── */
.fuel-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.fuel-label-val {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: 'Tiny5', monospace;
  font-size: 1rem;
}
.fuel-val { color: #39ff6a; }
.fuel-bar {
  width: 100%;
  height: 0.25rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.125rem;
  overflow: hidden;
}
.fuel-fill {
  height: 100%;
  border-radius: 0.125rem;
  transition: width 0.08s linear, background 0.3s ease;
  box-shadow: 0 0 4px currentColor;
}

.move-hint {
  font-family: 'Tiny5', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.07rem;
  color: rgba(255, 200, 0, 0.55);
  text-align: center;
  margin-top: 0.1rem;
}

.btn-fire {
  width: 100%;
  background: rgba(255, 60, 60, 0.15);
  border: 0.0625rem solid rgba(255, 60, 60, 0.6);
  color: #ff6666;
  font-family: 'Antonio', sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.125rem;
  padding: 0.45rem 0;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
  text-shadow: 0 0 0.5rem #ff4444;
  margin-top: auto;
}

.btn-fire:hover:not(:disabled) {
  background: rgba(255, 60, 60, 0.35);
  box-shadow: 0 0 1rem rgba(255, 60, 60, 0.4);
}

.btn-fire:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.waiting-turn-msg {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-size: 0.62rem;
  letter-spacing: 0.1rem;
  color: #99ccff;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.4;
  animation: blink 1.5s infinite alternate ease-in-out;
}

.firing-text {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Antonio', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.2rem;
  color: #ffc400;
  text-shadow: 0 0 0.75rem #ffc400;
  animation: pulse 0.6s ease-in-out infinite alternate;
  text-align: center;
}

@keyframes pulse {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

/* ─── Overlays (.game-status-overlay / .pill / .confirm-* shared via gameLanding.css) ─── */
.score-sub {
  color: #ffc400 !important;
  font-weight: bold;
  letter-spacing: 0.0625rem;
}
</style>
