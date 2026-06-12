<template>
  <div class="ds-widget">
    <div class="widget-header">
      <span class="widget-label">INTERACTIVE — SIGNALS INTELLIGENCE DIVISION</span>
      <h3>Klingon Intercept Decryption Station</h3>
      <p class="widget-prompt">
        Starfleet has intercepted an encrypted Klingon transmission. The encryption uses a technique
        called XOR — each bit of the message is combined with the corresponding bit of a secret key.
        If the key bit is <strong>1</strong>, the message bit flips. If it's <strong>0</strong>, it stays the same.
        Your mission: use the key to decrypt the transmission.
      </p>
    </div>

    <div class="tabs">
      <button :class="{ active: tab === 'decrypt' }" @click="tab = 'decrypt'">DECRYPT MISSION</button>
      <button :class="{ active: tab === 'encrypt' }" @click="tab = 'encrypt'">ENCRYPT YOUR OWN</button>
      <button :class="{ active: tab === 'learn' }" @click="tab = 'learn'">HOW XOR WORKS</button>
    </div>

    <!-- DECRYPT tab -->
    <div v-if="tab === 'decrypt'" class="tab-content">
      <p class="hint">Step through each byte. Apply the key by flipping bits where the key is 1. Then look up the ASCII character.</p>

      <div class="mission-block">
        <div class="mission-row header-row">
          <span>Byte</span>
          <span>Encrypted</span>
          <span>Key</span>
          <span>XOR Result</span>
          <span>ASCII</span>
          <span>Your answer</span>
        </div>
        <div v-for="(byte, i) in fixedMissionBytes" :key="i" class="mission-row">
          <span class="byte-idx">{{ i }}</span>

          <!-- Encrypted bits -->
          <div class="bits-group">
            <span v-for="(b, j) in byte.encrypted" :key="j" class="bit-cell" :class="{ on: b === '1' }">{{ b }}</span>
          </div>

          <!-- Key bits -->
          <div class="bits-group key-group">
            <span v-for="(b, j) in byte.key" :key="j" class="bit-cell key" :class="{ active: b === '1' }">{{ b }}</span>
          </div>

          <!-- XOR result (computed) -->
          <div class="bits-group">
            <span
              v-for="(b, j) in xorBits(byte.encrypted, byte.key)"
              :key="j"
              class="bit-cell result"
              :class="{ on: b === '1' }"
            >{{ b }}</span>
          </div>

          <!-- ASCII character -->
          <span class="ascii-char">{{ xorChar(byte.encrypted, byte.key) }}</span>

          <!-- Student answer -->
          <input v-model="decryptAnswers[i]" class="answer-input" maxlength="1" placeholder="?" :disabled="decryptSubmitted" />
        </div>
      </div>

      <div class="footer-row">
        <button v-if="!decryptSubmitted" class="action-btn" @click="decryptSubmitted = true">SUBMIT</button>
        <button v-else class="action-btn reset" @click="decryptSubmitted = false; decryptAnswers.fill('')">RESET</button>
        <div v-if="decryptSubmitted" class="decoded-message">
          Decrypted: <strong>{{ decodedMessage }}</strong>
          &nbsp;·&nbsp; Score: {{ decryptScore }} / {{ missionBytes.length }}
        </div>
      </div>
    </div>

    <!-- ENCRYPT tab -->
    <div v-if="tab === 'encrypt'" class="tab-content">
      <p class="hint">Type a short message. We'll generate a random key and show you the encrypted output.</p>
      <div class="enc-controls">
        <input v-model="encryptText" class="text-input" maxlength="8" placeholder="e.g. ENGAGE" />
        <button class="action-btn" @click="generateKey">NEW KEY</button>
      </div>

      <div v-if="encryptText" class="enc-table">
        <div class="enc-row header-row">
          <span>Char</span><span>ASCII Binary</span><span>Key</span><span>Encrypted</span>
        </div>
        <div v-for="(ec, i) in encryptedRows" :key="i" class="enc-row">
          <span class="at-char">{{ ec.char }}</span>
          <div class="bits-group">
            <span v-for="(b, j) in ec.original" :key="j" class="bit-cell" :class="{ on: b === '1' }">{{ b }}</span>
          </div>
          <div class="bits-group">
            <span v-for="(b, j) in ec.key" :key="j" class="bit-cell key" :class="{ active: b === '1' }">{{ b }}</span>
          </div>
          <div class="bits-group">
            <span v-for="(b, j) in ec.encrypted" :key="j" class="bit-cell result" :class="{ on: b === '1' }">{{ b }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- LEARN tab -->
    <div v-if="tab === 'learn'" class="tab-content">
      <p class="hint">XOR (Exclusive OR) is the rule: same → 0, different → 1. In other words, flip the bit <em>only if the key bit is 1</em>.</p>
      <div class="xor-table">
        <div class="xor-row header">
          <span>Message bit</span><span>Key bit</span><span>XOR result</span><span>Effect</span>
        </div>
        <div v-for="row in xorRules" :key="row.msg + row.key" class="xor-row">
          <span class="bit-cell" :class="{ on: row.msg === '1' }">{{ row.msg }}</span>
          <span class="bit-cell key" :class="{ active: row.key === '1' }">{{ row.key }}</span>
          <span class="bit-cell result" :class="{ on: row.result === '1' }">{{ row.result }}</span>
          <span class="xor-effect">{{ row.effect }}</span>
        </div>
      </div>
      <p class="hint" style="margin-top:1rem">
        The same operation works in reverse: if you XOR the encrypted bits with the same key,
        you get the original message back. That's why XOR is used for encryption!
      </p>
    </div>

    <div class="reflection">
      <p class="b">Discussion:</p>
      <p>Why is it important to keep the key secret? If someone intercepts both the encrypted message
        and the key, what can they do? Can you think of a real-world system that works this way?</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';

const tab = ref('decrypt');

// "ENGAGE" encrypted: encrypted = ASCII XOR key
const correctMission = [
  { char: 'E', ascii: '1000101', key: '0000110', encrypted: '1000011' },
  { char: 'N', ascii: '1001110', key: '0010110', encrypted: '1011000' },
  { char: 'G', ascii: '1000111', key: '0000011', encrypted: '1000100' },
  { char: 'A', ascii: '1000001', key: '0000010', encrypted: '1000011' },
  { char: 'G', ascii: '1000111', key: '0000011', encrypted: '1000100' },
  { char: 'E', ascii: '1000101', key: '0000110', encrypted: '1000011' },
];

// Override missionBytes with correct XOR pairs
const fixedMissionBytes = correctMission.map(m => ({
  encrypted: m.encrypted,
  key: m.key,
  expected: m.char,
}));

function xorBits(encStr, keyStr) {
  return encStr.split('').map((b, i) => (parseInt(b) ^ parseInt(keyStr[i])).toString());
}

function xorChar(encStr, keyStr) {
  const bits = xorBits(encStr, keyStr);
  const val = parseInt(bits.join(''), 2);
  return val >= 32 && val <= 126 ? String.fromCharCode(val) : '?';
}

const decryptAnswers = ref(Array(fixedMissionBytes.length).fill(''));
const decryptSubmitted = ref(false);

const decodedMessage = computed(() =>
  fixedMissionBytes.map(b => xorChar(b.encrypted, b.key)).join('')
);

const decryptScore = computed(() =>
  fixedMissionBytes.filter((b, i) =>
    decryptAnswers.value[i]?.toUpperCase() === xorChar(b.encrypted, b.key)
  ).length
);

// Encrypt tab
const encryptText = ref('');
const encKey = ref([]);

function generateKey() {
  encKey.value = Array.from({ length: 10 }, () =>
    Math.round(Math.random()).toString()
  );
}
generateKey();

const encryptedRows = computed(() => {
  return encryptText.value.toUpperCase().split('').slice(0, 8)
    .filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126)
    .map((char, i) => {
      const original = char.charCodeAt(0).toString(2).padStart(7, '0').split('');
      const key = (encKey.value.slice(0, 7).concat(Array(7).fill('0'))).slice(0, 7);
      const encrypted = original.map((b, j) => (parseInt(b) ^ parseInt(key[j])).toString());
      return { char, original, key, encrypted };
    });
});

