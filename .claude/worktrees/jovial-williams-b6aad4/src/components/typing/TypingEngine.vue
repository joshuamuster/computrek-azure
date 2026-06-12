<template>
  <div class="typing-engine" @click="focusInput" ref="engineRef">

    <!-- Hidden input captures all keystrokes -->
    <input
      ref="hiddenInput"
      class="hidden-input"
      @keydown.prevent="onKeyDown"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      aria-label="Typing input — click the text area to focus"
    />

    <!-- Click-to-focus prompt (shown when input is not focused) -->
    <div v-if="!isFocused && !isComplete" class="focus-prompt">
      <span class="focus-icon">▶</span> Click to begin typing
    </div>

    <!-- Main text display -->
    <div class="text-display" :class="{ 'text-blurred': !isFocused && !isComplete }">
      <template v-for="group in wordGroups" :key="group.startIndex">
        <!-- Space characters sit between words -->
        <span
          v-if="group.isSpace"
          :class="charClass(group.startIndex)"
          class="char"
        >{{ '\u00A0' }}</span>
        <!-- Word characters wrapped together to prevent mid-word line breaks -->
        <span v-else class="word-wrap">
          <span
            v-for="(char, ci) in group.chars"
            :key="group.startIndex + ci"
            :class="charClass(group.startIndex + ci)"
            class="char"
          >{{ char }}</span>
        </span>
      </template>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useTypingEngine } from '@/composables/useTypingEngine'
import type { TypingResult } from '@/composables/useTypingEngine'

// ── Props & emits ──────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  text:      string
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  (e: 'complete',   result: TypingResult): void
  (e: 'keystroke',  outcome: string):      void
}>()

// ── Engine ─────────────────────────────────────────────────────────────────

const engine = useTypingEngine()
const {
  typedChars,
  errorMap,
  cursorPos,
  isComplete,
  liveWpm,
  liveAccuracy,
} = engine

// ── DOM refs ───────────────────────────────────────────────────────────────

const hiddenInput = ref<HTMLInputElement | null>(null)
const engineRef   = ref<HTMLElement | null>(null)
const isFocused   = ref(false)

// ── Text loading ───────────────────────────────────────────────────────────

watch(() => props.text, (newText) => {
  engine.loadText(newText)
  // Re-focus the hidden input whenever text reloads (new round, reset, etc.)
  nextTick(() => focusInput())
}, { immediate: true })

// ── Keyboard input ─────────────────────────────────────────────────────────

const onKeyDown = (e: KeyboardEvent) => {
  if (props.disabled || isComplete.value) return
  const outcome = engine.handleKey(e.key)
  emit('keystroke', outcome)
  if (outcome === 'complete') {
    emit('complete', engine.buildResult())
  }
}

// ── Focus management ───────────────────────────────────────────────────────

const focusInput = () => nextTick(() => hiddenInput.value?.focus())

const onFocus = () => { isFocused.value = true }
const onBlur  = () => { isFocused.value = false }

onMounted(() => {
  const el = hiddenInput.value
  el?.addEventListener('focus', onFocus)
  el?.addEventListener('blur',  onBlur)
  // Auto-focus on mount so the student can start typing immediately
  focusInput()
})

onUnmounted(() => {
  const el = hiddenInput.value
  el?.removeEventListener('focus', onFocus)
  el?.removeEventListener('blur',  onBlur)
})

// ── Text rendering ─────────────────────────────────────────────────────────

const targetChars = computed(() => props.text.split(''))

// Groups characters into word runs so the template can wrap each word in a
// no-break span, preventing mid-word line breaks.
const wordGroups = computed(() => {
  const chars = targetChars.value
  const groups: Array<{ startIndex: number; chars: string[]; isSpace: boolean }> = []
  let i = 0
  while (i < chars.length) {
    if (chars[i] === ' ') {
      groups.push({ startIndex: i, chars: [' '], isSpace: true })
      i++
    } else {
      const start = i
      while (i < chars.length && chars[i] !== ' ') i++
      groups.push({ startIndex: start, chars: chars.slice(start, i), isSpace: false })
    }
  }
  return groups
})

