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
            <h3>Enter the ultimate command‑level strategy simulation</h3>
            <p>
              Your objective is to outmaneuver an opposing force on a contested tactical grid, coordinating your
              pieces with the precision and foresight expected of a CompuTrek officer.
            </p>
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
import { onMounted, ref, computed, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useMultiplayer } from '@/composables/useMultiplayer';
import { useGameModal } from '@/composables/useGameModal';
import { useGameScores } from '@/composables/useGameScores';
import { useAuth } from '@/composables/useAuth.js';
import GameInfoModal from '@/components/GameInfoModal.vue';
import gameData from '@/data/gameInfo.json';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import chessLogo from '@/assets/images/games/title-chess.svg';
import exitIcon     from '@/assets/icons/person-to-portal6.svg';
import astronautIcon from '@/assets/icons/user-astronaut6.svg';
import computerIcon  from '@/assets/icons/computer-classic7.svg';

const router = useRouter();
const hasClicked = ref(false);

// ── Leaderboard ────────────────────────────────────────────────────────────

const { userInfo, isCadet, isStaff, isAdmin } = useAuth();

const SCORE_OPTIONS = { lowerIsBetter: false }
const boardComposable = useGameScores('chess', SCORE_OPTIONS);

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

const gameInfo = gameData.chess;

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
  const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  await createOnlineGame('chess', startingFen);
}

async function handleJoin() {
  if (!inputCode.value) return;
  await joinOnlineGame('chess', inputCode.value.toUpperCase());
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
  router.push('/games/chess/play');
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
  router.push('/games/chess/play?mode=online');
}
</script>

<style scoped>
@import '@/assets/styles/gameLanding.css';
</style>