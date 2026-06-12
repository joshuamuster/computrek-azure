<template>
  <div class="lesson-page" :class="{ show: isVisible }">

    <!-- Loading / error splash -->
    <div v-if="isLoading" class="splash">
      <div class="lcars-text-bar"><span>Loading Mission…</span></div>
    </div>
    <div v-else-if="!lesson" class="splash">
      <div class="lcars-text-bar"><span>Lesson Not Found</span></div>
      <button class="lcars-btn" @click="router.push('/typing')">← Back to Typing Lab</button>
    </div>

    <!-- Lesson content -->
    <template v-else>

      <!-- ── Intro screen ─────────────────────────────────────────────── -->
      <div v-if="phase === 'intro'" class="intro-panel">
        <button class="back-link" @click="router.push('/typing')">← Typing Lab</button>
        <div class="lcars-text-bar">
          <span v-if="lesson.lessonType === 'tutorial'" class="type-prefix tutorial-prefix">Tutorial: </span>
          <span v-else-if="lesson.lessonType === 'test'" class="type-prefix test-prefix">Cadet Test: </span>
          <span>{{ lesson.title }}</span>
        </div>
        <p class="lesson-desc">{{ lesson.description }}</p>

        <!-- Pass target badge + personal best (lessons & tutorials) -->
        <div v-if="lesson.lessonType !== 'test' && (lesson.targetWpm > 0 || lesson.targetAccuracy > 0)" class="target-row">
          <span class="target-label">Pass Targets</span>
          <span v-if="lesson.targetWpm > 0" class="target-chip">{{ lesson.targetWpm }} WPM</span>
          <span v-if="lesson.targetWpm > 0 && lesson.targetAccuracy > 0" class="target-sep">+</span>
          <span v-if="lesson.targetAccuracy > 0" class="target-chip">{{ lesson.targetAccuracy }}% Accuracy</span>
        </div>
        <div v-if="introBestWpm !== null" class="intro-best-row">
          <span class="intro-best-label">Your Best</span>
          <span class="intro-best-wpm">{{ introBestWpm }} WPM</span>
        </div>

        <!-- Test grading note -->
        <div v-if="lesson.lessonType === 'test'" class="test-info-row">
          <span class="test-info-icon">📋</span>
          <span class="test-info-text">Graded test — your best attempt counts. Score is 50% WPM + 50% Accuracy.</span>
        </div>

        <!-- Focus key chips -->
        <div v-if="lesson.focusKeys.length" class="focus-key-row">
          <span class="focus-key-label">Focus Keys</span>
          <span
            v-for="k in lesson.focusKeys"
            :key="k"
            class="focus-chip"
          >{{ k.toUpperCase() }}</span>
        </div>

        <!-- Visual keyboard -->
        <TypingKeyboard :focusKeys="lesson.focusKeys" class="intro-keyboard" />

        <!-- Test locked state -->
        <div v-if="lesson.lessonType === 'test' && !isTestUnlocked" class="test-locked-banner">
          <span class="locked-icon">🔒</span>
          <span>This test is only available during class. Ask your teacher to open it.</span>
        </div>

        <div class="intro-actions">
          <button class="lcars-btn secondary-btn" @click="router.push('/typing')">← Back</button>
          <button
            class="lcars-btn start-btn"
            :disabled="lesson.lessonType === 'test' && !isTestUnlocked"
            @click="startLesson"
          >
            {{ lesson.lessonType === 'test' ? 'Begin Test' : 'Begin Lesson' }}
          </button>
        </div>
      </div>

      <!-- ── Typing phase ─────────────────────────────────────────────── -->
      <div v-else-if="phase === 'typing'" class="typing-panel">
        <div class="lesson-header">
          <div class="lesson-title">{{ lesson.title }}</div>
          <div class="live-stats">
            <span class="stat-item">
              <span class="stat-val">{{ engineRef?.liveWpm?.value ?? 0 }}</span>
              <span class="stat-unit">WPM</span>
            </span>
            <span class="stat-sep">·</span>
            <span class="stat-item">
              <span class="stat-val">{{ engineRef?.liveAccuracy?.value ?? 100 }}</span>
              <span class="stat-unit">%</span>
            </span>
          </div>
        </div>

        <!-- Visual keyboard — shows live active key + focus keys -->
        <TypingKeyboard
          :focusKeys="lesson.focusKeys"
          :activeKey="activeKey"
          :errorKeys="topErrorKeys"
          class="live-keyboard"
        />

        <!-- Typing engine -->
        <TypingEngine
          ref="engineRef"
          :text="lesson.passage"
          @complete="onComplete"
          @keystroke="onKeystroke"
        />
      </div>

      <!-- ── Results phase ────────────────────────────────────────────── -->
      <div v-else-if="phase === 'results'" class="results-panel">
        <div class="lcars-text-bar"><span>{{ lesson.title }} — Complete</span></div>

        <TypingResultsCard
          v-if="lastResult"
          :result="lastResult"
          :prevBestWpm="prevBestWpm"
          :lessonType="lesson.lessonType"
          :passed="lastPassed"
          :score="lastScore"
          :letterGrade="lastLetterGrade"
          :nextLessonId="nextLesson?.id ?? null"
          :nextLessonIsLockedTest="nextLessonIsLockedTest"
          @tryAgain="restartLesson"
          @back="router.push('/typing')"
          @next="goNext"
        />

        <!-- Visual keyboard showing top missed keys -->
        <div v-if="topErrorKeys.length" class="results-keyboard-wrap">
          <div class="results-keyboard-label">Keys to Practice</div>
          <TypingKeyboard
            :focusKeys="lesson.focusKeys"
            :errorKeys="topErrorKeys"
          />
        </div>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTypingContent }      from '@/composables/useTypingContent'
