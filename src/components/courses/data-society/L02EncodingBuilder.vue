<template>
  <div class="ds-widget">
    <div class="widget-header">
      <span class="widget-label">INTERACTIVE — HOLODECK SIMULATION</span>
      <h3>Starfleet Encoding System Builder</h3>
      <p class="widget-prompt">
        The Federation uses six Starfleet insignia as the basis for a secret encoding system.
        Your task: assign a unique two-symbol combination to each letter A–Z, then encode and
        decode messages with a partner.
      </p>
    </div>

    <!-- Symbol legend -->
    <div class="symbol-legend">
      <h4>THE SIX SYMBOLS</h4>
      <div class="symbols-row">
        <div v-for="sym in symbols" :key="sym.id" class="symbol-chip">
          <span class="sym-icon">{{ sym.icon }}</span>
          <span class="sym-name">{{ sym.name }}</span>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button :class="{ active: tab === 'define' }" @click="tab = 'define'">1 · DEFINE CODE</button>
      <button :class="{ active: tab === 'encode' }" @click="tab = 'encode'">2 · ENCODE MESSAGE</button>
      <button :class="{ active: tab === 'decode' }" @click="tab = 'decode'">3 · DECODE MESSAGE</button>
    </div>

    <!-- DEFINE tab -->
    <div v-if="tab === 'define'" class="tab-content">
      <p class="hint">Assign a pair of symbols to each letter. Each pair must be unique.</p>
      <div class="alphabet-grid">
        <div v-for="letter in alphabet" :key="letter" class="letter-row">
          <span class="letter">{{ letter }}</span>
          <select v-model="code[letter][0]" class="sym-select">
            <option value="">—</option>
            <option v-for="sym in symbols" :key="sym.id" :value="sym.id">{{ sym.icon }} {{ sym.name }}</option>
          </select>
          <span class="plus">+</span>
          <select v-model="code[letter][1]" class="sym-select">
            <option value="">—</option>
            <option v-for="sym in symbols" :key="sym.id" :value="sym.id">{{ sym.icon }} {{ sym.name }}</option>
          </select>
          <span class="preview">{{ previewCode(letter) }}</span>
        </div>
      </div>
      <div class="duplicate-warning" v-if="hasDuplicates">
        ⚠ Some letters share the same code — each pair must be unique!
      </div>
    </div>

    <!-- ENCODE tab -->
    <div v-if="tab === 'encode'" class="tab-content">
      <p class="hint">Type a message (letters only) and see it encoded using your system.</p>
      <input v-model="encodeInput" class="text-input" placeholder="e.g. TREK" maxlength="20" />
      <div class="encoded-output" v-if="encodedResult.length">
        <div v-for="(pair, i) in encodedResult" :key="i" class="encoded-pair">
          <span class="enc-letter">{{ pair.letter }}</span>
          <span class="enc-code">{{ pair.code }}</span>
        </div>
      </div>
      <p v-else-if="encodeInput" class="hint warn">
        Some letters have no code assigned — finish the Define step first.
      </p>
    </div>

    <!-- DECODE tab -->
    <div v-if="tab === 'decode'" class="tab-content">
      <p class="hint">Enter a sequence of symbol names (comma-separated pairs, space between letters) from a partner's message.</p>
      <p class="hint small">Example: <code>Delta,Alpha Star,Star</code> → two letters encoded with your system</p>
      <textarea v-model="decodeInput" class="text-input" rows="3" placeholder="Paste encoded sequence here…" />
      <button class="action-btn" @click="attemptDecode">DECODE</button>
      <div class="decoded-output" v-if="decodedResult !== null">
        <span v-if="decodedResult">Decoded: <strong>{{ decodedResult }}</strong></span>
        <span v-else class="warn">Could not decode — check your symbol names match the Define tab.</span>
      </div>
    </div>

    <div class="reflection">
      <p class="b">Discussion:</p>
      <p>Compare your system with a partner. Did you choose the same symbol pairs for any letters?
        What would happen if you tried to send them a message using your system without sharing your rules?
        Why do shared, agreed-upon conventions matter for communication?</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';

const symbols = [
  { id: 'command',   icon: '⬡', name: 'Command' },
  { id: 'science',  icon: '✦', name: 'Science' },
  { id: 'engineer', icon: '⚙', name: 'Engineer' },
  { id: 'medical',  icon: '✚', name: 'Medical' },
  { id: 'security', icon: '⬟', name: 'Security' },
  { id: 'delta',    icon: '△', name: 'Delta' },
];

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// code[letter] = [sym1Id, sym2Id]
const code = reactive(Object.fromEntries(alphabet.map(l => [l, ['', '']])));

const tab = ref('define');
const encodeInput = ref('');
const decodeInput = ref('');
const decodedResult = ref(null);

// reverse map: "command+science" → "A"
const reverseMap = computed(() => {
  const m = {};
  for (const l of alphabet) {
    const [a, b] = code[l];
    if (a && b) m[`${a}+${b}`] = l;
  }
  return m;
});

