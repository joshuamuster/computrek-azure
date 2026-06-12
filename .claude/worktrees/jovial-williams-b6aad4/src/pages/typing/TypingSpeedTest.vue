<template>
  <div class="speed-test" :class="{ show: isVisible }">

    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <div class="test-header">
      <div class="header-left">
        <button class="pill back-btn" @click="goBack">← Typing</button>
        <button
          v-for="(list, key) in WORD_LISTS"
          :key="key"
          class="pill"
          :class="{ active: selectedList === key }"
          @click="selectList(key)"
        >{{ list.label }}</button>
      </div>

      <div class="header-center">
        <span class="lcars-text">SPEED TEST</span>
      </div>

      <div class="header-right">
        <div class="stat-box" :class="{ urgent: timeLeft <= 10 && isRunning }">
          <span class="stat-label">TIME</span>
          <span class="stat-value">{{ timeLeft }}s</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">WPM</span>
          <span class="stat-value">{{ displayWpm }}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">ACC</span>
          <span class="stat-value">{{ displayAccuracy }}%</span>
        </div>
        <button @click="resetTest" class="pill reset-btn">Reset</button>
      </div>
    </div>

    <!-- ── Results card (shown after session ends) ─────────────────────── -->
    <TypingResultsCard
      v-if="sessionResult !== null"
      :result="sessionResult"
      :prevBestWpm="prevBestWpm"
      @tryAgain="resetTest"
      @back="goBack"
    />

    <!-- ── Typing area (shown during session) ─────────────────────────── -->
    <template v-else>
      <TypingEngine
        ref="engineRef"
        :text="currentPassage"
        @complete="onComplete"
        @keystroke="onKeystroke"
      />

      <div class="countdown-bar-wrap">
        <div
          class="countdown-bar"
          :style="{ width: barWidth }"
          :class="{ urgent: timeLeft <= 10 }"
        />
      </div>

      <div class="test-hint">
        {{ isRunning ? 'Keep going — you\'ve got this, Cadet.' : 'Start typing to begin the countdown.' }}
      </div>
    </template>

    <!-- Save status (brief message after result is saved) -->
    <div v-if="saveMessage" class="save-message">{{ saveMessage }}</div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TypingEngine     from '@/components/typing/TypingEngine.vue'
import TypingResultsCard from '@/components/typing/TypingResultsCard.vue'
import { useTypingResults } from '@/composables/useTypingResults'
import type { TypingResult } from '@/composables/useTypingEngine'

// ── Router ─────────────────────────────────────────────────────────────────

const router = useRouter()
const goBack = () => router.push('/typing')

// ── Word banks ─────────────────────────────────────────────────────────────

const WORD_LISTS = {
  starfleet: {
    label: 'Starfleet',
    words: [
      'starfleet', 'federation', 'holodeck', 'warp', 'photon', 'torpedo',
      'phaser', 'tricorder', 'transporter', 'replicator', 'ensign', 'captain',
      'lieutenant', 'commander', 'starship', 'enterprise', 'klingon', 'vulcan',
      'romulan', 'cardassian', 'borg', 'nebula', 'sector', 'quadrant', 'stardate',
      'deflector', 'shield', 'console', 'protocol', 'engage', 'energize',
      'resistance', 'futile', 'live', 'long', 'prosper', 'boldly', 'explore',
      'space', 'frontier', 'bridge', 'spock', 'picard', 'worf', 'troi',
      'riker', 'sisko', 'janeway', 'seven', 'chakotay', 'data', 'scotty',
      'bones', 'uhura', 'sulu', 'chekov', 'kirk', 'dax', 'odo', 'quark',
      'geordi', 'crusher', 'troi', 'neelix', 'tuvok', 'paris', 'torres',
      'hologram', 'subspace', 'warpcore', 'nacelle', 'impulse', 'antimatter',
    ],
  },
  systems: {
    label: 'Systems',
    words: [
      'variable', 'function', 'boolean', 'algorithm', 'syntax', 'debug',
      'compile', 'execute', 'iterate', 'loop', 'array', 'object', 'string',
      'integer', 'output', 'input', 'logic', 'binary', 'sequence', 'condition',
      'parameter', 'argument', 'return', 'class', 'method', 'library',
      'database', 'network', 'server', 'client', 'memory', 'hardware', 'software',
      'keyboard', 'monitor', 'processor', 'storage', 'encrypt', 'decrypt',
      'protocol', 'browser', 'router', 'packet', 'pixel', 'cursor', 'data',
      'interface', 'runtime', 'pointer', 'compile', 'console', 'terminal',
      'instance', 'module', 'import', 'export', 'format', 'render', 'cache',
    ],
  },
  standard: {
    label: 'Standard',
    words: [
      'the', 'be', 'to', 'of', 'and', 'in', 'that', 'have', 'it', 'for',
      'not', 'on', 'with', 'as', 'you', 'do', 'at', 'this', 'but', 'by',
      'from', 'they', 'we', 'say', 'she', 'or', 'an', 'will', 'my', 'one',
      'all', 'would', 'their', 'what', 'so', 'up', 'out', 'if', 'about',
      'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like',
      'time', 'no', 'just', 'know', 'take', 'people', 'into', 'your',
      'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
      'now', 'look', 'only', 'come', 'over', 'think', 'back', 'after',
      'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
      'new', 'want', 'these', 'give', 'day', 'most', 'us', 'great', 'long',
      'life', 'hand', 'high', 'place', 'hold', 'point', 'world', 'large',
    ],
  },
} as const