import { useTypingResults }      from '@/composables/useTypingResults'
import { useTestSessions }       from '@/composables/useTestSessions'
import { useStudentProgress }    from '@/composables/useStudentProgress'
import { useAuth }               from '@/composables/useAuth.js'
import type { TypingResult }     from '@/composables/useTypingEngine'
import TypingEngine              from '@/components/typing/TypingEngine.vue'
import TypingKeyboard            from '@/components/typing/TypingKeyboard.vue'
import TypingResultsCard         from '@/components/typing/TypingResultsCard.vue'

const route  = useRoute()
const router = useRouter()

const { lessons, isLoading, fetchLessons }              = useTypingContent()
const { saveResult, fetchMyBestWpm, fetchMyBestWpmForLesson } = useTypingResults()
const { activeSession, watchTestSession, stopWatching } = useTestSessions()
const { fetchProgress, hasPassedLesson, computeUnlocked } = useStudentProgress()
const { userInfo }                                      = useAuth()

// ── Phase FSM ───────────────────────────────────────────────────────────────
// intro → typing → results → (typing again on retry)

type Phase = 'intro' | 'typing' | 'results'
const phase      = ref<Phase>('intro')
const isVisible  = ref(false)
const engineRef  = ref<InstanceType<typeof TypingEngine> | null>(null)

// ── Lesson data ─────────────────────────────────────────────────────────────

const lesson = computed(() =>
  lessons.value.find(l => l.id === route.params.lessonId as string) ?? null
)

const sortedLessons = computed(() => [...lessons.value].sort((a, b) => a.order - b.order))

const nextLesson = computed(() => {
  if (!lesson.value) return null
  const idx = sortedLessons.value.findIndex(l => l.id === lesson.value!.id)
  return idx !== -1 && idx < sortedLessons.value.length - 1
    ? sortedLessons.value[idx + 1]
    : null
})

const nextLessonIsLockedTest = computed(() => {
  const next = nextLesson.value
  if (!next || next.lessonType !== 'test') return false
  return !hasPassedLesson(next) && (!activeSession.value || activeSession.value.lessonId !== next.id)
})

// ── Test gate ────────────────────────────────────────────────────────────────
// A test is unlocked when the teacher has opened a session for the student's
// period AND that session's lessonId matches the current lesson.
// A previously-passed test can always be revisited without a live session.

const isTestUnlocked = computed(() => {
  if (!lesson.value || lesson.value.lessonType !== 'test') return true
  if (hasPassedLesson(lesson.value)) return true        // allow review of passed test
  if (!activeSession.value) return false
  return activeSession.value.lessonId === lesson.value.id
})

// ── Grading helpers ──────────────────────────────────────────────────────────

/**
 * WPM scoring scale:
 *   0 WPM  → 0
 *   10 WPM → 60
 *   30 WPM → 100  (linear from 10–30)
 *   30+ WPM → 100
 */
