<template>
  <div class="game-landing-container" :class="{ 'fade-out': hasClicked }">
    <div class="intro-view">

      <div class="logo-row">
        <img :src="minesweeperLogo" alt="Minesweeper" class="game-logo" />
      </div>

      <div class="landing-layout" :class="{ 'dimmed': hasClicked }">

        <!-- ── LEFT: logo + briefing + controls ── -->
        <div class="landing-left">


          <div class="mission-subheading">
            <h3>The C.S.S. Curiosity has entered a sector littered with cloaked orbital mines!</h3>
            <p>Use tactical sensors to scan the grid and mark all threats before they damage the hull.</p>
            <div class="controls-row">
              <button type="button" class="pill launch-option" @click="startTransition">
                LAUNCH SIMULATION
              </button>
              <button class="back-btn pill" @click="router.push('/games')">
                BACK TO THE SIMULATOR
              </button>
            </div>
          </div>
          <div class="mission-briefing">
            <p>Minesweeper challenges players to use logic and deduction to uncover every safe tile on a
              hidden grid without triggering any of the mines buried beneath the surface. Each number you
              reveal tells you how many mines are touching that square, and from those clues you piece
              together the layout of the board — testing hypotheses, eliminating possibilities, and making
              careful decisions as the puzzle unfolds.</p>
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
              <div v-for="diff in DIFFICULTIES" :key="diff.key" class="diff-row">

                <div class="diff-row-header" :class="diff.key">{{ diff.name }}</div>

                <div v-if="!leaderboards[diff.key]?.length" class="board-empty">No scores yet</div>
                <ol class="board-list">
                  <li
                      v-for="(entry, i) in leaderboards[diff.key]"
                      :key="entry.uid"
                      class="board-entry"
                      :class="{ 'is-me': entry.uid === userInfo?.uid }"
                  >
                    <span class="board-rank">{{ i + 1 }}</span>
                    <span class="board-name">{{ firstName(entry.displayName) }}</span>
                    <span class="board-score">{{ formatTime(entry.highScore) }}</span>
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
import { useGameModal } from '@/composables/useGameModal';
import { useGameScores } from '@/composables/useGameScores';
import { useAuth } from '@/composables/useAuth.js';
import { useBroadcast } from '@/composables/useBroadcast';
import GameInfoModal from '@/components/GameInfoModal.vue';
import gameData from '@/data/gameInfo.json';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import minesweeperLogo from '@/assets/images/games/title-minesweeper.svg';

const router   = useRouter();
const gameInfo = gameData.minesweeper;
const { activeModal, openModal, closeModal } = useGameModal();
const { userInfo, isCadet, isStaff, isAdmin } = useAuth();
const { isBroadcasting, selectedPeriodId: broadcastPeriodId } = useBroadcast();

const hasClicked = ref(false);

// ── Leaderboard ────────────────────────────────────────────────────────────

const DIFFICULTIES = [
  { key: 'cadet',     name: 'Cadet'     },
  { key: 'standard',  name: 'Standard'  },
  { key: 'red-alert', name: 'Red Alert' },
] as const;

const SCORE_OPTIONS = { lowerIsBetter: true }
const boardComposables = {
  cadet:       useGameScores('minesweeper_cadet',     SCORE_OPTIONS),
  standard:    useGameScores('minesweeper_standard',  SCORE_OPTIONS),
  'red-alert': useGameScores('minesweeper_red-alert', SCORE_OPTIONS),
}

const leaderboards      = ref<Record<string, any[]>>({ cadet: [], standard: [], 'red-alert': [] });
const staffLeaderboards = ref<Record<string, any[]>>({ cadet: [], standard: [], 'red-alert': [] });
const loadingBoards     = ref(false);

const isStaffUser     = computed(() => isStaff.value || isAdmin.value)
const studentPeriodId = computed(() =>
  isBroadcasting.value && broadcastPeriodId.value
    ? broadcastPeriodId.value
    : userInfo.value?.periodId ?? null
)
const periodLabel     = computed(() =>
    isStaffUser.value ? 'Faculty' : (studentPeriodId.value?.replace('period-', '') ?? '?')
)

/** Formats seconds as M:SS */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const firstName = (name: string) => name.split(' ')[0]
const lastName  = (name: string) => name.split(' ').at(-1) ?? name

/** True if the student score beats the top faculty time for this difficulty. */
function beatsBestStaff(score: number, diffKey: string): boolean {
  const board = staffLeaderboards.value[diffKey]
  if (!board?.length) return false
  return score < board[0].highScore
}

async function loadLeaderboards() {
  loadingBoards.value = true;
  try {
    if (studentPeriodId.value) {
      const periodResults = await Promise.all(
          DIFFICULTIES.map(async (diff) => {
            const entries = await boardComposables[diff.key].fetchPeriodLeaderboard(studentPeriodId.value!, 5);
            return [diff.key, entries] as const;
          })
      );
      leaderboards.value = Object.fromEntries(periodResults);
    }
    // Faculty fetch removed — re-add staffLeaderboards fetch here when needed
  } finally {
    loadingBoards.value = false;
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(() => {
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
  loadLeaderboards();
});

onBeforeUnmount(() => {
  if (!hasClicked.value) {
    window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
  }
});

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
  router.push('/games/minesweeper/play');
}
</script>

<style scoped>
@import '@/assets/styles/gameLanding.css';
/* All leaderboard styles live in gameLanding.css — nothing game-specific to override here */
</style>