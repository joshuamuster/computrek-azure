<template>
  <div class="game-landing-container" :class="{ 'fade-out': hasClicked }">
    <div class="intro-view">

      <div class="logo-row">
        <img :src="mancalaLogo" alt="Rules of Acquisition" class="game-logo" />
      </div>

      <div class="landing-layout" :class="{ 'dimmed': hasClicked }">

        <!-- ── LEFT: briefing + controls ── -->
        <div class="landing-left">

          <div class="mission-subheading">
            <h3>The C.S.S. Curiosity has initiated a Ferengi trade‑negotiation simulation.</h3>
            <p>Your objective is to redistribute gold-pressed latinum reserves across the board with maximum efficiency, foresight, and profit, following the timeless Rules of Acquisition.</p>
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
            <p>Welcome to the Ferengi Alliance's most prestigious training simulation. Rules of Acquisition
              challenges cadets to think strategically about resource flow and long‑term planning. Every action
              alters the balance of assets on the board, forcing you to anticipate future opportunities, manage
              scarcity, and outmaneuver your opponent through careful sequencing and tactical foresight in a
              simulation optimized for both computer science and successful Ferengi negotiations.</p>
            <div class="modal-trigger-row">
              <button class="modal-trigger-btn" @click="openModal('rules')">Rules of the Game</button>
              <button class="modal-trigger-btn" @click="openModal('standards')">Curriculum Standards</button>
            </div>
          </div>

        </div>

        <!-- ── RIGHT: leaderboard ── -->
        <div class="landing-right" v-if="isCadet || isStaff || isAdmin">
          <div class="leaderboard-panel">

            <div class="leaderboard-panel-heading">
              {{ isStaffUser ? 'Faculty Standings' : 'Cadets vs Faculty' }}
            </div>

            <div v-if="loadingBoards" class="board-empty" style="text-align:center; padding: 1rem 0;">
              Loading...
            </div>

            <template v-else>
              <div class="diff-row">

                <div class="diff-row-header">All Time Wins</div>

                <div class="diff-row-boards">

                  <!-- Cadets half (students) or sole Faculty column (staff) -->
                  <div class="diff-half" :class="isStaffUser ? 'faculty-half' : 'period-half'">
                    <div class="diff-half-label">
                      {{ isStaffUser ? 'Faculty' : 'Cadets' }}
                    </div>
                    <div
                        v-if="!(isStaffUser ? staffLeaderboard : leaderboard)?.length"
                        class="board-empty"
                    >No scores yet</div>
                    <ol class="board-list">
                      <li
                          v-for="(entry, i) in (isStaffUser ? staffLeaderboard : leaderboard)"
                          :key="entry.uid"
                          class="board-entry"
                          :class="{
                            'is-me':       entry.uid === userInfo?.uid,
                            'beats-staff': !isStaffUser && beatsBestStaff(entry.highScore),
                          }"
                      >
                        <span class="board-rank">{{ i + 1 }}</span>
                        <span class="board-name">{{ isStaffUser ? lastName(entry.displayName) : firstName(entry.displayName) }}</span>
                        <span class="board-score">{{ entry.highScore }}</span>
                        <span
                            v-if="!isStaffUser && beatsBestStaff(entry.highScore)"
                            class="beat-badge"
                            title="Beats faculty best!"
                        >🖖</span>
                      </li>
                    </ol>
                  </div>

                  <!-- Faculty half — students only -->
                  <div class="diff-half faculty-half" v-if="!isStaffUser">
                    <div class="diff-half-label">Faculty</div>
                    <div v-if="!staffLeaderboard?.length" class="board-empty">No scores yet</div>
                    <ol class="board-list">
                      <li
                          v-for="(entry, i) in staffLeaderboard"
                          :key="entry.uid"
                          class="board-entry"
                          :class="{ 'is-me': entry.uid === userInfo?.uid }"
                      >
                        <span class="board-rank">{{ i + 1 }}</span>
                        <span class="board-name">{{ lastName(entry.displayName) }}</span>
                        <span class="board-score">{{ entry.highScore }}</span>
                      </li>
                    </ol>
                  </div>

                </div>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useMultiplayer } from '@/composables/useMultiplayer';