const calcWpmScore = (wpm: number): number => {
  if (wpm <= 0)  return 0
  if (wpm >= 30) return 100
  if (wpm <= 10) return Math.round((wpm / 10) * 60)
  // 10–30 range: 60 → 100
  return Math.round(60 + ((wpm - 10) / 20) * 40)
}

/**
 * Accuracy scoring scale:
 *   0%  → 0
 *   80% → 60
 *   95% → 100  (linear from 80–95)
 *   95%+ → 100
 */
const calcAccuracyScore = (accuracy: number): number => {
  if (accuracy <= 0)  return 0
  if (accuracy >= 95) return 100
  if (accuracy < 80)  return Math.round((accuracy / 80) * 60)
  // 80–95 range: 60 → 100
  return Math.round(60 + ((accuracy - 80) / 15) * 40)
}

/** Combined 50/50 score → 0–100 */
const calcTestScore = (wpm: number, accuracy: number): number => {
  return Math.round((calcWpmScore(wpm) + calcAccuracyScore(accuracy)) / 2)
}

const scoreToLetter = (score: number): string => {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

// ── Live key tracking ───────────────────────────────────────────────────────

const activeKey     = ref<string | null>(null)
const activeTimer   = ref<ReturnType<typeof setTimeout> | null>(null)
const sessionErrors = ref<Record<string, number>>({})

const topErrorKeys = computed(() => {
  const entries = Object.entries(sessionErrors.value)
  if (!entries.length) return []
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k)
})

const onKeystroke = (_outcome: string) => {
  // activeKey tracking is handled via the global keydown listener below
}

const onKeyDown = (e: KeyboardEvent) => {
  if (phase.value !== 'typing') return
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()
  activeKey.value = k
  if (activeTimer.value) clearTimeout(activeTimer.value)
  activeTimer.value = setTimeout(() => { activeKey.value = null }, 180)
}

// ── Results ─────────────────────────────────────────────────────────────────

const lastResult      = ref<TypingResult | null>(null)
const lastPassed      = ref<boolean | null>(null)
const lastScore       = ref<number | null>(null)
const lastLetterGrade = ref<string | null>(null)
const prevBestWpm     = ref<number | null>(null)
const introBestWpm    = ref<number | null>(null)   // shown on intro screen

const onComplete = async (result: TypingResult) => {
  lastResult.value    = result
  sessionErrors.value = { ...result.keyErrors }
  phase.value         = 'results'

  if (!lesson.value || !userInfo.value) return

  const lt = lesson.value.lessonType

  // Compute pass/fail for tutorials and lessons
  let passed: boolean | undefined
  let score:  number  | undefined

  if (lt === 'test') {
    score          = calcTestScore(result.wpm, result.accuracy)
    lastScore.value       = score
    lastLetterGrade.value = scoreToLetter(score)
    lastPassed.value      = null   // tests don't have a binary pass/fail
  } else {
    const wpmOk  = lesson.value.targetWpm      <= 0 || result.wpm      >= lesson.value.targetWpm
    const accOk  = lesson.value.targetAccuracy <= 0 || result.accuracy >= lesson.value.targetAccuracy
    passed             = wpmOk && accOk
    lastPassed.value   = passed
    lastScore.value    = null
    lastLetterGrade.value = null
  }

  prevBestWpm.value = await fetchMyBestWpm('lesson')

  await saveResult('lesson', result, {
    lessonId:   lesson.value.id,
    lessonType: lt,
    ...(passed  !== undefined ? { passed  } : {}),
    ...(score   !== undefined ? { score   } : {}),
  })
}

// ── Controls ─────────────────────────────────────────────────────────────────

const startLesson = () => {
  if (lesson.value?.lessonType === 'test' && !isTestUnlocked.value) return
  sessionErrors.value = {}
  phase.value = 'typing'
}

const restartLesson = () => {
  sessionErrors.value   = {}
  lastResult.value      = null
  lastPassed.value      = null
  lastScore.value       = null
  lastLetterGrade.value = null
  phase.value = 'typing'
}

const goNext = () => {
  if (nextLesson.value) router.push(`/typing/lesson/${nextLesson.value.id}`)
}

