<template>
  <div class="ds-widget">
    <div class="widget-header">
      <span class="widget-label">INTERACTIVE — SUBSPACE RELAY STATION</span>
      <h3>Subspace Transmission Decoder</h3>
      <p class="widget-prompt">
        All Federation subspace transmissions are encoded in binary using a system called ASCII —
        each letter maps to a unique 7-bit pattern of ONs and OFFs. Use this station to
        decode incoming transmissions and encode your own outgoing messages.
      </p>
    </div>

    <div class="tabs">
      <button :class="{ active: tab === 'decode' }" @click="tab = 'decode'">DECODE (Bits → Letter)</button>
      <button :class="{ active: tab === 'encode' }" @click="tab = 'encode'">ENCODE (Text → Binary)</button>
      <button :class="{ active: tab === 'table' }" @click="tab = 'table'">ASCII TABLE</button>
    </div>

    <!-- DECODE tab -->
    <div v-if="tab === 'decode'" class="tab-content">
      <p class="hint">Click each bit cell to toggle between 0 and 1. The ASCII character will appear when you have a valid 7-bit pattern.</p>

      <div class="bit-display">
        <div class="bit-labels">
          <span v-for="(_, i) in bits" :key="i" class="bit-label">b{{ 6 - i }}</span>
        </div>
        <div class="bit-row">
          <button
            v-for="(bit, i) in bits"
            :key="i"
            class="bit-btn"
            :class="{ on: bit === 1 }"
            @click="toggleBit(i)"
          >{{ bit }}</button>
        </div>
        <div class="bit-values">
          <span v-for="(_, i) in bits" :key="i" class="bit-value">{{ Math.pow(2, 6 - i) }}</span>
        </div>
      </div>

      <div class="decode-result">
        <div class="decimal-val">Decimal value: <strong>{{ decimalValue }}</strong></div>
        <div class="char-display">
          <span class="char-label">ASCII CHARACTER</span>
          <span class="char-value">{{ decodedChar }}</span>
        </div>
      </div>

      <!-- Challenge mode -->
      <div class="challenge-section">
        <h4>DECODE THIS TRANSMISSION</h4>
        <p class="hint">Set your bits to match each pattern below, then record what letter appears.</p>
        <div class="challenges">
          <div v-for="ch in challenges" :key="ch.bits" class="challenge-item">
            <div class="ch-bits">
              <span v-for="(b, i) in ch.bits.split('')" :key="i" class="ch-bit" :class="{ on: b === '1' }">{{ b }}</span>
            </div>
            <span class="ch-arrow">→</span>
            <input v-model="ch.answer" class="ch-input" maxlength="1" placeholder="?" />
            <span v-if="ch.answer" class="ch-check" :class="ch.answer.toUpperCase() === String.fromCharCode(parseInt(ch.bits, 2)) ? 'correct' : 'incorrect'">
              {{ ch.answer.toUpperCase() === String.fromCharCode(parseInt(ch.bits, 2)) ? '✓' : '✗' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ENCODE tab -->
    <div v-if="tab === 'encode'" class="tab-content">
      <p class="hint">Type a message and see each character encoded in 7-bit binary.</p>
      <div class="encode-input-row">
        <input v-model="encodeText" class="text-input" maxlength="16" placeholder="Enter text to encode…" />
      </div>
      <div class="encoded-chars" v-if="encodedChars.length">
        <div v-for="(ec, i) in encodedChars" :key="i" class="encoded-char-block">
          <span class="ec-letter">{{ ec.char }}</span>
          <div class="ec-bits">
            <span v-for="(b, j) in ec.bits.split('')" :key="j" class="ec-bit" :class="{ on: b === '1' }">{{ b }}</span>
          </div>
          <span class="ec-decimal">{{ ec.decimal }}</span>
        </div>
      </div>
      <p class="hint" v-if="encodeText && !encodedChars.length">Only printable ASCII characters supported.</p>
    </div>

    <!-- ASCII TABLE tab -->
    <div v-if="tab === 'table'" class="tab-content">
      <p class="hint">The standard 7-bit ASCII table for uppercase letters (A–Z). Lowercase follows the same pattern with a value 32 higher.</p>
      <div class="ascii-table">
        <div class="ascii-header">
          <span>Char</span><span>Decimal</span><span>Binary (7-bit)</span>
        </div>
        <div v-for="c in asciiRows" :key="c.char" class="ascii-row" :class="{ highlight: decimalValue === c.decimal && tab !== 'table' }">
          <span class="at-char">{{ c.char }}</span>
          <span class="at-dec">{{ c.decimal }}</span>
          <span class="at-bin">{{ c.binary }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';

const tab = ref('decode');
const bits = ref([0, 1, 0, 0, 0, 0, 1]); // 'A' = 65

function toggleBit(i) {
  bits.value[i] = bits.value[i] === 0 ? 1 : 0;
}

const decimalValue = computed(() =>
  bits.value.reduce((acc, b, i) => acc + b * Math.pow(2, 6 - i), 0)
);

const decodedChar = computed(() => {
  const n = decimalValue.value;
  if (n >= 32 && n <= 126) return String.fromCharCode(n);
  if (n === 0) return '(null)';
  return '(non-printable)';
});

// Challenge patterns
const challenges = reactive([
  { bits: '1001000', answer: '' }, // H
  { bits: '1000101', answer: '' }, // E
  { bits: '1001100', answer: '' }, // L
  { bits: '1001100', answer: '' }, // L
  { bits: '1001111', answer: '' }, // O
]);

// Encode tab
const encodeText = ref('');
const encodedChars = computed(() =>
  encodeText.value
    .split('')
    .filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126)
    .map(c => ({
      char: c,
      decimal: c.charCodeAt(0),
      bits: c.charCodeAt(0).toString(2).padStart(7, '0'),
    }))
);

// ASCII table A-Z + space + 0-9
const asciiRows = computed(() => {
  const rows = [];
  rows.push({ char: 'Space', decimal: 32, binary: '0100000' });
  for (let i = 48; i <= 57; i++) {
    rows.push({ char: String.fromCharCode(i), decimal: i, binary: i.toString(2).padStart(7, '0') });
  }
  for (let i = 65; i <= 90; i++) {
    rows.push({ char: String.fromCharCode(i), decimal: i, binary: i.toString(2).padStart(7, '0') });
  }
  for (let i = 97; i <= 122; i++) {
    rows.push({ char: String.fromCharCode(i), decimal: i, binary: i.toString(2).padStart(7, '0') });
  }
  return rows;
});
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

.tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.tabs button {
  background: transparent; border: 1px solid #333; color: #888;
  padding: 0.3rem 0.75rem; border-radius: 0.25rem; font-size: 0.72rem;
  letter-spacing: 0.08rem; cursor: pointer; transition: all 0.2s;
}
.tabs button.active { border-color: skyblue; color: skyblue; }
.tabs button:hover:not(.active) { border-color: #555; color: #aaa; }

.tab-content { min-height: 14rem; }
.hint { font-size: 0.82rem; color: #aaa; margin-bottom: 0.75rem; line-height: 1.4; }

/* Bit display */
.bit-display { margin-bottom: 1.25rem; }
.bit-labels, .bit-row, .bit-values { display: flex; gap: 0.4rem; margin-bottom: 0.25rem; }
.bit-label { width: 2.75rem; text-align: center; font-size: 0.6rem; color: #666; letter-spacing: 0.05rem; }
.bit-value { width: 2.75rem; text-align: center; font-size: 0.65rem; color: #555; }

.bit-btn {
  width: 2.75rem; height: 2.75rem;
  background: #1a1a1a; border: 1px solid #333; color: #666;
  border-radius: 0.375rem; font-size: 1.1rem; font-family: monospace;
  cursor: pointer; transition: all 0.15s;
}
.bit-btn.on {
  background: rgba(135,206,235,0.15);
  border-color: skyblue; color: skyblue;
}
.bit-btn:hover { border-color: #555; }

/* Decode result */
.decode-result { display: flex; align-items: center; gap: 2rem; margin-bottom: 1.5rem; }
.decimal-val { font-size: 0.85rem; color: #aaa; }
.decimal-val strong { color: antiquewhite; }
.char-display { display: flex; flex-direction: column; align-items: center; }
.char-label { font-size: 0.6rem; letter-spacing: 0.1rem; color: gold; }
.char-value { font-size: 3rem; color: skyblue; font-family: monospace; min-width: 3rem; text-align: center; }

/* Challenges */
.challenge-section h4 { font-size: 0.7rem; letter-spacing: 0.12rem; color: orange; margin: 0 0 0.5rem; }
.challenges { display: flex; flex-direction: column; gap: 0.5rem; }
.challenge-item { display: flex; align-items: center; gap: 0.6rem; }
.ch-bits { display: flex; gap: 0.15rem; }
.ch-bit {
  width: 1.4rem; height: 1.4rem; border: 1px solid #333;
  border-radius: 0.2rem; background: #1a1a1a; color: #555;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-family: monospace;
}
.ch-bit.on { background: rgba(135,206,235,0.12); border-color: skyblue; color: skyblue; }
.ch-arrow { color: #555; }
.ch-input {
  width: 2rem; background: #1a1a1a; border: 1px solid #444;
  color: antiquewhite; border-radius: 0.2rem; text-align: center;
  padding: 0.2rem; font-size: 0.9rem; font-family: monospace; text-transform: uppercase;
}
.ch-check { font-size: 0.85rem; font-weight: 700; }
.correct { color: #4caf50; }
.incorrect { color: #f44336; }

/* Encode tab */
.encode-input-row { margin-bottom: 1rem; }
.text-input {
  width: 100%; max-width: 24rem; background: #1a1a1a; border: 1px solid #333;
  color: antiquewhite; border-radius: 0.25rem; padding: 0.4rem 0.6rem;
  font-size: 0.9rem; font-family: monospace; box-sizing: border-box;
}
.encoded-chars { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.encoded-char-block {
  display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
  background: #1a1a1a; border: 1px solid #2a2a2a;
  border-radius: 0.375rem; padding: 0.5rem 0.6rem;
}
.ec-letter { font-size: 1.1rem; color: antiquewhite; font-family: monospace; }
.ec-bits { display: flex; gap: 0.1rem; }
.ec-bit {
  width: 1.1rem; height: 1.1rem; border: 1px solid #333; border-radius: 0.15rem;
  background: #111; color: #555; display: flex; align-items: center;
  justify-content: center; font-size: 0.65rem; font-family: monospace;
}
.ec-bit.on { border-color: skyblue; color: skyblue; background: rgba(135,206,235,0.1); }
.ec-decimal { font-size: 0.65rem; color: #666; }

/* ASCII table */
.ascii-table { max-height: 22rem; overflow-y: auto; font-size: 0.78rem; font-family: monospace; }
.ascii-header, .ascii-row { display: grid; grid-template-columns: 3rem 5rem 1fr; gap: 0.5rem; padding: 0.2rem 0.4rem; }
.ascii-header { color: orange; font-size: 0.65rem; letter-spacing: 0.08rem; border-bottom: 1px solid #333; position: sticky; top: 0; background: #0d0d0d; }
.ascii-row { border-bottom: 1px solid #1a1a1a; }
.ascii-row:hover { background: #1a1a1a; }
.ascii-row.highlight { background: rgba(135,206,235,0.1); }
.at-char { color: antiquewhite; }
.at-dec { color: gold; }
.at-bin { color: skyblue; }
</style>
