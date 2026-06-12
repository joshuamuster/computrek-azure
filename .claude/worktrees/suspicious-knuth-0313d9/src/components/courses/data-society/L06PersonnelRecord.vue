<template>
  <div class="ds-widget">
    <div class="widget-header">
      <span class="widget-label">INTERACTIVE — STARFLEET RECORDS DIVISION</span>
      <h3>Starfleet Personnel Record Decoder</h3>
      <p class="widget-prompt">
        An encrypted personnel file has been recovered from Starbase 12. The file uses a structured
        binary record format — each row is stored in a different encoding type. Use your knowledge
        of ASCII, binary numbers, and pixel images to decode the complete record.
      </p>
    </div>

    <!-- Personnel record table -->
    <div class="record-table">
      <div class="record-header">
        <span>Byte</span>
        <span>Field</span>
        <span>Encoding</span>
        <span>Raw Data</span>
        <span>Your Answer</span>
        <span>Check</span>
      </div>
      <div v-for="row in recordRows" :key="row.id" class="record-row">
        <span class="byte-num">{{ row.byte }}</span>
        <span class="field-name">{{ row.field }}</span>
        <span class="enc-type" :class="row.encType">{{ row.encLabel }}</span>
        <span class="raw-data">{{ row.raw }}</span>
        <div class="answer-cell">
          <input
            v-if="row.inputType !== 'pixel'"
            v-model="answers[row.id]"
            class="answer-input"
            :placeholder="row.hint"
            :disabled="submitted"
          />
          <span v-else class="pixel-note">See image below ↓</span>
        </div>
        <span v-if="submitted" class="check" :class="checkAnswer(row) ? 'correct' : 'incorrect'">
          {{ checkAnswer(row) ? '✓' : `✗ ${row.answer}` }}
        </span>
        <span v-else class="check muted">—</span>
      </div>
    </div>

    <!-- Pixel image row -->
    <div class="pixel-section">
      <div class="pixel-label">Byte 04 — Crew Photo (4×4 pixel image)</div>
      <div class="pixel-preview">
        <div v-for="(row, r) in photoPixels" :key="r" class="pixel-row-display">
          <div
            v-for="(bit, c) in row"
            :key="c"
            class="photo-pixel"
            :class="{ on: bit === '1' }"
          />
        </div>
      </div>
      <div class="pixel-binary">
        <div v-for="(row, r) in photoPixels" :key="r" class="pbin-row">
          <span class="pbin-label">Row {{ r }}:</span>
          <span v-for="(bit, c) in row" :key="c" class="pbin-bit" :class="{ on: bit === '1' }">{{ bit }}</span>
        </div>
      </div>
    </div>

    <div class="widget-footer">
      <button v-if="!submitted" class="submit-btn" @click="submitted = true">SUBMIT DECODING</button>
      <button v-else class="reset-btn" @click="resetAll">RESET</button>
      <div v-if="submitted" class="score">
        {{ correctCount }} / {{ gradedRows }} fields decoded correctly
      </div>
    </div>

    <div class="reflection">
      <p class="b">Discussion:</p>
      <p>Notice that the raw bits for the name and the rank level <em>look similar</em> but mean very different
        things. How does the computer know which encoding to use for each row?
        What would happen if you tried to decode the name field as a number, or the rank as ASCII?</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';

// The pre-built binary record. Each row is shown to students; they decode it.
const recordRows = [
  {
    id: 'name',
    byte: '00–02',
    field: 'Name (first 3 chars)',
    encType: 'ascii',
    encLabel: 'ASCII',
    raw: '1001011 1001001 1010010',
    hint: '3-letter name',
    answer: 'KIR',       // K=75, I=73, R=82
    inputType: 'text',
  },
  {
    id: 'rank',
    byte: '03',
    field: 'Rank Level',
    encType: 'number',
    encLabel: 'Binary Number',
    raw: '00000101',
    hint: 'decimal number',
    answer: '5',
    inputType: 'text',
  },
  {
    id: 'years',
    byte: '04',  // reuse label, photo is separate
    field: 'Years of Service',
    encType: 'number',
    encLabel: 'Binary Number',
    raw: '00001100',
    hint: 'decimal number',
    answer: '12',
    inputType: 'text',
  },
  {
    id: 'clearance',
    byte: '05',
    field: 'Security Clearance',
    encType: 'number',
    encLabel: 'Binary Number',
    raw: '00000011',
    hint: 'decimal number',
    answer: '3',
    inputType: 'text',
  },
];

