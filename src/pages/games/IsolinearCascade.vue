<template>
  <div class="game-landing-container" :class="{ 'fade-out': hasClicked }">
    <div class="intro-view">

      <!-- Logo — full width, above the two-column layout -->
      <div class="logo-row">
        <img :src="isolinearCascadeLogo" alt="Isolinear Cascade" class="game-logo" />
      </div>

      <div class="landing-layout" :class="{ 'dimmed': hasClicked }">

        <!-- ── LEFT: subheading + controls + briefing ── -->
        <div class="landing-left">

          <div class="mission-subheading">
            <h3>A power surge has disrupted the isolinear chip array aboard the C.S.S. Curiosity!</h3>
            <p>Toggle every panel to dark before critical systems are affected.</p>
            <div class="controls-row">
              <button type="button" class="pill launch-option" @click="startTransition">
                LAUNCH SIMULATION
              </button>
              <button class="back-btn pill" @click="router.push('/games')">
                BACK TO SIMULATOR
              </button>
            </div>
          </div>

          <div class="mission-briefing">
            <p>Isolinear Cascade challenges players to extinguish every illuminated panel on a grid by
              toggling switches that flip a cell and all its immediate neighbours simultaneously.
              What starts as a simple press quickly cascades into a web of dependencies — every move
              affects multiple panels, and undoing mistakes takes careful planning. Mastering the
              puzzle requires systematic thinking and the ability to see several steps ahead.</p>
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
                    <span class="board-score">{{ entry.highScore }} mv</span>
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
import isolinearCascadeLogo from '@/assets/images/games/title-isolinearcascade.svg';

const router     = useRouter();
const hasClicked = ref(false);
const gameInfo   = gameData.isolinearCascade;
const { activeModal, openModal, closeModal } = useGameModal();
const { userInfo, isCadet, isStaff, isAdmin } = useAuth();
const { isBroadcasting, selectedPeriodId: broadcastPeriodId } = useBroadcast();

// ── Leaderboard ────────────────────────────────────────────────────────────

const DIFFICULTIES = [
  { key: 'easy',   name: 'Easy'   },
  { key: 'medium', name: 'Medium' },
  { key: 'hard',   name: 'Hard'   },
] as const;

const SCORE_OPTIONS = { lowerIsBetter: true }
const boardComposables = {
  easy:   useGameScores('isolinear_easy',   SCORE_OPTIONS),
  medium: useGameScores('isolinear_medium', SCORE_OPTIONS),
  hard:   useGameScores('isolinear_hard',   SCORE_OPTIONS),
}

const leaderboards      = ref<Record<string, any[]>>({ easy: [], medium: [], hard: [] });
const staffLeaderboards = ref<Record<string, any[]>>({ easy: [], medium: [], hard: [] });
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

const firstName = (name: string) => name.split(' ')[0]
const lastName  = (name: string) => name.split(' ').at(-1) ?? name

/** True if the student score beats the top faculty move count for this difficulty. */
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
  router.push('/games/isolinear-cascade/play');
}
</script>

<style scoped>
@import '@/assets/styles/gameLanding.css';
</style>