// ── Init ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  // Fetch lesson list and student progress in parallel
  await Promise.all([fetchLessons(), fetchProgress()])
  if (lesson.value) {
    introBestWpm.value = await fetchMyBestWpmForLesson(lesson.value.id)
  }
  requestAnimationFrame(() => { isVisible.value = true })
  window.addEventListener('keydown', onKeyDown)

  // Start watching the test session for the student's period
  const periodId = userInfo.value?.periodId
  if (periodId) watchTestSession(periodId)

  // ── URL bypass guard ────────────────────────────────────────────────────
  // Redirect back to Typing Lab if the student navigates directly to a URL
  // for a lesson they haven't unlocked yet.  Teachers/staff are exempt.
  const role = (userInfo.value as any)?.role ?? ''
  const isStudent = !['staff', 'admin', 'teacher'].includes(role.toLowerCase())

  if (isStudent && lesson.value) {
    const allSorted = [...lessons.value].sort((a, b) => a.order - b.order)
    const unlocked  = computeUnlocked(allSorted)

    if (!unlocked.has(lesson.value.id)) {
      console.warn('[TypingLesson] URL bypass blocked — lesson not unlocked:', lesson.value.id)
      router.replace('/typing')
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (activeTimer.value) clearTimeout(activeTimer.value)
  stopWatching()
})
</script>

<style scoped>
/* ── Page ────────────────────────────────────────────────────────────────── */
.lesson-page {
  opacity:   0;
  transform: translateY(0.375rem);
  transition: opacity 0.6s ease, transform 0.6s ease;
  max-width: 54rem;
  margin:    0 auto;
}
.lesson-page.show {
  opacity:   1;
  transform: none;
}

/* ── Splash ──────────────────────────────────────────────────────────────── */
.splash {
  display:         flex;
  flex-direction:  column;
  align-items:     flex-start;
  gap:             1.5rem;
  padding-top:     2rem;
}

/* ── Back link ───────────────────────────────────────────────────────────── */
.back-link {
  background:    none;
  border:        none;
  color:         rgba(153, 204, 255, 0.6);
  font-family:   'Antonio', sans-serif;
  font-size:     0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor:        pointer;
  padding:       0;
  margin-bottom: 0.25rem;
  transition:    color 0.2s;
}
.back-link:hover { color: rgba(153, 204, 255, 1); }

/* ── Intro panel ─────────────────────────────────────────────────────────── */
.intro-panel {
  display:         flex;
  flex-direction:  column;
  gap:             1.25rem;
}

.lesson-desc {
  color:       #cacaca;
  font-size:   1.05rem;
  line-height: 1.6;
  margin:      0;
}

.type-prefix {
  margin-right: 0.5rem;
}
.tutorial-prefix { color: rgba(255, 180, 0, 0.9); }
.test-prefix     { color: rgba(255, 100, 100, 0.9); }

/* Pass target row */
.target-row {
  display:     flex;
  align-items: center;
  gap:         0.5rem;
  flex-wrap:   wrap;
}
.target-label {
  font-family:   'Antonio', sans-serif;
  font-size:     0.75rem;
  color:         rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-right:  0.25rem;
}
.target-chip {
  font-family:   'Antonio', monospace, sans-serif;
  font-size:     0.9rem;
  color:         rgba(120, 255, 180, 0.95);
  background:    rgba(60, 200, 120, 0.12);
  border:        0.0625rem solid rgba(60, 200, 120, 0.35);
  border-radius: 0.375rem;
  padding:       0.2rem 0.65rem;
}
.target-sep {
  color:     rgba(153, 204, 255, 0.35);
  font-size: 0.9rem;
}

/* Test info row */
.test-info-row {
  display:     flex;
  align-items: flex-start;
  gap:         0.6rem;
  padding:     0.75rem 1rem;
  background:  rgba(255, 100, 100, 0.08);
  border:      0.0625rem solid rgba(255, 100, 100, 0.25);
  border-radius: 0.5rem;
  color:       rgba(255, 180, 180, 0.85);
  font-size:   0.9rem;
  line-height: 1.5;
}
.test-info-icon { font-size: 1rem; flex-shrink: 0; margin-top: 0.05rem; }

/* Test locked banner */
.test-locked-banner {
  display:     flex;
  align-items: center;
  gap:         0.6rem;
  padding:     0.75rem 1rem;
  background:  rgba(255, 160, 0, 0.08);
  border:      0.0625rem solid rgba(255, 160, 0, 0.3);
  border-radius: 0.5rem;
  color:       rgba(255, 200, 100, 0.9);
  font-size:   0.9rem;
}
.locked-icon { font-size: 1.1rem; }

