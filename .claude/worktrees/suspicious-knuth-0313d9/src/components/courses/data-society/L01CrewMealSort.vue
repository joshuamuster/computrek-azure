<template>
  <div class="ds-widget">
    <div class="widget-header">
      <span class="widget-label">INTERACTIVE — HOLODECK SIMULATION</span>
      <h3>Replicator Recommendation Matrix</h3>
      <p class="widget-prompt">
        Four crew members have submitted meal requests to the replicator. Each of your four data
        cards represents the same four menu items in a different format. Match each crew member to
        the data card that gives you the <em>best</em> information to fulfill their request.
      </p>
    </div>

    <!-- Data cards -->
    <div class="card-section">
      <h4>YOUR DATA CARDS</h4>
      <div class="data-cards">
        <div
          v-for="card in dataCards"
          :key="card.id"
          class="data-card"
          :class="{ selected: selectedCard === card.id }"
          @click="selectedCard = selectedCard === card.id ? null : card.id"
        >
          <div class="card-type">{{ card.type }}</div>
          <div class="card-preview">
            <div v-for="item in card.items" :key="item.name" class="card-row">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-detail">{{ item.detail }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Crew members -->
    <div class="card-section">
      <h4>CREW REQUESTS</h4>
      <div class="crew-grid">
        <div v-for="crew in crewMembers" :key="crew.id" class="crew-card">
          <div class="crew-rank">{{ crew.rank }}</div>
          <div class="crew-name">{{ crew.name }}</div>
          <div class="crew-request">"{{ crew.request }}"</div>
          <div class="answer-row">
            <label>Best data card:</label>
            <select v-model="answers[crew.id]" :disabled="submitted">
              <option value="">— select —</option>
              <option v-for="card in dataCards" :key="card.id" :value="card.id">
                {{ card.type }}
              </option>
            </select>
          </div>
          <div v-if="submitted" class="feedback" :class="answers[crew.id] === crew.correct ? 'correct' : 'incorrect'">
            {{ answers[crew.id] === crew.correct ? '✓ Correct' : `✗ Best card: ${dataCards.find(c => c.id === crew.correct)?.type}` }}
          </div>
        </div>
      </div>
    </div>

    <div class="widget-footer">
      <button v-if="!submitted" class="submit-btn" :disabled="Object.values(answers).some(v => !v)" @click="submit">
        TRANSMIT RECOMMENDATIONS
      </button>
      <button v-else class="reset-btn" @click="reset">RESET SIMULATION</button>
      <div v-if="submitted" class="score">
        Score: {{ score }} / {{ crewMembers.length }}
        <span v-if="score === crewMembers.length"> — Outstanding, Cadet!</span>
      </div>
    </div>

    <!-- Reflection -->
    <div v-if="submitted" class="reflection">
      <p class="b">Reflection prompt:</p>
      <p>After completing the activity, discuss: Why did each crew member need a <em>different</em>
        representation of the same data? What does this tell us about how the purpose of a decision
        shapes what information is useful?</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';

const dataCards = [
  {
    id: 'picture',
    type: 'Visual Image',
    items: [
      { name: 'Plomeek Soup', detail: '🍲 amber broth, purple plomeek petals' },
      { name: 'Jumja Stick', detail: '🍡 golden crystallized, spiral texture' },
      { name: 'Rokeg Blood Pie', detail: '🥧 deep crimson crust, ornate pattern' },
      { name: 'Uttaberry Tart', detail: '🫐 violet berries, glazed pastry shell' },
    ],
  },
  {
    id: 'recipe',
    type: 'Ingredient List',
    items: [
      { name: 'Plomeek Soup', detail: 'plomeek root, vegetable broth, Vulcan spice blend' },
      { name: 'Jumja Stick', detail: 'jumja tree sap, cane sugar, crystallization agent' },
      { name: 'Rokeg Blood Pie', detail: 'gagh, heart of targ, blood wine reduction, pastry' },
      { name: 'Uttaberry Tart', detail: 'uttaberries, flour, egg wash, butter, sugar glaze' },
    ],
  },
  {
    id: 'menu',
    type: 'Replicator Menu',
    items: [
      { name: 'Plomeek Soup', detail: '12 energy credits' },
      { name: 'Jumja Stick', detail: '4 energy credits' },
      { name: 'Rokeg Blood Pie', detail: '18 energy credits' },
      { name: 'Uttaberry Tart', detail: '9 energy credits' },
    ],
  },
  {
    id: 'nutrition',
    type: 'Nutritional Analysis',
    items: [
      { name: 'Plomeek Soup', detail: '85 kcal · 210mg sodium · 3g protein' },
      { name: 'Jumja Stick', detail: '160 kcal · 5mg sodium · 0g protein' },
      { name: 'Rokeg Blood Pie', detail: '420 kcal · 890mg sodium · 22g protein' },
      { name: 'Uttaberry Tart', detail: '210 kcal · 120mg sodium · 4g protein' },
    ],
  },
];