import { useGameModal } from '@/composables/useGameModal';
import { useGameScores } from '@/composables/useGameScores';
import { useAuth } from '@/composables/useAuth.js';
import { getInitialBoard, boardToString } from '@/components/games/RulesOfAcquisition/engine';
import GameInfoModal from '@/components/GameInfoModal.vue';
import gameData from '@/data/gameInfo.json';
import mancalaLogo from '@/assets/images/games/title-rulesofacquisition.svg';
import exitIcon from '@/assets/icons/person-to-portal6.svg';
import astronautIcon from '@/assets/icons/user-astronaut6.svg';
import computerIcon  from '@/assets/icons/computer-classic7.svg';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';

const router = useRouter();
const hasClicked = ref(false);

// ── Leaderboard ────────────────────────────────────────────────────────────

const { userInfo, isCadet, isStaff, isAdmin } = useAuth();

const SCORE_OPTIONS = { lowerIsBetter: false }
const boardComposable = useGameScores('rules_of_acquisition', SCORE_OPTIONS);

const leaderboard      = ref<any[]>([]);
const staffLeaderboard = ref<any[]>([]);
const loadingBoards    = ref(false);

const isStaffUser     = computed(() => isStaff.value || isAdmin.value)
const studentPeriodId = computed(() => userInfo.value?.periodId ?? null)

const firstName = (name: string) => name.split(' ')[0]
const lastName  = (name: string) => name.split(' ').at(-1) ?? name

function beatsBestStaff(score: number): boolean {
  if (!staffLeaderboard.value?.length) return false
  return score > staffLeaderboard.value[0].highScore
}

async function loadLeaderboards() {
  loadingBoards.value = true;
  try {
    staffLeaderboard.value = await boardComposable.fetchPeriodLeaderboard('staff', 5);

    if (!isStaffUser.value && studentPeriodId.value) {
      leaderboard.value = await boardComposable.fetchPeriodLeaderboard(studentPeriodId.value, 5);
    }
  } finally {
    loadingBoards.value = false;
  }
}

const gameInfo = gameData.rulesOfAcquisition;
const { activeModal, openModal, closeModal } = useGameModal();

const {
  createOnlineGame,
  joinOnlineGame,
  joinCode,
  isLoading,
  error: multiError, resetState
} = useMultiplayer();

const multiplayerAction = ref<'create' | 'join' | null>(null);
const inputCode = ref('');

onMounted(() => {
  resetState();
  window.dispatchEvent(new CustomEvent("opening-intro-clear", { detail: true }));
  loadLeaderboards();
});

onBeforeUnmount(() => {
  if (!hasClicked.value) {
    resetState();
    window.dispatchEvent(new CustomEvent("opening-intro-clear", { detail: true }));
  }
});

const handleCreate = async () => {
  const initialState = boardToString(getInitialBoard().pits);
  await createOnlineGame('mancala', initialState, 'white');
};

const handleJoin = async () => {
  if (!inputCode.value) return;
  await joinOnlineGame('mancala', inputCode.value.toUpperCase());
  if (!multiError.value) {
    startTransition();
  }
};

const launchLocal = async () => {
  if (hasClicked.value) return;
  hasClicked.value = true;

  try {
    const audio = new Audio(soundSuccess);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (e) {}

  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  await new Promise(resolve => setTimeout(resolve, 1500));
  router.push('/games/rules-of-acquisition/play');
};

const startTransition = async () => {
  if (hasClicked.value) return;
  hasClicked.value = true;

  try {
    const audio = new Audio(soundSuccess);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (e) {}

  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  await new Promise(resolve => setTimeout(resolve, 1500));
  router.push('/games/rules-of-acquisition/play?mode=online');
};
</script>

<style scoped>
@import '@/assets/styles/gameLanding.css';
</style>