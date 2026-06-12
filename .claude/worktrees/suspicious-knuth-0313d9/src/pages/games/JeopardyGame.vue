<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useJeopardy, type Question } from '../../composables/useJeopardy';
import soundWarmup from '@/assets/sounds/LCARS-Bridge-Warmup.mp3';

const router = useRouter();
const {
  categories,
  loading,
  error,
  availableSheets,
  selectedSheet,
  selectedPeriod,
  periods,
  periodScores,
  teamNames,
  answeredQuestions,
  initializeData,
  fetchSheets,
  fetchJeopardyData,
  applyAnsweredState
} = useJeopardy();

const currentQuestion = ref<Question | null>(null);
const showAnswer = ref(false);
const activeQuestionIndices = ref<{catIdx: number, qIdx: number} | null>(null);
const showScoreModal = ref(false);
const activeTeamIdx = ref<number | null>(null);
const selectedTeams = ref<number[]>([]);

// Reset confirmation modal state
const showConfirm = ref(false);
const confirmMessage = ref('ARE YOU SURE YOU WANT TO RESET?');
let confirmActionCallback: (() => void) | null = null;

onMounted(async () => {
  initializeData();
  await fetchSheets();
  if (selectedPeriod.value && selectedSheet.value) {
    // Ensure the background stays dimmed (or dims if loaded directly)
    window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));

    await fetchJeopardyData();

    // Play warmup sound as the board appears
    try {
      const audio = new Audio(soundWarmup);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}
  } else {
    // If no selection, go back to landing
    router.push('/games/jeopardy');
  }
});

function onSelection() {
  if (selectedPeriod.value && selectedSheet.value) {
    fetchJeopardyData();
  }
}

function onLogoClick() {
  router.push('/games');
}

watch(selectedPeriod, () => {
  applyAnsweredState();
});

watch(selectedSheet, () => {
  fetchJeopardyData();
});

function selectQuestion(question: Question, catIdx: number, qIdx: number) {
  currentQuestion.value = question;
  activeQuestionIndices.value = { catIdx, qIdx };
  showAnswer.value = false;
}

function revealAnswer() {
  showAnswer.value = true;
}

function closeQuestion() {
  if (currentQuestion.value && activeQuestionIndices.value) {
    currentQuestion.value.answered = true;

    const { catIdx, qIdx } = activeQuestionIndices.value;
    const period = selectedPeriod.value;
    const sheet = selectedSheet.value;

    if (!answeredQuestions.value[period]) {
      answeredQuestions.value[period] = {};
    }
    if (!answeredQuestions.value[period][sheet]) {
      answeredQuestions.value[period][sheet] = [];
    }
    const key = `${catIdx}-${qIdx}`;
    if (!answeredQuestions.value[period][sheet].includes(key)) {
      answeredQuestions.value[period][sheet].push(key);
    }
  }
  currentQuestion.value = null;
  activeQuestionIndices.value = null;
  selectedTeams.value = [];
}

function updateScore(teamIdx: number, points: number) {
  const period = selectedPeriod.value;
  const sheet = selectedSheet.value;
  if (!periodScores.value[period]) {
    periodScores.value[period] = {};
  }
  if (!periodScores.value[period][sheet]) {
    periodScores.value[period][sheet] = [0, 0, 0, 0];
  }
  periodScores.value[period][sheet][teamIdx] += points;
}

function handleReset() {
  // Only show confirmation if a period and sheet are selected
  if (selectedPeriod.value && selectedSheet.value) {
    showConfirm.value = true;
    confirmActionCallback = () => doReset();
  } else {
    doReset();
  }
}

function doReset() {
  const period = selectedPeriod.value;
  const sheet = selectedSheet.value;

  if (!period || !sheet) return;

  if (!answeredQuestions.value[period]) {
    answeredQuestions.value[period] = {} as any;
  }
  answeredQuestions.value[period][sheet] = [];
  applyAnsweredState();

  if (!periodScores.value[period]) {
    periodScores.value[period] = {} as any;
  }
  periodScores.value[period][sheet] = [0, 0, 0, 0];
}