type ListKey = keyof typeof WORD_LISTS

// ── Constants ──────────────────────────────────────────────────────────────

const TEST_DURATION = 60   // seconds
const PASSAGE_LENGTH = 280 // target character count for generated passage

// ── State ──────────────────────────────────────────────────────────────────

const selectedList   = ref<ListKey>('starfleet')
const currentPassage = ref<string>('')
const isRunning      = ref(false)
const timeLeft       = ref(TEST_DURATION)
const sessionResult  = ref<TypingResult | null>(null)
const prevBestWpm    = ref<number | null>(null)
const saveMessage    = ref<string>('')
const isVisible      = ref(false)

const engineRef = ref<InstanceType<typeof TypingEngine> | null>(null)

let countdownInterval: ReturnType<typeof setInterval> | null = null

// ── Display values (use engine's live refs via the component ref) ──────────

const displayWpm = computed(() =>
  isRunning.value ? (engineRef.value?.liveWpm?.value ?? 0) : 0
)
const displayAccuracy = computed(() =>
  isRunning.value ? (engineRef.value?.liveAccuracy?.value ?? 100) : 100
)
const barWidth = computed(() =>
  `${(timeLeft.value / TEST_DURATION) * 100}%`
)

// ── Firestore ──────────────────────────────────────────────────────────────

const { saveResult, fetchMyBestWpm } = useTypingResults()

// ── Passage generator ──────────────────────────────────────────────────────

/**
 * Builds a randomised passage from the selected word bank.
 * Shuffles the list, then picks words until the passage reaches PASSAGE_LENGTH.
 * Result is always title-sentence-cased (first word capitalised, ends with period).
 */
const generatePassage = (listKey: ListKey): string => {
  const words = [...WORD_LISTS[listKey].words]

  // Fisher-Yates shuffle
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]]
  }

  let passage = ''
  let i = 0
  while (passage.length < PASSAGE_LENGTH) {
    passage += (passage ? ' ' : '') + words[i % words.length]
    i++
  }

  // Capitalise first letter
  passage = passage.charAt(0).toUpperCase() + passage.slice(1)
  return passage
}

// ── Timer ──────────────────────────────────────────────────────────────────

const startCountdown = () => {
  stopCountdown()
  countdownInterval = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      stopCountdown()
      engineRef.value?.forceComplete()
      // forceComplete triggers the @complete event which calls onComplete
    }
  }, 1000)
}

