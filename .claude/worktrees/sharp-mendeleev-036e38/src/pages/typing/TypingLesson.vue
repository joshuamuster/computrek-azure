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
          <span v-if="lesson.isTutorial" class="tutorial-prefix">Tutorial: </span>
          <span>{{ lesson.title }}</span>
        </div>
        <p class="lesson-desc">{{ lesson.description }}</p>

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

        <button class="lcars-btn start-btn" @click="startLesson">
          Begin Lesson
        </button>
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
          @tryAgain="restartLesson"
          @back="router.push('/typing')"
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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTypingContent }  from '@/composables/useTypingContent'
import { useTypingResults }  from '@/composables/useTypingResults'
import { useAuth }           from '@/composables/useAuth.js'
import type { TypingResult } from '@/composables/useTypingEngine'
import TypingEngine          from '@/components/typing/TypingEngine.vue'
import TypingKeyboard        from '@/components/typing/TypingKeyboard.vue'
import TypingResultsCard     from '@/components/typing/TypingResultsCard.vue'

const route  = useRoute()
const router = useRouter()

const { lessons, isLoading, fetchLessons } = useTypingContent()
const { saveResult, fetchMyBestWpm }       = useTypingResults()
const { userInfo }                         = useAuth()

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

// ── Live key tracking ───────────────────────────────────────────────────────

const activeKey    = ref<string | null>(null)
const activeTimer  = ref<ReturnType<typeof setTimeout> | null>(null)
const sessionErrors = ref<Record<string, number>>({})

const topErrorKeys = computed(() => {
  const entries = Object.entries(sessionErrors.value)
  if (!entries.length) return []
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k)
})

const onKeystroke = (outcome: string) => {
  // outcome from engine is 'correct'|'error'|'backspace'|'complete'|'idle'
  // The engine emits the outcome string; to get the pressed key we need to
  // intercept it at a higher level — but TypingEngine doesn't expose which key
  // was pressed. We handle activeKey tracking via keydown on the lesson wrapper.
}

const onKeyDown = (e: KeyboardEvent) => {
  if (phase.value !== 'typing') return
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()
  activeKey.value = k
  if (activeTimer.value) clearTimeout(activeTimer.value)
  activeTimer.value = setTimeout(() => { activeKey.value = null }, 180)
}

// ── Results ─────────────────────────────────────────────────────────────────

const lastResult  = ref<TypingResult | null>(null)
const prevBestWpm = ref<number | null>(null)

const onComplete = async (result: TypingResult) => {
  lastResult.value = result
  // Accumulate error keys from this session result
  sessionErrors.value = { ...result.keyErrors }
  phase.value = 'results'

  if (userInfo.value) {
    prevBestWpm.value = await fetchMyBestWpm('lesson')
    await saveResult('lesson', result, {
      lessonId:    lesson.value?.id,
      lessonTitle: lesson.value?.title,
    })
  }
}

// ── Controls ─────────────────────────────────────────────────────────────────

const startLesson = () => {
  sessionErrors.value = {}
  phase.value = 'typing'
}

const restartLesson = () => {
  sessionErrors.value = {}
  lastResult.value    = null
  phase.value = 'typing'
}

// ── Init ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  await fetchLessons()
  requestAnimationFrame(() => { isVisible.value = true })
  window.addEventListener('keydown', onKeyDown)
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (activeTimer.value) clearTimeout(activeTimer.value)
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

.tutorial-prefix {
  color: rgba(255, 180, 0, 0.9);
  margin-right: 0.5rem;
}

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

.start-btn {
  align-self:  flex-start;
  margin-top:  0.5rem;
  font-size:   1rem;
  padding:     0.7rem 2.5rem;
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