function handleConfirm() {
  showConfirm.value = false;
  if (confirmActionCallback) {
    confirmActionCallback();
    confirmActionCallback = null;
  }
}

function handleCancel() {
  showConfirm.value = false;
  confirmActionCallback = null;
}

function goToStart() {
  selectedPeriod.value = 0;
  selectedSheet.value = '';
  router.push('/games/jeopardy');
}

function toggleTeam(teamIdx: number) {
  const i = selectedTeams.value.indexOf(teamIdx);
  if (i === -1) {
    selectedTeams.value.push(teamIdx);
  } else {
    selectedTeams.value.splice(i, 1);
  }
}

function awardPoints() {
  if (currentQuestion.value && selectedTeams.value.length > 0) {
    for (const teamIdx of selectedTeams.value) {
      updateScore(teamIdx, currentQuestion.value.points);
    }
    closeQuestion();
  }
}

function openScoreModal(idx: number) {
  activeTeamIdx.value = idx;
  showScoreModal.value = true;
}

onBeforeUnmount(() => {
  // Clear dimming when leaving the game
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
});
</script>

<template>
  <div class="jeopardy-container">
    <div class="game-view">
      <div class="game-header">
        <div class="header-left">
          <div class="sheet-controls">
            <label></label>
            <select id="period-select" v-model="selectedPeriod" @change="onSelection">
              <option value="" disabled>Select Period...</option>
              <option v-for="p in periods" :key="p" :value="p">
                Period {{ p }}
              </option>
            </select>
          </div>
          <div class="sheet-controls">
            <select id="sheet-select" v-model="selectedSheet" @change="onSelection">
              <option value="" disabled>Select Puzzle...</option>
              <option v-for="sheet in availableSheets" :key="sheet" :value="sheet">
                {{ sheet }}
              </option>
            </select>
          </div>
        </div>

        <div class="logo-wrapper" @click="onLogoClick">
          <img
              src="../../assets/images/games/title-jeopardy.svg"
              alt="Jeopardy"
              class="game-logo-small"
          >
        </div>

        <div class="header-right">
          <button @click="goToStart" class="start-button">Back to Dials</button>
          <button @click="handleReset" class="pill reset-btn">Reset</button>
        </div>
      </div>

      <div v-if="loading" class="status-message">
        <p>Loading game board from Google Sheets...</p>
      </div>

      <div v-else-if="error" class="status-message error">
        <p>{{ error }}</p>
        <button @click="fetchJeopardyData">Retry</button>
      </div>

      <template v-else>
        <div class="game-board">
          <div class="category" v-for="(category, catIdx) in categories" :key="category.title">
            <h2 class="title">{{ category.title }}</h2>
            <ul>
              <li v-for="(question, qIdx) in category.questions" :key="qIdx">
                <button @click="selectQuestion(question, catIdx, qIdx)" :disabled="question.answered">
                  <span>&#8377;</span> {{ question.points }} <span>&#8377;</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <!-- Scoreboard -->
        <div class="scoreboard">
          <div v-for="(name, idx) in teamNames[selectedPeriod]" :key="idx" class="team-column" :class="'team-' + (idx + 1)">
            <input v-model="teamNames[selectedPeriod][idx]" class="team-name" />
            <button class="score-display" @click="openScoreModal(idx)" type="button">{{ periodScores[selectedPeriod]?.[selectedSheet]?.[idx] || 0 }}</button>
          </div>
        </div>
      </template>
    </div>

    <!-- Question Modal -->
    <div class="modal-overlay" v-if="currentQuestion" @click.self="closeQuestion">
      <div class="modal">
        <div class="modal-content">
          <p>{{ currentQuestion.question }}</p>
          <button @click="revealAnswer" v-if="!showAnswer">Reveal Answer</button>
          <p v-if="showAnswer">{{ currentQuestion.answer }}</p>

          <div v-if="showAnswer" class="award-points">
            <p>Award points to:</p>
            <div class="award-buttons">
              <button
                  v-for="(name, idx) in teamNames[selectedPeriod]"
                  :key="idx"
                  @click="toggleTeam(idx)"
                  :class="['team-' + (idx + 1), { selected: selectedTeams.includes(idx) }]"
              >
                {{ name }}
              </button>
            </div>
            <button
                class="confirm-award-btn"
                :disabled="selectedTeams.length === 0"
                @click="awardPoints"
            >
              Award +{{ currentQuestion.points }} to {{ selectedTeams.length === 0 ? '...' : selectedTeams.map(i => teamNames[selectedPeriod][i]).join(' & ') }}
            </button>
          </div>

          <button @click="closeQuestion">Close</button>
        </div>
      </div>
    </div>

    <!-- Score Adjustment Modal -->
    <div class="modal-overlay" v-if="showScoreModal && activeTeamIdx !== null" @click.self="showScoreModal = false">
      <div class="modal score-modal">
        <div class="modal-content">
          <h2 class="modal-title">{{ teamNames[selectedPeriod][activeTeamIdx] }}</h2>
          <div class="score-display large">{{ periodScores[selectedPeriod]?.[selectedSheet]?.[activeTeamIdx] || 0 }}</div>
          <div class="score-actions">
            <button @click="updateScore(activeTeamIdx, 100)">+100</button>
            <button @click="updateScore(activeTeamIdx, -100)">-100</button>
          </div>
          <button @click="showScoreModal = false">Close</button>
        </div>
      </div>
    </div>
    <!-- Reset Confirmation Modal -->
    <div v-if="showConfirm" class="game-status-overlay confirmation">
      <h2>{{ confirmMessage }}</h2>
      <p class="confirm-sub">Current simulation progress will be lost.</p>
      <div class="confirm-actions">
        <button @click="handleConfirm" class="pill confirm-btn">PROCEED</button>
        <button @click="handleCancel" class="pill abort-btn">ABORT</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Pill / Reset (shared via gameLanding.css) ───────────────────────────── */