const hasDuplicates = computed(() => {
  const seen = new Set();
  for (const l of alphabet) {
    const [a, b] = code[l];
    if (!a || !b) continue;
    const key = `${a}+${b}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
});

function previewCode(letter) {
  const [a, b] = code[letter];
  const sa = symbols.find(s => s.id === a);
  const sb = symbols.find(s => s.id === b);
  if (!sa || !sb) return '';
  return `${sa.icon}${sb.icon}`;
}

const encodedResult = computed(() => {
  const raw = encodeInput.value.toUpperCase().replace(/[^A-Z]/g, '');
  return raw.split('').map(letter => {
    const [a, b] = code[letter] || ['', ''];
    const sa = symbols.find(s => s.id === a);
    const sb = symbols.find(s => s.id === b);
    return { letter, code: sa && sb ? `${sa.icon}${sb.icon}` : '?' };
  });
});

function attemptDecode() {
  const parts = decodeInput.value.trim().split(/\s+/);
  let result = '';
  for (const part of parts) {
    const [aName, bName] = part.split(',').map(s => s.trim().toLowerCase());
    const aId = symbols.find(s => s.name.toLowerCase() === aName)?.id;
    const bId = symbols.find(s => s.name.toLowerCase() === bName)?.id;
    if (!aId || !bId) { decodedResult.value = ''; return; }
    const letter = reverseMap.value[`${aId}+${bId}`];
    if (!letter) { decodedResult.value = ''; return; }
    result += letter;
  }
  decodedResult.value = result || '';
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

.symbol-legend { margin-bottom: 1.25rem; }
.symbol-legend h4 { font-size: 0.7rem; letter-spacing: 0.12rem; color: orange; margin-bottom: 0.6rem; }
.symbols-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.symbol-chip {
  display: flex; align-items: center; gap: 0.4rem;
  background: #1a1a1a; border: 1px solid #333; border-radius: 0.375rem;
  padding: 0.3rem 0.6rem; font-size: 0.8rem;
}
.sym-icon { font-size: 1.1rem; }
.sym-name { color: #ccc; }

.tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.tabs button {
  background: transparent; border: 1px solid #333; color: #888;
  padding: 0.3rem 0.75rem; border-radius: 0.25rem; font-size: 0.72rem;
  letter-spacing: 0.08rem; cursor: pointer; transition: all 0.2s;
}
.tabs button.active { border-color: skyblue; color: skyblue; }
.tabs button:hover:not(.active) { border-color: #555; color: #aaa; }

.tab-content { min-height: 12rem; }
.hint { font-size: 0.82rem; color: #aaa; margin-bottom: 0.75rem; line-height: 1.4; }
.hint.small { font-size: 0.75rem; }
.hint.warn, .warn { color: #f44336; }

.alphabet-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.letter-row { display: flex; align-items: center; gap: 0.3rem; }
.letter { width: 1.25rem; color: antiquewhite; font-weight: 600; font-size: 0.85rem; }
.sym-select {
  background: #1a1a1a; border: 1px solid #333; color: #ccc;
  border-radius: 0.2rem; padding: 0.15rem 0.25rem; font-size: 0.72rem;
}
.plus { color: #555; font-size: 0.7rem; }
.preview { width: 2rem; font-size: 1rem; text-align: center; }

.duplicate-warning {
  margin-top: 0.75rem; padding: 0.4rem 0.75rem;
  background: rgba(244,67,54,0.1); border: 1px solid #f44336;
  border-radius: 0.25rem; font-size: 0.78rem; color: #f44336;
}

.text-input {
  width: 100%; max-width: 30rem;
  background: #1a1a1a; border: 1px solid #333; color: antiquewhite;
  border-radius: 0.25rem; padding: 0.4rem 0.6rem;
  font-size: 0.9rem; font-family: monospace;
  margin-bottom: 0.75rem; box-sizing: border-box;
}
textarea.text-input { resize: vertical; }

.encoded-output { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; }
.encoded-pair {
  display: flex; flex-direction: column; align-items: center;
  background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 0.375rem;
  padding: 0.4rem 0.6rem; min-width: 2.5rem;
}
.enc-letter { font-size: 0.65rem; color: gold; letter-spacing: 0.05rem; }
.enc-code { font-size: 1.2rem; }

.action-btn {
  background: transparent; border: 1px solid skyblue; color: skyblue;
  border-radius: 0.25rem; padding: 0.35rem 0.9rem;
  font-size: 0.72rem; letter-spacing: 0.1rem; cursor: pointer;
  margin-bottom: 0.75rem; transition: background 0.2s;
}
.action-btn:hover { background: rgba(135,206,235,0.1); }

.decoded-output { font-size: 0.9rem; color: #ccc; }
.decoded-output strong { color: antiquewhite; }

.reflection {
  margin-top: 1.5rem; background: #111;
  border-left: 3px solid orange; padding: 0.75rem 1rem;
  border-radius: 0 0.25rem 0.25rem 0; font-size: 0.85rem;
  color: #bbb; line-height: 1.5;
}
.reflection .b { color: orange; font-weight: 600; margin-bottom: 0.4rem; }
</style>
