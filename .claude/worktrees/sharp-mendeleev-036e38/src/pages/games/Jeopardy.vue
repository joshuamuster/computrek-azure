<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useJeopardy } from '../../composables/useJeopardy';
import { useGameModal } from '@/composables/useGameModal';
import GameInfoModal from '@/components/GameInfoModal.vue';
import gameData from '@/data/gameInfo.json';
import soundSuccess from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav';

const router = useRouter();
const {
  availableSheets,
  selectedSheet,
  selectedPeriod,
  periods,
  initializeData,
  fetchSheets
} = useJeopardy();

const gameInfo = gameData.jeopardy;
const { activeModal, openModal, closeModal } = useGameModal();

const hasClicked = ref(false);

onMounted(async () => {
  initializeData();
  await fetchSheets();

  // Reset to unselected values when loading the landing page
  selectedPeriod.value = 0;
  selectedSheet.value = '';

  // Ensure dimming is cleared when entering the landing page
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
});

onBeforeUnmount(() => {
  // Only clear dimming if we are NOT transitioning to the play page
  if (!hasClicked.value) {
    window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
  }
});

async function startTransition() {
  if (hasClicked.value) return;
  if (!selectedPeriod.value || !selectedSheet.value) return;

  hasClicked.value = true;

  try {
    const audio = new Audio(soundSuccess);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (e) {}

  // Dispatch event to dim the main UI frames
  window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));

  // Wait for the fade effect to be visible
  await new Promise(resolve => setTimeout(resolve, 1500));

  router.push('/games/jeopardy/play');
}

function onSelection() {
  if (selectedPeriod.value && selectedSheet.value) {
    startTransition();
  }
}

</script>

<template>
  <div class="game-landing-container" :class="{ 'fade-out': hasClicked }">
    <div class="intro-view">
      <!-- Row 1: Logo -->
      <div class="logo-row" :class="{ 'dimmed fade-out': hasClicked }">
        <img 
          src="../../assets/images/games/title-jeopardy.svg"
          alt="Jeopardy" 
          class="jeopardy-logo"
        >
      </div>

      <!-- Row 2: Text (Left) and Button (Right) -->
      <div class="content-row">
        <div class="briefing-column" :class="{ 'dimmed fade-out': hasClicked }">
          <div class="mission-briefing">
            <p>Accessing Starfleet Academy training archives... This simulation will test your knowledge across multiple categories.</p>
            <p>Prove your expertise to advance through the ranks and demonstrate your readiness for bridge duty.</p>
          </div>
        </div>

        <div class="controls-column" :class="{ 'dimmed fade-out': hasClicked }">
          <div class="sheet-controls">
            <label>Select Period</label>
            <div class="period-row">
              <button
                  v-for="p in periods"
                  :key="p"
                  type="button"
                  class="period-option"
                  :class="{ active: selectedPeriod === p }"
                  @click="selectedPeriod = p; onSelection()"
              >
                {{ p }}
              </button>
            </div>
            
            <div class="sheet-select-wrapper">
              <select id="sheet-select" v-model="selectedSheet" @change="onSelection">
                <option value="" disabled>Select Puzzle...</option>
                <option v-for="sheet in availableSheets" :key="sheet" :value="sheet">
                  {{ sheet }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 3: Back Button -->
      <div class="footer-row" :class="{ 'dimmed fade-out': hasClicked }">
        <button class="back-btn pill" @click="router.push('/games')">BACK TO GALLERY</button>
      </div>
      <!-- Modal Trigger Buttons -->
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

<style scoped>
@import '@/assets/styles/gameLanding.css';

.sheet-controls {
  display: flex;
  flex-direction: column;
  gap: 0.9375rem;
}

.jeopardy-logo {
  height: auto;
  width: 100%;
  max-width: 25rem;
  cursor: default;
  filter: drop-shadow(0 0 1.25rem rgba(153, 204, 255, 0.2));
}

.sheet-controls label {
  font-family: 'Antonio', sans-serif;
  text-transform: uppercase;
  color: #89f;
  font-weight: bold;
  font-size: 0.9rem;
}

.period-row {
  display: flex;
  gap: 0.25rem;
  justify-content: center;
}

.period-option {
  background-color: #121212;
  color: white;
  border: 0.0625rem solid #333;
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 1.875rem;
}

.period-option:hover {
  background-color: #222;
  border-color: #89f;
}

.period-option.active {
  background-color: #ffc400;
  color: black;
  border-color: #ffc400;
  font-weight: bold;
}

.sheet-controls select {
  background-color: #121212;
  color: white;
  border: 0;
  border-radius: 0.3125rem;
  padding: 0.3125rem 0.625rem;
  font-family: 'Antonio', sans-serif;
  font-size: 1.1rem;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
}

.sheet-controls select:focus {
  border-color: #ffc400;
}

.make-it-so {
  color: #ffffff;
  font-size: clamp(1.5rem, 4vw, 3rem);
  font-weight: 800;
  letter-spacing: 0.125rem;
  text-shadow: 0 0.125rem 0.375rem rgba(0,0,0,0.6);
  background: rgba(0, 0, 0, 0.3);
  border: 0.125rem solid rgba(255, 255, 255, 0.2);
  border-radius: 0.9375rem;
  padding: 0.9375rem 2.5rem;
  cursor: pointer;
  transition: all 0.6s ease;
  font-family: 'Antonio', sans-serif;
  text-transform: uppercase;
  margin-top: 1.25rem;
}

.make-it-so:hover {
  background: rgba(255, 196, 0, 0.2);
  border-color: #ffc400;
  color: #ffc400;
  transform: scale(1.05);
}

.make-it-so.fade-out {
  opacity: 0;
  pointer-events: none;
  transform: scale(0.9);
}

.jeopardy-logo.dimmed {
  opacity: 0.5;
  transition: opacity 1.5s ease;
}
</style>
