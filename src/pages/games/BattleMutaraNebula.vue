<template>
  <div class="game-landing-container" :class="{ 'fade-out': hasClicked }">
    <div class="intro-view">

      <div class="logo-row">
        <img :src="battleshipLogo" alt="Battleship" class="game-logo" />
      </div>

      <div class="landing-layout" :class="{ 'dimmed': hasClicked }">

        <!-- ── LEFT: briefing + controls ── -->
        <div class="landing-left">

          <div class="mission-subheading">
            <h3>Deploy your fleet and eliminate the enemy before they find you</h3>
            <p>Use deductive reasoning and probabilistic targeting to locate and sink all enemy vessels before your own fleet is destroyed.</p>
            <div class="controls-row">

              <!-- Default: room selection -->
              <template v-if="!multiplayerAction">
                <button class="pill launch-option pass-play-btn" @click="launchLocal">
                  <img :src="astronautIcon" class="pass-play-icon" alt="Player" />
                  <img :src="computerIcon"  class="pass-play-icon" alt="vs" />
                  <img :src="astronautIcon" class="pass-play-icon" alt="Player" />
                </button>
                <button class="pill launch-option pass-play-btn" @click="multiplayerAction = 'create'">
                  <img :src="astronautIcon" class="pass-play-icon" alt="Player" />
                  <img :src="computerIcon"  class="pass-play-icon" alt="vs" />
                  <span>Host</span>
                </button>
                <button class="pill launch-option pass-play-btn" @click="multiplayerAction = 'join'">
                  <span>Join</span>
                  <img :src="computerIcon"  class="pass-play-icon" alt="vs" />
                  <img :src="astronautIcon" class="pass-play-icon" alt="Player" />
                </button>
                <button class="pill launch-option pass-play-btn back-btn" @click="router.push('/games')">
                  <span>Back</span>
                  <img :src="exitIcon" class="pass-play-icon" alt="Back to Simulator" />
                </button>
              </template>

              <!-- Create Room -->
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
                <button class="back-btn pill" @click="multiplayerAction = null; resetState()">BACK</button>
              </template>

              <!-- Join Room -->
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
                <button class="back-btn pill" @click="multiplayerAction = null">BACK</button>
                <p v-if="multiError" class="error-text">{{ multiError }}</p>
              </template>

            </div>
          </div>

          <div class="mission-briefing">
            <p>
              Battleship in the Tactical Simulator challenges cadets to apply probabilistic reasoning,
              spatial deduction, and adaptive targeting strategy across a hidden-information engagement.
              With no direct visibility of the opponent's fleet, players must infer ship positions from
              incomplete data — transforming each shot into a hypothesis and each result into evidence.
              The interplay between offensive targeting and defensive fleet placement models core
              principles of information asymmetry, decision-making under uncertainty, and iterative
              hypothesis refinement essential to systems-level engineering thinking.
            </p>
            <div class="modal-trigger-row">
              <button class="modal-trigger-btn" @click="openModal('rules')">Rules of the Game</button>
              <button class="modal-trigger-btn" @click="openModal('standards')">Curriculum Standards</button>
            </div>
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useMultiplayer } from '@/composables/useMultiplayer';
import { useGameModal } from '@/composables/useGameModal';
import { useGameScores } from '@/composables/useGameScores';
import { useAuth } from '@/composables/useAuth.js';
import { useBroadcast } from '@/composables/useBroadcast';
import { createInitialBattleshipState } from '@/components/games/BattleMutaraNebula/engine';
import GameInfoModal from '@/components/GameInfoModal.vue';
import gameData from '@/data/gameInfo.json';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import battleshipLogo from '@/assets/images/games/title-battlemutaranebula.svg';
import exitIcon     from '@/assets/icons/person-from-portal3.svg';
import astronautIcon from '@/assets/icons/user-astronaut6.svg';
import computerIcon  from '@/assets/icons/computer-classic7.svg';

const router = useRouter();
const hasClicked = ref(false);

// ── Leaderboard ────────────────────────────────────────────────────────────

const { userInfo, isCadet, isStaff, isAdmin } = useAuth();
const { isBroadcasting, selectedPeriodId: broadcastPeriodId } = useBroadcast();

const SCORE_OPTIONS = { lowerIsBetter: false }
const boardComposable = useGameScores('battle_mutara_nebula', SCORE_OPTIONS);

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

const gameInfo = gameData.battleMutaraNebula;

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
const inputCode = ref('');

onMounted(() => {
  resetState();
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
  loadLeaderboards();
});

onBeforeUnmount(() => {
  if (!hasClicked.value) {
    resetState();
    window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
  }
});

async function handleCreate() {
  const initialState = JSON.stringify(createInitialBattleshipState());
  await createOnlineGame('battleship', initialState);
}

async function handleJoin() {
  if (!inputCode.value) return;
  await joinOnlineGame('battleship', inputCode.value.toUpperCase());
  if (!multiError.value) {
    startTransition();
  }
}

async function launchLocal() {
  if (hasClicked.value) return;
  hasClicked.value = true;

  try {
    const audio = new Audio(soundSuccess);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (e) {}

  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  await new Promise(resolve => setTimeout(resolve, 1500));
  router.push('/games/battle-of-the-mutara-nebula/play');
}

async function startTransition() {
  if (hasClicked.value) return;
  hasClicked.value = true;

  try {
    const audio = new Audio(soundSuccess);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (e) {}

  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  await new Promise(resolve => setTimeout(resolve, 1500));
  router.push('/games/battle-of-the-mutara-nebula/play?mode=online');
}
</script>

<style scoped>
@import '@/assets/styles/gameLanding.css';
</style>