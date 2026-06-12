<template>
  <div class="results-card" :class="{ show: visible }">

    <!-- Pass/Fail banner (lessons & tutorials) — folds in the personal-best note -->
    <div v-if="lessonType !== 'test' && passed !== null" class="outcome-banner" :class="passed ? 'passed' : 'failed'">
      <div class="outcome-main">
        <span class="outcome-icon">{{ passed ? '✓' : '✗' }}</span>
        <span class="outcome-text">{{ passed ? 'Passed!' : 'Not quite — try again!' }}</span>
      </div>
      <div v-if="isNewRecord" class="outcome-record">⭐ New personal best! Previous record: {{ prevBestWpm }} WPM</div>
      <div v-else-if="prevBestWpm !== null" class="outcome-prev-best">
        Personal best: {{ prevBestWpm }} WPM
        <span v-if="result.wpm < prevBestWpm" class="delta below">({{ prevBestWpm - result.wpm }} below your best)</span>
      </div>
    </div>

    <!-- Test grade banner -->
    <div v-if="lessonType === 'test' && score !== null" class="grade-banner" :class="gradeColorClass">
      <div class="grade-letter">{{ letterGrade }}</div>
      <div class="grade-details">
        <div class="grade-score">{{ score }}/100</div>
        <div class="grade-label">Test Score</div>
      </div>
    </div>

    <!-- Personal-best note for tests — no outcome-banner there to fold into -->
    <div v-if="lessonType === 'test' && isNewRecord" class="record-banner">
      ⭐ New personal best! Previous record: {{ prevBestWpm }} WPM
    </div>
    <div v-else-if="lessonType === 'test' && prevBestWpm !== null" class="prev-best">
      Personal best: {{ prevBestWpm }} WPM
      <span v-if="result.wpm < prevBestWpm" class="delta below">
        ({{ prevBestWpm - result.wpm }} below your best)
      </span>
    </div>

    <!-- Stats on the left, keyboard practice on the right -->
    <div class="results-body">
      <div class="results-col results-col--stats">
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
            <div v-if="result.activeSeconds < result.duration - 2" class="stat-sub">{{ result.activeSeconds }}s active</div>
          </div>
          <div class="stat-block">
            <div class="stat-value">{{ result.charsTyped }}</div>
            <div class="stat-label">Characters</div>
          </div>
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
      </div>

      <div v-if="errorKeys && errorKeys.length" class="results-col results-col--keyboard">
        <div class="results-keyboard-label">Keys to Practice</div>
        <TypingKeyboard :focusKeys="focusKeys" :errorKeys="errorKeys" />
      </div>
    </div>

    <!-- Saving indicator — shown while Firestore write is in flight -->
    <div v-if="isSaving" class="saving-indicator">
      <span class="saving-spinner">⏳</span> Recording your score…
    </div>

    <!-- Actions -->
    <div class="results-actions">
      <button class="pill" :class="backHighlighted ? 'cta' : 'secondary'" :disabled="isSaving" @click="$emit('back')">Back to Menu</button>
      <button class="pill" :class="tryAgainHighlighted ? 'cta' : 'secondary'" @click="$emit('tryAgain')">Try Again</button>

      <!--
        Next-lesson button — three mutually exclusive states:
        1. Teacher hasn't opened the next test yet (student passed/completed current)
        2. Student hasn't passed the current lesson — show disabled with target hint
        3. Normal — enabled and clickable
      -->
      <span
        v-if="nextLessonIsLockedTest && (lessonType === 'test' || didPass)"
        class="next-wait-msg"
      >🎓 Your teacher will open the next checkpoint when your class is ready.</span>

      <button
        v-else-if="nextLessonId && lessonType !== 'test' && !didPass"
        class="pill secondary next-locked-btn"
        disabled
      >Next Lesson 🔒</button>

      <button
        v-else-if="nextLessonId && !nextLessonIsLockedTest"
        class="pill"
        :class="nextHighlighted ? 'cta' : 'secondary'"
        @click="$emit('next')"
      >Next Lesson</button>
    </div>

    <!-- Pass-target hint: shown below actions when next lesson is locked by score -->
    <div
      v-if="lessonType !== 'test' && lessonType !== 'placement-test' && !didPass && nextLessonId && (minWpm || targetAccuracy)"
      class="pass-hint"
    >
      Need {{ minWpm }} WPM and {{ targetAccuracy }}% accuracy to unlock the next lesson
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { TypingResult } from '@/composables/useTypingEngine'
import type { TypingLessonType } from '@/composables/useTypingContent'
import TypingKeyboard from '@/components/typing/TypingKeyboard.vue'

