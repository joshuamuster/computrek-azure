<template>
  <div class="typing-hub" :class="{ show: isVisible }">

    <div class="lcars-text-bar"><span>CompuTrek Typing Lab</span></div>
    <p class="subheader">
      Develop your typing speed and accuracy through structured drills, timed speed tests,
      and targeted weakness training. Every session is logged to your cadet record.
    </p>

    <!-- Mode cards -->
    <div class="mode-grid">

      <!-- Speed Test — LIVE -->
      <div class="mode-card available" @click="router.push('/typing/speed-test')">
        <div class="mode-icon">⚡</div>
        <div class="mode-body">
          <div class="mode-title">Speed Test</div>
          <div class="mode-desc">
            60 seconds. Three word banks: Starfleet vocabulary, computer science
            terms, or standard English. How fast can you go?
          </div>
        </div>
        <div class="mode-badge live">Online</div>
      </div>

      <!-- Structured Lessons — LIVE -->
      <div class="mode-card available" @click="scrollToLessons">
        <div class="mode-icon">📋</div>
        <div class="mode-body">
          <div class="mode-title">Structured Lessons</div>
          <div class="mode-desc">
            A guided curriculum starting from home-row keys and building up
            to full keyboard fluency. Focused key training with a visual keyboard.
          </div>
        </div>
        <div class="mode-badge live">Online</div>
      </div>

      <!-- Custom Text — LIVE -->
      <div class="mode-card available" @click="scrollToCustom">
        <div class="mode-icon">✍️</div>
        <div class="mode-body">
          <div class="mode-title">Custom Text</div>
          <div class="mode-desc">
            Practice typing passages authored by your teacher — Star Trek quotes,
            vocabulary words, and more.
          </div>
        </div>
        <div class="mode-badge live">Online</div>
      </div>

      <!-- Weakness Drill — Coming soon -->
      <div class="mode-card locked">
        <div class="mode-icon">🎯</div>
        <div class="mode-body">
          <div class="mode-title">Weakness Drill</div>
          <div class="mode-desc">
            The system analyses your past sessions and auto-generates a passage
            heavy on your weakest keys. Targeted training that actually works.
          </div>
        </div>
        <div class="mode-badge coming-soon">Phase 3</div>
      </div>

    </div>

    <!-- ── Tutorial section ──────────────────────────────────────────────────── -->
    <div v-if="tutorialLessons.length" ref="tutorialListRef" class="lesson-section tutorial-section" :class="{ highlight: highlightLessons }">
      <div class="section-header">
        <span class="section-title">Typing Tutorial (Warmup)</span>
        <span class="section-count">{{ tutorialLessons.length }} lessons</span>
        <button class="skip-button" @click="scrollToMainLessons">Skip Tutorial</button>
      </div>

      <div class="lesson-list">
        <div
          v-for="(lesson, index) in tutorialLessons"
          :key="lesson.id"
          class="lesson-item tutorial-item"
          @click="router.push(`/typing/lesson/${lesson.id}`)"
        >
          <div class="lesson-num">{{ index + 1 }}</div>
          <div class="lesson-body">
            <div class="lesson-name">{{ lesson.title }}</div>
            <div class="lesson-sub">
              <span v-if="lesson.focusKeys.length" class="lesson-keys">
                {{ lesson.focusKeys.map(k => k.toUpperCase()).join(' · ') }}
              </span>
              <span v-else class="lesson-keys">Full keyboard</span>
            </div>
          </div>
          <div class="lesson-arrow">›</div>
        </div>
      </div>
    </div>

    <!-- ── Main Missions section ────────────────────────────────────────────── -->
    <div ref="lessonListRef" class="lesson-section main-missions-section" :class="{ highlight: highlightLessons && !tutorialLessons.length }">
      <div class="section-header">
        <span class="section-title">Starfleet Academy Missions</span>
        <span v-if="mainLessons.length" class="section-count">{{ mainLessons.length }} missions</span>
      </div>

      <div v-if="isLoading" class="lesson-loading">Loading lessons…</div>

      <div v-else-if="mainLessons.length === 0" class="lesson-empty">
        No missions available yet. Check back soon.
      </div>

      <div v-else class="lesson-list">
        <div
          v-for="(lesson, index) in mainLessons"
          :key="lesson.id"
          class="lesson-item"
          @click="router.push(`/typing/lesson/${lesson.id}`)"
        >
          <div class="lesson-num">{{ index + 1 }}</div>
          <div class="lesson-body">
            <div class="lesson-name">{{ lesson.title }}</div>
            <div class="lesson-sub">
              <span v-if="lesson.focusKeys.length" class="lesson-keys">
                {{ lesson.focusKeys.map(k => k.toUpperCase()).join(' · ') }}
              </span>
              <span v-else class="lesson-keys">Full keyboard</span>
            </div>
          </div>
          <div class="lesson-arrow">›</div>
        </div>
      </div>
    </div>

    <!-- ── Custom Texts list ───────────────────────────────────────────── -->
    <div ref="customListRef" class="lesson-section" :class="{ highlight: highlightCustom }">
      <div class="section-header">
        <span class="section-title">Custom Texts</span>
        <span v-if="customTexts.length" class="section-count">{{ customTexts.length }} passages</span>
      </div>

      <div v-if="ctLoading" class="lesson-loading">Loading passages…</div>

      <div v-else-if="customTexts.length === 0" class="lesson-empty">
        No custom passages yet — your teacher hasn't posted any.
      </div>

      <div v-else class="lesson-list">
        <div
          v-for="ct in customTexts"
          :key="ct.id"
          class="lesson-item"
          @click="router.push(`/typing/custom/${ct.id}`)"
        >
          <div class="lesson-body">
            <div class="lesson-name">{{ ct.title }}</div>
            <div class="lesson-sub">
              <span v-if="ct.category" class="lesson-keys">{{ ct.category }}</span>
              <span v-else class="lesson-keys">Custom passage</span>
            </div>
          </div>
          <div class="lesson-arrow">›</div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTypingContent }    from '@/composables/useTypingContent'
