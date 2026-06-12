<template>
  <div class="lesson-admin">
    <div class="lcars-text-bar"><span>Typing Lab — Admin</span></div>

    <!-- Section switcher -->
    <div class="section-bar">
      <button
        class="section-btn"
        :class="{ active: section === 'lessons' }"
        @click="section = 'lessons'; tab = 'lessons'"
      >Structured Lessons</button>
      <button
        class="section-btn"
        :class="{ active: section === 'custom' }"
        @click="section = 'custom'; ctTab = 'list'"
      >Custom Texts</button>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════
         STRUCTURED LESSONS SECTION
         ════════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'lessons'">

    <!-- Tabs -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: tab === 'lessons' }"
        @click="tab = 'lessons'"
      >Lessons</button>
      <button
        class="tab-btn"
        :class="{ active: tab === 'create' }"
        @click="openCreate"
      >+ New Lesson</button>
    </div>

    <!-- ── Lessons tab ──────────────────────────────────────────────────── -->
    <div v-if="tab === 'lessons'" class="tab-content">


      <!-- Error message -->
      <p v-if="error" class="error-msg">{{ error }}</p>

      <!-- Lesson list -->
      <div v-if="isLoading" class="loading-msg">Loading lessons…</div>
      <template v-else>

        <!-- ── Foundations section ────────────────────────────────────────── -->
        <div v-if="foundationLessons.length" class="admin-lesson-section">
          <div class="admin-section-header">
            <span class="admin-section-title">Foundations</span>
            <span class="admin-section-count">{{ foundationLessons.length }} lessons</span>
          </div>
          <div class="lesson-list">
            <div
              v-for="(lesson, index) in foundationLessons"
              :key="lesson.id"
              class="lesson-row tutorial-row"
              :class="{ archived: lesson.archived }"
            >
              <div class="order-num">#{{ index + 1 }}</div>
              <div class="lesson-info" @click="openEdit(lesson)">
                <div class="lesson-name">
                  {{ lesson.title }}
                </div>
                <div class="lesson-meta">
                  <span v-if="lesson.focusKeys.length" class="meta-keys">
                    Keys: {{ lesson.focusKeys.map(k => k.toUpperCase()).join(' · ') }}
                  </span>
                  <span v-else class="meta-keys">Full keyboard</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-chars">{{ lesson.passage.length }} chars</span>
                  <span v-if="lesson.archived" class="meta-archived">archived</span>
                </div>
              </div>
              <div class="row-actions">
                <button class="action-btn edit-btn" @click="openEdit(lesson)">Edit</button>
                <button class="action-btn archive-btn" @click="toggleArchive(lesson)">
                  {{ lesson.archived ? 'Restore' : 'Archive' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Checkpoint: after Tutorial section ────────────────────────── -->
        <div v-if="test1Lesson" class="test-checkpoint">
          <div class="checkpoint-header">
            <span class="checkpoint-label">Checkpoint</span>
            <span class="checkpoint-title">{{ test1Lesson.title }}</span>
            <span class="checkpoint-meta">{{ test1Lesson.passage.length }} chars · Graded</span>
          </div>
          <div
            class="lesson-row test-row"
            :class="{ archived: test1Lesson.archived }"
          >
            <div class="order-num test-order-icon">🎯</div>
            <div class="lesson-info" @click="openEdit(test1Lesson)">
              <div class="lesson-name">
                {{ test1Lesson.title }}
                <span class="test-badge">Test</span>
              </div>
              <div class="lesson-meta">
                <span class="meta-chars">{{ test1Lesson.passage.length }} chars</span>
                <span class="meta-sep">·</span>
                <span class="meta-target">Graded 50/50 WPM + Accuracy</span>
                <span v-if="test1Lesson.archived" class="meta-archived">archived</span>
              </div>
            </div>
            <div class="row-actions">
              <template v-for="p in myPeriodIds" :key="p">
                <button
                  v-if="testSessionStates[test1Lesson.id] === p"
                  class="action-btn close-test-btn"
                  :disabled="testSessionLoading[test1Lesson.id]"
                  @click="handleCloseTest(test1Lesson.id, p)"
                >{{ testSessionLoading[test1Lesson.id] ? '…' : `Close ${p.replace('period-', 'P')}` }}</button>
                <button
                  v-else-if="!testSessionStates[test1Lesson.id]"
                  class="action-btn open-test-btn"
                  :disabled="testSessionLoading[test1Lesson.id]"
                  @click="handleOpenTest(test1Lesson.id, p)"
                >{{ testSessionLoading[test1Lesson.id] ? '…' : `Open ${p.replace('period-', 'P')}` }}</button>
              </template>
              <button class="action-btn edit-btn" @click="openEdit(test1Lesson)">Edit</button>
              <button class="action-btn archive-btn" @click="toggleArchive(test1Lesson)">
                {{ test1Lesson.archived ? 'Restore' : 'Archive' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Core Skills section ────────────────────────────────────────── -->
        <div v-if="coreSkillLessons.length" class="admin-lesson-section">
          <div class="admin-section-header">
            <span class="admin-section-title">Core Skills</span>
            <span class="admin-section-count">{{ coreSkillLessons.length }} lessons</span>
          </div>
          <div class="lesson-list">
            <div
              v-for="(lesson, index) in coreSkillLessons"
              :key="lesson.id"
              class="lesson-row"
              :class="{ archived: lesson.archived }"
            >
              <div class="order-num">#{{ index + 1 }}</div>
              <div class="lesson-info" @click="openEdit(lesson)">
                <div class="lesson-name">{{ lesson.title }}</div>
                <div class="lesson-meta">
                  <span v-if="lesson.focusKeys.length" class="meta-keys">
                    Keys: {{ lesson.focusKeys.map(k => k.toUpperCase()).join(' · ') }}
                  </span>
                  <span v-else class="meta-keys">Full keyboard</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-chars">{{ lesson.passage.length }} chars</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-target">Min: {{ lesson.minWpm }} WPM / Goal: {{ lesson.goalWpm }} WPM / {{ lesson.targetAccuracy }}%+</span>
                  <span v-if="lesson.archived" class="meta-archived">archived</span>
                </div>
              </div>
              <div class="row-actions">
                <button class="action-btn edit-btn" @click="openEdit(lesson)">Edit</button>
                <button class="action-btn archive-btn" @click="toggleArchive(lesson)">
                  {{ lesson.archived ? 'Restore' : 'Archive' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Checkpoint: after Mastery section ─────────────────────────── -->
        <div v-if="test2Lesson" class="test-checkpoint">
          <div class="checkpoint-header">
            <span class="checkpoint-label">Checkpoint</span>
            <span class="checkpoint-title">{{ test2Lesson.title }}</span>
            <span class="checkpoint-meta">{{ test2Lesson.passage.length }} chars · Graded</span>
          </div>
          <div
            class="lesson-row test-row"
            :class="{ archived: test2Lesson.archived }"
          >
            <div class="order-num test-order-icon">🎯</div>
            <div class="lesson-info" @click="openEdit(test2Lesson)">
              <div class="lesson-name">
                {{ test2Lesson.title }}
                <span class="test-badge">Test</span>
              </div>
              <div class="lesson-meta">
                <span class="meta-chars">{{ test2Lesson.passage.length }} chars</span>
                <span class="meta-sep">·</span>
                <span class="meta-target">Graded 50/50 WPM + Accuracy</span>
                <span v-if="test2Lesson.archived" class="meta-archived">archived</span>
              </div>
            </div>
            <div class="row-actions">
              <template v-for="p in myPeriodIds" :key="p">
                <button
                  v-if="testSessionStates[test2Lesson.id] === p"
                  class="action-btn close-test-btn"
                  :disabled="testSessionLoading[test2Lesson.id]"
                  @click="handleCloseTest(test2Lesson.id, p)"
                >{{ testSessionLoading[test2Lesson.id] ? '…' : `Close ${p.replace('period-', 'P')}` }}</button>
                <button
                  v-else-if="!testSessionStates[test2Lesson.id]"
                  class="action-btn open-test-btn"
                  :disabled="testSessionLoading[test2Lesson.id]"
                  @click="handleOpenTest(test2Lesson.id, p)"
                >{{ testSessionLoading[test2Lesson.id] ? '…' : `Open ${p.replace('period-', 'P')}` }}</button>
              </template>
              <button class="action-btn edit-btn" @click="openEdit(test2Lesson)">Edit</button>
              <button class="action-btn archive-btn" @click="toggleArchive(test2Lesson)">
                {{ test2Lesson.archived ? 'Restore' : 'Archive' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Advanced Missions section ──────────────────────────────────── -->
        <div v-if="advancedLessons.length" class="admin-lesson-section">
          <div class="admin-section-header">
            <span class="admin-section-title">Advanced Missions</span>
            <span class="admin-section-count">{{ advancedLessons.length }} missions</span>
          </div>
          <div class="lesson-list">
            <div
              v-for="(lesson, index) in advancedLessons"
              :key="lesson.id"
              class="lesson-row"
              :class="{ archived: lesson.archived }"
            >
              <div class="order-num">#{{ index + 1 }}</div>
              <div class="lesson-info" @click="openEdit(lesson)">
                <div class="lesson-name">{{ lesson.title }}</div>
                <div class="lesson-meta">
                  <span v-if="lesson.focusKeys.length" class="meta-keys">
                    Keys: {{ lesson.focusKeys.map(k => k.toUpperCase()).join(' · ') }}
                  </span>
                  <span v-else class="meta-keys">Full keyboard</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-chars">{{ lesson.passage.length }} chars</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-target">Min: {{ lesson.minWpm }} WPM / Goal: {{ lesson.goalWpm }} WPM / {{ lesson.targetAccuracy }}%+</span>
                  <span v-if="lesson.archived" class="meta-archived">archived</span>
                </div>
              </div>
              <div class="row-actions">
                <button class="action-btn edit-btn" @click="openEdit(lesson)">Edit</button>
                <button class="action-btn archive-btn" @click="toggleArchive(lesson)">
                  {{ lesson.archived ? 'Restore' : 'Archive' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Expert Skills section ──────────────────────────────────────── -->
        <div v-if="expertLessons.length" class="admin-lesson-section">
          <div class="admin-section-header">
            <span class="admin-section-title expert-section-title">Expert Skills</span>
            <span class="admin-section-count">{{ expertLessons.length }} lessons</span>
          </div>
          <div class="lesson-list">
            <div
              v-for="(lesson, index) in expertLessons"
              :key="lesson.id"
              class="lesson-row"
              :class="{ archived: lesson.archived }"
            >
              <div class="order-num">#{{ index + 1 }}</div>
              <div class="lesson-info" @click="openEdit(lesson)">
                <div class="lesson-name">{{ lesson.title }}</div>
                <div class="lesson-meta">
                  <span v-if="lesson.focusKeys.length" class="meta-keys">
                    Keys: {{ lesson.focusKeys.map(k => k.toUpperCase()).join(' · ') }}
                  </span>
                  <span v-else class="meta-keys">Full keyboard</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-chars">{{ lesson.passage.length }} chars</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-target">Min: {{ lesson.minWpm }} WPM / Goal: {{ lesson.goalWpm }} WPM / {{ lesson.targetAccuracy }}%+</span>
                  <span v-if="lesson.archived" class="meta-archived">archived</span>
                </div>
              </div>
              <div class="row-actions">
                <button class="action-btn edit-btn" @click="openEdit(lesson)">Edit</button>
                <button class="action-btn archive-btn" @click="toggleArchive(lesson)">
                  {{ lesson.archived ? 'Restore' : 'Archive' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Checkpoint: Semester Exam (end of core curriculum) ────────── -->
        <div v-if="test3Lesson" class="test-checkpoint">
          <div class="checkpoint-header">
            <span class="checkpoint-label">Semester Exam</span>
            <span class="checkpoint-title">{{ test3Lesson.title }}</span>
            <span class="checkpoint-meta">{{ test3Lesson.passage.length }} chars · Graded</span>
          </div>
          <div
            class="lesson-row test-row"
            :class="{ archived: test3Lesson.archived }"
          >
            <div class="order-num test-order-icon">🏆</div>
            <div class="lesson-info" @click="openEdit(test3Lesson)">
              <div class="lesson-name">
                {{ test3Lesson.title }}
                <span class="test-badge">Test</span>
              </div>
              <div class="lesson-meta">
                <span class="meta-chars">{{ test3Lesson.passage.length }} chars</span>
                <span class="meta-sep">·</span>
                <span class="meta-target">Graded 50/50 WPM + Accuracy</span>
                <span v-if="test3Lesson.archived" class="meta-archived">archived</span>
              </div>
            </div>
            <div class="row-actions">
              <template v-for="p in myPeriodIds" :key="p">
                <button
                  v-if="testSessionStates[test3Lesson.id] === p"
                  class="action-btn close-test-btn"
                  :disabled="testSessionLoading[test3Lesson.id]"
                  @click="handleCloseTest(test3Lesson.id, p)"
                >{{ testSessionLoading[test3Lesson.id] ? '…' : `Close ${p.replace('period-', 'P')}` }}</button>
                <button
                  v-else-if="!testSessionStates[test3Lesson.id]"
                  class="action-btn open-test-btn"
                  :disabled="testSessionLoading[test3Lesson.id]"
                  @click="handleOpenTest(test3Lesson.id, p)"
                >{{ testSessionLoading[test3Lesson.id] ? '…' : `Open ${p.replace('period-', 'P')}` }}</button>
              </template>
              <button class="action-btn edit-btn" @click="openEdit(test3Lesson)">Edit</button>
              <button class="action-btn archive-btn" @click="toggleArchive(test3Lesson)">
                {{ test3Lesson.archived ? 'Restore' : 'Archive' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ── Other tests (teacher-created, no fixed position) ───────────── -->
        <div v-if="otherTests.length" class="admin-lesson-section">
          <div class="admin-section-header">
            <span class="admin-section-title test-section-title">Additional Tests</span>
            <span class="admin-section-count">{{ otherTests.length }} tests</span>
          </div>
          <div class="lesson-list">
            <div
              v-for="(lesson, index) in otherTests"
              :key="lesson.id"
              class="lesson-row test-row"
              :class="{ archived: lesson.archived }"
            >
              <div class="order-num">#{{ index + 1 }}</div>
              <div class="lesson-info" @click="openEdit(lesson)">
                <div class="lesson-name">
                  {{ lesson.title }}
                  <span class="test-badge">Test</span>
                </div>
                <div class="lesson-meta">
                  <span class="meta-chars">{{ lesson.passage.length }} chars</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-target">Graded 50/50 WPM + Accuracy</span>
                  <span v-if="lesson.archived" class="meta-archived">archived</span>
                </div>
              </div>
              <div class="row-actions">
                <template v-for="p in myPeriodIds" :key="p">
                  <button
                    v-if="testSessionStates[lesson.id] === p"
                    class="action-btn close-test-btn"
                    :disabled="testSessionLoading[lesson.id]"
                    @click="handleCloseTest(lesson.id, p)"
                  >{{ testSessionLoading[lesson.id] ? '…' : `Close ${p.replace('period-', 'P')}` }}</button>
                  <button
                    v-else-if="!testSessionStates[lesson.id]"
                    class="action-btn open-test-btn"
                    :disabled="testSessionLoading[lesson.id]"
                    @click="handleOpenTest(lesson.id, p)"
                  >{{ testSessionLoading[lesson.id] ? '…' : `Open ${p.replace('period-', 'P')}` }}</button>
                </template>
                <button class="action-btn edit-btn" @click="openEdit(lesson)">Edit</button>
                <button class="action-btn archive-btn" @click="toggleArchive(lesson)">
                  {{ lesson.archived ? 'Restore' : 'Archive' }}
                </button>
              </div>
            </div>
          </div>
        </div>

      </template>
    </div>

    <!-- ── Create / Edit tab ─────────────────────────────────────────────── -->
    <div v-if="tab === 'create' || tab === 'edit'" class="tab-content form-panel">
      <div class="form-title">{{ tab === 'edit' ? 'Edit Lesson' : 'New Lesson' }}</div>

      <label class="form-label">
        Title
        <input
          v-model="form.title"
          class="lcars-input"
          placeholder="e.g. Left Home Row"
        />
      </label>

      <label class="form-label">
        Description
        <textarea
          v-model="form.description"
          class="lcars-input lcars-textarea"
          placeholder="Brief instructions for students…"
          rows="3"
        />
      </label>

      <label class="form-label">
        Focus Keys
        <input
          v-model="focusKeysRaw"
          class="lcars-input"
          placeholder="a s d f  (space-separated, leave blank for full keyboard)"
        />
        <span class="input-hint">Space-separated list of keys to highlight on the keyboard.</span>
      </label>

      <!-- Preview keyboard with focus keys -->
      <div v-if="parsedFocusKeys.length" class="form-keyboard-wrap">
        <div class="form-keyboard-label">Key Preview</div>
        <TypingKeyboard :focusKeys="parsedFocusKeys" />
      </div>

      <label class="form-label">
        Passage
        <textarea
          v-model="form.passage"
          class="lcars-input lcars-textarea passage-area"
          placeholder="The text students will type…"
          rows="5"
        />
        <span class="input-hint">{{ form.passage.length }} characters</span>
      </label>

      <label class="form-label">
        Lesson Type
        <select v-model="form.lessonType" class="lcars-input">
          <option value="keys">Keys (two-key intro drill)</option>
          <option value="review">Review (key pair review)</option>
          <option value="practice">Practice (real-word sentences)</option>
          <option value="play">Play (free-form string)</option>
          <option value="drill">Drill (single-hand / finger)</option>
          <option value="lesson">Lesson (general passage)</option>
          <option value="test">Test (graded, class only)</option>
          <option value="placement-test">Placement Test (section assessment)</option>
        </select>
      </label>

      <div v-if="form.lessonType !== 'test' && form.lessonType !== 'placement-test'" class="form-row-2">
        <label class="form-label">
          Goal WPM
          <input
            v-model.number="form.goalWpm"
            type="number"
            min="0"
            class="lcars-input order-input"
          />
          <span class="input-hint">Aspirational target shown to students</span>
        </label>
        <label class="form-label">
          Min WPM
          <input
            v-model.number="form.minWpm"
            type="number"
            min="0"
            class="lcars-input order-input"
          />
          <span class="input-hint">Required to pass (0 = no requirement)</span>
        </label>
      </div>

      <div v-if="form.lessonType !== 'test' && form.lessonType !== 'placement-test'" class="form-row-2">
        <label class="form-label">
          Min Accuracy %
          <input
            v-model.number="form.targetAccuracy"
            type="number"
            min="0"
            max="100"
            class="lcars-input order-input"
          />
          <span class="input-hint">0 = no requirement</span>
        </label>
        <label class="form-label">
          Point Value
          <input
            v-model.number="form.pointValue"
            type="number"
            min="0"
            step="500"
            class="lcars-input order-input"
          />
          <span class="input-hint">Points awarded on completion</span>
        </label>
      </div>

      <label class="form-label">
        Order (0 = first)
        <input
          v-model.number="form.order"
          type="number"
          min="0"
          class="lcars-input order-input"
        />
      </label>

      <p v-if="formError" class="error-msg">{{ formError }}</p>

      <div class="form-actions">
        <button
          class="lcars-btn save-btn"
          :disabled="isSaving"
          @click="submitForm"
        >{{ isSaving ? 'Saving…' : tab === 'edit' ? 'Save Changes' : 'Create Lesson' }}</button>
        <button class="lcars-btn cancel-btn" @click="tab = 'lessons'">Cancel</button>
      </div>
    </div>

    </template> <!-- end lessons section -->

    <!-- ════════════════════════════════════════════════════════════════════
         CUSTOM TEXTS SECTION
         ════════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'custom'">

      <!-- Tabs -->
      <div class="tab-bar">
        <button class="tab-btn" :class="{ active: ctTab === 'list' }"   @click="ctTab = 'list'">Passages</button>
        <button class="tab-btn" :class="{ active: ctTab === 'create' }" @click="openCtCreate">+ New Passage</button>
      </div>

      <!-- ── Passage list ──────────────────────────────────────────────── -->
      <div v-if="ctTab === 'list'" class="tab-content">
        <p v-if="ctError" class="error-msg">{{ ctError }}</p>
        <div v-if="ctLoading" class="loading-msg">Loading passages…</div>
        <div v-else-if="ctTexts.length === 0" class="lesson-empty">
          No custom passages yet. Click "+ New Passage" to write your first one.
        </div>
        <div v-else class="lesson-list">
          <div
            v-for="ct in ctTexts"
            :key="ct.id"
            class="lesson-row"
            :class="{ archived: ct.archived }"
          >
            <div class="lesson-info" @click="openCtEdit(ct)">
              <div class="lesson-name">{{ ct.title }}</div>
              <div class="lesson-meta">
                <span v-if="ct.category" class="meta-keys">{{ ct.category }}</span>
                <span class="meta-sep" v-if="ct.category">·</span>
                <span class="meta-chars">{{ ct.passage.length }} chars</span>
                <span v-if="ct.archived" class="meta-archived">archived</span>
              </div>
            </div>
            <div class="row-actions">
              <button class="action-btn edit-btn"    @click="openCtEdit(ct)">Edit</button>
              <button class="action-btn archive-btn" @click="toggleCtArchive(ct)">
                {{ ct.archived ? 'Restore' : 'Archive' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Create / Edit passage form ───────────────────────────────── -->
      <div v-if="ctTab === 'create' || ctTab === 'edit'" class="tab-content form-panel">
        <div class="form-title">{{ ctTab === 'edit' ? 'Edit Passage' : 'New Passage' }}</div>

        <label class="form-label">
          Title
          <input v-model="ctForm.title" class="lcars-input" placeholder="e.g. The Prime Directive" />
        </label>

        <label class="form-label">
          Category <span class="input-hint" style="text-transform:none; letter-spacing:0">(optional — e.g. Trek Quotes, Vocab, Story)</span>
          <input v-model="ctForm.category" class="lcars-input" placeholder="Trek Quotes" />
        </label>

        <label class="form-label">
          Passage
          <textarea
            v-model="ctForm.passage"
            class="lcars-input lcars-textarea passage-area"
            placeholder="Type or paste the passage here…"
            rows="7"
          />
          <span class="input-hint">{{ ctForm.passage.length }} characters</span>
        </label>

        <p v-if="ctFormError" class="error-msg">{{ ctFormError }}</p>

        <div class="form-actions">
          <button class="lcars-btn save-btn" :disabled="ctSaving" @click="submitCtForm">
            {{ ctSaving ? 'Saving…' : ctTab === 'edit' ? 'Save Changes' : 'Create Passage' }}
          </button>
          <button class="lcars-btn cancel-btn" @click="ctTab = 'list'">Cancel</button>
        </div>
      </div>

    </template> <!-- end custom texts section -->

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTypingContent }      from '@/composables/useTypingContent'
import { useTypingCustomText }   from '@/composables/useTypingCustomText'
import { useTestSessions }       from '@/composables/useTestSessions'
import { useAuth }               from '@/composables/useAuth.js'
import TypingKeyboard            from '@/components/typing/TypingKeyboard.vue'
import type { TypingLesson, TypingLessonType } from '@/composables/useTypingContent'
import type { CustomText }       from '@/composables/useTypingCustomText'

const { lessons, isLoading, error, fetchAllLessons, createLesson, updateLesson } =
  useTypingContent()
const { texts: ctTexts, isLoading: ctLoading, error: ctError,
        fetchAllTexts, createText, updateText, archiveText, restoreText } =
  useTypingCustomText()
const { userInfo } = useAuth()
const { openTestSession, closeTestSession, fetchTestSession } = useTestSessions()

const myPeriodIds     = computed<string[]>(() => userInfo.value?.periodIds ?? [])
// Foundations = full keyboard acquisition (orders 1–84, every lessonType)
const foundationLessons = computed(() =>
  lessons.value.filter(l => l.order < 85).sort((a, b) => a.order - b.order)
)
// Core Skills = real words, capitals, tricky words, patterns (orders 86–242)
const coreSkillLessons = computed(() =>
  lessons.value.filter(l => l.order > 85 && l.order < 243).sort((a, b) => a.order - b.order)
)
// Advanced Missions = numbers, advanced patterns, topical passages (orders 244–317)
const advancedLessons = computed(() =>
  lessons.value.filter(l => l.order > 243 && l.order < 318).sort((a, b) => a.order - b.order)
)
// Expert Skills = punctuation, code symbols, speed passages (orders 319+)
const expertLessons = computed(() =>
  lessons.value.filter(l => l.order > 318).sort((a, b) => a.order - b.order)
)
const testLessons = computed(() =>
  lessons.value.filter(l => l.lessonType === 'test' || l.lessonType === 'placement-test').sort((a, b) => a.order - b.order)
)
// Inline curriculum checkpoints — known IDs placed at their logical positions
const test1Lesson = computed(() => testLessons.value.find(l => l.id === 'test-1') ?? null)
const test2Lesson = computed(() => testLessons.value.find(l => l.id === 'test-2') ?? null)
const test3Lesson = computed(() => testLessons.value.find(l => l.id === 'test-3') ?? null)
// Any teacher-created tests that don't have a fixed position
const otherTests  = computed(() => testLessons.value.filter(l => !['test-1', 'test-2', 'test-3'].includes(l.id)))

// ── Section switcher ──────────────────────────────────────────────────────────

type Section = 'lessons' | 'custom'
const section = ref<Section>('lessons')

// ── Lesson tabs ───────────────────────────────────────────────────────────────

type Tab = 'lessons' | 'create' | 'edit'
const tab = ref<Tab>('lessons')

// ── Form state ────────────────────────────────────────────────────────────────

const defaultForm = () => ({
  title:          '',
  description:    '',
  passage:        '',
  order:          lessons.value.length,
  lessonType:     'lesson' as TypingLessonType,
  goalWpm:        30,
  minWpm:         20,
  targetAccuracy: 80,
  pointValue:     2000,
})

const form         = ref(defaultForm())
const focusKeysRaw = ref('')
const formError    = ref('')
const isSaving     = ref(false)
const editingId    = ref<string | null>(null)

const parsedFocusKeys = computed(() =>
  focusKeysRaw.value
    .split(/\s+/)
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length === 1),
)

const openCreate = () => {
  editingId.value    = null
  form.value         = defaultForm()
  focusKeysRaw.value = ''
  formError.value    = ''
  tab.value          = 'create'
}

const openEdit = (lesson: TypingLesson) => {
  editingId.value    = lesson.id
  form.value         = {
    title:          lesson.title,
    description:    lesson.description,
    passage:        lesson.passage,
    order:          lesson.order,
    lessonType:     lesson.lessonType ?? 'lesson',
    goalWpm:        lesson.goalWpm ?? 30,
    minWpm:         lesson.minWpm ?? 20,
    targetAccuracy: lesson.targetAccuracy ?? 80,
    pointValue:     lesson.pointValue ?? 2000,
  }
  focusKeysRaw.value = lesson.focusKeys.join(' ')
  formError.value    = ''
  tab.value          = 'edit'
}

const submitForm = async () => {
  formError.value = ''
  if (!form.value.title.trim())   { formError.value = 'Title is required.';   return }
  if (!form.value.passage.trim()) { formError.value = 'Passage is required.'; return }

  isSaving.value = true
  const payload = {
    ...form.value,
    focusKeys: parsedFocusKeys.value,
  }

  try {
    if (editingId.value) {
      await updateLesson(editingId.value, payload)
    } else {
      await createLesson({ ...payload, createdBy: userInfo.value?.email ?? '' })
    }
    await fetchAllLessons()
    tab.value = 'lessons'
  } finally {
    isSaving.value = false
  }
}

// ── Archive toggle ────────────────────────────────────────────────────────────

const toggleArchive = async (lesson: TypingLesson) => {
  await updateLesson(lesson.id, { archived: !lesson.archived })
  await fetchAllLessons()
}

// ── Test session management ────────────────────────────────────────────────────
// openTestSessions tracks which periodId currently has a test open, keyed by lessonId
// e.g. { 'test-1': 'period-2' } means test-1 is open for period-2

const testSessionStates  = ref<Record<string, string | null>>({}) // lessonId → openPeriodId | null
const testSessionLoading = ref<Record<string, boolean>>({})

/** Refresh the active session state for a given test lesson */
const refreshTestSession = async (lessonId: string) => {
  // We need to check which period (if any) has this test open.
  // We do this by checking every period the teacher owns.
  const periodIds = userInfo.value?.periodIds ?? []
  for (const periodId of periodIds) {
    const session = await fetchTestSession(periodId)
    if (session && session.lessonId === lessonId) {
      testSessionStates.value = { ...testSessionStates.value, [lessonId]: periodId }
      return
    }
  }
  testSessionStates.value = { ...testSessionStates.value, [lessonId]: null }
}

const handleOpenTest = async (lessonId: string, periodId: string) => {
  testSessionLoading.value = { ...testSessionLoading.value, [lessonId]: true }
  await openTestSession(periodId, lessonId)
  await refreshTestSession(lessonId)
  testSessionLoading.value = { ...testSessionLoading.value, [lessonId]: false }
}

const handleCloseTest = async (lessonId: string, periodId: string) => {
  testSessionLoading.value = { ...testSessionLoading.value, [lessonId]: true }
  await closeTestSession(periodId)
  await refreshTestSession(lessonId)
  testSessionLoading.value = { ...testSessionLoading.value, [lessonId]: false }
}


// ── Custom Text state ─────────────────────────────────────────────────────────

type CtTab = 'list' | 'create' | 'edit'
const ctTab       = ref<CtTab>('list')
const ctEditingId = ref<string | null>(null)
const ctFormError = ref('')
const ctSaving    = ref(false)
const ctForm      = ref({ title: '', category: '', passage: '' })

const openCtCreate = () => {
  ctEditingId.value = null
  ctForm.value      = { title: '', category: '', passage: '' }
  ctFormError.value = ''
  ctTab.value       = 'create'
}

const openCtEdit = (ct: CustomText) => {
  ctEditingId.value = ct.id
  ctForm.value      = { title: ct.title, category: ct.category, passage: ct.passage }
  ctFormError.value = ''
  ctTab.value       = 'edit'
}

const submitCtForm = async () => {
  ctFormError.value = ''
  if (!ctForm.value.title.trim())   { ctFormError.value = 'Title is required.';   return }
  if (!ctForm.value.passage.trim()) { ctFormError.value = 'Passage is required.'; return }

  ctSaving.value = true
  try {
    if (ctEditingId.value) {
      await updateText(ctEditingId.value, { ...ctForm.value })
    } else {
      await createText({ ...ctForm.value, createdBy: userInfo.value?.email ?? '' })
    }
    await fetchAllTexts()
    ctTab.value = 'list'
  } finally {
    ctSaving.value = false
  }
}

const toggleCtArchive = async (ct: CustomText) => {
  if (ct.archived) await restoreText(ct.id)
  else             await archiveText(ct.id)
  await fetchAllTexts()
}

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(async () => {
  await fetchAllLessons()
  fetchAllTexts()
  // Pre-load active test session states for all test lessons
  for (const lesson of testLessons.value) {
    refreshTestSession(lesson.id)
  }
})
</script>

<style scoped>
/* ── Page wrapper ────────────────────────────────────────────────────────── */
.lesson-admin {
  display:         flex;
  flex-direction:  column;
  gap:             1.25rem;
}

/* ── Section switcher ────────────────────────────────────────────────────── */
.section-bar {
  display:     flex;
  gap:         0.25rem;
  background:  rgba(0, 10, 30, 0.5);
  border:      0.0625rem solid rgba(153, 204, 255, 0.12);
  border-radius: 0.625rem;
  padding:     0.25rem;
  width:       fit-content;
}
.section-btn {
  font-family:   'Antonio', sans-serif;
  font-size:     0.85rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  background:    transparent;
  border:        none;
  border-radius: 0.4rem;
  color:         rgba(153, 204, 255, 0.5);
  padding:       0.4rem 1.1rem;
  cursor:        pointer;
  transition:    background 0.2s, color 0.2s;
}
.section-btn:hover  { color: #99ccff; }
.section-btn.active {
  background: rgba(153, 204, 255, 0.15);
  color:      #e8f0ff;
}

/* ── Tab bar ─────────────────────────────────────────────────────────────── */
.tab-bar {
  display:     flex;
  gap:         0.5rem;
  flex-wrap:   wrap;
}

.tab-btn {
  font-family:   'Antonio', sans-serif;
  font-size:     0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background:    rgba(0, 20, 45, 0.6);
  border:        0.0625rem solid rgba(153, 204, 255, 0.2);
  border-radius: 62.4375rem;
  color:         rgba(153, 204, 255, 0.7);
  padding:       0.4rem 1.2rem;
  cursor:        pointer;
  transition:    background 0.2s, color 0.2s, border-color 0.2s;
}
.tab-btn:hover  {
  background:    rgba(0, 40, 80, 0.7);
  border-color:  rgba(153, 204, 255, 0.5);
  color:         #99ccff;
}
.tab-btn.active {
  background:    rgba(153, 204, 255, 0.15);
  border-color:  rgba(153, 204, 255, 0.55);
  color:         #e8f0ff;
}

/* ── Tab content area ────────────────────────────────────────────────────── */
.tab-content {
  display:         flex;
  flex-direction:  column;
  gap:             0.75rem;
}

/* ── Seed banner ─────────────────────────────────────────────────────────── */
.seed-banner {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  gap:             1rem;
  padding:         1.25rem 1.5rem;
  background:      rgba(0, 30, 60, 0.5);
  border:          0.0625rem solid rgba(153, 204, 255, 0.2);
  border-radius:   0.75rem;
  flex-wrap:       wrap;
}
.seed-text {
  margin:    0;
  color:     #99ccff;
  font-size: 0.9rem;
  flex:      1;
}

/* ── Admin lesson sections ───────────────────────────────────────────────── */
.admin-lesson-section {
  display:        flex;
  flex-direction: column;
  gap:            0.5rem;
}

.admin-section-header {
  display:     flex;
  align-items: baseline;
  gap:         0.75rem;
  padding:     0.25rem 0.25rem 0.25rem 0.1rem;
}

.admin-section-title {
  font-family:    'Antonio', sans-serif;
  font-size:      0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color:          rgba(153, 204, 255, 0.6);
}

.admin-lesson-section:first-child .admin-section-title {
  color: rgba(255, 180, 0, 0.75);
}

.admin-section-count {
  font-size: 0.75rem;
  color:     rgba(153, 204, 255, 0.35);
}

.tutorial-row {
  border-color: rgba(255, 180, 0, 0.15) !important;
}
.tutorial-row:hover {
  border-color: rgba(255, 180, 0, 0.4) !important;
}

/* ── Test checkpoints (inline curriculum dividers) ───────────────────── */
.test-checkpoint {
  display:        flex;
  flex-direction: column;
  gap:            0.4rem;
  padding:        0.5rem 0;
  border-left:    0.15rem solid rgba(255, 100, 100, 0.25);
  padding-left:   0.75rem;
  margin-left:    0.1rem;
}

.checkpoint-header {
  display:     flex;
  align-items: baseline;
  gap:         0.6rem;
  padding-bottom: 0.1rem;
}

.checkpoint-label {
  font-family:    'Antonio', sans-serif;
  font-size:      0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color:          rgba(255, 100, 100, 0.6);
  background:     rgba(255, 100, 100, 0.08);
  border:         0.0625rem solid rgba(255, 100, 100, 0.25);
  border-radius:  62.5rem;
  padding:        0.1rem 0.5rem;
}

.checkpoint-title {
  font-family:    'Antonio', sans-serif;
  font-size:      0.8rem;
  color:          rgba(255, 160, 160, 0.75);
  letter-spacing: 0.04em;
}

.checkpoint-meta {
  font-size: 0.72rem;
  color:     rgba(153, 204, 255, 0.3);
}

.test-order-icon {
  font-size: 1rem;
  min-width: 2rem;
  text-align: center;
}

.test-section-title {
  color: rgba(255, 100, 100, 0.7) !important;
}

.expert-section-title {
  color: rgba(180, 120, 255, 0.85) !important;
}

.test-row {
  border-color: rgba(255, 100, 100, 0.15) !important;
}
.test-row:hover {
  border-color: rgba(255, 100, 100, 0.4) !important;
}

.test-badge {
  font-family:   'Antonio', sans-serif;
  font-size:     0.65rem;
  color:         rgba(255, 100, 100, 0.9);
  background:    rgba(255, 100, 100, 0.12);
  border:        0.0625rem solid rgba(255, 100, 100, 0.4);
  border-radius: 62.4375rem;
  padding:       0.1rem 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-left:   0.5rem;
  vertical-align: middle;
}

.meta-target {
  font-size: 0.72rem;
  color:     rgba(120, 220, 160, 0.6);
}

.open-test-btn {
  color:        rgba(100, 220, 140, 0.85);
  border-color: rgba(100, 220, 140, 0.3);
  background:   transparent;
}
.open-test-btn:not(:disabled):hover {
  background:   rgba(100, 220, 140, 0.12);
  border-color: rgba(100, 220, 140, 0.6);
}

.close-test-btn {
  color:        rgba(255, 100, 100, 0.85);
  border-color: rgba(255, 100, 100, 0.3);
  background:   rgba(255, 100, 100, 0.08);
}
.close-test-btn:not(:disabled):hover {
  background:   rgba(255, 100, 100, 0.15);
  border-color: rgba(255, 100, 100, 0.6);
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* ── Lesson list ─────────────────────────────────────────────────────────── */
.lesson-list {
  display:        flex;
  flex-direction: column;
  gap:            0.5rem;
}

.lesson-row {
  display:      flex;
  align-items:  center;
  gap:          1rem;
  padding:      0.85rem 1.1rem;
  background:   rgba(0, 20, 45, 0.55);
  border:       0.0625rem solid rgba(153, 204, 255, 0.15);
  border-radius: 0.625rem;
  transition:   border-color 0.2s, background 0.2s;
}
.lesson-row:hover {
  border-color: rgba(153, 204, 255, 0.35);
  background:   rgba(0, 35, 75, 0.55);
}
.lesson-row.archived {
  opacity: 0.45;
}

.order-num {
  font-family:   'Antonio', monospace, sans-serif;
  font-size:     0.85rem;
  color:         rgba(153, 204, 255, 0.4);
  min-width:     2rem;
  text-align:    center;
}

.lesson-info {
  flex:   1;
  cursor: pointer;
}
.lesson-name {
  font-family:   'Antonio', sans-serif;
  font-size:     1.05rem;
  color:         #e8f0ff;
  letter-spacing: 0.03em;
}
.lesson-meta {
  display:     flex;
  align-items: center;
  gap:         0.4rem;
  flex-wrap:   wrap;
  margin-top:  0.15rem;
}
.meta-keys {
  font-family: 'Antonio', monospace, sans-serif;
  font-size:   0.75rem;
  color:       rgba(255, 210, 60, 0.7);
}
.meta-chars {
  font-size: 0.75rem;
  color:     rgba(153, 204, 255, 0.5);
}
.meta-sep {
  color:     rgba(153, 204, 255, 0.3);
  font-size: 0.75rem;
}
.meta-archived {
  font-family:   'Antonio', sans-serif;
  font-size:     0.65rem;
  color:         rgba(255, 100, 100, 0.7);
  background:    rgba(255, 80, 80, 0.1);
  border:        0.0625rem solid rgba(255, 80, 80, 0.25);
  border-radius: 62.4375rem;
  padding:       0.1rem 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Row action buttons */
.row-actions {
  display: flex;
  gap:     0.5rem;
}
.action-btn {
  font-family:   'Antonio', sans-serif;
  font-size:     0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding:       0.25rem 0.75rem;
  border-radius: 62.4375rem;
  border:        0.0625rem solid;
  cursor:        pointer;
  transition:    background 0.2s, color 0.2s;
}
.edit-btn {
  color:            #99ccff;
  border-color:     rgba(153, 204, 255, 0.3);
  background:       transparent;
}
.edit-btn:hover {
  background:   rgba(153, 204, 255, 0.1);
  border-color: rgba(153, 204, 255, 0.6);
}
.archive-btn {
  color:        rgba(255, 150, 50, 0.7);
  border-color: rgba(255, 150, 50, 0.25);
  background:   transparent;
}
.archive-btn:hover {
  background:   rgba(255, 150, 50, 0.1);
  border-color: rgba(255, 150, 50, 0.55);
}

/* ── Form panel ──────────────────────────────────────────────────────────── */
.form-panel {
  gap: 1.1rem;
}
.form-title {
  font-family:   'Antonio', sans-serif;
  font-size:     1.1rem;
  color:         #ff9900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.form-label {
  display:        flex;
  flex-direction: column;
  gap:            0.35rem;
  font-family:    'Antonio', sans-serif;
  font-size:      0.78rem;
  color:          rgba(153, 204, 255, 0.6);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lcars-input {
  font-family:   'Roboto', sans-serif;
  font-size:     0.9rem;
  color:         #e8f0ff;
  background:    rgba(0, 20, 50, 0.7);
  border:        0.0625rem solid rgba(153, 204, 255, 0.25);
  border-radius: 0.375rem;
  padding:       0.55rem 0.85rem;
  outline:       none;
  transition:    border-color 0.2s;
  width:         100%;
  box-sizing:    border-box;
}
.lcars-input:focus {
  border-color:  rgba(153, 204, 255, 0.65);
  box-shadow:    0 0 0.5rem rgba(153, 204, 255, 0.1);
}
.lcars-textarea {
  resize:     vertical;
  min-height: 4rem;
  line-height: 1.5;
}

.checkbox-label {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}
.lcars-checkbox {
  width: 1.2rem;
  height: 1.2rem;
  accent-color: #ff9900;
  cursor: pointer;
}

.passage-area {
  font-family: 'Courier New', monospace;
  font-size:   0.85rem;
}
.order-input {
  width: 6rem;
}
.input-hint {
  font-family:    'Roboto', sans-serif;
  font-size:      0.75rem;
  color:          rgba(153, 204, 255, 0.4);
  text-transform: none;
  letter-spacing: 0;
}

/* Form keyboard preview */
.form-keyboard-wrap {
  display:        flex;
  flex-direction: column;
  gap:            0.4rem;
}
.form-keyboard-label {
  font-family:   'Antonio', sans-serif;
  font-size:     0.75rem;
  color:         rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── Form action buttons ──────────────────────────────────────────────────── */
.form-actions {
  display:     flex;
  gap:         0.75rem;
  flex-wrap:   wrap;
  padding-top: 0.5rem;
}

.lcars-btn {
  font-family:   'Antonio', sans-serif;
  font-size:     0.85rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border:        none;
  border-radius: 62.4375rem;
  padding:       0.5rem 1.5rem;
  cursor:        pointer;
  transition:    background 0.2s, transform 0.15s;
}
.lcars-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.save-btn {
  background: #99ccff;
  color:      #0a1628;
}
.save-btn:not(:disabled):hover {
  background: #bbddff;
  transform:  translateY(-0.1rem);
}
.cancel-btn {
  background: rgba(153, 204, 255, 0.1);
  color:      #99ccff;
  border:     0.0625rem solid rgba(153, 204, 255, 0.3);
}
.cancel-btn:hover {
  background: rgba(153, 204, 255, 0.2);
}
.seed-btn {
  background: rgba(100, 220, 140, 0.2);
  color:      rgba(100, 220, 140, 0.9);
  border:     0.0625rem solid rgba(100, 220, 140, 0.4);
  white-space: nowrap;
}
.seed-btn:not(:disabled):hover {
  background: rgba(100, 220, 140, 0.3);
}

/* ── Misc ────────────────────────────────────────────────────────────────── */
.error-msg   { color: #ff5555; font-size: 0.85rem; margin: 0; }
.loading-msg { color: rgba(153, 204, 255, 0.5); font-size: 0.9rem; }
.lesson-empty { color: rgba(153, 204, 255, 0.4); font-size: 0.9rem; padding: 1rem 0; }

</style>
