<template>
  <div class="typing-hub" :class="{ show: isVisible }">

    <div class="lcars-text-bar"><span>CompuTrek Typing Lab</span></div>
    <p class="subheader">
      Develop your typing speed and accuracy through structured drills, timed speed tests,
      and targeted weakness training. Every session is logged to your cadet record.
    </p>

    <!-- ── Page header row ──────────────────────────────────────────────────── -->
    <div class="page-header-row">
      <button class="speed-test-btn" @click="router.push('/typing/speed-test')">
        <span class="speed-test-icon">⚡</span>
        <span class="speed-test-label">Speed Test</span>
        <span class="speed-test-arrow">›</span>
      </button>
    </div>

    <!-- ── Tab bar ────────────────────────────────────────────────────────────── -->
    <div class="tab-bar">
      <button
        class="tab"
        :class="{ active: activeTab === 'lessons' }"
        @click="activeTab = 'lessons'"
      >
        <span class="tab-icon">📋</span> Lessons
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'custom', empty: !ctLoading && customTexts.length === 0 }"
        :disabled="!ctLoading && customTexts.length === 0"
        @click="customTexts.length ? activeTab = 'custom' : null"
      >
        <span class="tab-icon">✍️</span> Custom Text
        <span v-if="!ctLoading && customTexts.length === 0" class="tab-empty-hint">None posted</span>
      </button>
      <button class="tab" disabled>
        <span class="tab-icon">🎯</span> Weakness Drill
        <span class="tab-phase-badge">Phase 3</span>
      </button>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- LESSONS TAB                                                           -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'lessons'" class="tab-panel">

    <!-- ── Tutorial section ──────────────────────────────────────────────────── -->
    <div v-if="tutorialLessons.length" ref="tutorialListRef" class="lesson-section tutorial-section">
      <div class="section-header">
        <span class="section-title">Typing Tutorial (Warmup)</span>
        <span class="section-count">{{ tutorialLessons.length }} lessons</span>
        <button class="skip-button" @click="lessonListRef?.scrollIntoView({ behavior: 'smooth', block: 'start' })">Skip Tutorial</button>
      </div>

      <div class="lesson-list">
        <div
          v-for="(lesson, index) in tutorialLessons"
          :key="lesson.id"
          class="lesson-item tutorial-item"
          :class="{ 'lesson-locked': !unlockedIds.has(lesson.id) }"
          @click="unlockedIds.has(lesson.id) ? router.push(`/typing/lesson/${lesson.id}`) : null"
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
          <div class="lesson-arrow">{{ unlockedIds.has(lesson.id) ? (progressLoading ? '…' : (hasPassedLesson(lesson) ? '✓' : '›')) : '🔒' }}</div>
        </div>
      </div>
    </div>

    <!-- ── Test 1 checkpoint ──────────────────────────────────────────────────── -->
    <div v-if="test1Lesson" class="test-checkpoint">
      <div class="checkpoint-header">
        <span class="checkpoint-label">🎯 Section Checkpoint</span>
        <span class="checkpoint-title">{{ test1Lesson.title }}</span>
        <span v-if="hasPassedLesson(test1Lesson)" class="checkpoint-passed-badge">✓ Passed</span>
        <span v-else-if="isTestOpen(test1Lesson.id)" class="test-open-badge">🟢 Open Now</span>
        <span v-else class="test-locked-badge">🔒 Class Only</span>
      </div>
      <p class="checkpoint-desc">Complete during class to unlock Standard Lessons.</p>
      <div
        class="lesson-item test-item checkpoint-item"
        :class="{
          'test-locked':  !unlockedIds.has(test1Lesson.id) || (!isTestOpen(test1Lesson.id) && !hasPassedLesson(test1Lesson)),
          'test-passed':  hasPassedLesson(test1Lesson),
        }"
        @click="canTakeTest(test1Lesson) ? router.push(`/typing/lesson/${test1Lesson.id}`) : null"
      >
        <div class="lesson-num test-num">{{ hasPassedLesson(test1Lesson) ? '✓' : '1' }}</div>
        <div class="lesson-body">
          <div class="lesson-name">{{ test1Lesson.title }}</div>
          <div class="lesson-sub">
            <span class="lesson-keys">{{ testStatusLabel(test1Lesson) }}</span>
          </div>
        </div>
        <div class="lesson-arrow">{{ canTakeTest(test1Lesson) ? '›' : (hasPassedLesson(test1Lesson) ? '✓' : '🔒') }}</div>
      </div>
    </div>

    <!-- ── Standard Lessons section ────────────────────────────────────────── -->
    <div ref="lessonListRef" class="lesson-section">
      <div class="section-header">
        <span class="section-title">Standard Lessons</span>
        <span v-if="standardLessons.length" class="section-count">{{ standardLessons.length }} lessons</span>
        <span v-if="test1Lesson && !hasPassedLesson(test1Lesson)" class="section-gate-badge">🔒 Pass Test 1 to unlock</span>
      </div>

      <div v-if="isLoading" class="lesson-loading">Loading lessons…</div>

      <div v-else-if="standardLessons.length === 0" class="lesson-empty">
        No lessons available yet. Check back soon.
      </div>

      <div v-else class="lesson-list">
        <div
          v-for="(lesson, index) in standardLessons"
          :key="lesson.id"
          class="lesson-item"
          :class="{ 'lesson-locked': !unlockedIds.has(lesson.id) }"
          @click="unlockedIds.has(lesson.id) ? router.push(`/typing/lesson/${lesson.id}`) : null"
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
          <div class="lesson-arrow">{{ unlockedIds.has(lesson.id) ? (hasPassedLesson(lesson) ? '✓' : '›') : '🔒' }}</div>
        </div>
      </div>
    </div>

    <!-- ── Test 2 checkpoint ──────────────────────────────────────────────────── -->
    <div v-if="test2Lesson" class="test-checkpoint">
      <div class="checkpoint-header">
        <span class="checkpoint-label">🎯 Section Checkpoint</span>
        <span class="checkpoint-title">{{ test2Lesson.title }}</span>
        <span v-if="hasPassedLesson(test2Lesson)" class="checkpoint-passed-badge">✓ Passed</span>
        <span v-else-if="isTestOpen(test2Lesson.id)" class="test-open-badge">🟢 Open Now</span>
        <span v-else class="test-locked-badge">🔒 Class Only</span>
      </div>
      <p class="checkpoint-desc">Complete during class to unlock Starfleet Academy Missions.</p>
      <div
        class="lesson-item test-item checkpoint-item"
        :class="{
          'test-locked':  !unlockedIds.has(test2Lesson.id) || (!isTestOpen(test2Lesson.id) && !hasPassedLesson(test2Lesson)),
          'test-passed':  hasPassedLesson(test2Lesson),
        }"
        @click="canTakeTest(test2Lesson) ? router.push(`/typing/lesson/${test2Lesson.id}`) : null"
      >
        <div class="lesson-num test-num">{{ hasPassedLesson(test2Lesson) ? '✓' : '2' }}</div>
        <div class="lesson-body">
          <div class="lesson-name">{{ test2Lesson.title }}</div>
          <div class="lesson-sub">
            <span class="lesson-keys">{{ testStatusLabel(test2Lesson) }}</span>
          </div>
        </div>
        <div class="lesson-arrow">{{ canTakeTest(test2Lesson) ? '›' : (hasPassedLesson(test2Lesson) ? '✓' : '🔒') }}</div>
      </div>
    </div>

    <!-- ── Star Trek Missions section ───────────────────────────────────────── -->
    <div ref="starTrekListRef" class="lesson-section star-trek-section">
      <div class="section-header">
        <span class="section-title">Starfleet Academy Missions</span>
        <span v-if="starTrekLessons.length" class="section-count">{{ starTrekLessons.length }} missions</span>
        <span v-if="test2Lesson && !hasPassedLesson(test2Lesson)" class="section-gate-badge">🔒 Pass Test 2 to unlock</span>
      </div>

      <div v-if="isLoading" class="lesson-loading">Loading missions…</div>

      <div v-else-if="starTrekLessons.length === 0" class="lesson-empty">
        No missions available yet. Check back soon.
      </div>

      <div v-else class="lesson-list">
        <div
          v-for="(lesson, index) in starTrekLessons"
          :key="lesson.id"
          class="lesson-item star-trek-item"
          :class="{ 'lesson-locked': !unlockedIds.has(lesson.id) }"
          @click="unlockedIds.has(lesson.id) ? router.push(`/typing/lesson/${lesson.id}`) : null"
        >
          <div class="lesson-num">{{ index + 1 }}</div>
          <div class="lesson-body">
            <div class="lesson-name">{{ lesson.title }}</div>
            <div class="lesson-sub">
              <span class="lesson-keys">Full keyboard · {{ lesson.targetWpm }}+ WPM</span>
            </div>
          </div>
          <div class="lesson-arrow">{{ unlockedIds.has(lesson.id) ? (hasPassedLesson(lesson) ? '✓' : '›') : '🔒' }}</div>
        </div>
      </div>
    </div>

    <!-- ── Test 3 checkpoint (Final Exam) ──────────────────────────────────── -->
    <div v-if="test3Lesson" class="test-checkpoint test-final">
      <div class="checkpoint-header">
        <span class="checkpoint-label">🏆 Final Exam</span>
        <span class="checkpoint-title">{{ test3Lesson.title }}</span>
        <span v-if="hasPassedLesson(test3Lesson)" class="checkpoint-passed-badge">✓ Passed</span>
        <span v-else-if="isTestOpen(test3Lesson.id)" class="test-open-badge">🟢 Open Now</span>
        <span v-else class="test-locked-badge">🔒 Class Only</span>
      </div>
      <p class="checkpoint-desc">The final typing exam. Complete during class to earn your Starfleet certification.</p>
      <div
        class="lesson-item test-item checkpoint-item"
        :class="{
          'test-locked':  !unlockedIds.has(test3Lesson.id) || (!isTestOpen(test3Lesson.id) && !hasPassedLesson(test3Lesson)),
          'test-passed':  hasPassedLesson(test3Lesson),
        }"
        @click="canTakeTest(test3Lesson) ? router.push(`/typing/lesson/${test3Lesson.id}`) : null"
      >
        <div class="lesson-num test-num">{{ hasPassedLesson(test3Lesson) ? '✓' : '★' }}</div>
        <div class="lesson-body">
          <div class="lesson-name">{{ test3Lesson.title }}</div>
          <div class="lesson-sub">
            <span class="lesson-keys">{{ testStatusLabel(test3Lesson) }}</span>
          </div>
        </div>
        <div class="lesson-arrow">{{ canTakeTest(test3Lesson) ? '›' : (hasPassedLesson(test3Lesson) ? '✓' : '🔒') }}</div>
      </div>
    </div>

    </div><!-- end lessons tab panel -->

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- CUSTOM TEXT TAB                                                       -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'custom'" class="tab-panel">
      <div class="lesson-section">
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
    </div><!-- end custom tab panel -->

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTypingContent }      from '@/composables/useTypingContent'
import { useTypingCustomText }   from '@/composables/useTypingCustomText'
import { useTestSessions }       from '@/composables/useTestSessions'
import { useStudentProgress }    from '@/composables/useStudentProgress'
import { useAuth }               from '@/composables/useAuth.js'
import type { TypingLesson }     from '@/composables/useTypingContent'