.pill:nth-child(2) {
  background-color: inherit;
}
/* game-status-overlay, confirm-sub, confirm-actions, confirm-btn, abort-btn shared via gameLanding.css */
.jeopardy-container {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background-color: rgba(0,0,255,0);
  border-radius: 3.125rem;
  color: white;
  text-align: center;
}

.game-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  justify-content: space-between;
}

/* game-header, header-left, header-right shared via gameLanding.css */

.modal-title {
  font-family: 'Antonio', sans-serif;
  text-transform: uppercase;
  color: #ffc400;
  margin-bottom: 1.5625rem;
  font-size: 2rem;
  margin-top: 0;
}

.scoreboard {
  display: flex;
  justify-content: center;
  gap: 1.25rem;
  margin: 1.25rem 0 0;
  padding: 0.9375rem;
  background-color: rgba(0, 0, 0, 0.25);
  border-radius: 1.25rem;
  max-width: 75rem;
}

.team-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0.625rem;
  border-radius: 0.625rem;
  background-color: rgba(0,0,0,0.4);
}

.team-1 {
  background-color: rgba(102, 153, 255, 0.25);
  border-top: 0.375rem solid #69f;
  border-bottom: 0.375rem solid #69f;
}

.team-2 {
  background-color: rgba(102, 204, 153, 0.25);
  border-bottom: 0.375rem solid #6c9;
  border-top: 0.375rem solid #6c9;
}

.team-3 {
  background-color: rgba(255, 230, 102, 0.25);
  border-bottom: 0.375rem solid #ffe600;
  border-top: 0.375rem solid #ffe600;
}

.team-4 {
  background-color: rgba(204, 68, 68, 0.25);
  border-bottom: 0.375rem solid #c44;
  border-top: 0.375rem solid #c44;
}

.team-name {
  background: transparent;
  border: none;
  border-bottom: 0.125rem solid rgba(255,255,255,0.3);
  color: white;
  font-family: 'Antonio', sans-serif;
  font-size: 1.2rem;
  text-align: center;
  width: 90%;
  text-transform: uppercase;
  font-weight: bold;
}

.team-name:focus {
  outline: none;
  border-bottom: 0.125rem solid #ffc400;
}

