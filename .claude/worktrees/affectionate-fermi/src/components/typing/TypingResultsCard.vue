<template>
  <div class="results-card" :class="{ show: visible }">

    <!-- Header -->
    <div class="results-header">
      <div class="lcars-text-bar"><span>SESSION COMPLETE</span></div>
    </div>

    <!-- Primary stats row -->
    <div class="stats-row">
      <div class="stat-block main-stat">
        <div class="stat-value" :class="wpmColorClass">{{ result.wpm }}</div>
        <div class="stat-label">WPM</div>
      </div>
      <div class="stat-block">
        <div class="stat-value" :class="accuracyColorClass">{{ result.accuracy }}%</div>
        <div class="stat-label">Accuracy</div>
      </div>
      <div class="stat-block">
        <div class="stat-value">{{ formattedDuration }}</div>
        <div class="stat-label">Duration</div>
      </div>
      <div class="stat-block">
        <div class="stat-value">{{ result.charsTyped }}</div>
        <div class="stat-label">Characters</div>
      </div>
    </div>

    <!-- Personal best banner -->
    <div v-if="isNewRecord" class="record-banner">
      ⭐ New personal best! Previous record: {{ prevBestWpm }} WPM
    </div>
    <div v-else-if="prevBestWpm !== null" class="prev-best">
      Personal best: {{ prevBestWpm }} WPM
      <span v-if="result.wpm < prevBestWpm" class="delta below">
        ({{ prevBestWpm - result.wpm }} below your best)
      </span>
    </div>

    <!-- Top missed keys -->
    <div v-if="topMissedKeys.length > 0" class="missed-keys-section">
      <div class="section-label">Keys to practise</div>
      <div class="missed-keys-row">
        <div
          v-for="(entry, i) in topMissedKeys"
          :key="entry.key"
          class="key-chip"
          :class="rankClass(i)"
        >
          <span class="key-char">{{ entry.key === ' ' ? '␣' : entry.key }}</span>
          <span class="key-count">{{ entry.count }}×</span>
        </div>
      </div>
    </div>
    <div v-else class="no-errors">
      No key errors — flawless run!
    </div>

    <!-- Actions -->
    <div class="results-actions">
      <button class="pill" @click="$emit('tryAgain')">Try Again</button>
      <button class="pill secondary" @click="$emit('back')">Back to Menu</button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { TypingResult } from '@/composables/useTypingEngine'

// ── Props & emits ──────────────────────────────────────────────────────────

const props = defineProps<{
  result:      TypingResult
  prevBestWpm: number | null   // null if no previous sessions
}>()

defineEmits<{
  (e: 'tryAgain'): void
  (e: 'back'):     void
}>()

// ── Animation ──────────────────────────────────────────────────────────────

const visible = ref(false)
onMounted(() => requestAnimationFrame(() => { visible.value = true }))

// ── Derived display values ─────────────────────────────────────────────────

const isNewRecord = computed(() =>
  props.prevBestWpm !== null && props.result.wpm > props.prevBestWpm
)