import { useTypingCustomText } from '@/composables/useTypingCustomText'

const router         = useRouter()
const isVisible        = ref(false)
const highlightLessons = ref(false)
const highlightCustom  = ref(false)
const tutorialListRef = ref<HTMLElement | null>(null)
const lessonListRef   = ref<HTMLElement | null>(null)
const customListRef   = ref<HTMLElement | null>(null)

const { lessons, isLoading, fetchLessons }              = useTypingContent()
const { texts: customTexts, isLoading: ctLoading, fetchTexts } = useTypingCustomText()

const tutorialLessons = computed(() => lessons.value.filter(l => l.isTutorial))
const mainLessons     = computed(() => lessons.value.filter(l => !l.isTutorial))

const scrollToLessons = () => {
  if (tutorialLessons.value.length) {
    tutorialListRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } else {
    lessonListRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  highlightLessons.value = true
  setTimeout(() => { highlightLessons.value = false }, 1200)
}

const scrollToMainLessons = () => {
  lessonListRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  highlightLessons.value = true
  setTimeout(() => { highlightLessons.value = false }, 1200)
}

const scrollToCustom = () => {
  customListRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  highlightCustom.value = true
  setTimeout(() => { highlightCustom.value = false }, 1200)
}

onMounted(async () => {
  requestAnimationFrame(() => { isVisible.value = true })
  await Promise.all([fetchLessons(), fetchTexts()])
})
</script>

<style scoped>
/* ── Page ───────────────────────────────────────────────────────────────── */
.typing-hub {
  opacity:   0;
  transform: translateY(0.375rem);
  transition: opacity 0.6s ease, transform 0.6s ease;
  margin:    0 auto;
  width: 95%;
}

.typing-hub.show {
  opacity:   1;
  transform: none;
}

.subheader {
  color:       #cacaca;
  font-size:   1.1rem;
  font-weight: 500;
  margin-top:  0.5rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

/* ── Mode grid ──────────────────────────────────────────────────────────── */
.mode-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

/* ── Mode card ──────────────────────────────────────────────────────────── */
.mode-card {
  position:   relative;
  display:    flex;
  align-items: flex-start;
  gap:        1rem;
  padding:    1.25rem 1.25rem 1.25rem 1.25rem;
  background: rgba(0, 0, 0, 0.45);
  border:     0.0625rem solid rgba(153, 204, 255, 0.18);
  border-radius: 0.75rem;
  backdrop-filter: blur(0.5rem);
  transition: border-color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease;
}

.mode-card.available {
  cursor: pointer;
}

.mode-card.available:hover {
  border-color: rgba(153, 204, 255, 0.55);
  transform:    translateY(-0.125rem);
  box-shadow:   0 0.5rem 1.5rem rgba(0, 0, 0, 0.4), 0 0 1rem rgba(153, 204, 255, 0.1);
}

.mode-card.locked {
  cursor:  default;
  opacity: 0.55;
}

/* ── Card internals ─────────────────────────────────────────────────────── */
.mode-icon {
  font-size:  2rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.mode-body {
  flex: 1;
}

.mode-title {
  font-family: 'Antonio', sans-serif;
  font-size:   1.3rem;
  color:       #e8f0ff;
  margin-bottom: 0.35rem;
  letter-spacing: 0.03em;
}

.mode-desc {
  font-family: 'Roboto', sans-serif;
  font-size:   0.85rem;
  color:       rgba(180, 195, 220, 0.75);
  line-height: 1.5;
}

/* ── Badge ──────────────────────────────────────────────────────────────── */
.mode-badge {
  position:      absolute;
  top:           0.75rem;
  right:         0.75rem;
  font-family:   'Antonio', sans-serif;
  font-size:     0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding:       0.2rem 0.55rem;
  border-radius: 62.4375rem;
}

.mode-badge.live {
  background:   rgba(100, 220, 140, 0.15);
  border:       0.0625rem solid rgba(100, 220, 140, 0.4);
  color:        rgba(100, 220, 140, 0.9);
}

.mode-badge.coming-soon {
  background:   rgba(153, 204, 255, 0.08);
  border:       0.0625rem solid rgba(153, 204, 255, 0.2);
  color:        rgba(153, 204, 255, 0.5);
}

/* ── Lesson section ──────────────────────────────────────────────────────── */
.lesson-section {
  margin-top: 2rem;
}

/* Flash when scrolled-to from the mode card */
.lesson-section.highlight {
  animation: section-flash 1.2s ease forwards;
}
@keyframes section-flash {
  0%   { outline: 0.125rem solid rgba(153, 204, 255, 0); }
  20%  { outline: 0.125rem solid rgba(153, 204, 255, 0.5); border-radius: 0.75rem; }
  100% { outline: 0.125rem solid rgba(153, 204, 255, 0); }
}

.section-header {
  display:     flex;
  align-items: center;
  gap:         0.75rem;
  margin-bottom: 0.85rem;
}
.section-title {
  font-family:   'Antonio', sans-serif;
  font-size:     1rem;
  color:         rgba(153, 204, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.tutorial-section .section-title {
  color: rgba(255, 180, 0, 0.75); /* LCARS Orange/Gold */
}

.skip-button {
  margin-left:   auto;
  background:    rgba(255, 180, 0, 0.1);
  border:        0.0625rem solid rgba(255, 180, 0, 0.3);
  color:         rgba(255, 180, 0, 0.8);
  font-family:   'Antonio', sans-serif;
  font-size:     0.75rem;
  padding:       0.25rem 0.75rem;
  border-radius: 0.375rem;
  cursor:        pointer;
  text-transform: uppercase;
  transition:    all 0.2s ease;
}
.skip-button:hover {
  background:    rgba(255, 180, 0, 0.2);
  border-color:  rgba(255, 180, 0, 0.6);
  color:         #fff;
}

.tutorial-item {
  border-color: rgba(255, 180, 0, 0.13) !important;
}
.tutorial-item:hover {
  border-color: rgba(255, 180, 0, 0.4) !important;
  background:   rgba(50, 35, 0, 0.5) !important;
}
.tutorial-item .lesson-num {
  color: rgba(255, 180, 0, 0.35);
}

.section-count {
  font-family:   'Antonio', sans-serif;
  font-size:     0.75rem;
  color:         rgba(153, 204, 255, 0.4);
  letter-spacing: 0.08em;
}

.lesson-loading,
.lesson-empty {
  color:     rgba(153, 204, 255, 0.4);
  font-size: 0.9rem;
  padding:   1rem 0;
}

/* ── Lesson list ─────────────────────────────────────────────────────────── */
.lesson-list {
  display: grid;
  flex-direction: column;
  gap: 1.5rem;
  grid-template-columns: repeat(4, 1fr);
}

.lesson-item {
  display:      flex;
  align-items:  center;
  gap:          1rem;
  padding:      0.85rem 1.1rem;
  background:   rgba(51, 122, 191, 0.3);
  border:       0.0625rem solid rgba(153, 204, 255, 0.13);
  border-radius: 0.625rem;
  cursor:        pointer;
  transition:    border-color 0.2s ease, background 0.2s ease, transform 0.15s ease;
  backdrop-filter: blur(6px) saturate(160%);
}
.lesson-item:hover {
  border-color: rgba(153, 204, 255, 0.4);
  background:   rgba(0, 20, 50, 0.5);
  transform:    translateX(0.2rem);
}

.lesson-num {
  font-family:   'Antonio', monospace, sans-serif;
  font-size:     1rem;
  color:         rgba(153, 204, 255, 1);
  min-height:    1.75rem;
  min-width:     1.75rem;
  text-align:    center;
  background:    rgba(150, 150, 150, 0.35);
  border-radius: 100%;
  border: 1px solid #FFFFFF;
}

.lesson-body {
  flex: 1;
}
.lesson-name {
  font-family:   'Antonio', sans-serif;
  font-size:     0.9rem;
  font-weight: 900;
  color:         #e8f0ff;
  letter-spacing: 0.1rem;
}
.lesson-sub {
  margin-top: 0.15rem;
}
.lesson-keys {
  font-family:   'Antonio', monospace, sans-serif;
  font-size:     0.75rem;
  color:         rgba(255, 210, 60, 0.65);
  letter-spacing: 0.05em;
}

.lesson-arrow {
  font-size:  1.4rem;
  color:      rgba(153, 204, 255, 0.35);
  transition: color 0.2s, transform 0.2s;
}
.lesson-item:hover .lesson-arrow {
  color:     rgba(153, 204, 255, 0.8);
  transform: translateX(0.2rem);
}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 44rem) {
  .mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
