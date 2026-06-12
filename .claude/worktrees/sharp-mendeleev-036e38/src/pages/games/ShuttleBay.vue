<template>
  <div class="game-landing-container" :class="{ 'fade-out': hasClicked }">
    <div class="intro-view">
      <!-- Row 1: Logo -->
      <div class="logo-row" :class="{ 'dimmed fade-out': hasClicked }">
        <img :src="shuttleBayLogo" alt="Shuttle Bay" class="shuttlebay-logo" />
      </div>

      <!-- Row 2: Mission subheading -->
      <div class="content-row">
        <div class="briefing-column" :class="{ 'dimmed fade-out': hasClicked }">
          <div class="mission-subheading">
            <h3>A logjam in the cargo bay is preventing the shuttle from departing on its mission.</h3>
            <p>Clear a path for the shuttle to reach the exit on the right.</p>
          </div>
        </div>
      </div>

      <!-- Row 3: Controls (Left) and Briefing + Modals (Right) -->
      <div class="content-row">
        <div class="controls-column" :class="{ 'dimmed fade-out': hasClicked }">
          <div class="launch-controls">
            <button
                type="button"
                class="pill launch-option"
                @click="startTransition"
            >
              LAUNCH SIMULATION
            </button>
          </div>
          <button class="back-btn pill" @click="router.push('/games')">BACK TO SIMULATOR</button>
        </div>

        <div class="briefing-column" :class="{ 'dimmed fade-out': hasClicked }">
          <div class="mission-briefing">
            <p>The Shuttle Bay is gridlocked. Cargo vessels and maintenance pods block every route through
              the bay, and the mission clock is running. You'll need to think several moves ahead — sliding
              vehicles out of the way one at a time — to open a clear path for the shuttle to reach the
              exit. Each puzzle demands careful sequencing, spatial reasoning, and the kind of methodical
              planning that separates a good engineer from a great one.</p>
          </div>
        </div>
      </div>
      <div class="modal-trigger-row" :class="{ 'dimmed fade-out': hasClicked }">
        <button class="modal-trigger-btn" @click="openModal('rules')">Rules of the Game</button>
        <button class="modal-trigger-btn" @click="openModal('standards')">Curriculum Standards</button>
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
import { onMounted, ref, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useGameModal } from '@/composables/useGameModal';
import GameInfoModal from '@/components/GameInfoModal.vue';
import gameData from '@/data/gameInfo.json';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';
import shuttleBayLogo from '@/assets/images/games/title-shuttlebay.svg';

const router = useRouter();
const hasClicked = ref(false);
const gameInfo = gameData.shuttleBay;
const { activeModal, openModal, closeModal } = useGameModal();

onMounted(() => {
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
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

  router.push('/games/shuttle-bay/play');
}
</script>

<style scoped>
@import '@/assets/styles/gameLanding.css';

.shuttlebay-logo {
  width: 25rem;
  max-width: 80vw;
  height: auto;
  filter: drop-shadow(0 0 1.25rem rgba(255, 157, 0, 0.3));
}


</style>