// ── Props & emits ──────────────────────────────────────────────────────────

const props = defineProps<{
  result:                  TypingResult
  prevBestWpm:             number | null
  lessonType?:             TypingLessonType
  passed?:                 boolean | null     // true/false for lessons; null/undefined for tests
  score?:                  number | null      // 0–100 for tests; null for lessons
  letterGrade?:            string | null      // 'A'–'F' for tests
  nextLessonId?:           string | null      // id of the next lesson in sequence, if any
  nextLessonIsLockedTest?: boolean            // true if next lesson is a test not yet unlocked by teacher
  goalWpm?:                number             // aspirational WPM target (display only)
  minWpm?:                 number             // minimum WPM required to pass (shown in hint)
  targetAccuracy?:         number             // accuracy threshold for the current lesson
  isSaving?:               boolean            // true while Firestore write is in flight
  focusKeys?:              string[]           // keys this lesson focuses on (passed through to the practice keyboard)
  errorKeys?:              string[]           // top missed keys this session — shown on a practice keyboard when present
}>()

defineEmits<{
  (e: 'tryAgain'): void
  (e: 'back'):     void
  (e: 'next'):     void
}>()

// ── Animation ──────────────────────────────────────────────────────────────

const visible = ref(false)
onMounted(() => requestAnimationFrame(() => { visible.value = true }))

// ── Derived display values ─────────────────────────────────────────────────

const isNewRecord = computed(() =>
  props.prevBestWpm !== null &&
  props.result.accuracy >= 80 &&
  props.result.wpm > props.prevBestWpm
)