.score-display {
  background: transparent;
  border: none;
  padding: 0;
  color: #ffc400;
  cursor: pointer;
  font-size: 2.25rem;
  font-weight: 900;
  font-family: 'Antonio', sans-serif;
  text-shadow: 0.125rem 0.125rem black;
  transition: transform 0.1s;
  width: 100%;
}

@media (hover: hover) {
  .score-display:hover {
    transform: scale(1.1);
  }
}

.score-display:active {
  transform: scale(0.9);
}

.score-display.large {
  font-size: 5rem;
  cursor: default;
}

@media (hover: hover) {
  .score-display.large:hover {
    transform: none;
  }
}

.score-actions {
  display: flex;
  justify-content: center;
  gap: 0.625rem;
}

.score-actions button {
  padding: 0.3125rem 0.625rem;
  background-color: #0000c0;
  color: white;
  border: 0.125rem solid white;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  transition: all 0.2s;
}

@media (hover: hover) {
  .score-actions button:hover {
    background-color: #0000ff;
    border-color: #ffc400;
  }
}

.score-actions button:active {
  transform: scale(0.95);
}

.award-points {
  margin-top: 1.25rem;
  border-top: 0.125rem solid rgba(255,255,255,0.2);
  padding-top: 0.9375rem;
}

.award-points p {
  margin-bottom: 0.625rem;
  font-size: 1.1rem !important;
  color: #89f;
  text-transform: uppercase;
  font-family: 'Antonio', sans-serif;
}

