// composables/useTypingEngine.ts
//
// Core typing engine: handles keystroke-by-keystroke input,
// calculates live WPM and accuracy, and signals session completion.
//
// Usage:
//   const engine = useTypingEngine()
//   engine.loadText('The quick brown fox...')
//   // In keydown handler:
//   const result = engine.handleKey(e.key)  // 'correct' | 'error' | 'backspace' | 'complete' | 'idle'
//   // On complete:
//   const result = engine.buildResult()

import { ref, computed, onUnmounted } from 'vue'

export interface TypingResult {
  wpm:          number
  accuracy:     number
  duration:     number                    // seconds — total elapsed from first keystroke to last
  activeSeconds: number                   // seconds — only time between keystrokes ≤ 4s apart
  charsTyped:   number
  keyErrors:    Record<string, number>   // { 'f': 3, 'j': 1 } — missed counts per expected key
}

export type KeypressOutcome = 'correct' | 'error' | 'backspace' | 'complete' | 'idle'

export function useTypingEngine() {

  // ── Core state ─────────────────────────────────────────────────────────────

  const targetText    = ref<string>('')
  const typedChars    = ref<string[]>([])    // one entry per position advanced through

  // errorMap: keyed by character index, value true if an error was made there
  // Using a plain object (not Set) so Vue can track mutations reactively
  const errorMap      = ref<Record<number, true>>({})

  // keyErrors: how many times each target key was missed across this session
  const keyErrors     = ref<Record<string, number>>({})

  const startTime       = ref<number | null>(null)
  const endTime         = ref<number | null>(null)
  const isComplete      = ref<boolean>(false)
  const isStarted       = ref<boolean>(false)
  const liveWpm         = ref<number>(0)
  const liveAccuracy    = ref<number>(100)

  // Active typing time — sum of inter-keystroke gaps that are ≤ 4 seconds.
  // Gaps longer than 4 seconds mean the student paused, so we don't count them.
  let   activeMs        = 0
  let   lastKeystroke   = 0   // timestamp of the most recent keystroke

  let wpmInterval: ReturnType<typeof setInterval> | null = null

  // ── Derived ────────────────────────────────────────────────────────────────

  /** Current position in targetText — equals how many chars have been advanced through. */
  const cursorPos = computed(() => typedChars.value.length)

  const errorCount = computed(() => Object.keys(errorMap.value).length)

  const elapsedSeconds = computed(() => {
    if (!startTime.value) return 0
    const end = endTime.value ?? Date.now()
    return Math.max((end - startTime.value) / 1000, 0.01)
  })

  // ── Internal helpers ───────────────────────────────────────────────────────

  const calcWpm = (): number => {
    const secs = elapsedSeconds.value
    if (secs < 0.5 || cursorPos.value === 0) return 0
    // Standard formula: 1 word = 5 characters (gross WPM, doesn't penalise errors)
    return Math.round((cursorPos.value / 5) / (secs / 60))
  }

  const calcAccuracy = (): number => {
    if (cursorPos.value === 0) return 100
    const correct = cursorPos.value - errorCount.value
    return Math.max(0, Math.round((correct / cursorPos.value) * 100))
  }

  const startWpmTicker = () => {
    stopWpmTicker()
    wpmInterval = setInterval(() => {
      liveWpm.value     = calcWpm()
      liveAccuracy.value = calcAccuracy()
    }, 1000)
  }

  const stopWpmTicker = () => {
    if (wpmInterval !== null) {
      clearInterval(wpmInterval)
      wpmInterval = null
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Reset engine state and load new target text.
   * Call this before starting a new session or restarting.
   */
  const loadText = (text: string) => {
    targetText.value   = text
    typedChars.value   = []
    errorMap.value     = {}
    keyErrors.value    = {}
    startTime.value    = null
    endTime.value      = null
    isComplete.value   = false
    isStarted.value    = false
    liveWpm.value      = 0
    liveAccuracy.value = 100
    activeMs           = 0
    lastKeystroke      = 0
    stopWpmTicker()
  }

  /**
   * Process a single keypress.
   * Returns one of: 'correct' | 'error' | 'backspace' | 'complete' | 'idle'
   *
   * Design decisions:
   * - Errors advance the cursor (forgiving mode — better for 7th graders)
   * - Errors are recorded against the *expected* key, not what was typed
   *   (this is what tells you which keys a student struggles with)
   * - Backspace removes the last typed character and clears its error flag
   */
  const handleKey = (key: string): KeypressOutcome => {
    if (isComplete.value)      return 'idle'
    if (!targetText.value)     return 'idle'

    // ── Backspace ────────────────────────────────────────────────────────────
    if (key === 'Backspace') {
      if (typedChars.value.length === 0) return 'idle'
      const pos = typedChars.value.length - 1

      // Remove last typed char
      typedChars.value = typedChars.value.slice(0, pos)

      // Clear error flag at that position (if any)
      if (errorMap.value[pos]) {
        const { [pos]: _removed, ...rest } = errorMap.value
        errorMap.value = rest as Record<number, true>
      }

      liveAccuracy.value = calcAccuracy()
      return 'backspace'
    }

    // ── Ignore non-printable keys (but allow Space) ───────────────────────
    if (key.length > 1) return 'idle'

    const pos      = typedChars.value.length
    const expected = targetText.value[pos]
    if (expected === undefined) return 'idle'

    // ── Start timer on first real keystroke ──────────────────────────────
    const now = Date.now()
    if (!isStarted.value) {
      isStarted.value = true
      startTime.value = now
      startWpmTicker()
    } else {
      // Accumulate active time — only count gaps ≤ 4 seconds (4000ms)
      const gap = now - lastKeystroke
      if (gap <= 4000) activeMs += gap
    }
    lastKeystroke = now

    const isCorrect = key === expected

    if (!isCorrect) {
      // Flag this position as an error
      errorMap.value = { ...errorMap.value, [pos]: true }
      // Tally against the expected key (tells us which keys are weak)
      keyErrors.value = {
        ...keyErrors.value,
        [expected]: (keyErrors.value[expected] ?? 0) + 1,
      }
    }

    typedChars.value = [...typedChars.value, key]
    liveAccuracy.value = calcAccuracy()

    // ── Session complete ─────────────────────────────────────────────────
    if (typedChars.value.length >= targetText.value.length) {
      endTime.value    = Date.now()
      isComplete.value = true
      liveWpm.value    = calcWpm()
      stopWpmTicker()
      return 'complete'
    }

    return isCorrect ? 'correct' : 'error'
  }

  /**
   * Force-end the session early — used by speed test when the timer expires.
   * After calling this, use buildResult() to get the result object.
   */
  const forceComplete = () => {
    if (isComplete.value) return
    if (!isStarted.value) {
      // Player never typed — give them zeros
      startTime.value = Date.now()
    }
    endTime.value    = Date.now()
    isComplete.value = true
    liveWpm.value    = calcWpm()
    stopWpmTicker()
  }

  /**
   * Build the result object to pass to useTypingResults.saveResult().
   * Call after isComplete is true.
   */
  const buildResult = (): TypingResult => ({
    wpm:          calcWpm(),
    accuracy:     calcAccuracy(),
    duration:     Math.round(elapsedSeconds.value),
    activeSeconds: Math.round(activeMs / 1000),
    charsTyped:   cursorPos.value,
    keyErrors:    { ...keyErrors.value },
  })

  // Clean up ticker if the component using this composable unmounts mid-session
  onUnmounted(stopWpmTicker)

  return {
    // ── Reactive state (read) ──────────────────────────────────────────────
    targetText,
    typedChars,
    errorMap,
    cursorPos,
    isComplete,
    isStarted,
    liveWpm,
    liveAccuracy,
    elapsedSeconds,

    // ── Methods ────────────────────────────────────────────────────────────
    loadText,
    handleKey,
    forceComplete,
    buildResult,
  }
}
