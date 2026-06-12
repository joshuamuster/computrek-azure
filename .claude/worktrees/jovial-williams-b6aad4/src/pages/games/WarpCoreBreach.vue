<template>
  <div class="game-landing-container" :class="{ 'fade-out': hasClicked }">
    <div class="intro-view">

      <!-- Logo — full width, above the two-column layout -->
      <div class="logo-row">
        <img :src="warpCoreBreachLogo" alt="Warp Core Breach" class="game-logo" />
      </div>

      <div class="landing-layout" :class="{ 'dimmed': hasClicked }">

        <!-- ── LEFT: subheading + controls + briefing ── -->
        <div class="landing-left">

          <div class="mission-subheading">
            <h3>A coolant line to the warp core aboard the C.S.S. Curiosity has ruptured!</h3>
            <p>Construct a new coolant line to guide the flow before it breaches the hull.</p>
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
            <p>Warp Core Breach challenges players to build a continuous pipe network before pressurised
              coolant starts flowing. Place pipes from a randomised queue to steer the flow as far as
              possible — the longer the chain, the higher the score. Think fast: the coolant doesn't
              wait, and a single gap means a catastrophic breach. Hold SPACEBAR to accelerate the flow
              for bonus points when you're confident in your pipeline.</p>
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
              {{ isStaffUser ? 'Faculty Standings' : `Period ${periodLabel} vs Faculty` }}
            </div>

            <div v-if="loadingBoards" class="board-empty" style="text-align:center; padding: 1rem 0;">
              Loading...
            </div>

            <template v-else>
              <div v-for="diff in DIFFICULTIES" :key="diff.key" class="diff-row">

                <div class="diff-row-header" :class="diff.key">{{ diff.name }}</div>

                <div class="diff-row-boards">

                  <!-- Period half (students) or sole Faculty column (staff) -->
                  <div class="diff-half" :class="isStaffUser ? 'faculty-half' : 'period-half'">
                    <div class="diff-half-label">
                      {{ isStaffUser ? 'Faculty' : 'Cadets' }}
                    </div>
                    <div
                        v-if="!(isStaffUser ? staffLeaderboards[diff.key] : leaderboards[diff.key])?.length"
                        class="board-empty"
                    >No scores yet</div>
                    <ol class="board-list">
                      <li
                          v-for="(entry, i) in (isStaffUser ? staffLeaderboards[diff.key] : leaderboards[diff.key])"
                          :key="entry.uid"
                          class="board-entry"
                          :class="{
                            'is-me':       entry.uid === userInfo?.uid,
                            'beats-staff': !isStaffUser && beatsBestStaff(entry.highScore, diff.key),
                          }"
                      >
                        <span class="board-rank">{{ i + 1 }}</span>
                        <span class="board-name">{{ isStaffUser ? lastName(entry.displayName) : firstName(entry.displayName) }}</span>
                        <span class="board-score">{{ entry.highScore }} pts</span>
                        <span
                            v-if="!isStaffUser && beatsBestStaff(entry.highScore, diff.key)"
                            class="beat-badge"
                            title="Beats faculty best!"
                        >🖖</span>
                      </li>
                    </ol>
                  </div>

                  <!-- Faculty half — students only -->
                  <div class="diff-half faculty-half" v-if="!isStaffUser">
                    <div class="diff-half-label">Faculty</div>
                    <div v-if="!staffLeaderboards[diff.key]?.length" class="board-empty">No scores yet</div>
                    <ol class="board-list">
                      <li
                          v-for="(entry, i) in staffLeaderboards[diff.key]"
                          :key="entry.uid"
                          class="board-entry"
                          :class="{ 'is-me': entry.uid === userInfo?.uid }"
                      >
                        <span class="board-rank">{{ i + 1 }}</span>
                        <span class="board-name">{{ lastName(entry.displayName) }}</span>
                        <span class="board-score">{{ entry.highScore }} pts</span>
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
import { useGameModal } from '@/composables/useGameModal';
import { useGameScores } from '@/composables/useGameScores';
import { useAuth } from '@/composables/useAuth.js';
import GameInfoModal from '@/components/GameInfoModal.vue';
import gameData from '@/data/gameInfo.json';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import warpCoreBreachLogo from '@/assets/images/games/title-warpcorebreach.svg';

const router     = useRouter();
const hasClicked = ref(false);
const gameInfo   = (gameData as any).warpCoreBreach;
const { activeModal, openModal, closeModal } = useGameModal();
const { userInfo, isCadet, isStaff, isAdmin } = useAuth();

// ── Leaderboard ────────────────────────────────────────────────────────────

const DIFFICULTIES = [
  { key: 'easy',   name: 'Easy'   },
  { key: 'medium', name: 'Medium' },
  { key: 'hard',   name: 'Hard'   },
] as const;

// Higher is better — lowerIsBetter defaults to false
const boardComposables = {
  easy:   useGameScores('warp_easy'),
  medium: useGameScores('warp_medium'),
  hard:   useGameScores('warp_hard'),
}

const leaderboards      = ref<Record<string, any[]>>({ easy: [], medium: [], hard: [] });
const staffLeaderboards = ref<Record<string, any[]>>({ easy: [], medium: [], hard: [] });
const loadingBoards     = ref(false);

const isStaffUser     = computed(() => isStaff.value || isAdmin.value)
const studentPeriodId = computed(() => userInfo.value?.periodId ?? null)
const periodLabel     = computed(() =>
    isStaffUser.value ? 'Faculty' : (studentPeriodId.value?.replace('period-', '') ?? '?')
)

const firstName = (name: string) => name.split(' ')[0]
const lastName  = (name: string) => name.split(' ').at(-1) ?? name

/** True if the student score beats the top faculty score for this difficulty. */
function beatsBestStaff(score: number, diffKey: string): boolean {
  const board = staffLeaderboards.value[diffKey]
  if (!board?.length) return false
  return score > board[0].highScore  // higher is better
}

async function loadLeaderboards() {
  loadingBoards.value = true;
  try {
    const staffResults = await Promise.all(
        DIFFICULTIES.map(async (diff) => {
          const entries = await boardComposables[diff.key].fetchPeriodLeaderboard('staff', 5);
          return [diff.key, entries] as const;
        })
    );
    staffLeaderboards.value = Object.fromEntries(staffResults);

    if (!isStaffUser.value && studentPeriodId.value) {
      const periodResults = await Promise.all(
          DIFFICULTIES.map(async (diff) => {
            const entries = await boardComposables[diff.key].fetchPeriodLeaderboard(studentPeriodId.value!, 5);
            return [diff.key, entries] as const;
          })
      );
      leaderboards.value = Object.fromEntries(periodResults);
    }
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
  router.push('/games/warp-core-breach/play');
}
</script>

<style scoped>
@import '@/assets/styles/gameLanding.css';
</style>