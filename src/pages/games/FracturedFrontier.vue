<template>
  <div class="game-landing-container" :class="{ 'fade-out': hasClicked }">
    <div class="intro-view">

      <div class="logo-row">
        <img :src="orbitalBombardmentLogo" alt="Fractured Frontier" class="game-logo" />
      </div>

      <div class="landing-layout" :class="{ 'dimmed': hasClicked }">

        <!-- ── LEFT: briefing + controls ── -->
        <div class="landing-left">

          <div class="mission-subheading">
            <h3>Command your battery. Dial in your shot. Level the enemy.</h3>
            <p>Master angle, power, gravity, and solar wind to land devastating strikes — and adapt to a battlefield that changes with every impact.</p>
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
              Fractured Frontier pits the United Federation of Planets against the Romulan Star Empire
              in a turn-based artillery duel fought across destructible terrain. Choosing a launch angle
              and power level — then accounting for gravity and a shifting solar wind — turns every shot
              into a hands-on exercise in vectors, trigonometry, and iterative estimation. Because impacts
              permanently reshape the battlefield, cadets must continually revise their model of the
              problem and adapt their strategy, transforming abstract math into a visible, physical duel
              of wits.
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

            <div class="leaderboard-panel-heading">Tactical Standings</div>

            <div v-if="loadingBoards" class="board-empty" style="text-align:center; padding: 1rem 0;">
              Loading...
            </div>

            <template v-else>
              <div class="diff-row">
                <div class="diff-row-header">Cumulative Combat Score</div>
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
import { createInitialState } from '@/components/games/FracturedFrontier/engine';
import GameInfoModal from '@/components/GameInfoModal.vue';
import gameData from '@/data/gameInfo.json';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import orbitalBombardmentLogo from '@/assets/images/games/title-fracturedfrontier.svg';
import exitIcon     from '@/assets/icons/person-from-portal3.svg';
import astronautIcon from '@/assets/icons/user-astronaut6.svg';
import computerIcon  from '@/assets/icons/computer-classic7.svg';

const router = useRouter();
const hasClicked = ref(false);

// ── Leaderboard ────────────────────────────────────────────────────────────

const { userInfo, isCadet, isStaff, isAdmin } = useAuth();
const { isBroadcasting, selectedPeriodId: broadcastPeriodId } = useBroadcast();

const SCORE_OPTIONS = { lowerIsBetter: false }
const boardComposable = useGameScores('fractured_frontier', SCORE_OPTIONS);

const leaderboard      = ref<any[]>([]);
const loadingBoards    = ref(false);

const studentPeriodId = computed(() =>
  isBroadcasting.value && broadcastPeriodId.value
    ? broadcastPeriodId.value
    : userInfo.value?.periodId ?? null
)

const firstName = (name: string) => name.split(' ')[0]

async function loadLeaderboards() {
  loadingBoards.value = true;
  try {
    if (studentPeriodId.value) {
      leaderboard.value = await boardComposable.fetchPeriodLeaderboard(studentPeriodId.value, 5);
    }
  } finally {
    loadingBoards.value = false;
  }
}

const gameInfo = gameData.orbitalBombardment;

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
  const initialState = JSON.stringify(createInitialState());
  await createOnlineGame('fractured-frontier', initialState);
}

async function handleJoin() {
  if (!inputCode.value) return;
  await joinOnlineGame('fractured-frontier', inputCode.value.toUpperCase());
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
  router.push('/games/fractured-frontier/play');
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
  router.push('/games/fractured-frontier/play?mode=online');
}
</script>

<style scoped>
@import '@/assets/styles/gameLanding.css';
</style>