/* Focus key row */
.focus-key-row {
  display:     flex;
  align-items: center;
  gap:         0.5rem;
  flex-wrap:   wrap;
}
.focus-key-label {
  font-family:   'Antonio', sans-serif;
  font-size:     0.75rem;
  color:         rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-right:  0.25rem;
}
.focus-chip {
  font-family:   'Antonio', monospace, sans-serif;
  font-size:     1rem;
  color:         rgba(255, 210, 60, 0.95);
  background:    rgba(255, 196, 0, 0.15);
  border:        0.0625rem solid rgba(255, 196, 0, 0.4);
  border-radius: 0.375rem;
  padding:       0.2rem 0.6rem;
  min-width:     2rem;
  text-align:    center;
}

.intro-keyboard {
  margin-top: 0.5rem;
}

.intro-best-row {
  display:     flex;
  align-items: center;
  gap:         0.5rem;
  margin-top:  0.25rem;
}
.intro-best-label {
  font-family:   'Antonio', sans-serif;
  font-size:     0.75rem;
  color:         rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-right:  0.25rem;
}
.intro-best-wpm {
  font-family:   'Antonio', monospace, sans-serif;
  font-size:     0.9rem;
  color:         rgba(255, 196, 0, 0.9);
  background:    rgba(255, 196, 0, 0.1);
  border:        0.0625rem solid rgba(255, 196, 0, 0.3);
  border-radius: 0.375rem;
  padding:       0.2rem 0.65rem;
}

.intro-actions {
  display:     flex;
  gap:         0.75rem;
  align-items: center;
  margin-top:  0.5rem;
  flex-wrap:   wrap;
}

.start-btn {
  font-size:   1rem;
  padding:     0.7rem 2.5rem;
}
.start-btn:disabled {
  opacity: 0.35;
  cursor:  not-allowed;
}
.start-btn:disabled:hover {
  background:  #99ccff;
  transform:   none;
}
.secondary-btn {
  font-size:   1rem;
  padding:     0.7rem 1.5rem;
  background:  rgba(100, 100, 120, 0.15);
  color:       rgba(153, 204, 255, 0.6);
  border-color: rgba(100, 100, 120, 0.4);
}
.secondary-btn:hover {
  background:  rgba(100, 100, 120, 0.3);
  color:       #fff;
  border-color: rgba(153, 204, 255, 0.5);
  box-shadow:  none;
  transform:   none;
}

/* ── Typing panel ────────────────────────────────────────────────────────── */
.typing-panel {
  display:        flex;
  flex-direction: column;
  gap:            1rem;
}

.lesson-header {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
}

.lesson-title {
  font-family:   'Antonio', sans-serif;
  font-size:     1.4rem;
  color:         #e8f0ff;
  letter-spacing: 0.04em;
}

/* Live stats */
.live-stats {
  display:     flex;
  align-items: baseline;
  gap:         0.5rem;
}
.stat-item {
  display:     flex;
  align-items: baseline;
  gap:         0.2rem;
}
.stat-val {
  font-family: 'Antonio', sans-serif;
  font-size:   1.6rem;
  color:       #99ccff;
  line-height: 1;
}
.stat-unit {
  font-family:   'Antonio', sans-serif;
  font-size:     0.7rem;
  color:         rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.stat-sep {
  color:     rgba(153, 204, 255, 0.3);
  font-size: 1.2rem;
}

.live-keyboard {
  /* slightly compact in the typing phase */
  max-width: 44rem;
}

/* ── Results panel ───────────────────────────────────────────────────────── */
.results-panel {
  display:         flex;
  flex-direction:  column;
  gap:             1.5rem;
}

.results-keyboard-wrap {
  display:        flex;
  flex-direction: column;
  gap:            0.5rem;
}
.results-keyboard-label {
  font-family:   'Antonio', sans-serif;
  font-size:     0.75rem;
  color:         rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── Shared button ───────────────────────────────────────────────────────── */
.lcars-btn {
  font-family:   'Antonio', sans-serif;
  font-size:     0.9rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color:          #0a1628;
  background:     #99ccff;
  border:         none;
  border-radius:  62.4375rem;
  padding:        0.55rem 1.75rem;
  cursor:         pointer;
  transition:     background 0.2s, transform 0.15s;
}
.lcars-btn:hover {
  background: #bbddff;
  transform:  translateY(-0.1rem);
}
</style>