const stopCountdown = () => {
  if (countdownInterval !== null) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

// ── Event handlers ─────────────────────────────────────────────────────────

/** Called by TypingEngine when the first keystroke lands. */
const onKeystroke = (outcome: string) => {
  if (!isRunning.value && outcome !== 'idle') {
    isRunning.value = true
    startCountdown()
  }
}

/** Called by TypingEngine when session ends (text finished or timer forced it). */
const onComplete = async (result: TypingResult) => {
  stopCountdown()
  isRunning.value = false

  // Fetch personal best *before* saving so we can show the comparison
  prevBestWpm.value = await fetchMyBestWpm('speed-test')

  sessionResult.value = result

  // Save to Firestore
  const saved = await saveResult('speed-test', result)
  if (!saved) {
    saveMessage.value = 'Could not save result — check your connection.'
    setTimeout(() => { saveMessage.value = '' }, 4000)
  }
}

// ── Controls ───────────────────────────────────────────────────────────────

const selectList = (key: ListKey) => {
  if (isRunning.value) return   // don't switch mid-session
  selectedList.value = key
  resetTest()
}

const resetTest = () => {
  stopCountdown()
  isRunning.value     = false
  timeLeft.value      = TEST_DURATION
  sessionResult.value = null
  currentPassage.value = generatePassage(selectedList.value)
  // TypingEngine will detect the text change and reset itself automatically
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(() => {
  currentPassage.value = generatePassage(selectedList.value)
  requestAnimationFrame(() => { isVisible.value = true })
})

onBeforeUnmount(stopCountdown)
</script>

<style scoped>
/* ── Page container ─────────────────────────────────────────────────────── */
.speed-test {
  opacity:   0;
  transform: translateY(0.375rem);
  transition: opacity 0.6s ease, transform 0.6s ease;
  display:   flex;
  flex-direction: column;
  gap:       1.25rem;
  max-width: 62rem;
  margin:    0 auto;
}

.speed-test.show {
  opacity:   1;
  transform: none;
}

/* ── Header bar ─────────────────────────────────────────────────────────── */
.test-header {
  display:     flex;
  align-items: center;
  justify-content: space-between;
  gap:         1rem;
  flex-wrap:   wrap;
}

.header-left {
  display: flex;
  gap:     0.5rem;
  flex-wrap: wrap;
}

.header-center .lcars-text {
  font-family: 'Antonio', sans-serif;
  font-size:   1.4rem;
  color:       rgba(153, 204, 255, 0.55);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.header-right {
  display:     flex;
  align-items: center;
  gap:         0.625rem;
}

/* ── Stat boxes ─────────────────────────────────────────────────────────── */
.stat-box {
  background: rgba(0, 0, 0, 0.6);
  border:     0.0625rem solid rgba(153, 204, 255, 0.25);
  border-radius: 0.375rem;
  padding:    0.3rem 0.7rem;
  min-width:  3.8rem;
  display:    flex;
  flex-direction: column;
  align-items: center;
  box-shadow: inset 0 0 0.5rem rgba(0, 0, 0, 0.4);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.stat-box.urgent {
  border-color: rgba(255, 85, 85, 0.6);
  box-shadow:   inset 0 0 0.5rem rgba(255, 85, 85, 0.1), 0 0 0.75rem rgba(255, 85, 85, 0.2);
  animation:    pulse-urgent 0.8s ease-in-out infinite alternate;
}

@keyframes pulse-urgent {
  from { box-shadow: inset 0 0 0.5rem rgba(255,85,85,0.1), 0 0 0.5rem rgba(255,85,85,0.15); }
  to   { box-shadow: inset 0 0 0.5rem rgba(255,85,85,0.2), 0 0 1.25rem rgba(255,85,85,0.4); }
}

.stat-label {
  font-family: 'Antonio', sans-serif;
  font-size:   0.65rem;
  color:       rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1;
}

.stat-value {
  font-family: 'Antonio', sans-serif;
  font-size:   1.25rem;
  font-weight: bold;
  color:       #fff;
  line-height: 1.1;
  text-shadow: 0 0 0.3rem rgba(255,255,255,0.3);
}

/* ── Countdown bar ──────────────────────────────────────────────────────── */
.countdown-bar-wrap {
  height:       0.2rem;
  background:   rgba(153, 204, 255, 0.08);
  border-radius: 1rem;
  overflow:     hidden;
}

.countdown-bar {
  height:     100%;
  background: rgba(153, 204, 255, 0.5);
  border-radius: 1rem;
  transition: width 1s linear, background 0.5s ease;
  box-shadow: 0 0 0.5rem rgba(153, 204, 255, 0.3);
}

.countdown-bar.urgent {
  background: rgba(255, 85, 85, 0.7);
  box-shadow: 0 0 0.5rem rgba(255, 85, 85, 0.5);
}

/* ── Hint text ──────────────────────────────────────────────────────────── */
.test-hint {
  text-align:  center;
  font-family: 'Roboto', sans-serif;
  font-size:   0.82rem;
  color:       rgba(153, 204, 255, 0.35);
  letter-spacing: 0.03em;
  font-style:  italic;
}

/* ── Save message ───────────────────────────────────────────────────────── */
.save-message {
  text-align:  center;
  font-family: 'Antonio', sans-serif;
  font-size:   0.8rem;
  color:       rgba(255, 100, 100, 0.7);
  letter-spacing: 0.05em;
}

/* ── Pill buttons ───────────────────────────────────────────────────────── */
.pill {
  background: rgba(153, 204, 255, 0.1);
  color:      rgba(153, 204, 255, 0.7);
  border:     0.0625rem solid rgba(153, 204, 255, 0.3);
  padding:    0.3rem 0.8rem;
  border-radius: 62.4375rem;
  font-weight: bold;
  cursor:     pointer;
  text-transform: uppercase;
  font-family: 'Antonio', sans-serif;
  font-size:  0.78rem;
  letter-spacing: 0.05em;
  transition: all 0.25s ease;
}

.pill:hover {
  background:  rgba(153, 204, 255, 0.25);
  border-color: rgba(153, 204, 255, 0.7);
  color:       #fff;
  box-shadow:  0 0 0.75rem rgba(153, 204, 255, 0.25);
}

.pill.active {
  background:  rgba(153, 204, 255, 0.25);
  border-color: #9cf;
  color:       #fff;
  box-shadow:  0 0 0.75rem rgba(153, 204, 255, 0.3);
}

.reset-btn {
  margin-left: 0.25rem;
}
</style>