.award-buttons {
  display: flex;
  justify-content: center;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.award-buttons button {
  margin: 0.3125rem !important;
  font-size: 1rem !important;
  text-transform: uppercase;
  font-family: 'Antonio', sans-serif;
  transition: all 0.2s;
  border: none;
  border-top: 0.3125rem solid white;
  border-bottom: 0.3125rem solid white;
  border-radius: 0.625rem;
  color: white;
  background-color: #000 !important;
}

.award-buttons button.team-1 {
  background-image: linear-gradient(rgba(102, 153, 255, 0.25), rgba(102, 153, 255, 0.25)) !important;
  border-color: #69f !important;
}
.award-buttons button.team-2 {
  background-image: linear-gradient(rgba(102, 204, 153, 0.25), rgba(102, 204, 153, 0.25)) !important;
  border-color: #6c9 !important;
}
.award-buttons button.team-3 {
  background-image: linear-gradient(rgba(255, 230, 102, 0.25), rgba(255, 230, 102, 0.25)) !important;
  border-color: #ffe600 !important;
}
.award-buttons button.team-4 {
  background-image: linear-gradient(rgba(204, 68, 68, 0.25), rgba(204, 68, 68, 0.25)) !important;
  border-color: #c44 !important;
}

.award-buttons button.team-1.selected { background-image: linear-gradient(rgba(102, 153, 255, 0.7), rgba(102, 153, 255, 0.7)) !important; box-shadow: 0 0 0.5rem #69f; }
.award-buttons button.team-2.selected { background-image: linear-gradient(rgba(102, 204, 153, 0.7), rgba(102, 204, 153, 0.7)) !important; box-shadow: 0 0 0.5rem #6c9; }
.award-buttons button.team-3.selected { background-image: linear-gradient(rgba(255, 230, 102, 0.7), rgba(255, 230, 102, 0.7)) !important; box-shadow: 0 0 0.5rem #ffe600; }
.award-buttons button.team-4.selected { background-image: linear-gradient(rgba(204, 68, 68, 0.7), rgba(204, 68, 68, 0.7)) !important; box-shadow: 0 0 0.5rem #c44; }

.confirm-award-btn {
  margin-top: 1rem !important;
  padding: 0.625rem 1.25rem !important;
  background-color: #004400 !important;
  border: 0.125rem solid #0f0 !important;
  border-radius: 0.5rem;
  color: #0f0 !important;
  font-family: 'Antonio', sans-serif;
  font-size: 1.1rem !important;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.05em;
}

.confirm-award-btn:disabled {
  background-color: #1a1a1a !important;
  border-color: #444 !important;
  color: #555 !important;
  cursor: not-allowed;
}

@media (hover: hover) {
  .confirm-award-btn:not(:disabled):hover {
    background-color: #006600 !important;
    box-shadow: 0 0 0.75rem #0f0;
  }
}

.confirm-award-btn:not(:disabled):active {
  transform: scale(0.97);
}

@media (hover: hover) {
  .award-buttons button.team-1:hover { background-image: linear-gradient(rgba(102, 153, 255, 0.5), rgba(102, 153, 255, 0.5)) !important; }
  .award-buttons button.team-2:hover { background-image: linear-gradient(rgba(102, 204, 153, 0.5), rgba(102, 204, 153, 0.5)) !important; }
  .award-buttons button.team-3:hover { background-image: linear-gradient(rgba(255, 230, 102, 0.5), rgba(255, 230, 102, 0.5)) !important; }
  .award-buttons button.team-4:hover { background-image: linear-gradient(rgba(204, 68, 68, 0.5), rgba(204, 68, 68, 0.5)) !important; }
}

.sheet-controls {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  justify-content: center;
}

.sheet-controls label {
  font-family: 'Antonio', sans-serif;
  text-transform: uppercase;
  color: #89f;
  font-weight: bold;
  font-size: 0.9rem;
}


.sheet-controls select, .start-button, .reset-button {
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

@media (hover: hover) {
  .start-button:hover {
    background-color: rgba(0, 255, 0, 0.5);
    border-color: #ffc400;
  }
}

.start-button:active {
  transform: scale(0.95);
}

.reset-button {
  text-transform: uppercase;
}

@media (hover: hover) {
  .reset-button:hover {
    background-color: rgba(225, 0, 0, 0.8);
    border-color: white;
  }
}

.reset-button:active {
  transform: scale(0.95);
}

.game-board {
  flex: 1;
  display: flex;
  justify-content: space-around;
  margin: 0 auto;
  max-width: 75rem;
  padding: 0.625rem 0 0;
  width: 100%;
}

.category {
  flex: 1;
}

.category h2 {
  background-color: #0000c0;
  border: 0.3125rem solid black;
  border-radius: 0.625rem;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Antonio', 'Arial Narrow', 'Avenir Next Condensed', sans-serif;
  font-size: 1.25rem;
  font-weight: 900;
  margin: 0 auto;
  min-height: 6.5625rem;
  padding: 0 0.625rem;
  width: 100%;
}

ul {
  list-style: none;
  margin-left: 0;
  padding: 0;
  width: 100%;
}

li button {
  background-color: #0000c0;
  border: 0.3125rem solid black;
  border-radius: 0.625rem;
  color: #ffc400;
  cursor: pointer;
  font-family: 'Antonio', 'Arial Narrow', 'Avenir Next Condensed', sans-serif;
  font-size: 2.25em;
  font-weight: 900;
  padding: 0 0.625rem 0.3125rem;
  width: 100%;
  transition: all 0.2s;
}

li button span {
  font-size: 2rem;
  font-weight: 100;
}

@media (hover: hover) {
  li button:hover:not(:disabled) {
    background-color: #0000ff;
    border-color: #ffc400;
  }
}

li button:active:not(:disabled) {
  transform: scale(0.95);
}

li button:disabled {
  background-color: #333;
  color: #777777;
  cursor: not-allowed;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal {
  background-color: #000080;
  padding: 2.5rem;
  border-radius: 0.625rem;
  border: 0.125rem solid white;
  color: white;
}

.modal-content p {
  font-size: 1.5rem;
}

.modal-content button {
  margin: 1.25rem 1.25rem 0;
  padding: 0.625rem 1.25rem;
  background-color: #0000c0;
  color: white;
  border: 0.125rem solid white;
  border-radius: 5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-content button:active {
  transform: scale(0.95);
}

@media (hover: hover) {
  .modal-content button:hover {
    background-color: #0000ff;
    border-color: #ffc400;
  }
}

.status-message {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3.125rem;
  font-size: 1.5em;
}

.status-message.error {
  color: #ff4444;
}

.status-message button {
  margin-top: 1.25rem;
  padding: 0.625rem 1.25rem;
  background-color: #c44;
  color: white;
  border: 0.125rem solid white;
  border-radius: 0.3125rem;
  cursor: pointer;
}
</style>