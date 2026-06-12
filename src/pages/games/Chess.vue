<template>
  <div class="game-landing-container" :class="{ 'fade-out': hasClicked }">
    <div class="intro-view">

      <div class="logo-row">
        <img :src="chessLogo" alt="Chess" class="game-logo" />
      </div>

      <div class="landing-layout" :class="{ 'dimmed': hasClicked }">

        <!-- ── LEFT: briefing + controls ── -->
        <div class="landing-left">

          <div class="mission-subheading">
            <h3 v-if="!launchMode">Enter the ultimate command‑level strategy simulation</h3>
            <p v-if="!launchMode">
              Your objective is to outmaneuver an opposing force on a contested tactical grid, coordinating your
              pieces with the precision and foresight expected of a CompuTrek officer.
            </p>
            <div class="controls-row">

              <!-- ── Step 0: Main action buttons ─────────────────────────── -->
              <template v-if="!launchMode && !multiplayerAction">

                <!-- Mission variant banner -->
                <div v-if="missionVariant" class="mission-variant-banner">
                  <span class="mission-variant-label">MISSION</span>
                  {{ missionVariantLabel }} — Host or Join below
                </div>

                <!-- Pass & Play — hidden when launched from a variant-specific mission -->
                <button v-if="!missionVariant" class="pill launch-option pass-play-btn" @click="launchMode = 'local'">
                  <img :src="astronautIcon" class="pass-play-icon" alt="Player" />
                  <img :src="computerIcon"  class="pass-play-icon" alt="vs" />
                  <img :src="astronautIcon" class="pass-play-icon" alt="Player" />
                </button>

                <!-- Host Online -->
                <button class="pill launch-option pass-play-btn" @click="launchMode = 'host'">
                  <img :src="astronautIcon" class="pass-play-icon" alt="Player" />
                  <img :src="computerIcon"  class="pass-play-icon" alt="vs" />
                  <span>Host</span>
                </button>

                <!-- Join -->
                <button class="pill launch-option pass-play-btn" @click="multiplayerAction = 'join'">
                  <span>Join</span>
                  <img :src="computerIcon"  class="pass-play-icon" alt="vs" />
                  <img :src="astronautIcon" class="pass-play-icon" alt="Player" />
                </button>

                <!-- Back to Games -->
                <button class="pill launch-option pass-play-btn back-btn" @click="router.push('/games')">
                  <span>Back</span>
                  <img :src="exitIcon" class="pass-play-icon" alt="Back to Simulator" />
                </button>

              </template>

              <!-- ── Step 1: Variant chooser screen ─────────────────────── -->
              <template v-else-if="launchMode">
                <div class="variant-chooser">
                  <p class="chooser-heading">
                    <template v-if="missionVariant">
                      Host Online — your mission variant:
                    </template>
                    <template v-else>
                      {{ launchMode === 'local' ? 'Pass &amp; Play' : 'Host Online' }} — pick a variant
                    </template>
                  </p>
                  <div class="variant-card-grid">
                    <button
                      v-for="v in visibleVariants"
                      :key="v.id"
                      class="variant-card-btn"
                      :style="{ '--vc': v.color }"
                      @click="selectVariant(v.id)"
                    >
                      <div class="vc-top">
                        <span class="vc-name">{{ v.label }}</span>
                        <span class="vc-badge" v-if="v.badge">{{ v.badge }}</span>
                      </div>
                      <p class="vc-desc">{{ v.description }}</p>
                    </button>
                  </div>
                  <button class="pill back-btn" @click="launchMode = null">← Back</button>
                </div>
              </template>

              <!-- ── Step 2: Create Room ──────────────────────────────────── -->
              <template v-else-if="multiplayerAction === 'create'">
                <div v-if="joinCode" class="code-display">
                  <div>
                    <span class="label">JOIN CODE</span>
                    <div class="code-value">{{ joinCode }}</div>
                  </div>
                  <button class="pill" @click="startTransition">LAUNCH SIMULATION</button>
                </div>
                <button v-else class="pill" @click="handleCreate" :disabled="isLoading">
                  {{ isLoading ? 'INITIALIZING...' : 'INITIALIZE ROOM' }}
                </button>
                <button class="back-btn pill" @click="multiplayerAction = null; selectedVariant = null; resetState()">BACK</button>
              </template>

              <!-- ── Step 3: Join Room ───────────────────────────────────── -->
              <template v-else-if="multiplayerAction === 'join'">
                <input
                    v-model="inputCode"
                    placeholder="ENTER CODE"
                    class="lcars-input"
                    maxlength="6"
                    @keyup.enter="handleJoin"
                />
                <button class="pill" @click="handleJoin" :disabled="isLoading || !inputCode">
                  {{ isLoading ? 'JOINING...' : 'JOIN ROOM' }}
                </button>
                <button class="back-btn pill" @click="multiplayerAction = null; selectedVariant = null">BACK</button>
                <p v-if="multiError" class="error-text">{{ multiError }}</p>
              </template>

            </div>
          </div>

          <div class="mission-briefing">
            <p>
              Chess in the Tactical Simulator challenges cadets to think critically about positioning, long‑term
              planning, and the interplay of multiple systems as they command a diverse set of units across the
              board. Every move reshapes the tactical landscape, forcing you to anticipate enemy responses, protect
              key assets, and exploit emerging opportunities with calculated precision. By evaluating threats,
              coordinating piece abilities, and adapting to shifting conditions, cadets develop the strategic
              discipline, predictive reasoning, and decision‑making clarity essential to successful engineers.
            </p>
            <div class="modal-trigger-row">
              <button class="modal-trigger-btn" @click="openModal('rules')">Rules of the Game</button>
              <button class="modal-trigger-btn" @click="openModal('standards')">Curriculum Standards</button>
              <button class="modal-trigger-btn piece-style-btn" @click="openPieceModal">
                <img :src="currentThemeData?.previewSrc" class="piece-btn-icon" alt="" />
                Piece Style
              </button>
            </div>
            <p v-if="selectedVariant === '960'" class="variant-note">
              ★ Chess 960: pieces start in a randomized back-rank arrangement. Castling is not available in this implementation.
            </p>
            <p v-if="selectedVariant === 'crazyhouse'" class="variant-note">
              ★ Crazyhouse: captured pieces join your pocket — drop them back onto any legal square instead of making a regular move.
            </p>
            <p v-if="selectedVariant === 'koth'" class="variant-note">
              ★ King of the Hill: move your King to the center (e4, d4, e5, or d5) to win instantly.
            </p>
            <p v-if="selectedVariant === 'threecheck'" class="variant-note">
              ★ Three-Check: put the opponent in check three times to win. Standard checkmate also ends the game.
            </p>
            <p v-if="selectedVariant === 'antichess'" class="variant-note">
              ★ Antichess: captures are mandatory. The first player to lose all pieces wins.
            </p>
            <p v-if="selectedVariant === 'horde'" class="variant-note">
              ★ Horde: White is a horde of 36 pawns; Black has the standard army. White wins by promoting; Black wins by capturing all White pieces.
            </p>
            <p v-if="selectedVariant === 'racingkings'" class="variant-note">
              ★ Racing Kings: no checks allowed. First King to reach the 8th rank wins.
            </p>
          </div>

        </div>

        <!-- ── RIGHT: leaderboard ── -->
        <div class="landing-right" v-if="isCadet || isStaff || isAdmin">
          <div class="leaderboard-panel">

            <div class="leaderboard-panel-heading">Cadet Standings</div>

            <div v-if="loadingBoards" class="board-empty" style="text-align:center; padding: 1rem 0;">
              Loading...
            </div>

            <template v-else>
              <div class="diff-row">
                <div class="diff-row-header">All Time Wins</div>
                <div v-if="!leaderboard?.length" class="board-empty">No scores yet</div>
                <ol class="board-list">
                  <li
                      v-for="(entry, i) in leaderboard"
                      :key="entry.uid"
                      class="board-entry"
                      :class="{ 'is-me': entry.uid === userInfo?.uid }"
                  >
                    <span class="board-rank">{{ i + 1 }}</span>
                    <span class="board-name">{{ firstName(entry.displayName) }}</span>
                    <span class="board-score">{{ entry.highScore }}</span>
                  </li>
                </ol>
              </div>
            </template>

          </div>
        </div>

      </div>

    </div>

    <GameInfoModal
        :type="activeModal"
        :data="activeModal ? gameInfo[activeModal] : null"
        @close="closeModal"
    />

    <!-- ── Piece Style Picker Modal ──────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="piece-modal">
        <div v-if="showPieceModal" class="piece-modal-overlay" @click.self="savePieceTheme">
          <div class="piece-modal">

            <div class="piece-modal-header">
              <div class="piece-modal-title">PIECE STYLE</div>
              <button class="piece-modal-close" @click="showPieceModal = false" aria-label="Close">✕</button>
            </div>

            <div class="piece-modal-grid">
              <button
                v-for="theme in CHESS_THEMES"
                :key="theme.id"
                class="piece-card"
                :class="{ 'is-selected': pendingTheme === theme.id }"
                @click="pendingTheme = theme.id"
              >
                <div class="piece-card-preview">
                  <img :src="theme.previewSrc" :alt="theme.label" class="piece-card-img" />
                </div>
                <div class="piece-card-label">{{ theme.label }}</div>
                <div class="piece-card-desc">{{ theme.description }}</div>
              </button>
            </div>

            <div class="piece-modal-footer">
              <button class="piece-save-btn" @click="savePieceTheme">SAVE</button>
            </div>

          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useMultiplayer } from '@/composables/useMultiplayer';