const router          = useRouter()
const isVisible       = ref(false)
const activeTab       = ref<'lessons' | 'custom'>('lessons')
const tutorialListRef = ref<HTMLElement | null>(null)
const lessonListRef   = ref<HTMLElement | null>(null)
const starTrekListRef = ref<HTMLElement | null>(null)

const { lessons, isLoading, fetchLessons }                            = useTypingContent()
const { texts: customTexts, isLoading: ctLoading, fetchTexts }        = useTypingCustomText()
const { activeSession, watchTestSession, stopWatching }               = useTestSessions()
const { userInfo }                                                     = useAuth()
const { isLoading: progressLoading, fetchProgress, hasPassedLesson,
        computeUnlocked }                                             = useStudentProgress()

// ── Lesson groupings ───────────────────────────────────────────────────────────
const tutorialLessons = computed(() =>
  lessons.value.filter(l => l.lessonType === 'tutorial').sort((a, b) => a.order - b.order)
)
// Standard lessons = row drills + mastery (orders 21–28)
const standardLessons = computed(() =>
  lessons.value.filter(l => l.lessonType === 'lesson' && l.order < 50).sort((a, b) => a.order - b.order)
)
// Star Trek lessons = full-keyboard themed passages (orders 51–70)
const starTrekLessons = computed(() =>
  lessons.value.filter(l => l.lessonType === 'lesson' && l.order >= 50).sort((a, b) => a.order - b.order)
)
const testLessons = computed(() =>
  lessons.value.filter(l => l.lessonType === 'test').sort((a, b) => a.order - b.order)
)

