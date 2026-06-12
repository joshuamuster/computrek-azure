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
      <button
        class="section-btn"
        :class="{ active: section === 'stats' }"
        @click="openStats"
      >Class Stats</button>
      <button
        class="section-btn"
        :class="{ active: section === 'progress' }"
        @click="openProgress"
      >Period Progress</button>
      <button
        class="section-btn"
        :class="{ active: section === 'student' }"
        @click="openStudent"
      >Student</button>
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

        <!-- ── Tutorial section ──────────────────────────────────────────── -->
        <div v-if="tutorialLessons.length" class="admin-lesson-section">
          <div class="admin-section-header">
            <span class="admin-section-title">Typing Tutorial (Warmup)</span>
            <span class="admin-section-count">{{ tutorialLessons.length }} lessons</span>
          </div>
          <div class="lesson-list">
            <div
              v-for="(lesson, index) in tutorialLessons"
              :key="lesson.id"
              class="lesson-row tutorial-row"
              :class="{ archived: lesson.archived }"
            >
              <div class="order-num">#{{ index + 1 }}</div>
              <div class="lesson-info" @click="openEdit(lesson)">
                <div class="lesson-name">
                  {{ lesson.title }}
                  <span class="tutorial-badge">Tutorial</span>
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

        <!-- ── Mastery Lessons section ────────────────────────────────────── -->
        <div v-if="masteryLessons.length" class="admin-lesson-section">
          <div class="admin-section-header">
            <span class="admin-section-title">Standard Lessons</span>
            <span class="admin-section-count">{{ masteryLessons.length }} lessons</span>
          </div>
          <div class="lesson-list">
            <div
              v-for="(lesson, index) in masteryLessons"
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
                  <span class="meta-target">Pass: {{ lesson.targetWpm }}+ WPM / {{ lesson.targetAccuracy }}%+</span>
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

        <!-- ── Star Trek Missions section ─────────────────────────────────── -->
        <div v-if="starTrekLessons.length" class="admin-lesson-section">
          <div class="admin-section-header">
            <span class="admin-section-title">Starfleet Academy Missions</span>
            <span class="admin-section-count">{{ starTrekLessons.length }} missions</span>
          </div>
          <div class="lesson-list">
            <div
              v-for="(lesson, index) in starTrekLessons"
              :key="lesson.id"
              class="lesson-row"
              :class="{ archived: lesson.archived }"
            >
              <div class="order-num">#{{ index + 1 }}</div>
              <div class="lesson-info" @click="openEdit(lesson)">
                <div class="lesson-name">{{ lesson.title }}</div>
                <div class="lesson-meta">
                  <span class="meta-keys">Full keyboard</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-chars">{{ lesson.passage.length }} chars</span>
                  <span class="meta-sep">·</span>
                  <span class="meta-target">Pass: {{ lesson.targetWpm }}+ WPM / {{ lesson.targetAccuracy }}%+</span>
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

        <!-- ── Checkpoint: Final Exam (end of curriculum) ─────────────────── -->
        <div v-if="test3Lesson" class="test-checkpoint">
          <div class="checkpoint-header">
            <span class="checkpoint-label">Final Exam</span>
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
          <option value="tutorial">Tutorial (warmup drill)</option>
          <option value="lesson">Lesson (standard mission)</option>
          <option value="test">Test (graded, class only)</option>
        </select>
      </label>

      <div v-if="form.lessonType !== 'test'" class="form-row-2">
        <label class="form-label">
          Pass Target — WPM
          <input
            v-model.number="form.targetWpm"
            type="number"
            min="0"
            class="lcars-input order-input"
          />
          <span class="input-hint">0 = no requirement</span>
        </label>
        <label class="form-label">
          Pass Target — Accuracy %
          <input
            v-model.number="form.targetAccuracy"
            type="number"
            min="0"
            max="100"
            class="lcars-input order-input"
          />
          <span class="input-hint">0 = no requirement</span>
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

    <!-- ════════════════════════════════════════════════════════════════════
         CLASS STATS SECTION
         ════════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'stats'">

      <div v-if="dashLoading" class="loading-msg">Loading class data…</div>
      <div v-else-if="dashError" class="error-msg">{{ dashError }}</div>

      <template v-else-if="dashData">

        <!-- Summary bar -->
        <div class="stats-summary">
          <div class="summary-chip">
            <span class="summary-val">{{ dashData.totalSessions }}</span>
            <span class="summary-lbl">Total Sessions</span>
          </div>
          <div class="summary-chip">
            <span class="summary-val">{{ dashData.periods.length }}</span>
            <span class="summary-lbl">Periods</span>
          </div>
          <div class="summary-chip">
            <span class="summary-val">{{ overallAvgWpm }}</span>
            <span class="summary-lbl">Avg WPM</span>
          </div>
          <div class="summary-chip">
            <span class="summary-val">{{ overallBestWpm }}</span>
            <span class="summary-lbl">Class Best</span>
          </div>
          <div class="summary-chip refreshed">
            <span class="summary-lbl">Updated {{ refreshedLabel }}</span>
          </div>
        </div>

        <!-- Period breakdown -->
        <div class="stats-section-title">By Period</div>
        <div v-if="dashData.periods.length === 0" class="lesson-empty">
          No data yet — students haven't completed any typing sessions.
        </div>
        <div v-else class="period-grid">
          <div v-for="p in dashData.periods" :key="p.periodId" class="period-card">
            <div class="period-name">Period {{ p.periodId }}</div>
            <div class="period-stats">
              <div class="pstat">
                <span class="pstat-val">{{ p.avgWpm }}</span>
                <span class="pstat-lbl">Avg WPM</span>
              </div>
              <div class="pstat">
                <span class="pstat-val">{{ p.bestWpm }}</span>
                <span class="pstat-lbl">Best</span>
              </div>
              <div class="pstat">
                <span class="pstat-val">{{ p.avgAccuracy }}%</span>
                <span class="pstat-lbl">Accuracy</span>
              </div>
              <div class="pstat">
                <span class="pstat-val">{{ p.students }}</span>
                <span class="pstat-lbl">Students</span>
              </div>
              <div class="pstat">
                <span class="pstat-val">{{ p.sessions }}</span>
                <span class="pstat-lbl">Sessions</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Top performers -->
        <div class="stats-section-title">Top Performers</div>
        <div v-if="dashData.topStudents.length === 0" class="lesson-empty">No data yet.</div>
        <div v-else class="top-list">
          <div
            v-for="(s, i) in dashData.topStudents"
            :key="s.uid"
            class="top-row"
            :class="{ gold: i === 0, silver: i === 1, bronze: i === 2 }"
          >
            <div class="top-rank">{{ i + 1 }}</div>
            <div class="top-info">
              <div class="top-name">{{ s.displayName }}</div>
              <div class="top-meta">Period {{ s.periodId }} · {{ s.sessions }} sessions</div>
            </div>
            <div class="top-wpm">
              <span class="top-wpm-val">{{ s.bestWpm }}</span>
              <span class="top-wpm-lbl">WPM best</span>
            </div>
            <div class="top-avg">{{ s.avgWpm }} avg</div>
          </div>
        </div>

        <!-- Most-missed keys -->
        <div class="stats-section-title">Most Missed Keys (Class-wide)</div>
        <div v-if="dashData.missedKeys.length === 0" class="lesson-empty">No error data yet.</div>
        <div v-else class="missed-keys">
          <div
            v-for="(mk, i) in dashData.missedKeys"
            :key="mk.key"
            class="missed-chip"
            :class="{ 'miss-1': i === 0, 'miss-2': i === 1, 'miss-3': i === 2 }"
          >
            <span class="miss-key">{{ mk.key.toUpperCase() }}</span>
            <span class="miss-count">{{ mk.count }}</span>
          </div>
        </div>

      </template>

      <div v-else class="lesson-empty">No data yet.</div>

    </template> <!-- end stats section -->

    <!-- ════════════════════════════════════════════════════════════════════
         PERIOD PROGRESS SECTION
         ════════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'progress'">

      <!-- Period pill selector -->
      <div class="prog-period-bar">
        <span class="prog-period-label">PERIOD</span>
        <button
          v-for="p in PERIOD_IDS"
          :key="p.id"
          class="prog-pill"
          :class="{
            'prog-pill--mine':   isAdmin || isAudit || myPeriodIds.includes(p.id),
            'prog-pill--active': progPeriodId === p.id,
          }"
          :disabled="!isAdmin && !isAudit && !myPeriodIds.includes(p.id)"
          :title="p.label"
          @click="progPeriodId = p.id"
        >{{ p.id.replace('period-', 'P') }}</button>
      </div>

      <!-- Loading / error states -->
      <div v-if="dashLoading" class="loading-msg">Loading class data…</div>
      <div v-else-if="dashError" class="error-msg">{{ dashError }}</div>

      <!-- No period selected -->
      <div v-else-if="!progPeriodId" class="lesson-empty">
        Select a period above to view student progress.
      </div>

      <!-- Period table -->
      <template v-else-if="dashData">

        <!-- Period summary strip -->
        <div class="prog-summary" v-if="progPeriodStat">
          <div class="prog-summary-chip">
            <span class="prog-summary-val">{{ progPeriodStat.students }}</span>
            <span class="prog-summary-lbl">Students Active</span>
          </div>
          <div class="prog-summary-chip">
            <span class="prog-summary-val">{{ progPeriodStat.sessions }}</span>
            <span class="prog-summary-lbl">Total Sessions</span>
          </div>
          <div class="prog-summary-chip">
            <span class="prog-summary-val">{{ progPeriodStat.bestWpm }}</span>
            <span class="prog-summary-lbl">Period Best WPM</span>
          </div>
          <div class="prog-summary-chip">
            <span class="prog-summary-val">{{ progPeriodStat.avgWpm }}</span>
            <span class="prog-summary-lbl">Period Avg WPM</span>
          </div>
          <div class="prog-summary-chip">
            <span class="prog-summary-val">{{ progPeriodStat.avgAccuracy }}%</span>
            <span class="prog-summary-lbl">Avg Accuracy</span>
          </div>
          <button
            class="clear-period-btn"
            @click="typingDeleteTarget = { type: 'period', label: periodShortLbl(progPeriodId) }"
          >CLEAR PERIOD</button>
        </div>

        <div v-if="sortedPeriodStudents.length === 0" class="lesson-empty">
          No students in this period have completed a typing session yet.
        </div>

        <template v-else>
          <!-- Sortable table header -->
          <div class="prog-table">
            <div class="prog-thead">
              <span class="prog-th prog-th--name sortable" @click="setProgSort('displayName')">
                CADET {{ progSortIcon('displayName') }}
              </span>
              <span class="prog-th sortable" @click="setProgSort('sessions')">
                SESSIONS {{ progSortIcon('sessions') }}
              </span>
              <span class="prog-th sortable" @click="setProgSort('bestWpm')">
                BEST WPM {{ progSortIcon('bestWpm') }}
              </span>
              <span class="prog-th sortable" @click="setProgSort('avgWpm')">
                AVG WPM {{ progSortIcon('avgWpm') }}
              </span>
              <span class="prog-th sortable" @click="setProgSort('avgAccuracy')">
                ACCURACY {{ progSortIcon('avgAccuracy') }}
              </span>
              <span class="prog-th sortable" @click="setProgSort('lastActive')">
                LAST ACTIVE {{ progSortIcon('lastActive') }}
              </span>
              <span class="prog-th"></span>
            </div>

            <div
              v-for="(s, i) in sortedPeriodStudents"
              :key="s.uid"
              class="prog-row"
              :class="{ 'prog-row--alt': i % 2 === 1 }"
            >
              <span class="prog-td prog-td--name">{{ s.displayName }}</span>
              <span class="prog-td prog-td--num">{{ s.sessions }}</span>
              <span class="prog-td prog-td--wpm">
                <span class="prog-wpm-val" :class="wpmClass(s.bestWpm, progPeriodStat?.bestWpm)">
                  {{ s.bestWpm }}
                </span>
                <span class="prog-wpm-bar">
                  <span
                    class="prog-wpm-fill"
                    :style="{ width: progPeriodStat?.bestWpm ? (s.bestWpm / progPeriodStat.bestWpm * 100) + '%' : '0%' }"
                  ></span>
                </span>
              </span>
              <span class="prog-td prog-td--num">{{ s.avgWpm }}</span>
              <span class="prog-td prog-td--acc"
                :class="accClass(s.avgAccuracy)"
              >{{ s.avgAccuracy }}%</span>
              <span class="prog-td prog-td--date">{{ formatLastActive(s.lastActive) }}</span>
              <span class="prog-td prog-td--action">
                <button
                  class="del-row-btn"
                  title="Clear typing history for this cadet"
                  @click="typingDeleteTarget = { type: 'student', label: s.displayName, uid: s.uid }"
                >✕</button>
              </span>
            </div>
          </div>

          <p class="prog-footnote">
            Only students with at least one completed session appear here.
          </p>
        </template>

      </template>

    </template> <!-- end progress section -->

    <!-- ════════════════════════════════════════════════════════════════════
         STUDENT SECTION — all students, searchable, across all periods
         ════════════════════════════════════════════════════════════════════ -->
    <template v-if="section === 'student'">

      <!-- Search + period pills in one row -->
      <div class="stud-controls">
        <div class="stud-search-wrap">
          <input
            v-model="studentSearchQ"
            class="lcars-input stud-search-input"
            type="text"
            placeholder="Search cadet name…"
          />
          <button v-if="studentSearchQ" class="stud-search-clear" @click="studentSearchQ = ''">✕</button>
        </div>
        <div class="prog-period-bar stud-pills">
          <span class="prog-period-label">PERIOD</span>
          <button
            class="prog-pill"
            :class="{
              'prog-pill--mine':   true,
              'prog-pill--active': studentPeriodFilter === '',
            }"
            @click="studentPeriodFilter = ''"
          >ALL</button>
          <button
            v-for="p in PERIOD_IDS"
            :key="p.id"
            class="prog-pill"
            :class="{
              'prog-pill--mine':   isAdmin || isAudit || myPeriodIds.includes(p.id),
              'prog-pill--active': studentPeriodFilter === p.id,
            }"
            :disabled="!isAdmin && !isAudit && !myPeriodIds.includes(p.id)"
            @click="studentPeriodFilter = p.id"
          >{{ periodShortLbl(p.id) }}</button>
        </div>
      </div>

      <!-- Loading / error -->
      <div v-if="dashLoading" class="loading-msg">Loading student data…</div>
      <div v-else-if="dashError" class="error-msg">{{ dashError }}</div>

      <template v-else-if="dashData">

        <!-- Result count + summary strip -->
        <div class="stud-meta-row">
          <span class="stud-result-count">
            {{ filteredStudents.length }} cadet{{ filteredStudents.length !== 1 ? 's' : '' }}
            <template v-if="studentSearchQ || studentPeriodFilter"> matching</template>
          </span>
        </div>

        <div v-if="filteredStudents.length === 0" class="lesson-empty">
          No students match your search or filter.
        </div>

        <template v-else>
          <!-- Sortable table — same style as Period Progress, + PERIOD column -->
          <div class="prog-table stud-table">
            <div class="prog-thead stud-thead">
              <span class="prog-th prog-th--name sortable" @click="setStudSort('displayName')">
                CADET {{ studSortIcon('displayName') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('periodId')">
                PERIOD {{ studSortIcon('periodId') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('sessions')">
                SESSIONS {{ studSortIcon('sessions') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('bestWpm')">
                BEST WPM {{ studSortIcon('bestWpm') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('avgWpm')">
                AVG WPM {{ studSortIcon('avgWpm') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('avgAccuracy')">
                ACCURACY {{ studSortIcon('avgAccuracy') }}
              </span>
              <span class="prog-th sortable" @click="setStudSort('lastActive')">
                LAST ACTIVE {{ studSortIcon('lastActive') }}
              </span>
              <span class="prog-th"></span>
            </div>

            <div
              v-for="(s, i) in filteredStudents"
              :key="s.uid"
              class="prog-row"
              :class="{ 'prog-row--alt': i % 2 === 1 }"
            >
              <span class="prog-td prog-td--name">{{ s.displayName }}</span>
              <span class="prog-td prog-td--period">{{ periodShortLbl(s.periodId) }}</span>
              <span class="prog-td prog-td--num">{{ s.sessions }}</span>
              <span class="prog-td prog-td--wpm">
                <span class="prog-wpm-val" :class="wpmClass(s.bestWpm, studBestWpm)">
                  {{ s.bestWpm }}
                </span>
                <span class="prog-wpm-bar">
                  <span
                    class="prog-wpm-fill"
                    :style="{ width: studBestWpm ? (s.bestWpm / studBestWpm * 100) + '%' : '0%' }"
                  ></span>
                </span>
              </span>
              <span class="prog-td prog-td--num">{{ s.avgWpm }}</span>
              <span class="prog-td prog-td--acc" :class="accClass(s.avgAccuracy)">
                {{ s.avgAccuracy }}%
              </span>
              <span class="prog-td prog-td--date">{{ formatLastActive(s.lastActive) }}</span>
              <span class="prog-td prog-td--action">
                <button
                  class="del-row-btn"
                  title="Clear typing history for this cadet"
                  @click="typingDeleteTarget = { type: 'student', label: s.displayName, uid: s.uid }"
                >✕</button>
              </span>
            </div>
          </div>

          <p class="prog-footnote">
            Only cadets with at least one completed session appear here.
          </p>
        </template>

      </template>

    </template> <!-- end student section -->

  </div>

  <!-- ── Typing history delete confirmation modal ──────────────────────────── -->
  <Teleport to="body">
    <div
      v-if="typingDeleteTarget"
      class="typing-del-overlay"
      @click.self="typingDeleteTarget = null"
    >
      <div class="typing-del-modal">
        <div class="typing-del-title">CLEAR TYPING HISTORY</div>
        <p class="typing-del-body">
          Delete all typing records for
          <strong>{{ typingDeleteTarget.type === 'period' ? typingDeleteTarget.label : typingDeleteTarget.label }}</strong>?
          <br>This cannot be undone.
        </p>
        <p v-if="typingDeleteError" class="typing-del-error">{{ typingDeleteError }}</p>
        <div class="typing-del-actions">
          <button
            class="typing-del-cancel"
            :disabled="isTypingDeleting"
            @click="typingDeleteTarget = null"
          >Cancel</button>
          <button
            class="typing-del-confirm"
            :disabled="isTypingDeleting"
            @click="deleteTypingHistory"
          >{{ isTypingDeleting ? 'Deleting…' : 'Delete' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTypingContent }      from '@/composables/useTypingContent'
import { useTypingCustomText }   from '@/composables/useTypingCustomText'
import { useTypingDashboard }    from '@/composables/useTypingDashboard'
import { useTestSessions }       from '@/composables/useTestSessions'
import { useAuth }               from '@/composables/useAuth.js'
import TypingKeyboard            from '@/components/typing/TypingKeyboard.vue'
import type { TypingLesson, TypingLessonType } from '@/composables/useTypingContent'
import type { CustomText }       from '@/composables/useTypingCustomText'
import { PERIOD_IDS, SCHOOL_YEAR_ID } from '@/config/schoolYear'
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '@/firebase'

const { lessons, isLoading, error, fetchAllLessons, createLesson, updateLesson } =
  useTypingContent()
const { texts: ctTexts, isLoading: ctLoading, error: ctError,
        fetchAllTexts, createText, updateText, archiveText, restoreText } =
  useTypingCustomText()
const { userInfo, isAdmin, isAudit } = useAuth()
const { openTestSession, closeTestSession, fetchTestSession } = useTestSessions()

const myPeriodIds     = computed<string[]>(() => userInfo.value?.periodIds ?? [])
const tutorialLessons = computed(() =>
  lessons.value.filter(l => l.lessonType === 'tutorial').sort((a, b) => a.order - b.order)
)
// Standard lessons = lessonType 'lesson' with order < 50 (row drills + mastery, orders 21–28)
const masteryLessons = computed(() =>
  lessons.value.filter(l => l.lessonType === 'lesson' && l.order < 50).sort((a, b) => a.order - b.order)
)
// Star Trek lessons = lessonType 'lesson' with order ≥ 50 (The Voyage Begins … To the Stars, orders 51–70)
const starTrekLessons = computed(() =>
  lessons.value.filter(l => l.lessonType === 'lesson' && l.order >= 50).sort((a, b) => a.order - b.order)
)
const testLessons = computed(() =>
  lessons.value.filter(l => l.lessonType === 'test').sort((a, b) => a.order - b.order)
)
// Inline curriculum checkpoints — known IDs placed at their logical positions
const test1Lesson = computed(() => testLessons.value.find(l => l.id === 'test-1') ?? null)
const test2Lesson = computed(() => testLessons.value.find(l => l.id === 'test-2') ?? null)
const test3Lesson = computed(() => testLessons.value.find(l => l.id === 'test-3') ?? null)
// Any teacher-created tests that don't have a fixed position
const otherTests  = computed(() => testLessons.value.filter(l => !['test-1', 'test-2', 'test-3'].includes(l.id)))

// ── Section switcher ──────────────────────────────────────────────────────────

type Section = 'lessons' | 'custom' | 'stats' | 'progress' | 'student'
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
  targetWpm:      20,
  targetAccuracy: 90,
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
    targetWpm:      lesson.targetWpm ?? 20,
    targetAccuracy: lesson.targetAccuracy ?? 90,
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

const { data: dashData, isLoading: dashLoading, error: dashError, fetchDashboard } =
  useTypingDashboard()

const openStats = async () => {
  section.value = 'stats'
  if (!dashData.value) {
    await fetchDashboard(
      userInfo.value?.email ?? '',
      userInfo.value?.schoolYearId ?? '2025-2026',
    )
  }
}

const overallAvgWpm = computed(() => {
  if (!dashData.value?.periods.length) return 0
  const total = dashData.value.periods.reduce((s, p) => s + p.avgWpm * p.sessions, 0)
  const sess  = dashData.value.periods.reduce((s, p) => s + p.sessions, 0)
  return sess ? Math.round(total / sess) : 0
})

const overallBestWpm = computed(() =>
  dashData.value?.topStudents[0]?.bestWpm ?? 0
)

const refreshedLabel = computed(() => {
  if (!dashData.value) return ''
  return dashData.value.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

// ── Period Progress ────────────────────────────────────────────────────────────

const progPeriodId = ref('')

// Shared dashboard fetch — reuse same data as Class Stats section
const openProgress = async () => {
  section.value = 'progress'
  if (!dashData.value) {
    await fetchDashboard(
      userInfo.value?.email ?? '',
      userInfo.value?.schoolYearId ?? SCHOOL_YEAR_ID,
    )
  }
}

// Stats for the selected period (from the periods array)
const progPeriodStat = computed(() =>
  dashData.value?.periods.find(p => p.periodId === progPeriodId.value) ?? null
)

// All students in the selected period, from the full allStudents list
const periodStudents = computed(() =>
  dashData.value?.allStudents.filter(s => s.periodId === progPeriodId.value) ?? []
)

// Sorting
type ProgSortKey = 'displayName' | 'sessions' | 'bestWpm' | 'avgWpm' | 'avgAccuracy' | 'lastActive'
const progSortKey = ref<ProgSortKey>('displayName')
const progSortDir = ref<'asc' | 'desc'>('asc')

const setProgSort = (key: ProgSortKey) => {
  if (progSortKey.value === key) progSortDir.value = progSortDir.value === 'asc' ? 'desc' : 'asc'
  else { progSortKey.value = key; progSortDir.value = key === 'displayName' ? 'asc' : 'desc' }
}
const progSortIcon = (key: string) => {
  if (progSortKey.value !== key) return '⇅'
  return progSortDir.value === 'asc' ? '↑' : '↓'
}

const sortedPeriodStudents = computed(() => {
  return [...periodStudents.value].sort((a, b) => {
    let cmp = 0
    if (progSortKey.value === 'displayName') {
      cmp = a.displayName.localeCompare(b.displayName)
    } else if (progSortKey.value === 'lastActive') {
      cmp = (a.lastActive?.getTime() ?? 0) - (b.lastActive?.getTime() ?? 0)
    } else {
      cmp = (a[progSortKey.value] as number) - (b[progSortKey.value] as number)
    }
    return progSortDir.value === 'asc' ? cmp : -cmp
  })
})

// Colour helpers
function wpmClass(wpm: number, best: number | undefined): string {
  if (!best) return ''
  const ratio = wpm / best
  if (ratio >= 0.85) return 'wpm--high'
  if (ratio >= 0.55) return 'wpm--mid'
  return 'wpm--low'
}

function accClass(acc: number): string {
  if (acc >= 96) return 'acc--high'
  if (acc >= 88) return 'acc--mid'
  return 'acc--low'
}

function formatLastActive(d: Date | null): string {
  if (!d) return '—'
  const now   = new Date()
  const diff  = now.getTime() - d.getTime()
  const days  = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Student Progress section ──────────────────────────────────────────────────

const studentSearchQ      = ref('')
const studentPeriodFilter = ref('')  // '' = all periods

const openStudent = async () => {
  section.value = 'student'
  if (!dashData.value) {
    await fetchDashboard(
      userInfo.value?.email ?? '',
      userInfo.value?.schoolYearId ?? SCHOOL_YEAR_ID,
    )
  }
}

// Sort state (independent from Period Progress sort)
type StudSortKey = 'displayName' | 'periodId' | 'sessions' | 'bestWpm' | 'avgWpm' | 'avgAccuracy' | 'lastActive'
const studSortKey = ref<StudSortKey>('displayName')
const studSortDir = ref<'asc' | 'desc'>('asc')

const setStudSort = (key: StudSortKey) => {
  if (studSortKey.value === key) studSortDir.value = studSortDir.value === 'asc' ? 'desc' : 'asc'
  else { studSortKey.value = key; studSortDir.value = key === 'displayName' || key === 'periodId' ? 'asc' : 'desc' }
}
const studSortIcon = (key: string) => {
  if (studSortKey.value !== key) return '⇅'
  return studSortDir.value === 'asc' ? '↑' : '↓'
}

const filteredStudents = computed(() => {
  if (!dashData.value) return []
  let list = dashData.value.allStudents
  // Period pill filter
  if (studentPeriodFilter.value) {
    list = list.filter(s => s.periodId === studentPeriodFilter.value)
  }
  // Search filter
  const q = studentSearchQ.value.trim().toLowerCase()
  if (q) list = list.filter(s => s.displayName.toLowerCase().includes(q))
  // Sort
  return [...list].sort((a, b) => {
    let cmp = 0
    if (studSortKey.value === 'displayName') cmp = a.displayName.localeCompare(b.displayName)
    else if (studSortKey.value === 'periodId') cmp = a.periodId.localeCompare(b.periodId)
    else if (studSortKey.value === 'lastActive') cmp = (a.lastActive?.getTime() ?? 0) - (b.lastActive?.getTime() ?? 0)
    else cmp = (a[studSortKey.value] as number) - (b[studSortKey.value] as number)
    return studSortDir.value === 'asc' ? cmp : -cmp
  })
})

// Best WPM among visible students — used to scale the WPM bar
const studBestWpm = computed(() =>
  filteredStudents.value.reduce((max, s) => Math.max(max, s.bestWpm), 0)
)

// Period label helpers — short labels like "P1"
function periodShortLbl(id: string) { return id.replace('period-', 'P') }

// ── Delete typing history ─────────────────────────────────────────────────────

interface TypingDeleteTarget {
  type:  'period' | 'student'
  label: string
  uid?:  string
}
const typingDeleteTarget = ref<TypingDeleteTarget | null>(null)
const isTypingDeleting   = ref(false)
const typingDeleteError  = ref('')

const deleteTypingHistory = async () => {
  if (!typingDeleteTarget.value) return
  isTypingDeleting.value  = true
  typingDeleteError.value = ''
  try {
    const teacherEmail = userInfo.value?.email ?? ''
    const schoolYearId = userInfo.value?.schoolYearId ?? SCHOOL_YEAR_ID

    const constraints =
      typingDeleteTarget.value.type === 'period'
        ? [
            where('periodId',     '==', progPeriodId.value),
            where('teacherEmail', '==', teacherEmail),
            where('schoolYearId', '==', schoolYearId),
          ]
        : [
            where('uid',          '==', typingDeleteTarget.value.uid),
            where('schoolYearId', '==', schoolYearId),
          ]

    const snap  = await getDocs(query(collection(db, 'typingResults'), ...constraints))
    const batch = writeBatch(db)
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()

    typingDeleteTarget.value = null
    await fetchDashboard(teacherEmail, schoolYearId)
  } catch (e: any) {
    typingDeleteError.value = e.message ?? 'Delete failed.'
  } finally {
    isTypingDeleting.value = false
  }
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

.tutorial-badge {
  font-family:   'Antonio', sans-serif;
  font-size:     0.65rem;
  color:         rgba(255, 180, 0, 0.9);
  background:    rgba(255, 180, 0, 0.15);
  border:        0.0625rem solid rgba(255, 180, 0, 0.4);
  border-radius: 62.4375rem;
  padding:       0.1rem 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-left:   0.5rem;
  vertical-align: middle;
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

/* ── Dashboard ───────────────────────────────────────────────────────────── */

.stats-section-title {
  font-family:    'Antonio', sans-serif;
  font-size:      0.78rem;
  color:          rgba(153, 204, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top:     1.25rem;
  margin-bottom:  0.5rem;
}

/* Summary chips */
.stats-summary {
  display:   flex;
  gap:       0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}
.summary-chip {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  padding:        0.65rem 1.1rem;
  background:     rgba(0, 20, 50, 0.6);
  border:         0.0625rem solid rgba(153, 204, 255, 0.15);
  border-radius:  0.625rem;
  min-width:      5rem;
}
.summary-val {
  font-family: 'Antonio', sans-serif;
  font-size:   1.6rem;
  color:       #99ccff;
  line-height: 1;
}
.summary-lbl {
  font-family:   'Antonio', sans-serif;
  font-size:     0.65rem;
  color:         rgba(153, 204, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top:    0.2rem;
}
.summary-chip.refreshed {
  justify-content: center;
  background: transparent;
  border-color: transparent;
}
.summary-chip.refreshed .summary-lbl { font-size: 0.7rem; color: rgba(153,204,255,0.3); }

/* Period grid */
.period-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.75rem;
}
.period-card {
  background:    rgba(0, 20, 50, 0.55);
  border:        0.0625rem solid rgba(153, 204, 255, 0.15);
  border-radius: 0.75rem;
  padding:       1rem 1.1rem;
}
.period-name {
  font-family:   'Antonio', sans-serif;
  font-size:     1rem;
  color:         #ff9900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}
.period-stats {
  display:   flex;
  gap:       1rem;
  flex-wrap: wrap;
}
.pstat {
  display:        flex;
  flex-direction: column;
  align-items:    center;
}
.pstat-val {
  font-family: 'Antonio', sans-serif;
  font-size:   1.25rem;
  color:       #e8f0ff;
  line-height: 1;
}
.pstat-lbl {
  font-family:   'Antonio', sans-serif;
  font-size:     0.6rem;
  color:         rgba(153, 204, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top:    0.15rem;
}

/* Top performers */
.top-list {
  display:        flex;
  flex-direction: column;
  gap:            0.4rem;
}
.top-row {
  display:      flex;
  align-items:  center;
  gap:          0.85rem;
  padding:      0.65rem 1rem;
  background:   rgba(0, 20, 45, 0.5);
  border:       0.0625rem solid rgba(153, 204, 255, 0.1);
  border-radius: 0.5rem;
}
.top-row.gold   { border-color: rgba(255, 196, 0, 0.35);  background: rgba(255, 196, 0, 0.06); }
.top-row.silver { border-color: rgba(200, 210, 230, 0.3); background: rgba(200, 210, 230, 0.04); }
.top-row.bronze { border-color: rgba(200, 130, 80, 0.3);  background: rgba(200, 130, 80, 0.04); }

.top-rank {
  font-family:   'Antonio', sans-serif;
  font-size:     1.1rem;
  color:         rgba(153, 204, 255, 0.35);
  min-width:     1.5rem;
  text-align:    center;
}
.top-row.gold   .top-rank { color: rgba(255, 210, 60, 0.9); }
.top-row.silver .top-rank { color: rgba(200, 215, 240, 0.8); }
.top-row.bronze .top-rank { color: rgba(210, 150, 100, 0.8); }

.top-info { flex: 1; }
.top-name {
  font-family:   'Antonio', sans-serif;
  font-size:     1rem;
  color:         #e8f0ff;
  letter-spacing: 0.02em;
}
.top-meta {
  font-size: 0.72rem;
  color:     rgba(153, 204, 255, 0.45);
  margin-top: 0.1rem;
}
.top-wpm {
  display:        flex;
  flex-direction: column;
  align-items:    flex-end;
}
.top-wpm-val {
  font-family: 'Antonio', sans-serif;
  font-size:   1.4rem;
  color:       #99ccff;
  line-height: 1;
}
.top-wpm-lbl {
  font-family:   'Antonio', sans-serif;
  font-size:     0.6rem;
  color:         rgba(153, 204, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.top-avg {
  font-family: 'Antonio', sans-serif;
  font-size:   0.8rem;
  color:       rgba(153, 204, 255, 0.5);
  min-width:   4rem;
  text-align:  right;
}

/* Most-missed keys */
.missed-keys {
  display:   flex;
  gap:       0.5rem;
  flex-wrap: wrap;
}
.missed-chip {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  padding:        0.5rem 0.9rem;
  background:     rgba(255, 80, 80, 0.08);
  border:         0.0625rem solid rgba(255, 80, 80, 0.2);
  border-radius:  0.5rem;
  min-width:      3.5rem;
  transition:     background 0.2s;
}
.missed-chip.miss-1 { background: rgba(255,60,60,0.18); border-color: rgba(255,80,80,0.5); }
.missed-chip.miss-2 { background: rgba(255,60,60,0.13); border-color: rgba(255,80,80,0.38); }
.missed-chip.miss-3 { background: rgba(255,60,60,0.09); border-color: rgba(255,80,80,0.28); }
.miss-key {
  font-family: 'Antonio', monospace, sans-serif;
  font-size:   1.2rem;
  color:       rgba(255, 140, 140, 0.95);
  line-height: 1;
}
.miss-count {
  font-family:   'Antonio', sans-serif;
  font-size:     0.65rem;
  color:         rgba(255, 150, 150, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top:    0.2rem;
}

/* ── Misc ────────────────────────────────────────────────────────────────── */
.error-msg   { color: #ff5555; font-size: 0.85rem; margin: 0; }
.loading-msg { color: rgba(153, 204, 255, 0.5); font-size: 0.9rem; }
.lesson-empty { color: rgba(153, 204, 255, 0.4); font-size: 0.9rem; padding: 1rem 0; }

/* ══════════════════════════════════════════════════════════════════════════
   PERIOD PROGRESS
   ══════════════════════════════════════════════════════════════════════════ */

/* Period pill selector */
.prog-period-bar {
  display:     flex;
  align-items: center;
  gap:         0.4rem;
  flex-wrap:   wrap;
}
.prog-period-label {
  font-family:    'Antonio', sans-serif;
  font-size:      0.72rem;
  color:          rgba(153, 204, 255, 0.4);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-right:   0.25rem;
}
.prog-pill {
  font-family:    'Antonio', sans-serif;
  font-size:      0.72rem;
  font-weight:    bold;
  letter-spacing: 0.07em;
  padding:        0.22rem 0.6rem;
  border-radius:  0.3rem;
  border:         0.0625rem solid rgba(80, 100, 80, 0.3);
  background:     transparent;
  color:          #445;
  cursor:         default;
  transition:     all 0.15s;
}
.prog-pill--mine {
  color:        #69f0ae;
  border-color: rgba(105, 240, 174, 0.4);
  cursor:       pointer;
}
.prog-pill--mine:hover {
  border-color: #69f0ae;
  background:   rgba(105, 240, 174, 0.08);
}
.prog-pill--active {
  color:        #ff9900 !important;
  border-color: #ff9900 !important;
  background:   rgba(255, 153, 0, 0.12) !important;
  cursor:       pointer;
}

/* Period summary strip */
.prog-summary {
  display:   flex;
  gap:       0.6rem;
  flex-wrap: wrap;
}
.prog-summary-chip {
  display:        flex;
  flex-direction: column;
  align-items:    center;
  padding:        0.5rem 0.9rem;
  background:     rgba(0, 20, 50, 0.55);
  border:         0.0625rem solid rgba(153, 204, 255, 0.13);
  border-radius:  0.5rem;
  min-width:      4.5rem;
}
.prog-summary-val {
  font-family: 'Antonio', sans-serif;
  font-size:   1.4rem;
  color:       #99ccff;
  line-height: 1;
}
.prog-summary-lbl {
  font-family:    'Antonio', sans-serif;
  font-size:      0.58rem;
  color:          rgba(153, 204, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-top:     0.18rem;
  white-space:    nowrap;
}

/* Progress table */
.prog-table {
  display:        flex;
  flex-direction: column;
  border:         0.0625rem solid rgba(153, 204, 255, 0.12);
  border-radius:  0.625rem;
  overflow:       hidden;
}

.prog-thead,
.prog-row {
  display:     grid;
  grid-template-columns: 1.8fr 0.7fr 1.1fr 0.7fr 0.75fr 0.85fr 2rem;
  align-items: center;
  gap:         0.25rem;
  padding:     0.55rem 1rem;
}

.prog-thead {
  background:   rgba(0, 15, 40, 0.7);
  border-bottom: 0.0625rem solid rgba(153, 204, 255, 0.12);
}
.prog-th {
  font-family:    'Antonio', sans-serif;
  font-size:      0.68rem;
  color:          rgba(153, 204, 255, 0.45);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  user-select:    none;
}
.prog-th.sortable { cursor: pointer; }
.prog-th.sortable:hover { color: #99ccff; }

.prog-row {
  background: rgba(0, 20, 50, 0.35);
  transition: background 0.12s;
}
.prog-row--alt  { background: rgba(0, 15, 40, 0.5); }
.prog-row:hover { background: rgba(0, 35, 80, 0.6); }

.prog-td {
  font-family: 'Antonio', sans-serif;
  font-size:   0.92rem;
  color:       #c8d8f0;
}
.prog-td--name { color: #e8f0ff; font-size: 0.95rem; }
.prog-td--num  { color: rgba(153, 204, 255, 0.7); text-align: center; }
.prog-td--date { color: rgba(153, 204, 255, 0.5); font-size: 0.8rem; }

/* WPM cell with bar */
.prog-td--wpm {
  display:        flex;
  flex-direction: column;
  gap:            0.18rem;
}
.prog-wpm-val        { font-size: 0.95rem; }
.prog-wpm-val.wpm--high { color: #69f0ae; }
.prog-wpm-val.wpm--mid  { color: #ffd740; }
.prog-wpm-val.wpm--low  { color: rgba(153, 204, 255, 0.55); }

.prog-wpm-bar {
  height:        0.2rem;
  border-radius: 62.5rem;
  background:    rgba(153, 204, 255, 0.1);
  overflow:      hidden;
}
.prog-wpm-fill {
  display:       block;
  height:        100%;
  border-radius: 62.5rem;
  background:    linear-gradient(90deg, #4488cc, #69f0ae);
  transition:    width 0.4s ease;
}

/* Accuracy colouring */
.prog-td--acc.acc--high { color: #69f0ae; }
.prog-td--acc.acc--mid  { color: #ffd740; }
.prog-td--acc.acc--low  { color: rgba(255, 120, 120, 0.8); }

/* Footnote */
.prog-footnote {
  font-size:  0.75rem;
  color:      rgba(153, 204, 255, 0.3);
  margin:     0;
  padding-top: 0.4rem;
  font-style: italic;
}

/* ══════════════════════════════════════════════════════════════════════════
   STUDENT SECTION
   ══════════════════════════════════════════════════════════════════════════ */

.stud-controls {
  display:     flex;
  align-items: center;
  gap:         1rem;
  flex-wrap:   wrap;
}

.stud-search-wrap {
  position:   relative;
  flex:        1 1 220px;
  max-width:   320px;
}
.stud-search-input {
  width:        100%;
  box-sizing:   border-box;
  padding-right: 2rem;
}
.stud-search-clear {
  position:  absolute;
  right:     0.5rem;
  top:       50%;
  transform: translateY(-50%);
  background: none;
  border:    none;
  color:     rgba(153, 204, 255, 0.5);
  cursor:    pointer;
  font-size: 0.8rem;
  line-height: 1;
}
.stud-search-clear:hover { color: #ff9900; }

/* Pills row sits inline beside the search */
.stud-pills {
  flex: 0 0 auto;
}

.stud-meta-row {
  display:     flex;
  align-items: center;
  gap:         0.75rem;
}
.stud-result-count {
  font-family:    'Antonio', sans-serif;
  font-size:      0.75rem;
  color:          rgba(153, 204, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Student table: 8 columns (adds PERIOD between name and sessions) */
.stud-thead,
.stud-table .prog-row {
  grid-template-columns: 1.5fr 0.55fr 0.65fr 1.1fr 0.65fr 0.72fr 0.85fr 2rem;
}

.prog-td--period {
  font-family:    'Antonio', sans-serif;
  font-size:      0.8rem;
  color:          rgba(255, 153, 0, 0.7);
  letter-spacing: 0.06em;
}

/* ── Delete / clear buttons ──────────────────────────────────────────────── */

/* CLEAR PERIOD — floats to the right inside prog-summary flex row */
.clear-period-btn {
  margin-left:    auto;
  align-self:     center;
  font-family:    'Antonio', sans-serif;
  font-size:      0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background:     rgba(200, 50, 50, 0.1);
  border:         0.0625rem solid rgba(200, 50, 50, 0.35);
  border-radius:  0.4rem;
  color:          rgba(255, 110, 110, 0.75);
  padding:        0.35rem 0.85rem;
  cursor:         pointer;
  transition:     background 0.2s, border-color 0.2s, color 0.2s;
  white-space:    nowrap;
}
.clear-period-btn:hover {
  background:   rgba(200, 50, 50, 0.22);
  border-color: rgba(255, 100, 100, 0.7);
  color:        #ff8888;
}

/* ✕ per-row delete icon button */
.prog-td--action {
  display:         flex;
  justify-content: center;
  align-items:     center;
}
.del-row-btn {
  background:   transparent;
  border:       none;
  color:        rgba(255, 100, 100, 0.35);
  cursor:       pointer;
  font-size:    0.8rem;
  line-height:  1;
  padding:      0.2rem 0.3rem;
  border-radius: 0.25rem;
  transition:   color 0.15s, background 0.15s;
}
.del-row-btn:hover {
  color:      rgba(255, 100, 100, 0.9);
  background: rgba(200, 50, 50, 0.15);
}

/* ── Typing delete confirmation modal ─────────────────────────────────────── */
.typing-del-overlay {
  position:        fixed;
  inset:           0;
  background:      rgba(0, 5, 20, 0.75);
  display:         flex;
  align-items:     center;
  justify-content: center;
  z-index:         9999;
}
.typing-del-modal {
  background:    rgba(5, 15, 40, 0.97);
  border:        0.0625rem solid rgba(200, 50, 50, 0.45);
  border-radius: 0.75rem;
  padding:       1.75rem 2rem;
  max-width:     26rem;
  width:         90%;
  display:       flex;
  flex-direction: column;
  gap:           0.75rem;
}
.typing-del-title {
  font-family:    'Antonio', sans-serif;
  font-size:      1.05rem;
  letter-spacing: 0.12em;
  color:          rgba(255, 110, 110, 0.9);
  text-transform: uppercase;
}
.typing-del-body {
  font-family: 'Antonio', sans-serif;
  font-size:   0.92rem;
  color:       rgba(200, 220, 255, 0.8);
  margin:      0;
  line-height: 1.55;
}
.typing-del-body strong {
  color: #e8f0ff;
}
.typing-del-error {
  font-size: 0.82rem;
  color:     rgba(255, 100, 100, 0.85);
  margin:    0;
}
.typing-del-actions {
  display:         flex;
  justify-content: flex-end;
  gap:             0.6rem;
  margin-top:      0.25rem;
}
.typing-del-cancel {
  font-family:    'Antonio', sans-serif;
  font-size:      0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background:     transparent;
  border:         0.0625rem solid rgba(153, 204, 255, 0.2);
  border-radius:  0.4rem;
  color:          rgba(153, 204, 255, 0.6);
  padding:        0.45rem 1.1rem;
  cursor:         pointer;
  transition:     border-color 0.2s, color 0.2s;
}
.typing-del-cancel:hover:not(:disabled) {
  border-color: rgba(153, 204, 255, 0.5);
  color:        #99ccff;
}
.typing-del-confirm {
  font-family:    'Antonio', sans-serif;
  font-size:      0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background:     rgba(180, 40, 40, 0.75);
  border:         0.0625rem solid rgba(200, 60, 60, 0.6);
  border-radius:  0.4rem;
  color:          #ffcccc;
  padding:        0.45rem 1.3rem;
  cursor:         pointer;
  transition:     background 0.2s, border-color 0.2s;
}
.typing-del-confirm:hover:not(:disabled) {
  background:   rgba(210, 50, 50, 0.9);
  border-color: rgba(230, 80, 80, 0.8);
}
.typing-del-confirm:disabled,
.typing-del-cancel:disabled {
  opacity: 0.5;
  cursor:  not-allowed;
}
</style>