const crewMembers = [
  {
    id: 'c1',
    rank: 'Ensign',
    name: 'T\'Lar',
    request: 'I have an egg allergy — I need to know exactly what\'s in each dish.',
    correct: 'recipe',
  },
  {
    id: 'c2',
    rank: 'Commander',
    name: 'Vasquez',
    request: 'My physician ordered me to reduce sodium intake.',
    correct: 'nutrition',
  },
  {
    id: 'c3',
    rank: 'Cadet',
    name: 'Okafor',
    request: 'I\'m rationing energy credits until next stardate.',
    correct: 'menu',
  },
  {
    id: 'c4',
    rank: 'Lieutenant',
    name: 'Zh\'ara',
    request: 'I want to post a photo to the ship\'s comm-net. Which looks most impressive?',
    correct: 'picture',
  },
];

const selectedCard = ref(null);
const answers = reactive({ c1: '', c2: '', c3: '', c4: '' });
const submitted = ref(false);

const score = computed(() =>
  crewMembers.filter(c => answers[c.id] === c.correct).length
);

function submit() { submitted.value = true; }
function reset() {
  submitted.value = false;
  Object.keys(answers).forEach(k => (answers[k] = ''));
}
</script>

<style scoped>
.ds-widget {
  border-top: 1px solid #444;
  margin-top: 2rem;
  padding-top: 1.5rem;
}

.widget-header { margin-bottom: 1.5rem; }
.widget-label {
  font-size: 0.65rem;
  letter-spacing: 0.15rem;
  color: skyblue;
  opacity: 0.7;
}
.widget-header h3 { margin: 0.4rem 0 0.6rem; font-size: 1.1rem; color: antiquewhite; }
.widget-prompt { font-size: 0.9rem; color: #ccc; line-height: 1.5; }

.card-section { margin-bottom: 1.5rem; }
.card-section h4 {
  font-size: 0.7rem;
  letter-spacing: 0.12rem;
  color: orange;
  margin-bottom: 0.75rem;
}

.data-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.data-card {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  flex: 1 1 10rem;
  transition: border-color 0.2s;
}
.data-card:hover { border-color: #666; }
.data-card.selected { border-color: skyblue; }

.card-type {
  font-size: 0.7rem;
  letter-spacing: 0.1rem;
  color: skyblue;
  margin-bottom: 0.5rem;
}
.card-row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.2rem 0;
  border-bottom: 1px solid #222;
  font-size: 0.78rem;
}
.item-name { color: antiquewhite; white-space: nowrap; }
.item-detail { color: #aaa; text-align: right; font-size: 0.72rem; }

.crew-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.crew-card {
  background: #111;
  border: 1px solid #2a2a2a;
  border-radius: 0.5rem;
  padding: 0.875rem 1rem;
  flex: 1 1 14rem;
}
.crew-rank { font-size: 0.65rem; letter-spacing: 0.1rem; color: gold; }
.crew-name { font-size: 1rem; color: antiquewhite; margin: 0.2rem 0 0.4rem; }
.crew-request { font-size: 0.82rem; color: #bbb; font-style: italic; margin-bottom: 0.75rem; line-height: 1.4; }

.answer-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: #aaa;
}
.answer-row select {
  background: #222;
  color: antiquewhite;
  border: 1px solid #444;
  border-radius: 0.25rem;
  padding: 0.2rem 0.4rem;
  font-size: 0.78rem;
}

.feedback {
  margin-top: 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
}
.correct { color: #4caf50; }
.incorrect { color: #f44336; }

.widget-footer {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin: 1.25rem 0;
}

.submit-btn, .reset-btn {
  background: transparent;
  border: 1px solid skyblue;
  color: skyblue;
  border-radius: 0.25rem;
  padding: 0.4rem 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.1rem;
  cursor: pointer;
  transition: background 0.2s;
}
.submit-btn:disabled { border-color: #444; color: #444; cursor: not-allowed; }
.submit-btn:not(:disabled):hover, .reset-btn:hover { background: rgba(135,206,235,0.1); }
.reset-btn { border-color: #888; color: #888; }

.score { font-size: 0.85rem; color: antiquewhite; }

.reflection {
  background: #111;
  border-left: 3px solid orange;
  padding: 0.75rem 1rem;
  border-radius: 0 0.25rem 0.25rem 0;
  font-size: 0.85rem;
  color: #bbb;
  line-height: 1.5;
}
.reflection .b { color: orange; font-weight: 600; margin-bottom: 0.4rem; }
</style>