// Inline test checkpoints
const test1Lesson = computed(() => testLessons.value.find(l => l.id === 'test-1') ?? null)
const test2Lesson = computed(() => testLessons.value.find(l => l.id === 'test-2') ?? null)
const test3Lesson = computed(() => testLessons.value.find(l => l.id === 'test-3') ?? null)

// ── Unlock chain ──────────────────────────────────────────────────────────────
/** All lessons sorted by order for the sequential unlock chain. */
const allSorted = computed(() =>
  [...lessons.value].sort((a, b) => a.order - b.order)
)

/** Set of lesson IDs the student may currently access. */
const unlockedIds = computed(() => computeUnlocked(allSorted.value))

// ── Test gate logic ───────────────────────────────────────────────────────────

/** True if the teacher has opened this specific test for the student's period. */
const isTestOpen = (lessonId: string): boolean => {
  if (!activeSession.value) return false
  return activeSession.value.lessonId === lessonId
}

/**
 * A student can take a test if:
 *   1. The sequential chain has unlocked it (all prior lessons passed), AND
 *   2. Either it's already been passed (review) OR the teacher has opened the session.
 */
const canTakeTest = (lesson: TypingLesson): boolean => {
  if (!unlockedIds.value.has(lesson.id)) return false
  return hasPassedLesson(lesson) || isTestOpen(lesson.id)
}