const formattedDuration = computed(() => {
  const s = props.result.duration
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}m ${r}s` : `${r}s`
})

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

const gradeColorClass = computed(() => {
  const g = props.letterGrade
  if (g === 'A') return 'grade-a'
  if (g === 'B') return 'grade-b'
  if (g === 'C') return 'grade-c'
  if (g === 'D') return 'grade-d'
  return 'grade-f'
})

const rankClass = (i: number) => {
  if (i === 0) return 'rank-1'
  if (i === 1) return 'rank-2'
  return 'rank-other'
}

// ── Button highlight logic ─────────────────────────────────────────────────
// didPass: true if lesson passed (met WPM+accuracy) or test scored ≥ 70 (D or above)
const didPass = computed(() => {
  if (props.passed !== null && props.passed !== undefined) return props.passed
  if (props.score  !== null && props.score  !== undefined) return props.score >= 70
  return false
})

const tryAgainHighlighted = computed(() => !didPass.value)

// "Next Lesson" is highlighted when:
//   – lesson/tutorial: student passed
//   – test: any score (completing the test always clears the section)
// ...AND the next lesson is a regular lesson (not a teacher-gated test)
const nextHighlighted = computed(() => {
  if (!props.nextLessonId || props.nextLessonIsLockedTest) return false
  if (props.lessonType === 'test') return true
  return didPass.value
})

const backHighlighted = computed(() =>
  didPass.value && (!props.nextLessonId || props.nextLessonIsLockedTest)
)
</script>

<style scoped>
/* ── Card container ─────────────────────────────────────────────────────── */
.results-card {
  opacity:   0;
  transform: translateY(0.5rem);
  transition: opacity 0.5s ease, transform 0.5s ease;
  padding:   1.1rem 1.25rem;
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

/* ── Pass/Fail banner ───────────────────────────────────────────────────── */
.outcome-banner {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  gap:            0.3rem;
  padding:        0.45rem 1rem;
  border-radius:  0.5rem;
  margin-bottom:  0.65rem;
}

.outcome-main {
  display:     flex;
  align-items: center;
  justify-content: center;
  gap:         0.6rem;
  font-family: 'Antonio', sans-serif;
  font-size:   1.05rem;
  letter-spacing: 0.06em;
}

.outcome-banner.passed {
  background:  rgba(60, 200, 120, 0.12);
  border:      0.0625rem solid rgba(60, 200, 120, 0.4);
  color:       rgba(100, 230, 150, 0.95);
  box-shadow:  0 0 1rem rgba(60, 200, 120, 0.15);
}

.outcome-banner.failed {
  background:  rgba(255, 85, 85, 0.1);
  border:      0.0625rem solid rgba(255, 85, 85, 0.35);
  color:       rgba(255, 140, 140, 0.9);
}

.outcome-icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.outcome-record {
  font-family: 'Antonio', sans-serif;
  font-size:   0.8rem;
  letter-spacing: 0.04em;
  color:       #ffc400;
  text-shadow: 0 0 0.5rem rgba(255, 196, 0, 0.35);
}

.outcome-prev-best {
  font-family: 'Antonio', sans-serif;
  font-size:   0.78rem;
  letter-spacing: 0.03em;
  color:       rgba(255, 255, 255, 0.55);
}

/* ── Test grade banner ──────────────────────────────────────────────────── */
.grade-banner {
  display:     flex;
  align-items: center;
  gap:         1.25rem;
  padding:     0.6rem 1.25rem;
  border-radius: 0.5rem;
  margin-bottom: 0.65rem;
  border:      0.0625rem solid;
}

.grade-letter {
  font-family: 'Antonio', sans-serif;
  font-size:   2.6rem;
  font-weight: bold;
  line-height: 1;
  min-width:   2.5rem;
  text-align:  center;
}

.grade-score {
  font-family: 'Antonio', sans-serif;
  font-size:   1.4rem;
  line-height: 1;
}

.grade-label {
  font-family:   'Antonio', sans-serif;
  font-size:     0.7rem;
  color:         rgba(153, 204, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top:    0.2rem;
}

.grade-a {
  background:  rgba(60, 200, 120, 0.1);
  border-color: rgba(60, 200, 120, 0.45);
  color:       rgba(100, 240, 160, 0.95);
  box-shadow:  0 0 1rem rgba(60, 200, 120, 0.15);
}
.grade-b {
  background:  rgba(100, 160, 255, 0.1);
  border-color: rgba(100, 160, 255, 0.4);
  color:       rgba(140, 190, 255, 0.95);
}
.grade-c {
  background:  rgba(255, 196, 0, 0.08);
  border-color: rgba(255, 196, 0, 0.35);
  color:       rgba(255, 210, 80, 0.9);
}
.grade-d {
  background:  rgba(255, 140, 0, 0.08);
  border-color: rgba(255, 140, 0, 0.35);
  color:       rgba(255, 170, 80, 0.9);
}
.grade-f {
  background:  rgba(255, 85, 85, 0.08);
  border-color: rgba(255, 85, 85, 0.3);
  color:       rgba(255, 130, 130, 0.9);
}

/* ── Results body: stats column + keyboard-practice column ──────────────── */
.results-body {
  display:     flex;
  align-items: flex-start;
  gap:         1.25rem;
  margin-bottom: 0.75rem;
}

.results-col {
  flex:     1 1 0;
  min-width: 0;
}

.results-col--keyboard {
  display:        flex;
  flex-direction: column;
  gap:            0.5rem;
  align-self:     center;
}

.results-keyboard-label {
  font-family:   'Antonio', sans-serif;
  font-size:     0.75rem;
  color:         rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

@media (max-width: 40rem) {
  .results-body {
    flex-direction: column;
  }
}

/* ── Stats grid ─────────────────────────────────────────────────────────── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

/* Narrower when sharing the row with the practice keyboard */
.results-col--stats .stats-row {
  grid-template-columns: repeat(2, 1fr);
}

.stat-block {
  background: rgba(0, 0, 0, 0.45);
  border:     0.0625rem solid rgba(153, 204, 255, 0.18);
  border-radius: 0.5rem;
  padding:    0.55rem 1rem;
  text-align: center;
  box-shadow: inset 0 0 0.75rem rgba(0, 0, 0, 0.4);
}

.stat-value {
  font-family: 'Antonio', sans-serif;
  font-size:   1.9rem;
  font-weight: bold;
  line-height: 1;
  color: #fff;
}

.main-stat .stat-value {
  font-size: 2.5rem;
}

.stat-label {
  font-family: 'Antonio', sans-serif;
  font-size:   0.68rem;
  color:       rgba(153, 204, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top:  0.2rem;
}

.stat-sub {
  font-family: 'Antonio', sans-serif;
  font-size:   0.65rem;
  color:       rgba(153, 204, 255, 0.35);
  margin-top:  0.2rem;
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
  padding:    0.45rem 1rem;
  color:      #ffc400;
  font-family: 'Antonio', sans-serif;
  font-size:  0.9rem;
  text-align: center;
  letter-spacing: 0.04em;
  margin-bottom: 0.65rem;
  box-shadow: 0 0 1rem rgba(255, 196, 0, 0.15);
}

.prev-best {
  text-align: center;
  font-family: 'Antonio', sans-serif;
  font-size:  0.8rem;
  color:      rgba(153, 204, 255, 0.6);
  margin-bottom: 0.65rem;
}

.delta.below { color: rgba(200, 150, 150, 0.8); margin-left: 0.25rem; }

/* ── Missed keys ─────────────────────────────────────────────────────────── */
.missed-keys-section {
  margin-bottom: 0.65rem;
}

.section-label {
  font-family: 'Antonio', sans-serif;
  font-size:   0.75rem;
  color:       rgba(153, 204, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.4rem;
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
  font-size:   0.85rem;
  color:       rgba(100, 220, 140, 0.8);
  text-align:  center;
  padding:     0.5rem;
  margin-bottom: 0.65rem;
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

.pill.cta {
  background:  rgba(60, 200, 120, 0.18);
  color:       rgba(100, 240, 160, 0.95);
  border-color: rgba(60, 200, 120, 0.55);
  box-shadow:  0 0 0.75rem rgba(60, 200, 120, 0.2);
}

.pill.cta:hover {
  background:  rgba(60, 200, 120, 0.3);
  color:       #fff;
  border-color: rgba(60, 200, 120, 0.8);
  box-shadow:  0 0 1.25rem rgba(60, 200, 120, 0.35);
}

/* ── Saving indicator ────────────────────────────────────────────────────── */
.saving-indicator {
  display:        flex;
  align-items:    center;
  justify-content: center;
  gap:            0.4rem;
  font-family:    'Antonio', sans-serif;
  font-size:      0.8rem;
  letter-spacing: 0.06em;
  color:          rgba(153, 204, 255, 0.55);
  margin-bottom:  0.5rem;
}
.saving-spinner { font-size: 0.9rem; }

/* ── Next-lesson special states ─────────────────────────────────────────── */

/* "Teacher will open" inline message — sits in the actions row */
.next-wait-msg {
  font-family:    'Antonio', sans-serif;
  font-size:      0.8rem;
  letter-spacing: 0.05em;
  color:          rgba(255, 196, 0, 0.75);
  background:     rgba(255, 196, 0, 0.07);
  border:         0.0625rem solid rgba(255, 196, 0, 0.25);
  border-radius:  0.5rem;
  padding:        0.45rem 0.9rem;
  text-align:     center;
  max-width:      22rem;
  line-height:    1.4;
}

/* Disabled "Next Lesson 🔒" button */
.next-locked-btn {
  opacity: 0.45;
  cursor:  not-allowed;
}
.next-locked-btn:hover {
  background:   rgba(100, 100, 120, 0.15) !important;
  border-color: rgba(100, 100, 120, 0.4)  !important;
  color:        rgba(180, 190, 210, 0.7)  !important;
  box-shadow:   none !important;
  transform:    none !important;
}

/* Pass-target hint line below the action row */
.pass-hint {
  text-align:     center;
  font-family:    'Antonio', sans-serif;
  font-size:      0.78rem;
  letter-spacing: 0.05em;
  color:          rgba(153, 204, 255, 0.45);
  margin-top:     0.5rem;
}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 36rem) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