import { useGameModal } from '@/composables/useGameModal';
import { useGameScores } from '@/composables/useGameScores';
import { useAuth } from '@/composables/useAuth.js';
import { useBroadcast } from '@/composables/useBroadcast';
import { useChessPieceTheme, CHESS_THEMES } from '@/composables/useChessPieceTheme';
import GameInfoModal from '@/components/GameInfoModal.vue';
import gameData from '@/data/gameInfo.json';
import { generateChess960FEN, STANDARD_FEN } from '@/utils/chess960';
import { type ChessVariant, createPosition, getFen, HORDE_FEN } from '@/utils/chess-variants';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import chessLogo from '@/assets/images/games/title-chess.svg';
import exitIcon     from '@/assets/icons/person-from-portal3.svg';
import astronautIcon from '@/assets/icons/user-astronaut6.svg';
import computerIcon  from '@/assets/icons/computer-classic7.svg';

const router = useRouter();
const route  = useRoute();
const hasClicked = ref(false);
const selectedVariant = ref<ChessVariant | null>(null);

// If the student arrived from a mission that requires a specific variant,
// pre-filter the host variant chooser and hide Pass & Play.
const missionVariant = computed(() => (route.query.missionVariant as string) || null)
const missionVariantLabel = computed(() =>
  VARIANT_INFO.find(v => v.id === missionVariant.value)?.label ?? missionVariant.value
)