/** Human-readable status line shown under a test in the checkpoint card. */
const testStatusLabel = (lesson: TypingLesson): string => {
  if (!unlockedIds.value.has(lesson.id)) return 'Complete all previous lessons first'
  if (hasPassedLesson(lesson))           return 'Passed — click to review'
  if (isTestOpen(lesson.id))             return 'Open now — click to begin'
  return 'Available during class only'
}

// ── Tab switching ─────────────────────────────────────────────────────────────

/** Switch to the custom tab only if content exists */
const goToCustomTab = () => {
  if (!ctLoading.value && customTexts.value.length > 0) activeTab.value = 'custom'
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  requestAnimationFrame(() => { isVisible.value = true })
  await Promise.all([fetchLessons(), fetchTexts(), fetchProgress()])
  const periodId = userInfo.value?.periodId
  if (periodId) watchTestSession(periodId)
})

onUnmounted(() => {
  stopWatching()
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

/* ── Page header row ────────────────────────────────────────────────────── */
.page-header-row {
  display:         flex;
  justify-content: flex-end;
  margin-bottom:   0.25rem;
}

/* ── Speed Test launch button ───────────────────────────────────────────── */
.speed-test-btn {
  display:       flex;
  align-items:   center;
  gap:           0.5rem;
  padding:       0.5rem 1rem 0.5rem 0.75rem;
  background:    rgba(255, 220, 0, 0.08);
  border:        0.0625rem solid rgba(255, 220, 0, 0.3);
  border-radius: 0.5rem;
  cursor:        pointer;
  transition:    background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
}
.speed-test-btn:hover {
  background:    rgba(255, 220, 0, 0.16);
  border-color:  rgba(255, 220, 0, 0.65);
  transform:     translateY(-0.0625rem);
}
.speed-test-icon {
  font-size: 1.1rem;
}
.speed-test-label {
  font-family:    'Antonio', sans-serif;
  font-size:      0.85rem;
  letter-spacing: 0.06em;
  color:          rgba(255, 220, 0, 0.85);
  text-transform: uppercase;
}
.speed-test-arrow {
  font-size: 1.1rem;
  color:     rgba(255, 220, 0, 0.5);
  margin-left: 0.1rem;
}

/* ── Tab bar ────────────────────────────────────────────────────────────── */
.tab-bar {
  display:       flex;
  gap:           0.25rem;
  border-bottom: 0.0625rem solid rgba(153, 204, 255, 0.15);
  margin-bottom: 0;
  padding-bottom: 0;
}

.tab {
  display:        flex;
  align-items:    center;
  gap:            0.4rem;
  padding:        0.55rem 1.1rem;
  background:     transparent;
  border:         none;
  border-bottom:  0.1875rem solid transparent;
  color:          rgba(153, 204, 255, 0.5);
  font-family:    'Antonio', sans-serif;
  font-size:      0.875rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  cursor:         pointer;
  transition:     color 0.2s ease, border-color 0.2s ease;
  position:       relative;
  bottom:         -0.0625rem;  /* sit on top of the border-bottom */
}

.tab:not([disabled]):hover {
  color: rgba(153, 204, 255, 0.8);
}

.tab.active {
  color:        rgba(153, 204, 255, 1);
  border-bottom-color: rgba(153, 204, 255, 0.8);
}

.tab[disabled] {
  cursor: default;
}

.tab.empty {
  color: rgba(153, 204, 255, 0.25);
}

.tab-icon {
  font-size: 0.9rem;
}

.tab-empty-hint {
  font-size:      0.65rem;
  letter-spacing: 0.04em;
  color:          rgba(153, 204, 255, 0.3);
  margin-left:    0.2rem;
  text-transform: none;
  font-family:    'Roboto', sans-serif;
}

.tab-phase-badge {
  font-size:      0.6rem;
  letter-spacing: 0.06em;
  color:          rgba(153, 204, 255, 0.3);
  background:     rgba(153, 204, 255, 0.06);
  border:         0.0625rem solid rgba(153, 204, 255, 0.15);
  border-radius:  62.4375rem;
  padding:        0.1rem 0.4rem;
  margin-left:    0.2rem;
}

/* ── Tab panel ──────────────────────────────────────────────────────────── */
.tab-panel {
  padding-top: 0.5rem;
}

/* ── Lesson section ──────────────────────────────────────────────────────── */
.lesson-section {
  margin-top: 2rem;
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

.star-trek-section .section-title {
  color: rgba(100, 180, 255, 0.8); /* Starfleet blue */
}

.star-trek-item {
  border-color: rgba(100, 160, 255, 0.13) !important;
}
.star-trek-item:hover {
  border-color: rgba(100, 160, 255, 0.4) !important;
  background:   rgba(0, 20, 60, 0.5) !important;
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

/* ── Locked lesson state ─────────────────────────────────────────────────── */
.lesson-item.lesson-locked {
  cursor:  default;
  opacity: 0.45;
}
.lesson-item.lesson-locked:hover {
  transform:    none;
  border-color: inherit;
  background:   rgba(51, 122, 191, 0.3);
}

/* ── Test checkpoint cards ───────────────────────────────────────────────── */
.test-checkpoint {
  margin-top:    1.75rem;
  padding:       1rem 1.25rem;
  background:    rgba(255, 90, 90, 0.04);
  border:        0.0625rem solid rgba(255, 100, 100, 0.2);
  border-radius: 0.75rem;
}

.test-final {
  background: rgba(255, 200, 0, 0.04);
  border-color: rgba(255, 200, 0, 0.25);
}

.checkpoint-header {
  display:     flex;
  align-items: center;
  gap:         0.75rem;
  margin-bottom: 0.35rem;
}

.checkpoint-label {
  font-family:    'Antonio', sans-serif;
  font-size:      0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color:          rgba(255, 100, 100, 0.6);
}

.test-final .checkpoint-label {
  color: rgba(255, 200, 0, 0.65);
}

.checkpoint-title {
  font-family:   'Antonio', sans-serif;
  font-size:     0.9rem;
  color:         #e8f0ff;
  letter-spacing: 0.05em;
}

.checkpoint-desc {
  font-size:     0.8rem;
  color:         rgba(153, 204, 255, 0.4);
  margin-bottom: 0.75rem;
  margin-top:    0;
}

.checkpoint-passed-badge {
  font-family:   'Antonio', sans-serif;
  font-size:     0.72rem;
  letter-spacing: 0.08em;
  color:         rgba(100, 220, 140, 0.9);
  background:    rgba(100, 220, 140, 0.1);
  border:        0.0625rem solid rgba(100, 220, 140, 0.35);
  border-radius: 62.4375rem;
  padding:       0.15rem 0.6rem;
}

.checkpoint-item {
  max-width: 32rem;
}

/* ── Test item states ────────────────────────────────────────────────────── */
.section-desc {
  font-size:     0.85rem;
  color:         rgba(153, 204, 255, 0.45);
  margin-bottom: 0.85rem;
  margin-top:    -0.4rem;
}

.test-open-badge {
  font-family:   'Antonio', sans-serif;
  font-size:     0.72rem;
  letter-spacing: 0.08em;
  color:         rgba(100, 220, 140, 0.9);
  background:    rgba(100, 220, 140, 0.1);
  border:        0.0625rem solid rgba(100, 220, 140, 0.35);
  border-radius: 62.4375rem;
  padding:       0.15rem 0.6rem;
}

.test-locked-badge {
  font-family:   'Antonio', sans-serif;
  font-size:     0.72rem;
  letter-spacing: 0.08em;
  color:         rgba(255, 160, 0, 0.7);
  background:    rgba(255, 160, 0, 0.08);
  border:        0.0625rem solid rgba(255, 160, 0, 0.25);
  border-radius: 62.4375rem;
  padding:       0.15rem 0.6rem;
}

.section-gate-badge {
  margin-left:   auto;
  font-family:   'Antonio', sans-serif;
  font-size:     0.7rem;
  letter-spacing: 0.08em;
  color:         rgba(255, 160, 0, 0.65);
  background:    rgba(255, 160, 0, 0.07);
  border:        0.0625rem solid rgba(255, 160, 0, 0.2);
  border-radius: 62.4375rem;
  padding:       0.15rem 0.65rem;
}

.test-item {
  border-color: rgba(255, 100, 100, 0.15) !important;
}
.test-item:not(.test-locked):not(.lesson-locked):hover {
  border-color: rgba(255, 100, 100, 0.45) !important;
  background:   rgba(50, 0, 0, 0.5) !important;
}

.test-item.test-locked,
.test-item.lesson-locked {
  cursor:  default;
  opacity: 0.45;
}
.test-item.test-locked:hover,
.test-item.lesson-locked:hover {
  transform: none;
}

.test-item.test-passed {
  border-color: rgba(100, 220, 140, 0.2) !important;
  background:   rgba(0, 40, 20, 0.35) !important;
}

.test-num {
  color: rgba(255, 100, 100, 1) !important;
}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 44rem) {
  .mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