const formattedDuration = computed(() => {
  const s = props.result.duration
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}m ${r}s` : `${r}s`
})

/** Sort missed keys by error count, return top 5 */
const topMissedKeys = computed(() => {
  return Object.entries(props.result.keyErrors)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
})

const wpmColorClass = computed(() => {
  const w = props.result.wpm
  if (w >= 60) return 'text-gold'
  if (w >= 40) return 'text-blue'
  return 'text-white'
})

const accuracyColorClass = computed(() => {
  const a = props.result.accuracy
  if (a >= 98) return 'text-gold'
  if (a >= 90) return 'text-blue'
  if (a >= 75) return 'text-white'
  return 'text-red'
})

const rankClass = (i: number) => {
  if (i === 0) return 'rank-1'
  if (i === 1) return 'rank-2'
  return 'rank-other'
}
</script>

<style scoped>
/* ── Card container ─────────────────────────────────────────────────────── */
.results-card {
  opacity:   0;
  transform: translateY(0.5rem);
  transition: opacity 0.5s ease, transform 0.5s ease;
  padding:   1.5rem;
  background: rgba(5, 10, 20, 0.7);
  border:     0.0625rem solid rgba(153, 204, 255, 0.3);
  border-radius: 0.75rem;
  backdrop-filter: blur(0.75rem);
  box-shadow: 0 0 2.5rem rgba(0, 0, 0, 0.6), inset 0 0 1rem rgba(153, 204, 255, 0.04);
}

.results-card.show {
  opacity:   1;
  transform: none;
}

/* ── Header bar ─────────────────────────────────────────────────────────── */
.results-header {
  margin-bottom: 1.25rem;
}

/* ── Stats grid ─────────────────────────────────────────────────────────── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.stat-block {
  background: rgba(0, 0, 0, 0.45);
  border:     0.0625rem solid rgba(153, 204, 255, 0.18);
  border-radius: 0.5rem;
  padding:    0.9rem 1rem;
  text-align: center;
  box-shadow: inset 0 0 0.75rem rgba(0, 0, 0, 0.4);
}

.stat-value {
  font-family: 'Antonio', sans-serif;
  font-size:   2.4rem;
  font-weight: bold;
  line-height: 1;
  color: #fff;
}

.main-stat .stat-value {
  font-size: 3.2rem;
}

.stat-label {
  font-family: 'Antonio', sans-serif;
  font-size:   0.72rem;
  color:       rgba(153, 204, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top:  0.35rem;
}

/* Stat colour modifiers */
.text-gold  { color: #ffc400; text-shadow: 0 0 0.5rem rgba(255, 196, 0, 0.5); }
.text-blue  { color: #99ccff; text-shadow: 0 0 0.5rem rgba(153, 204, 255, 0.4); }
.text-white { color: #ffffff; }
.text-red   { color: #ff5555; }

/* ── Personal best banners ───────────────────────────────────────────────── */
.record-banner {
  background: rgba(255, 196, 0, 0.12);
  border:     0.0625rem solid rgba(255, 196, 0, 0.4);
  border-radius: 0.5rem;
  padding:    0.65rem 1rem;
  color:      #ffc400;
  font-family: 'Antonio', sans-serif;
  font-size:  0.95rem;
  text-align: center;
  letter-spacing: 0.04em;
  margin-bottom: 1rem;
  box-shadow: 0 0 1rem rgba(255, 196, 0, 0.15);
}

.prev-best {
  text-align: center;
  font-family: 'Antonio', sans-serif;
  font-size:  0.85rem;
  color:      rgba(153, 204, 255, 0.6);
  margin-bottom: 1rem;
}

.delta.below { color: rgba(200, 150, 150, 0.8); margin-left: 0.25rem; }

/* ── Missed keys ─────────────────────────────────────────────────────────── */
.missed-keys-section {
  margin-bottom: 1.25rem;
}

.section-label {
  font-family: 'Antonio', sans-serif;
  font-size:   0.75rem;
  color:       rgba(153, 204, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.6rem;
}

.missed-keys-row {
  display: flex;
  gap:     0.5rem;
  flex-wrap: wrap;
}

.key-chip {
  display:       flex;
  flex-direction: column;
  align-items:   center;
  justify-content: center;
  padding:       0.4rem 0.75rem;
  border-radius: 0.4rem;
  min-width:     3rem;
  background:    rgba(0, 0, 0, 0.4);
  border:        0.0625rem solid rgba(153, 204, 255, 0.2);
}

.key-chip.rank-1 {
  border-color: rgba(255, 85, 85, 0.6);
  background:   rgba(255, 85, 85, 0.1);
  box-shadow:   0 0 0.5rem rgba(255, 85, 85, 0.2);
}

.key-chip.rank-2 {
  border-color: rgba(255, 152, 0, 0.5);
  background:   rgba(255, 152, 0, 0.08);
}

.key-char {
  font-family: 'Courier New', monospace;
  font-size:   1.3rem;
  font-weight: bold;
  color:       #e8e8e8;
  line-height: 1;
}

.key-count {
  font-family: 'Antonio', sans-serif;
  font-size:   0.65rem;
  color:       rgba(180, 180, 200, 0.6);
  margin-top:  0.15rem;
}

.no-errors {
  font-family: 'Antonio', sans-serif;
  font-size:   0.9rem;
  color:       rgba(100, 220, 140, 0.8);
  text-align:  center;
  padding:     0.75rem;
  margin-bottom: 1.25rem;
  border:      0.0625rem solid rgba(100, 220, 140, 0.2);
  border-radius: 0.5rem;
  background:  rgba(100, 220, 140, 0.05);
}

/* ── Action buttons ─────────────────────────────────────────────────────── */
.results-actions {
  display:    flex;
  gap:        0.75rem;
  justify-content: center;
  margin-top: 0.25rem;
}

.pill {
  background: rgba(153, 204, 255, 0.15);
  color:      #9cf;
  border:     0.0625rem solid rgba(153, 204, 255, 0.4);
  padding:    0.45rem 1.25rem;
  border-radius: 62.4375rem;
  font-weight: bold;
  cursor:     pointer;
  text-transform: uppercase;
  font-family: 'Antonio', sans-serif;
  font-size:  0.85rem;
  letter-spacing: 0.05em;
  transition: all 0.25s ease;
}

.pill:hover {
  background:  rgba(153, 204, 255, 0.3);
  border-color: #9cf;
  color:       #fff;
  box-shadow:  0 0 0.9375rem rgba(153, 204, 255, 0.3);
}

.pill.secondary {
  background:  rgba(100, 100, 120, 0.15);
  color:       rgba(180, 190, 210, 0.7);
  border-color: rgba(100, 100, 120, 0.4);
}

.pill.secondary:hover {
  background:  rgba(100, 100, 120, 0.3);
  color:       #fff;
  border-color: rgba(180, 190, 210, 0.6);
  box-shadow:  none;
}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 36rem) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