// 4×4 pixel photo (rows of bit strings)
const photoPixels = [
  ['0','1','1','0'],
  ['1','0','0','1'],
  ['1','1','1','1'],
  ['0','1','1','0'],
];

const answers = reactive({ name: '', rank: '', years: '', clearance: '' });
const submitted = ref(false);

function checkAnswer(row) {
  return answers[row.id]?.toString().trim().toUpperCase() === row.answer.toString().toUpperCase();
}

const gradedRows = computed(() => recordRows.length);
const correctCount = computed(() => recordRows.filter(r => checkAnswer(r)).length);

function resetAll() {
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
.widget-header { margin-bottom: 1.25rem; }
.widget-label { font-size: 0.65rem; letter-spacing: 0.15rem; color: skyblue; opacity: 0.7; }
.widget-header h3 { margin: 0.4rem 0 0.6rem; font-size: 1.1rem; color: antiquewhite; }
.widget-prompt { font-size: 0.9rem; color: #ccc; line-height: 1.5; }

.record-table { margin-bottom: 1.5rem; font-size: 0.8rem; overflow-x: auto; }
.record-header, .record-row {
  display: grid;
  grid-template-columns: 4rem 9rem 7rem 1fr 8rem 5rem;
  gap: 0.5rem; align-items: center;
  padding: 0.4rem 0.5rem;
}
.record-header {
  color: orange; font-size: 0.65rem; letter-spacing: 0.08rem;
  border-bottom: 1px solid #333; margin-bottom: 0.25rem;
}
.record-row { border-bottom: 1px solid #1a1a1a; }
.record-row:hover { background: #111; }

.byte-num { font-family: monospace; color: #555; }
.field-name { color: antiquewhite; }
.enc-type { font-size: 0.7rem; letter-spacing: 0.05rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 0.2rem; }
.enc-type.ascii { color: gold; background: rgba(255,215,0,0.1); }
.enc-type.number { color: #7eb8f7; background: rgba(126,184,247,0.1); }
.enc-type.pixel { color: #a8d8a8; background: rgba(168,216,168,0.1); }

.raw-data { font-family: monospace; font-size: 0.72rem; color: #888; word-break: break-all; }

.answer-input {
  width: 100%; background: #1a1a1a; border: 1px solid #333; color: antiquewhite;
  border-radius: 0.2rem; padding: 0.2rem 0.4rem; font-size: 0.8rem; box-sizing: border-box;
}
.pixel-note { font-size: 0.72rem; color: #666; font-style: italic; }

.check { font-size: 0.78rem; font-weight: 700; }
.correct { color: #4caf50; }
.incorrect { color: #f44336; font-size: 0.68rem; }
.muted { color: #333; }

/* Pixel photo */
.pixel-section { margin-bottom: 1.5rem; }
.pixel-label { font-size: 0.7rem; letter-spacing: 0.08rem; color: #a8d8a8; margin-bottom: 0.6rem; }
.pixel-preview { display: flex; flex-direction: column; gap: 2px; margin-bottom: 0.75rem; width: fit-content; }
.pixel-row-display { display: flex; gap: 2px; }
.photo-pixel {
  width: 28px; height: 28px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 2px;
}
.photo-pixel.on { background: #a8d8a8; border-color: #7eb87e; }

.pixel-binary { font-family: monospace; font-size: 0.75rem; }
.pbin-row { display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.2rem; }
.pbin-label { color: #555; width: 3.5rem; }
.pbin-bit { color: #333; }
.pbin-bit.on { color: #a8d8a8; }

/* Footer */
.widget-footer { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1.25rem; }
.submit-btn, .reset-btn {
  background: transparent; border: 1px solid skyblue; color: skyblue;
  border-radius: 0.25rem; padding: 0.4rem 1rem; font-size: 0.75rem;
  letter-spacing: 0.1rem; cursor: pointer; transition: background 0.2s;
}
.submit-btn:hover { background: rgba(135,206,235,0.1); }
.reset-btn { border-color: #888; color: #888; }
.score { font-size: 0.85rem; color: antiquewhite; }

.reflection {
  background: #111; border-left: 3px solid orange;
  padding: 0.75rem 1rem; border-radius: 0 0.25rem 0.25rem 0;
  font-size: 0.85rem; color: #bbb; line-height: 1.5;
}
.reflection .b { color: orange; font-weight: 600; margin-bottom: 0.4rem; }
</style>