/**
 * Returns the CSS class for each character span based on its state:
 *   'pending'    — not yet reached
 *   'correct'    — typed correctly
 *   'error'      — typed incorrectly (advance was made with a wrong key)
 *   'cursor-pos' — the very next character to type (blinking cursor drawn here)
 */
const charClass = (i: number): string => {
  const pos = cursorPos.value
  if (i > pos)  return 'pending'
  if (i === pos) return 'cursor-pos'
  if (errorMap.value[i]) return 'error'
  return 'correct'
}

// ── Expose for parent (TypingSpeedTest needs forceComplete) ────────────────

defineExpose({
  forceComplete: () => {
    engine.forceComplete()
    emit('complete', engine.buildResult())
  },
  liveWpm,
  liveAccuracy,
  focusInput,
})
</script>

<style scoped>
/* ── Container ──────────────────────────────────────────────────────────── */
.typing-engine {
  position:   relative;
  cursor:     text;
  padding:    1.5rem 1.75rem;
  background: rgba(0, 0, 0, 0.5);
  border:     0.0625rem solid rgba(153, 204, 255, 0.25);
  border-radius: 0.75rem;
  backdrop-filter: blur(0.5rem);
  box-shadow: 0 0 2rem rgba(0, 0, 0, 0.5), inset 0 0 1rem rgba(153, 204, 255, 0.04);
  min-height: 7rem;
  transition: border-color 0.3s ease;
}

.typing-engine:focus-within {
  border-color: rgba(153, 204, 255, 0.55);
  box-shadow:   0 0 2rem rgba(0, 0, 0, 0.5), 0 0 0.75rem rgba(153, 204, 255, 0.15);
}

/* ── Hidden input (invisible, but receives keyboard focus) ──────────────── */
.hidden-input {
  position: absolute;
  opacity:  0;
  width:    1px;
  height:   1px;
  top:      0;
  left:     0;
  pointer-events: none;
}

/* ── Focus prompt ───────────────────────────────────────────────────────── */
.focus-prompt {
  position:   absolute;
  inset:      0;
  display:    flex;
  align-items: center;
  justify-content: center;
  gap:        0.5rem;
  color:      rgba(153, 204, 255, 0.5);
  font-family: 'Antonio', sans-serif;
  font-size:  1.1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 2;
}

.focus-icon {
  font-size: 0.8rem;
  animation: pulse-focus 1.4s ease-in-out infinite;
}

@keyframes pulse-focus {
  0%, 100% { opacity: 0.4; transform: translateX(0); }
  50%       { opacity: 1;   transform: translateX(0.25rem); }
}

/* ── Text display ───────────────────────────────────────────────────────── */
.text-display {
  font-family: 'Courier New', Courier, monospace;
  font-size:   1.35rem;
  line-height: 1.9;
  letter-spacing: 0.04em;
  transition:  filter 0.2s ease;
  user-select: none;
}

/* Keeps each word together so no word breaks across a line */
.word-wrap {
  display:     inline-block;
  white-space: nowrap;
}

.text-blurred {
  filter: blur(0.18rem);
}

/* ── Character states ───────────────────────────────────────────────────── */
.char {
  display:    inline;
  transition: color 0.08s ease;
}

/* Not yet reached */
.char.pending {
  color: rgba(180, 200, 230, 0.4);
}

/* Typed correctly */
.char.correct {
  color: rgba(153, 255, 180, 0.9);
}

/* Typed with an error */
.char.error {
  color:            #ff5555;
  text-decoration:  underline;
  text-underline-offset: 0.2em;
  text-decoration-color: rgba(255, 85, 85, 0.6);
}

/* The next character to type — blinking cursor drawn before it */
.char.cursor-pos {
  color: rgba(180, 200, 230, 0.4);
  position: relative;
}

.char.cursor-pos::before {
  content:     '';
  position:    absolute;
  left:        -0.08em;
  top:         0.1em;
  bottom:      0.1em;
  width:       0.12em;
  background:  #99ccff;
  border-radius: 0.06em;
  box-shadow:  0 0 0.4em #99ccff, 0 0 0.8em rgba(153, 204, 255, 0.4);
  animation:   blink-cursor 1.1s step-end infinite;
}

@keyframes blink-cursor {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
</style>