// Learn tab
const xorRules = [
  { msg: '0', key: '0', result: '0', effect: 'Unchanged (both same)' },
  { msg: '1', key: '0', result: '1', effect: 'Unchanged (both same)' },
  { msg: '0', key: '1', result: '1', effect: 'Flipped (different)' },
  { msg: '1', key: '1', result: '0', effect: 'Flipped (different)' },
];
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

.tab-content { min-height: 14rem; }
.hint { font-size: 0.82rem; color: #aaa; margin-bottom: 0.75rem; line-height: 1.4; }

/* Mission table */
.mission-block { overflow-x: auto; margin-bottom: 1rem; }
.mission-row, .header-row {
  display: grid;
  grid-template-columns: 2.5rem 6rem 6rem 6rem 3rem 4rem;
  gap: 0.5rem; align-items: center;
  padding: 0.35rem 0.4rem; font-size: 0.75rem;
  border-bottom: 1px solid #1a1a1a;
}
.header-row { color: orange; font-size: 0.65rem; letter-spacing: 0.08rem; border-bottom-color: #333; }
.byte-idx { font-family: monospace; color: #555; }

.bits-group { display: flex; gap: 2px; }
.bit-cell {
  width: 1.1rem; height: 1.1rem; border: 1px solid #2a2a2a; border-radius: 2px;
  background: #111; color: #444; display: flex; align-items: center;
  justify-content: center; font-size: 0.65rem; font-family: monospace;
}
.bit-cell.on { background: rgba(135,206,235,0.15); border-color: #5bc; color: skyblue; }
.bit-cell.key { border-color: #3a3; background: #0a1a0a; }
.bit-cell.key.active { background: rgba(100,200,100,0.15); color: #7c7; border-color: #7c7; }
.bit-cell.result.on { background: rgba(255,200,50,0.12); border-color: gold; color: gold; }

.ascii-char { font-family: monospace; font-size: 1.1rem; color: gold; text-align: center; }

.answer-input {
  width: 2.5rem; background: #1a1a1a; border: 1px solid #333; color: antiquewhite;
  border-radius: 0.2rem; padding: 0.2rem; text-align: center; font-size: 0.85rem;
  text-transform: uppercase;
}

.footer-row { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 0.75rem; }
.decoded-message { font-size: 0.85rem; color: #ccc; }
.decoded-message strong { color: antiquewhite; letter-spacing: 0.05rem; }

/* Encrypt tab */
.enc-controls { display: flex; gap: 0.75rem; margin-bottom: 1rem; align-items: center; }
.text-input {
  background: #1a1a1a; border: 1px solid #333; color: antiquewhite;
  border-radius: 0.25rem; padding: 0.4rem 0.6rem; font-size: 0.9rem; font-family: monospace;
}
.enc-table { overflow-x: auto; }
.enc-row {
  display: grid; grid-template-columns: 2.5rem 6rem 6rem 6rem;
  gap: 0.5rem; align-items: center; padding: 0.3rem 0.4rem;
  border-bottom: 1px solid #1a1a1a; font-size: 0.75rem;
}
.enc-row.header-row { color: orange; font-size: 0.65rem; letter-spacing: 0.08rem; border-bottom-color: #333; }
.at-char { font-family: monospace; font-size: 1rem; color: antiquewhite; }

/* Learn tab */
.xor-table { font-size: 0.8rem; }
.xor-row {
  display: grid; grid-template-columns: 7rem 5rem 7rem 1fr;
  gap: 0.75rem; align-items: center; padding: 0.4rem 0.5rem;
  border-bottom: 1px solid #1a1a1a;
}
.xor-row.header { color: orange; font-size: 0.65rem; letter-spacing: 0.08rem; border-bottom-color: #333; }
.xor-effect { font-size: 0.75rem; color: #aaa; }

.action-btn {
  background: transparent; border: 1px solid skyblue; color: skyblue;
  border-radius: 0.25rem; padding: 0.35rem 0.9rem;
  font-size: 0.72rem; letter-spacing: 0.08rem; cursor: pointer; transition: background 0.2s;
}
.action-btn:hover { background: rgba(135,206,235,0.1); }
.action-btn.reset { border-color: #888; color: #888; }

.reflection {
  margin-top: 1.5rem; background: #111; border-left: 3px solid orange;
  padding: 0.75rem 1rem; border-radius: 0 0.25rem 0.25rem 0;
  font-size: 0.85rem; color: #bbb; line-height: 1.5;
}
.reflection .b { color: orange; font-weight: 600; margin-bottom: 0.4rem; }
</style>