// Show only the required variant card when launched from a mission; all 8 otherwise.
const visibleVariants = computed(() =>
  missionVariant.value
    ? VARIANT_INFO.filter(v => v.id === missionVariant.value)
    : VARIANT_INFO
)

// ── Piece style picker ──────────────────────────────────────────────────────
const { currentTheme, setTheme } = useChessPieceTheme();
const showPieceModal = ref(false);
const pendingTheme = ref(currentTheme.value);
const currentThemeData = computed(() => CHESS_THEMES.find(t => t.id === currentTheme.value));

function openPieceModal() {
  pendingTheme.value = currentTheme.value; // reset to saved selection each open
  showPieceModal.value = true;
}

function savePieceTheme() {
  setTheme(pendingTheme.value);
  showPieceModal.value = false;
}

// ── Leaderboard ────────────────────────────────────────────────────────────

const { userInfo, isCadet, isStaff, isAdmin } = useAuth();
const { isBroadcasting, selectedPeriodId: broadcastPeriodId } = useBroadcast();

const SCORE_OPTIONS = { lowerIsBetter: false }
const boardComposable = useGameScores('chess', SCORE_OPTIONS);

const leaderboard      = ref<any[]>([]);
const staffLeaderboard = ref<any[]>([]);
const loadingBoards    = ref(false);

const isStaffUser     = computed(() => isStaff.value || isAdmin.value)
const studentPeriodId = computed(() =>
  isBroadcasting.value && broadcastPeriodId.value
    ? broadcastPeriodId.value
    : userInfo.value?.periodId ?? null
)

