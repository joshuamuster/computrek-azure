<template>
  <div class="custom-text-page" :class="{ show: isVisible }">

    <!-- Loading -->
    <div v-if="isLoading" class="splash">
      <div class="lcars-text-bar"><span>Loading Passage…</span></div>
    </div>

    <!-- Not found -->
    <div v-else-if="!text" class="splash">
      <div class="lcars-text-bar"><span>Passage Not Found</span></div>
      <button class="lcars-btn" @click="router.push('/typing')">← Back to Typing Lab</button>
    </div>

    <template v-else>

      <!-- ── Intro ──────────────────────────────────────────────────────── -->
      <div v-if="phase === 'intro'" class="intro-panel">
        <div class="lcars-text-bar"><span>{{ text.title }}</span></div>

        <div v-if="text.category" class="category-badge">{{ text.category }}</div>

        <div class="passage-preview">{{ text.passage }}</div>

        <div class="passage-meta">
          {{ text.passage.length }} characters &nbsp;·&nbsp;
          ~{{ estimatedMinutes }} min at average speed
        </div>

        <button class="lcars-btn start-btn" @click="phase = 'typing'">
          Begin Passage
        </button>
      </div>

      <!-- ── Typing ─────────────────────────────────────────────────────── -->
      <div v-else-if="phase === 'typing'" class="typing-panel">
        <div class="passage-header">
          <div class="passage-title">{{ text.title }}</div>
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

        <TypingEngine
          ref="engineRef"
          :text="text.passage"
          @complete="onComplete"
        />
      </div>

      <!-- ── Results ────────────────────────────────────────────────────── -->
      <div v-else-if="phase === 'results'" class="results-panel">
        <div class="lcars-text-bar"><span>{{ text.title }} — Complete</span></div>

        <TypingResultsCard
          v-if="lastResult"
          :result="lastResult"
          :prevBestWpm="prevBestWpm"
          @tryAgain="restartPassage"
          @back="router.push('/typing')"
        />
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter }       from 'vue-router'
import { useTypingCustomText }       from '@/composables/useTypingCustomText'
import { useTypingResults }          from '@/composables/useTypingResults'
import { useAuth }                   from '@/composables/useAuth.js'
import type { TypingResult }         from '@/composables/useTypingEngine'
import TypingEngine                  from '@/components/typing/TypingEngine.vue'
import TypingResultsCard             from '@/components/typing/TypingResultsCard.vue'

const route  = useRoute()
const router = useRouter()

const { texts, isLoading, fetchTexts } = useTypingCustomText()
const { saveResult, fetchMyBestWpm }   = useTypingResults()
const { userInfo }                     = useAuth()

// ── Phase FSM ────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'typing' | 'results'
const phase     = ref<Phase>('intro')
const isVisible = ref(false)
const engineRef = ref<InstanceType<typeof TypingEngine> | null>(null)

// ── Text data ─────────────────────────────────────────────────────────────────

const text = computed(() =>
  texts.value.find(t => t.id === route.params.textId as string) ?? null
)

const estimatedMinutes = computed(() => {
  if (!text.value) return 0
  // Average typist ~40 WPM → chars per min = 40 * 5 = 200
  return Math.max(1, Math.round(text.value.passage.length / 200))
})

// ── Results ───────────────────────────────────────────────────────────────────

const lastResult  = ref<TypingResult | null>(null)
const prevBestWpm = ref<number | null>(null)

const onComplete = async (result: TypingResult) => {
  lastResult.value = result
  phase.value      = 'results'

  if (userInfo.value) {
    prevBestWpm.value = await fetchMyBestWpm('custom')
    await saveResult('custom', result, {
      textId:    text.value?.id,
      textTitle: text.value?.title,
    })
  }
}

const restartPassage = () => {
  lastResult.value = null
  phase.value      = 'typing'
}

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(async () => {
  await fetchTexts()
  requestAnimationFrame(() => { isVisible.value = true })
})
</script>

<style scoped>
/* ── Page ────────────────────────────────────────────────────────────────── */
.custom-text-page {
  opacity:   0;
  transform: translateY(0.375rem);
  transition: opacity 0.6s ease, transform 0.6s ease;
  max-width: 54rem;
  margin:    0 auto;
}
.custom-text-page.show {
  opacity:   1;
  transform: none;
}

.splash {
  display:        flex;
  flex-direction: column;
  gap:            1.5rem;
  padding-top:    2rem;
}

/* ── Intro panel ─────────────────────────────────────────────────────────── */
.intro-panel {
  display:        flex;
  flex-direction: column;
  gap:            1.25rem;
}

.category-badge {
  display:       inline-flex;
  align-self:    flex-start;
  font-family:   'Antonio', sans-serif;
  font-size:     0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color:         rgba(255, 196, 0, 0.85);
  background:    rgba(255, 196, 0, 0.12);
  border:        0.0625rem solid rgba(255, 196, 0, 0.35);
  border-radius: 62.4375rem;
  padding:       0.2rem 0.75rem;
}

.passage-preview {
  font-family:   'Courier New', monospace;
  font-size:     1rem;
  line-height:   1.75;
  color:         rgba(180, 200, 230, 0.7);
  background:    rgba(0, 0, 0, 0.35);
  border:        0.0625rem solid rgba(153, 204, 255, 0.15);
  border-radius: 0.625rem;
  padding:       1.25rem 1.5rem;
  white-space:   pre-wrap;
  word-break:    break-word;
  max-height:    12rem;
  overflow-y:    auto;
}

.passage-meta {
  font-family:   'Antonio', sans-serif;
  font-size:     0.78rem;
  color:         rgba(153, 204, 255, 0.45);
  letter-spacing: 0.05em;
}

.start-btn {
  align-self: flex-start;
  font-size:  1rem;
  padding:    0.7rem 2.5rem;
}

/* ── Typing panel ────────────────────────────────────────────────────────── */
.typing-panel {
  display:        flex;
  flex-direction: column;
  gap:            1rem;
}

.passage-header {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
}
.passage-title {
  font-family:   'Antonio', sans-serif;
  font-size:     1.4rem;
  color:         #e8f0ff;
  letter-spacing: 0.04em;
}
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

/* ── Results panel ───────────────────────────────────────────────────────── */
.results-panel {
  display:        flex;
  flex-direction: column;
  gap:            1.5rem;
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
