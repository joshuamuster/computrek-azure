<template>
  <div class="ds-widget">
    <div class="widget-header">
      <span class="widget-label">INTERACTIVE — WARP CORE CALIBRATION STATION</span>
      <h3>Warp Core Power Grid</h3>
      <p class="widget-prompt">
        The warp core uses a binary power distribution grid — each conduit is either ACTIVE (1) or
        OFFLINE (0). The total power output is the sum of all active conduit values.
        Click each conduit to toggle it and observe how binary values combine to represent any number.
      </p>
    </div>

    <!-- Mode selector -->
    <div class="mode-row">
      <label>Bit width:</label>
      <button v-for="n in [4, 8]" :key="n" :class="{ active: bitWidth === n }" @click="setBitWidth(n)" class="mode-btn">
        {{ n }}-bit
      </button>
    </div>

    <!-- Conduit cards -->
    <div class="conduits">
      <div
        v-for="(bit, i) in bits"
        :key="i"
        class="conduit"
        :class="{ active: bit }"
        @click="toggleBit(i)"
      >
        <div class="conduit-value">{{ placeValues[i] }}</div>
        <div class="conduit-bit">{{ bit ? '1' : '0' }}</div>
        <div class="conduit-label">b{{ bits.length - 1 - i }}</div>
      </div>
    </div>

    <!-- Result display -->
    <div class="result-panel">
      <div class="result-row">
        <span class="result-label">Binary:</span>
        <span class="result-binary">{{ bits.map(b => b ? '1' : '0').join('') }}</span>
      </div>
      <div class="result-row">
        <span class="result-label">Decimal:</span>
        <span class="result-decimal">{{ decimalValue }}</span>
      </div>
      <div class="power-bar">
        <div class="power-fill" :style="{ width: `${(decimalValue / maxValue) * 100}%` }" />
      </div>
      <div class="power-label">{{ decimalValue }} / {{ maxValue }} power units</div>
    </div>

    <!-- Challenges -->
    <div class="challenge-section">
      <h4>CALIBRATION CHALLENGES</h4>
      <p class="hint">Set the conduits to match each target power level.</p>
      <div class="challenges">
        <div v-for="ch in activeChallenges" :key="ch.target" class="ch-item">
          <span class="ch-target">Target: <strong>{{ ch.target }}</strong></span>
          <span class="ch-binary">Binary: {{ ch.binary }}</span>
          <span class="ch-check" :class="decimalValue === ch.target ? 'correct' : 'pending'">
            {{ decimalValue === ch.target ? '✓ MATCHED' : '—' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Enter decimal target -->
    <div class="target-section">
      <h4>MANUAL CALIBRATION</h4>
      <div class="target-row">
        <label>Enter a power level (0–{{ maxValue }}):</label>
        <input v-model.number="targetInput" type="number" :min="0" :max="maxValue" class="target-input" />
        <button class="action-btn" @click="setFromDecimal">SET</button>
      </div>
    </div>

    <div class="reflection">
      <p class="b">Discussion:</p>
      <p>How many different values can you represent with 4 bits? With 8 bits?
        What pattern do you notice about the place values (1, 2, 4, 8…)?
        Can you represent every number from 0 to {{ maxValue }} using this system?</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const bitWidth = ref(4);
const bits = ref([false, false, false, false]);

function setBitWidth(n) {
  bitWidth.value = n;
  bits.value = Array(n).fill(false);
}

const placeValues = computed(() =>
  bits.value.map((_, i) => Math.pow(2, bits.value.length - 1 - i))
);

const maxValue = computed(() => Math.pow(2, bitWidth.value) - 1);

function toggleBit(i) {
  bits.value = bits.value.map((b, j) => j === i ? !b : b);
}

const decimalValue = computed(() =>
  bits.value.reduce((acc, b, i) => acc + (b ? placeValues.value[i] : 0), 0)
);

const challenges4 = [
  { target: 5,  binary: '0101' },
  { target: 10, binary: '1010' },
  { target: 13, binary: '1101' },
  { target: 15, binary: '1111' },
];
const challenges8 = [
  { target: 42,  binary: '00101010' },
  { target: 100, binary: '01100100' },
  { target: 200, binary: '11001000' },
  { target: 255, binary: '11111111' },
];

const activeChallenges = computed(() => bitWidth.value === 4 ? challenges4 : challenges8);

const targetInput = ref(0);
function setFromDecimal() {
  const n = Math.max(0, Math.min(maxValue.value, Math.floor(targetInput.value)));
  bits.value = n.toString(2).padStart(bitWidth.value, '0').split('').map(b => b === '1');
}
</script>

<style scoped>
.ds-widget {
  border-top: 1px solid #444;
  margin-top: 2rem;
  padding-top: 1.5rem;
}
.widget-header { margin-bottom: 1.25rem; }
.widget-label { font-size: 0.65rem; letter-spacing: 0.15rem; color: skyblue; opacity: 0.7; }
.widget-header h3 { margin: 0.4rem 0 0.6rem; font-size: 1.1rem; color: antiquewhite; }
.widget-prompt { font-size: 0.9rem; color: #ccc; line-height: 1.5; }

.mode-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.25rem; font-size: 0.78rem; color: #aaa; }
.mode-btn {
  background: transparent; border: 1px solid #333; color: #888;
  border-radius: 0.25rem; padding: 0.25rem 0.7rem; font-size: 0.72rem; cursor: pointer;
}
.mode-btn.active { border-color: skyblue; color: skyblue; }

.conduits { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem; }

.conduit {
  display: flex; flex-direction: column; align-items: center;
  width: 5rem; padding: 0.75rem 0.5rem;
  background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 0.5rem;
  cursor: pointer; transition: all 0.15s;
}
.conduit:hover { border-color: #555; }
.conduit.active {
  background: rgba(135,206,235,0.1);
  border-color: skyblue;
  box-shadow: 0 0 10px rgba(135,206,235,0.2);
}

.conduit-value {
  font-size: 1.4rem; font-weight: 700; color: #555;
  transition: color 0.15s;
}
.conduit.active .conduit-value { color: skyblue; }

.conduit-bit {
  font-size: 2rem; font-family: monospace; color: #333;
  transition: color 0.15s;
}
.conduit.active .conduit-bit { color: antiquewhite; }

.conduit-label { font-size: 0.6rem; color: #444; letter-spacing: 0.05rem; margin-top: 0.2rem; }

/* Result panel */
.result-panel {
  background: #111; border: 1px solid #2a2a2a; border-radius: 0.5rem;
  padding: 1rem 1.25rem; margin-bottom: 1.25rem;
}
.result-row { display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.4rem; }
.result-label { font-size: 0.7rem; color: #666; letter-spacing: 0.08rem; width: 4.5rem; }
.result-binary { font-family: monospace; font-size: 1.3rem; color: skyblue; letter-spacing: 0.15rem; }
.result-decimal { font-size: 2rem; font-weight: 700; color: antiquewhite; }
.power-bar {
  height: 6px; background: #1a1a1a; border-radius: 3px;
  margin: 0.75rem 0 0.3rem; overflow: hidden;
}
.power-fill {
  height: 100%; background: skyblue; border-radius: 3px;
  transition: width 0.2s;
}
.power-label { font-size: 0.72rem; color: #666; }

/* Challenges */
.challenge-section { margin-bottom: 1.25rem; }
.challenge-section h4 { font-size: 0.7rem; letter-spacing: 0.12rem; color: orange; margin-bottom: 0.5rem; }
.hint { font-size: 0.82rem; color: #aaa; margin-bottom: 0.6rem; }
.challenges { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.ch-item {
  display: flex; flex-direction: column; gap: 0.2rem;
  background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 0.375rem;
  padding: 0.6rem 0.875rem; min-width: 9rem;
}
.ch-target { font-size: 0.85rem; color: #ccc; }
.ch-target strong { color: antiquewhite; }
.ch-binary { font-size: 0.72rem; font-family: monospace; color: #666; }
.ch-check { font-size: 0.72rem; font-weight: 700; }
.correct { color: #4caf50; }
.pending { color: #444; }

/* Target section */
.target-section { margin-bottom: 1.25rem; }
.target-section h4 { font-size: 0.7rem; letter-spacing: 0.12rem; color: orange; margin-bottom: 0.5rem; }
.target-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; font-size: 0.78rem; color: #aaa; }
.target-input {
  width: 5rem; background: #1a1a1a; border: 1px solid #333; color: antiquewhite;
  border-radius: 0.25rem; padding: 0.3rem 0.5rem; font-size: 0.9rem; text-align: center;
}
.action-btn {
  background: transparent; border: 1px solid skyblue; color: skyblue;
  border-radius: 0.25rem; padding: 0.3rem 0.8rem;
  font-size: 0.72rem; letter-spacing: 0.08rem; cursor: pointer; transition: background 0.2s;
}
.action-btn:hover { background: rgba(135,206,235,0.1); }

.reflection {
  background: #111; border-left: 3px solid orange;
  padding: 0.75rem 1rem; border-radius: 0 0.25rem 0.25rem 0;
  font-size: 0.85rem; color: #bbb; line-height: 1.5;
}
.reflection .b { color: orange; font-weight: 600; margin-bottom: 0.4rem; }
</style>