const firstName = (name: string) => name.split(' ')[0]
const lastName  = (name: string) => name.split(' ').at(-1) ?? name

function beatsBestStaff(score: number): boolean {
  if (!staffLeaderboard.value?.length) return false
  return score > staffLeaderboard.value[0].highScore
}

async function loadLeaderboards() {
  loadingBoards.value = true;
  try {
    if (studentPeriodId.value) {
      leaderboard.value = await boardComposable.fetchPeriodLeaderboard(studentPeriodId.value, 5);
    }
    // Faculty fetch removed — re-add staffLeaderboard fetch here when needed
  } finally {
    loadingBoards.value = false;
  }
}

// Show variant-specific rules in the modal
const gameInfo = computed(() => {
  if (selectedVariant.value === '960') return gameData.chess960;
  if (selectedVariant.value === 'crazyhouse') return gameData.crazyhouse;
  return gameData.chess;
});

const {
  createOnlineGame,
  joinOnlineGame,
  joinCode,
  isLoading,
  error: multiError,
  resetState
} = useMultiplayer();

const { activeModal, openModal, closeModal } = useGameModal();

const multiplayerAction = ref<'create' | 'join' | null>(null);
const launchMode = ref<'local' | 'host' | null>(null);
const inputCode = ref('');

/** All 8 variants with label, badge, accent color, and student-friendly description. */
const VARIANT_INFO = [
  {
    id: 'standard' as ChessVariant,
    label: 'Standard',
    badge: '',
    color: '#99ccff',
    description: 'Classic chess. Checkmate the enemy king to win.',
  },
  {
    id: '960' as ChessVariant,
    label: 'Chess 960',
    badge: '960',
    color: '#ffc400',
    description: 'Same rules, randomized starting positions. No opening theory needed.',
  },
  {
    id: 'crazyhouse' as ChessVariant,
    label: 'Crazyhouse',
    badge: 'CZH',
    color: '#ff6b6b',
    description: 'Captured pieces join your hand — drop them back onto the board.',
  },
  {
    id: 'koth' as ChessVariant,
    label: 'King of the Hill',
    badge: 'KOTH',
    color: '#4caf50',
    description: 'Move your King to the center four squares to win instantly.',
  },
  {
    id: 'threecheck' as ChessVariant,
    label: 'Three-Check',
    badge: '3CHK',
    color: '#ff9800',
    description: 'Put the opponent in check three times to win. Defense is everything.',
  },
  {
    id: 'antichess' as ChessVariant,
    label: 'Antichess',
    badge: 'ANTI',
    color: '#ab47bc',
    description: 'Captures are mandatory. Lose all your pieces first to win.',
  },
  {
    id: 'horde' as ChessVariant,
    label: 'Horde',
    badge: 'HRDE',
    color: '#f06292',
    description: 'White commands 36 pawns; Black uses the standard army. Survive the swarm.',
  },
  {
    id: 'racingkings' as ChessVariant,
    label: 'Racing Kings',
    badge: 'RACE',
    color: '#29b6f6',
    description: 'No checks allowed. First King to reach the far end of the board wins.',
  },
] as const;

/** Called when the user picks a variant from the second-screen chooser. */
function selectVariant(variant: ChessVariant) {
  selectedVariant.value = variant;
  if (launchMode.value === 'local') {
    launchMode.value = null;
    launchLocal(variant);
  } else {
    // host — move to create-room step
    launchMode.value = null;
    multiplayerAction.value = 'create';
  }
}

onMounted(() => {
  resetState();
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
  loadLeaderboards();

  // If returning from a finished game via "New Variant", jump straight to the chooser
  const relaunch = route.query.relaunch as string | undefined;
  if (relaunch === 'local' || relaunch === 'host') {
    launchMode.value = relaunch;
  }
});

onBeforeUnmount(() => {
  if (!hasClicked.value) {
    resetState();
    window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
  }
});

async function handleCreate() {
  const variant = selectedVariant.value ?? 'standard';

  // Determine starting FEN for each variant
  let startingFen: string;
  if (variant === '960') {
    startingFen = generateChess960FEN();
  } else {
    const freshPos = createPosition(variant);
    startingFen = getFen(freshPos);
  }

  // Pass variant string to Firebase (undefined for standard / 960)
  const variantStr = (variant === 'standard' || variant === '960') ? undefined : variant;
  await createOnlineGame('chess', startingFen, 'w', variantStr);
}

async function handleJoin() {
  if (!inputCode.value) return;
  await joinOnlineGame('chess', inputCode.value.toUpperCase());
  if (!multiError.value) {
    startTransition();
  }
}

/** Launch a local (pass-and-play) game for the chosen variant. */
async function launchLocal(variant: ChessVariant) {
  if (hasClicked.value) return;
  hasClicked.value = true;
  selectedVariant.value = variant;

  try {
    const audio = new Audio(soundSuccess);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {}

  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  await new Promise(resolve => setTimeout(resolve, 1500));

  if (variant === '960') {
    const fen960 = generateChess960FEN();
    router.push(`/games/chess/play?variant=960&fen=${encodeURIComponent(fen960)}`);
  } else if (variant === 'standard') {
    router.push('/games/chess/play');
  } else {
    router.push(`/games/chess/play?variant=${variant}`);
  }
}

async function startTransition() {
  if (hasClicked.value) return;
  hasClicked.value = true;

  try {
    const audio = new Audio(soundSuccess);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {}

  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  await new Promise(resolve => setTimeout(resolve, 1500));

  const v = selectedVariant.value ?? 'standard';
  const variantParam = v === 'standard' ? '' : `&variant=${v}`;
  router.push(`/games/chess/play?mode=online${variantParam}`);
}
</script>

<style scoped>
@import '@/assets/styles/gameLanding.css';

/* ── Mission variant banner ─────────────────────────────────────────────── */
.mission-variant-banner {
  width: 100%;
  padding: 0.5rem 0.85rem;
  background: color-mix(in srgb, #ffc400 8%, transparent);
  border: 0.0625rem solid rgba(255, 196, 0, 0.35);
  border-left: 0.25rem solid #ffc400;
  border-radius: 0.5rem;
  font-family: 'Antonio', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.08rem;
  color: rgba(255, 196, 0, 0.85);
  text-transform: uppercase;
}

.mission-variant-label {
  font-size: 0.65rem;
  letter-spacing: 0.15rem;
  background: rgba(255, 196, 0, 0.15);
  border: 0.0625rem solid rgba(255, 196, 0, 0.4);
  border-radius: 62rem;
  padding: 0.1rem 0.5rem;
  margin-right: 0.5rem;
  color: #ffc400;
}

/* ── Variant chooser (second-screen card grid) ──────────────────────────── */

.variant-chooser {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
}

.chooser-heading {
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  letter-spacing: 0.12rem;
  color: rgba(153, 204, 255, 0.7);
  text-transform: uppercase;
  margin: 0;
}

.variant-card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
}

@media (max-width: 40rem) {
  .variant-card-grid {
    grid-template-columns: 1fr;
  }
}

.variant-card-btn {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.65rem 0.85rem 0.65rem 1rem;
  background: rgba(153, 204, 255, 0.04);
  border: 0.0625rem solid rgba(153, 204, 255, 0.15);
  border-left: 0.25rem solid var(--vc, #99ccff);
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.18s, border-color 0.18s, box-shadow 0.18s;
}

.variant-card-btn:hover {
  background: color-mix(in srgb, var(--vc, #99ccff) 10%, transparent);
  border-color: color-mix(in srgb, var(--vc, #99ccff) 50%, transparent);
  border-left-color: var(--vc, #99ccff);
  box-shadow: 0 0 0.75rem color-mix(in srgb, var(--vc, #99ccff) 20%, transparent);
}

.vc-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vc-name {
  font-family: 'Antonio', sans-serif;
  font-size: 0.95rem;
  letter-spacing: 0.06rem;
  color: var(--vc, #99ccff);
  text-transform: uppercase;
  line-height: 1;
}

.vc-badge {
  font-family: 'Antonio', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.1rem;
  padding: 0.1rem 0.45rem;
  border-radius: 62rem;
  border: 0.0625rem solid color-mix(in srgb, var(--vc, #99ccff) 50%, transparent);
  color: var(--vc, #99ccff);
  background: color-mix(in srgb, var(--vc, #99ccff) 12%, transparent);
  white-space: nowrap;
  line-height: 1.4;
}

.vc-desc {
  font-family: 'Roboto', sans-serif;
  font-size: 0.75rem;
  color: rgba(153, 204, 255, 0.55);
  margin: 0;
  line-height: 1.35;
}

/* Castling-not-available notice */
.variant-note {
  font-family: 'Roboto', sans-serif;
  font-size: 0.8rem;
  color: rgba(255, 196, 0, 0.75);
  margin: 0.4rem 0 0;
  padding: 0;
}

/* ── Piece Style trigger button ─────────────────────────────────────────── */
.piece-style-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.piece-btn-icon {
  width: 1.1rem;
  height: 1.1rem;
  object-fit: contain;
  flex-shrink: 0;
}

/* ── Piece Style modal (Teleported to body) ─────────────────────────────── */
.piece-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}

.piece-modal {
  background: #07111a;
  border: 0.125rem solid rgba(153, 204, 255, 0.5);
  border-radius: 1.25rem;
  padding: 1.5rem;
  width: min(96vw, 44rem);
  box-shadow: 0 0 3rem rgba(0, 0, 0, 0.8), 0 0 1.5rem rgba(153, 204, 255, 0.1);
}

.piece-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.piece-modal-title {
  font-family: 'Antonio', sans-serif;
  font-size: 1.1rem;
  letter-spacing: 0.2rem;
  color: #99ccff;
  text-transform: uppercase;
}

.piece-modal-close {
  background: none;
  border: none;
  color: rgba(153, 204, 255, 0.5);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  line-height: 1;
  transition: color 0.2s;
}
.piece-modal-close:hover {
  color: #99ccff;
}

/* ── 5-card grid ────────────────────────────────────────────────────────── */
.piece-modal-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;
}

@media (max-width: 36rem) {
  .piece-modal-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.piece-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 0.5rem;
  background: rgba(153, 204, 255, 0.05);
  border: 0.0625rem solid rgba(153, 204, 255, 0.2);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, box-shadow 0.18s;
  font-family: inherit;
  text-align: center;
}

.piece-card:hover {
  background: rgba(153, 204, 255, 0.12);
  border-color: rgba(153, 204, 255, 0.5);
}

.piece-card.is-selected {
  background: rgba(153, 204, 255, 0.15);
  border-color: #99ccff;
  box-shadow: 0 0 0.75rem rgba(153, 204, 255, 0.35);
}

.piece-card-preview {
  width: 3.25rem;
  height: 3.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.piece-card-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0.1rem 0.2rem rgba(0, 0, 0, 0.5));
}

.piece-card-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.08rem;
  color: #99ccff;
  text-transform: uppercase;
  line-height: 1;
}

.piece-card-desc {
  font-family: 'Roboto', sans-serif;
  font-size: 0.65rem;
  color: rgba(153, 204, 255, 0.5);
  line-height: 1.3;
}

/* ── Modal footer + Save button ─────────────────────────────────────────── */
.piece-modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.1rem;
  padding-top: 0.9rem;
  border-top: 0.0625rem solid rgba(153, 204, 255, 0.15);
}

.piece-save-btn {
  font-family: 'Antonio', sans-serif;
  font-size: 0.95rem;
  letter-spacing: 0.12rem;
  text-transform: uppercase;
  padding: 0.45rem 1.75rem;
  border-radius: 62rem;
  background: rgba(153, 204, 255, 0.15);
  border: 0.0625rem solid rgba(153, 204, 255, 0.5);
  color: #99ccff;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, box-shadow 0.18s, color 0.18s;
}

.piece-save-btn:hover {
  background: rgba(153, 204, 255, 0.28);
  border-color: #99ccff;
  color: #fff;
  box-shadow: 0 0 0.75rem rgba(153, 204, 255, 0.35);
}

/* ── Modal enter/leave transition ───────────────────────────────────────── */
.piece-modal-enter-active,
.piece-modal-leave-active {
  transition: opacity 0.2s ease;
}
.piece-modal-enter-active .piece-modal,
.piece-modal-leave-active .piece-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.piece-modal-enter-from,
.piece-modal-leave-to {
  opacity: 0;
}
.piece-modal-enter-from .piece-modal,
.piece-modal-leave-to .piece-modal {
  transform: scale(0.95);
  opacity: 0;
}
</style>