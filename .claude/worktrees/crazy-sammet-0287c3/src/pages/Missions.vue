<template>
  <div class="kanban-wrap">
    <div class="lcars-text-bar"><span>Mission Schedule</span></div>

    <!-- Sticky header: controls bar + day-of-week row -->
    <div class="sticky-header">
      <div class="controls">
        <div v-if="saveStatus" class="save-status" :class="saveStatus">{{ saveStatusMsg }}</div>
        <div class="month-strip">
          <span
              v-for="m in SCHOOL_MONTHS"
              :key="m.full"
              class="month-pip"
              :class="{
                'month-pip-active': m.full === visibleMonth,
                'month-pip-past':   m.isPast,
                'month-pip-future': m.isFuture,
              }"
          >{{ m.abbr }}</span>
        </div>
        <button v-if="canEdit" class="pill" @click="saveRows">Save</button>
        <span v-else class="readonly-badge">👁 VIEW ONLY</span>
      </div>

      <!-- Day-of-week row -->
      <div class="dow-header">
        <div class="dow-cell dow-weekend">Sun</div>
        <div class="dow-cell">Mon</div>
        <div class="dow-cell">Tue</div>
        <div class="dow-cell">Wed</div>
        <div class="dow-cell">Thu</div>
        <div class="dow-cell">Fri</div>
        <div class="dow-cell dow-weekend">Sat</div>
      </div>
    </div>

    <!-- Week rows -->
    <div class="kanban-board" ref="boardRef">
      <div
          v-for="(week, wi) in weeks"
          :key="`week-${wi}`"
          class="week-row"
          :class="[week.monthClass, { 'is-active-month': (week.weekdays[0]?.month ?? '') === visibleMonth }]"
          :data-month="week.weekdays[0]?.month ?? ''"
      >

        <!-- Sun label -->
        <div class="day-col weekend-col" :class="{ 'is-today': week.sun.isToday, 'is-past': week.sun.isPast }">
          <div class="date-label">
            <span class="dom">{{ week.sun.dom }}</span>
            <span class="month-tag">{{ week.sun.monthAbbr }}</span>
          </div>
        </div>

        <!-- Mon–Fri card columns -->
        <div
            v-for="day in week.weekdays"
            :key="day.iso"
            class="day-col weekday-col"
            :class="{ 'locked-col': day.locked, 'is-today': day.isToday, 'is-past': day.isPast }"
            :style="colBadgeStyle(day.schedType, day.parity)"
            @dragover.prevent="canEdit && onDragOver(day.iso)"
            @dragleave="canEdit && onDragLeave(day.iso)"
            @drop="canEdit && onDrop(day.iso, $event)"
        >
          <!-- Date header — admin click to add a card -->
          <div
              class="day-header"
              :class="{ 'locked-header': day.locked }"
              :style="schedBadgeStyle(day.schedType)"
              @click="canEdit && !day.locked && addCardOn(day.iso)"
          >
            <span class="dom">{{ day.dom }}</span>
            <span class="sched-badge">{{ schedLabel(day.schedType) }}</span>
            <span v-if="day.parity" class="parity-badge">{{ day.parity === 'odd' ? 'ODD' : 'EVEN' }}</span>
          </div>

          <!-- Cards — sorted warmup → lesson(s) → extension -->
          <div class="cards-area" :class="{ 'drag-over': dragOverIso === day.iso && !day.locked }">
            <div
                v-for="card in sortedCards(day.cards)"
                :key="card.id"
                class="kanban-card"
                :class="[`card-type-${card.type || 'lesson'}`, { 'dragging-card': draggingCardId === card.id, 'is-assignment-card': card.isAssignment }]"
                :draggable="canEdit"
                @dragstart="canEdit && onCardDragStart(card, day.iso, $event)"
                @dragend="canEdit && onCardDragEnd()"
                @click.stop="selectCard(card, day.iso)"
            >
              <!-- Assignment badge -->
              <div v-if="card.isAssignment" class="assignment-badge">
                {{ card.submissionType === 'game' ? '🎮' : '📎' }} ASSIGNMENT
              </div>
              <template v-if="card.type === 'lesson' || !card.type">
                <div class="card-meta-line" v-if="card.lessonNum || card.unit">
                  <span class="card-meta-text"><span v-if="card.lessonNum">Lesson {{ card.lessonNum }}</span><span v-if="card.lessonNum && card.unit">, </span><span v-if="card.unit">{{ card.unit }}</span></span>
                </div>
                <div class="card-lesson-big">{{ card.lesson || '(no lesson)' }}</div>
              </template>
              <template v-else>
                <div class="card-type-badge" :class="`badge-${card.type || 'lesson'}`">
                  {{ typeMeta(card.type).icon }} {{ typeMeta(card.type).label }}
                </div>
                <div class="card-unit" v-if="card.unit">{{ card.unit }}</div>
                <div class="card-lesson">{{ card.lesson || '(no lesson)' }}</div>
              </template>
              <div class="card-pts" v-if="card.points">{{ card.points }} pts</div>
            </div>

            <div v-if="day.cards.length === 0 && !day.locked" class="empty-slot">drop here</div>
          </div>
        </div>

        <!-- Sat label -->
        <div class="day-col weekend-col" :class="{ 'is-today': week.sat.isToday, 'is-past': week.sat.isPast }">
          <div class="date-label">
            <span class="dom">{{ week.sat.dom }}</span>
            <span class="month-tag">{{ week.sat.monthAbbr }}</span>
          </div>
        </div>

      </div>

      <!-- Overflow row -->
      <div v-if="overflowCards.length > 0" class="overflow-row">
        <div class="overflow-label">⚠ Off Calendar — these cards were bumped past the last school day</div>
        <div class="overflow-cards">
          <div
              v-for="card in overflowCards"
              :key="card.id"
              class="kanban-card overflow-card"
              :class="`card-type-${card.type || 'lesson'}`"
              :draggable="canEdit"
              @dragstart="canEdit && onCardDragStart(card, OVERFLOW_KEY, $event)"
              @dragend="canEdit && onCardDragEnd()"
              @click="selectCard(card, OVERFLOW_KEY)"
          >
            <template v-if="card.type === 'lesson' || !card.type">
              <div class="card-meta-line" v-if="card.lessonNum || card.unit">
                <span class="card-meta-text"><span v-if="card.lessonNum">Lesson {{ card.lessonNum }}</span><span v-if="card.lessonNum && card.unit">, </span><span v-if="card.unit">{{ card.unit }}</span></span>
              </div>
              <div class="card-lesson-big">{{ card.lesson || '(no lesson)' }}</div>
            </template>
            <template v-else>
              <div class="card-type-badge" :class="`badge-${card.type || 'lesson'}`">
                {{ typeMeta(card.type).icon }} {{ typeMeta(card.type).label }}
              </div>
              <div class="card-unit" v-if="card.unit">{{ card.unit }}</div>
              <div class="card-lesson">{{ card.lesson || '(no lesson)' }}</div>
            </template>
            <div class="card-pts" v-if="card.points">{{ card.points }} pts</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Bump chooser -->
    <Teleport to="body">
      <div v-if="dropPrompt" class="drop-prompt-backdrop" @click.self="cancelDrop">
        <div class="drop-prompt" :style="{ top: dropPrompt.y + 'px', left: dropPrompt.x + 'px' }">
          <p class="drop-prompt-title">Drop on <strong>{{ dropPrompt.toLabel }}</strong></p>
          <p class="drop-prompt-subtitle">{{ dropPrompt.hasCards ? 'A card is already here.' : 'Slot is empty.' }}</p>
          <div class="drop-prompt-btns">
            <button class="drop-btn add-btn-choice" @click="confirmDrop('add')">
              <span class="drop-btn-icon">＋</span>
              <span>Add alongside</span>
            </button>
            <button
                class="drop-btn bump-btn-choice"
                :disabled="!dropPrompt.hasCards"
                :title="!dropPrompt.hasCards ? 'Nothing here to bump' : 'Shift cards forward like books on a shelf'"
                @click="confirmDrop('bump')"
            >
              <span class="drop-btn-icon">→</span>
              <span>Bump forward</span>
            </button>
          </div>
          <button class="drop-cancel" @click="cancelDrop">Cancel</button>
        </div>
      </div>
    </Teleport>

    <!-- Card modal -->
    <div v-if="editingCard" class="modal-backdrop" @click.self="isNewCard ? null : closeModal()">
      <div class="modal">
        <h3 class="modal-title">
          {{ isNewCard ? 'New Card' : 'Card Details' }} — {{ editingDow }} {{ editingDom }}
        </h3>

        <!-- ── NEW CARD (always editable) ── -->
        <template v-if="isNewCard">
          <label class="modal-label">Type</label>
          <div class="type-selector">
            <button
                v-for="t in CARD_TYPES"
                :key="t.value"
                class="type-pill"
                :class="[`type-pill-${t.value}`, { active: editingCard.type === t.value }]"
                @click="editingCard.type = t.value"
            >{{ t.icon }} {{ t.label }}</button>
          </div>
          <div class="modal-inline-row">
            <label>Unit
              <input v-model="editingCard.unit" placeholder="e.g. Unit 01" />
            </label>
            <label>Lesson #
              <input v-model="editingCard.lessonNum" placeholder="e.g. 3" />
            </label>
          </div>
          <label>Lesson Title
            <input v-model="editingCard.lesson" placeholder="Lesson title" />
          </label>
          <label>Points
            <input v-model="editingCard.points" placeholder="e.g. 15" type="number" min="0" />
          </label>

          <!-- Assignment section -->
          <div class="assignment-section">
            <label class="assignment-toggle-label">
              <input type="checkbox" v-model="editingCard.isAssignment" />
              <span>This card is an assignment</span>
            </label>
            <template v-if="editingCard.isAssignment">
              <div class="assignment-fields">
                <div class="field-group">
                  <span class="modal-label">Submission type</span>
                  <div class="sub-type-selector">
                    <button
                        class="sub-type-pill"
                        :class="{ active: editingCard.submissionType === 'game' }"
                        @click="editingCard.submissionType = 'game'"
                    >🎮 Game score</button>
                    <button
                        class="sub-type-pill"
                        :class="{ active: editingCard.submissionType === 'file' }"
                        @click="editingCard.submissionType = 'file'"
                    >📎 File upload</button>
                  </div>
                </div>
                <div class="field-group">
                  <span class="modal-label">Assign to periods</span>
                  <div class="period-checks">
                    <label
                        v-for="p in PERIOD_IDS"
                        :key="p.id"
                        class="period-check"
                        :class="{ checked: (editingCard.periodIds ?? []).includes(p.id) }"
                    >
                      <input
                          type="checkbox"
                          :value="p.id"
                          :checked="(editingCard.periodIds ?? []).includes(p.id)"
                          @change="togglePeriod(p.id)"
                      />
                      {{ p.label }}
                    </label>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div class="modal-actions">
            <button class="pill pill-ghost" @click="closeModal">Cancel</button>
            <button class="pill" :disabled="isSavingAssignment" @click="saveCard">
              {{ isSavingAssignment ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </template>

        <!-- ── EXISTING CARD: VIEW MODE ── -->
        <template v-else-if="!isEditingCard">
          <div class="card-detail-row">
            <span class="card-detail-label">TYPE</span>
            <span :class="`badge-${editingCard.type || 'lesson'}`">
              {{ typeMeta(editingCard.type).icon }} {{ typeMeta(editingCard.type).label }}
            </span>
          </div>
          <div v-if="editingCard.unit" class="card-detail-row">
            <span class="card-detail-label">UNIT</span>
            <span class="card-detail-value">{{ editingCard.unit }}</span>
          </div>
          <div v-if="editingCard.lessonNum" class="card-detail-row">
            <span class="card-detail-label">LESSON #</span>
            <span class="card-detail-value">{{ editingCard.lessonNum }}</span>
          </div>
          <div class="card-detail-row">
            <span class="card-detail-label">LESSON</span>
            <span class="card-detail-value">{{ editingCard.lesson || '—' }}</span>
          </div>
          <div v-if="editingCard.points" class="card-detail-row">
            <span class="card-detail-label">POINTS</span>
            <span class="card-detail-value">{{ editingCard.points }} pts</span>
          </div>
          <!-- Assignment detail -->
          <div v-if="editingCard.isAssignment" class="card-detail-row">
            <span class="card-detail-label">ASSIGNMENT</span>
            <span class="card-detail-value assignment-detail-badge">
              {{ editingCard.submissionType === 'game' ? '🎮 Game score' : '📎 File upload' }}
            </span>
          </div>
          <div v-if="editingCard.isAssignment && editingCard.periodIds?.length" class="card-detail-row">
            <span class="card-detail-label">PERIODS</span>
            <span class="card-detail-value">{{ editingCard.periodIds.join(', ') }}</span>
          </div>
          <div class="modal-actions">
            <button class="pill pill-ghost" @click="closeModal">Close</button>
            <button v-if="canEdit" class="pill" @click="isEditingCard = true">Edit</button>
          </div>
        </template>

        <!-- ── EXISTING CARD: EDIT MODE ── -->
        <template v-else>
          <label class="modal-label">Type</label>
          <div class="type-selector">
            <button
                v-for="t in CARD_TYPES"
                :key="t.value"
                class="type-pill"
                :class="[`type-pill-${t.value}`, { active: editingCard.type === t.value }]"
                @click="editingCard.type = t.value"
            >{{ t.icon }} {{ t.label }}</button>
          </div>
          <div class="modal-inline-row">
            <label>Unit
              <input v-model="editingCard.unit" placeholder="e.g. Unit 01" />
            </label>
            <label>Lesson #
              <input v-model="editingCard.lessonNum" placeholder="e.g. 3" />
            </label>
          </div>
          <label>Lesson Title
            <input v-model="editingCard.lesson" placeholder="Lesson title" />
          </label>
          <label>Points
            <input v-model="editingCard.points" placeholder="e.g. 15" type="number" min="0" />
          </label>

          <!-- Assignment section -->
          <div class="assignment-section">
            <label class="assignment-toggle-label">
              <input type="checkbox" v-model="editingCard.isAssignment" />
              <span>This card is an assignment</span>
            </label>
            <template v-if="editingCard.isAssignment">
              <div class="assignment-fields">
                <div class="field-group">
                  <span class="modal-label">Submission type</span>
                  <div class="sub-type-selector">
                    <button
                        class="sub-type-pill"
                        :class="{ active: editingCard.submissionType === 'game' }"
                        @click="editingCard.submissionType = 'game'"
                    >🎮 Game score</button>
                    <button
                        class="sub-type-pill"
                        :class="{ active: editingCard.submissionType === 'file' }"
                        @click="editingCard.submissionType = 'file'"
                    >📎 File upload</button>
                  </div>
                </div>
                <div class="field-group">
                  <span class="modal-label">Assign to periods</span>
                  <div class="period-checks">
                    <label
                        v-for="p in PERIOD_IDS"
                        :key="p.id"
                        class="period-check"
                        :class="{ checked: (editingCard.periodIds ?? []).includes(p.id) }"
                    >
                      <input
                          type="checkbox"
                          :value="p.id"
                          :checked="(editingCard.periodIds ?? []).includes(p.id)"
                          @change="togglePeriod(p.id)"
                      />
                      {{ p.label }}
                    </label>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div v-if="!confirmingDelete" class="modal-actions">
            <button class="pill pill-danger-ghost" @click="confirmingDelete = true">Delete</button>
            <button class="pill pill-ghost" @click="isEditingCard = false">Cancel</button>
            <button class="pill" :disabled="isSavingAssignment" @click="saveEditedCard">
              {{ isSavingAssignment ? 'Saving...' : 'Done' }}
            </button>
          </div>
          <div v-else class="modal-actions delete-confirm-row">
            <span class="delete-confirm-label">⚠ Delete this card?</span>
            <div class="delete-confirm-btns">
              <button class="pill pill-ghost" @click="confirmingDelete = false">Cancel</button>
              <button class="pill pill-danger" @click="handleDeleteCard(editingCard, editingIso); closeModal()">Yes, delete</button>
            </div>
          </div>
        </template>

      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import {
  collection, addDoc, doc, updateDoc, setDoc, getDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/composables/useAuth.js';
import { PERIOD_IDS, SCHOOL_YEAR_ID, getQuarterIdForDate } from '@/config/schoolYear';
import calendarData from '@/assets/data/2526-AcademicCalendar.json';
import lessonSchedule from '@/assets/data/CS-Lessons-2025-2026.json';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import tigerStripes from '@/assets/images/colors/TigerStripes-min.png';

const { isAdmin, isStaff, userInfo, effectiveTeacherEmail } = useAuth();

// Staff and admins can edit; cadets, parents, audit are read-only
const canEdit = computed(() => isAdmin.value || isStaff.value);

// ─── Types ───────────────────────────────────────────────────────────────────

type CardType = 'warmup' | 'lesson' | 'extension' | '';

interface Card {
  id: string;
  unit: string;
  lessonNum: string;
  lesson: string;
  points: string;
  type: CardType;
  // Assignment fields (optional — only present when card is an assignment)
  isAssignment?: boolean;
  submissionType?: 'game' | 'file';
  periodIds?: string[];
  assignmentId?: string;   // Firestore assignments/{id} — set after first save
}

interface DayData {
  iso: string;
  dow: string;
  dom: string;
  month: string;
  monthAbbr: string;
  schedType: number;
  locked: boolean;
  isToday: boolean;
  isPast: boolean;
  parity: string;
  cards: Card[];
}

interface WeekendDay {
  iso: string;
  dom: string;
  monthAbbr: string;
  isToday: boolean;
  isPast: boolean;
}

interface Week {
  sun: WeekendDay;
  sat: WeekendDay;
  weekdays: DayData[];
  monthClass: string;
}

interface DropPrompt {
  x: number;
  y: number;
  toIso: string;
  toLabel: string;
  hasCards: boolean;
  card: Card;
  fromIso: string;
}

// ─── Card type metadata ───────────────────────────────────────────────────────

const CARD_TYPES: { value: CardType; label: string; icon: string }[] = [
  { value: 'warmup',    label: 'Warm-Up',   icon: '▲' },
  { value: 'lesson',    label: 'Lesson',    icon: '◆' },
  { value: 'extension', label: 'Extension', icon: '⬡' },
];

const TYPE_ORDER: Record<string, number> = { warmup: 0, lesson: 1, extension: 2, '': 1 };

function typeMeta(type: CardType | undefined) {
  return CARD_TYPES.find(t => t.value === (type || 'lesson')) ?? CARD_TYPES[1];
}

function sortedCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const ao = TYPE_ORDER[a.type ?? ''] ?? 1;
    const bo = TYPE_ORDER[b.type ?? ''] ?? 1;
    return ao - bo;
  });
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY      = 'kanban_cards_v2';
const OVERFLOW_KEY     = '__overflow__';
const MISSION_CARDS_ID = '2526'; // Firestore doc ID under missionCards/

const DAY_TYPES: Record<number, string> = {
  0: 'Weekend', 1: 'Normal', 2: 'Early Release', 3: 'Awards/Advisory',
  4: 'Rally', 5: 'Golden Hour', 6: 'Testing', 7: 'Testing Early Release',
  8: '8-Period', 9: 'Min Day', 10: 'Holiday',
};

const DAY_COLORS: Record<number, string> = {
  0: 'rgba(85, 85, 85, 0.35)',       // Weekend
  1: 'rgba(250, 229, 0, 0.35)',      // Normal       — was #FAE500
  2: 'rgba(114, 176, 67, 0.35)',     // Early Release — was #72B043
  3: 'rgba(108, 151, 217, 0.35)',    // Awards        — was #6C97D9
  4: 'rgba(255, 49, 49, 0.35)',      // Rally         — was #FF3131
  5: 'rgba(251, 182, 3, 0.35)',      // Golden Hour   — was #FBB603
  6: 'rgba(241, 170, 252, 0.35)',    // Testing       — was #F1AAFC
  7: 'rgba(183, 1, 202, 0.35)',      // Testing ER    — was #B701CA
  8: 'rgba(198, 223, 179, 0.35)',    // 8-Period      — was #C6DFB3
  9: 'rgba(255, 214, 188, 0.35)',    // Min Day       — was #FFD6BC
  10: 'rgba(85, 85, 85, 0.35)',      // Holiday
};

const MONTH_ABBR: Record<string, string> = {
  January:'Jan', February:'Feb', March:'Mar', April:'Apr', May:'May', June:'Jun',
  July:'Jul', August:'Aug', September:'Sep', October:'Oct', November:'Nov', December:'Dec',
};
const MONTH_NUM: Record<string, number> = {
  January:1, February:2, March:3, April:4, May:5, June:6,
  July:7, August:8, September:9, October:10, November:11, December:12,
};

// ─── Calendar JSON parsing ────────────────────────────────────────────────────

type CalendarEntry = {
  Month: string; Date: string; Day?: string;
  'Day of School'?: number | null; 'Schedule Type': number | string;
};

function toIso(dateStr: string): string {
  const m = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : dateStr;
}

function isLocked(schedType: number): boolean {
  return schedType === 0 || schedType === 10;
}

function buildCalendarMap(): Map<string, { schedType: number; dow: string; month: string; dom: string; parity: string }> {
  const arr = calendarData as any[];
  const days: CalendarEntry[] = arr.slice(2);
  const map = new Map<string, { schedType: number; dow: string; month: string; dom: string; parity: string }>();
  for (const entry of days) {
    const iso = toIso(String(entry.Date ?? ''));
    if (!iso) continue;
    const dom = iso.slice(8, 10).replace(/^0/, '');
    map.set(iso, {
      schedType: Number(entry['Schedule Type'] ?? 0),
      dow:    entry.Day ?? '',
      month:  entry.Month ?? '',
      dom,
      parity: String((entry as any)['Parity'] ?? '').toLowerCase(),
    });
  }
  return map;
}

// ─── Static lesson schedule (from CS-Lessons-2025-2026.json) ─────────────────

type LessonEntry = { iso: string; unit: string; lessonNum: string; lessonTitle: string; points: number };

function buildScheduleMap(): Map<string, { unit: string; lessonNum: string; lesson: string; points: string }> {
  const map = new Map<string, { unit: string; lessonNum: string; lesson: string; points: string }>();
  for (const entry of lessonSchedule as LessonEntry[]) {
    map.set(entry.iso, {
      unit:      entry.unit,
      lessonNum: entry.lessonNum,
      lesson:    entry.lessonTitle,
      points:    String(entry.points),
    });
  }
  return map;
}

// ─── State ───────────────────────────────────────────────────────────────────

const saveStatus      = ref<'saving' | 'saved' | 'error' | null>(null);
const saveStatusMsg   = ref('');
const isSavingAssignment = ref(false);

const cardsByIso  = ref<Map<string, Card[]>>(new Map());
const calendarMap = buildCalendarMap();

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadCards(): Map<string, Card[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, Card[]>;
    const migrated: Record<string, Card[]> = {};
    for (const [iso, cards] of Object.entries(obj)) {
      migrated[iso] = cards.map(c => ({ ...c, type: c.type ?? 'lesson' }));
    }
    return new Map(Object.entries(migrated));
  } catch { return new Map(); }
}

function persistCards() {
  try {
    const obj: Record<string, Card[]> = {};
    cardsByIso.value.forEach((cards, iso) => { obj[iso] = cards; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

function initCards(schedMap: Map<string, { unit: string; lessonNum: string; lesson: string; points: string }>) {
  const saved = loadCards();
  if (saved.size > 0) { cardsByIso.value = saved; return; }
  const fresh = new Map<string, Card[]>();
  schedMap.forEach(({ unit, lessonNum, lesson, points }, iso) => {
    if (lesson || unit || lessonNum) {
      fresh.set(iso, [{ id: `${iso}-0`, unit, lessonNum, lesson, points, type: 'lesson' }]);
    }
  });
  cardsByIso.value = fresh;
}

// ─── Migration: backfill lessonNum from CSV scheduleMap ──────────────────────

function migrateCardLessonNums(sched: Map<string, { unit: string; lessonNum: string; lesson: string; points: string }>): boolean {
  let dirty = false;
  cardsByIso.value.forEach((cards, iso) => {
    const seed = sched.get(iso);
    if (!seed) return;
    cards.forEach(card => {
      if ((card.type === 'lesson' || !card.type) && !card.lessonNum && seed.lessonNum) {
        card.lessonNum = seed.lessonNum;
        dirty = true;
      }
    });
  });
  if (dirty) cardsByIso.value = new Map(cardsByIso.value);
  return dirty;
}

// ─── Firestore assignment sync ────────────────────────────────────────────────

async function syncAssignmentToFirestore(card: Card, iso: string): Promise<string | undefined> {
  if (!card.isAssignment) return undefined;

  const payload = {
    title:        card.lesson?.trim() || card.unit?.trim() || '(untitled)',
    description:  '',
    type:         card.submissionType ?? 'file',
    periodIds:    card.periodIds ?? [],
    dueDate:      iso,
    quarterId:    getQuarterIdForDate(iso),
    schoolYearId: SCHOOL_YEAR_ID,
    archived:     false,
    cardId:       card.id,
    teacherEmail: effectiveTeacherEmail.value ?? userInfo.value?.email ?? '',
  };

  if (card.assignmentId) {
    // Update existing Firestore doc
    await updateDoc(doc(db, 'assignments', card.assignmentId), payload);
    return card.assignmentId;
  } else {
    // Create new Firestore doc
    const docRef = await addDoc(collection(db, 'assignments'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  }
}

async function archiveAssignmentInFirestore(assignmentId: string) {
  try {
    await updateDoc(doc(db, 'assignments', assignmentId), { archived: true });
  } catch (e) {
    console.error('Failed to archive assignment:', e);
  }
}

// ─── Derived data ─────────────────────────────────────────────────────────────

const scheduleMap = buildScheduleMap();
const todayIso    = new Date().toISOString().slice(0, 10);

const allIsoDates = computed<string[]>(() => {
  const arr = calendarData as any[];
  return (arr.slice(2) as CalendarEntry[])
      .map(e => toIso(String(e.Date ?? '')))
      .filter(Boolean)
      .sort();
});

const unlockedWeekdays = computed<string[]>(() =>
    allIsoDates.value.filter(iso => {
      const cal = calendarMap.get(iso);
      return cal && !['Sun', 'Sat'].includes(cal.dow) && !isLocked(cal.schedType);
    })
);

const overflowCards = computed<Card[]>(() => cardsByIso.value.get(OVERFLOW_KEY) ?? []);

// ─── Week building ────────────────────────────────────────────────────────────

const weeks = computed<Week[]>(() => {
  const dates = allIsoDates.value;
  if (!dates.length) return [];

  let startIdx = 0;
  while (startIdx < dates.length) {
    if (calendarMap.get(dates[startIdx])?.dow === 'Sun') break;
    startIdx++;
  }

  const padded = [...dates];
  while ((padded.length - startIdx) % 7 !== 0) padded.push('');

  const result: Week[] = [];
  for (let i = startIdx; i < padded.length; i += 7) {
    const chunk = padded.slice(i, i + 7);

    const makeWeekend = (iso: string): WeekendDay => {
      const cal = iso ? calendarMap.get(iso) : undefined;
      return {
        iso,
        dom: cal?.dom ?? (iso ? iso.slice(8, 10).replace(/^0/, '') : ''),
        monthAbbr: MONTH_ABBR[cal?.month ?? ''] ?? '',
        isToday: !!iso && iso === todayIso,
        isPast:  !!iso && iso < todayIso,
      };
    };

    const makeWeekday = (iso: string): DayData => {
      const cal = iso ? calendarMap.get(iso) : undefined;
      const schedType = cal?.schedType ?? 0;
      return {
        iso,
        dow:       cal?.dow    ?? '',
        dom:       cal?.dom    ?? (iso ? iso.slice(8) : ''),
        month:     cal?.month  ?? '',
        monthAbbr: MONTH_ABBR[cal?.month ?? ''] ?? '',
        schedType,
        locked:  !iso || isLocked(schedType),
        isToday: !!iso && iso === todayIso,
        isPast:  !!iso && iso < todayIso,
        parity:  cal?.parity ?? '',
        cards:   iso ? (cardsByIso.value.get(iso) ?? []) : [],
      };
    };

    const weekdays = chunk.slice(1, 6).map(makeWeekday);
    result.push({
      sun: makeWeekend(chunk[0]),
      sat: makeWeekend(chunk[6]),
      weekdays,
      monthClass: `month-${(weekdays.find(d => d.month)?.month || '').toLowerCase().slice(0, 3)}`,
    });
  }
  return result;
});

// ─── Sticky month label via IntersectionObserver ──────────────────────────────

const boardRef     = ref<HTMLElement | null>(null);
const visibleMonth = ref('');
let monthObserver: IntersectionObserver | null = null;

const SCHOOL_MONTH_ORDER = [
  'August','September','October','November','December',
  'January','February','March','April','May','June','July',
];

const SCHOOL_MONTHS = computed(() => {
  const activeIdx = SCHOOL_MONTH_ORDER.indexOf(visibleMonth.value);
  return SCHOOL_MONTH_ORDER.map((full, i) => ({
    full,
    abbr: MONTH_ABBR[full] ?? full.slice(0, 3),
    isPast:   activeIdx >= 0 && i < activeIdx,
    isFuture: activeIdx >= 0 && i > activeIdx,
  }));
});

function initMonthObserver() {
  if (monthObserver) monthObserver.disconnect();
  const scroller = document.querySelector('.main-scroll') as HTMLElement | null;
  monthObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
            .filter(e => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const month = (visible[0].target as HTMLElement).dataset.month ?? '';
          if (month) visibleMonth.value = month;
        }
      },
      {
        root: scroller,
        threshold: 0,
        rootMargin: '0px 0px -80% 0px',
      }
  );
  nextTick(() => {
    boardRef.value?.querySelectorAll<HTMLElement>('.week-row').forEach(row => {
      monthObserver!.observe(row);
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function schedLabel(type: number): string { return DAY_TYPES[type] ?? String(type); }
function schedColor(type: number): string { return DAY_COLORS[type] ?? '#888'; }

function schedBadgeStyle(schedType: number): Record<string, string> {
  return { background: schedColor(schedType) };
}

function colBadgeStyle(schedType: number, parity: string): Record<string, string> {
  const style: Record<string, string> = { background: schedColor(schedType) };
  if (parity === 'even') {
    style.backgroundImage  = `url(${tigerStripes})`;
    style.backgroundRepeat = 'repeat';
    style.backgroundSize   = 'cover';
  }
  return style;
}

function getCards(iso: string): Card[] {
  return cardsByIso.value.get(iso) ?? [];
}

function setCards(iso: string, cards: Card[]) {
  cardsByIso.value.set(iso, cards);
  cardsByIso.value = new Map(cardsByIso.value);
}

function newCardId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Period toggle helper ─────────────────────────────────────────────────────

function togglePeriod(periodId: string) {
  if (!editingCard.value) return;
  const current = editingCard.value.periodIds ?? [];
  editingCard.value.periodIds = current.includes(periodId)
      ? current.filter(p => p !== periodId)
      : [...current, periodId];
}

// ─── Bump logic ───────────────────────────────────────────────────────────────

function bumpInsert(toIso: string, incoming: Card[]) {
  const parity = calendarMap.get(toIso)?.parity ?? '';
  const days = parity
      ? unlockedWeekdays.value.filter(iso => calendarMap.get(iso)?.parity === parity)
      : unlockedWeekdays.value;
  const idx  = days.indexOf(toIso);
  if (idx < 0) return;

  const newMap = new Map(cardsByIso.value);
  let carrying = incoming;

  for (let i = idx; i < days.length; i++) {
    const slotIso = days[i];
    const existing = (newMap.get(slotIso) ?? []).slice();
    newMap.set(slotIso, carrying);
    carrying = existing;
    if (carrying.length === 0) break;
  }

  if (carrying.length > 0) {
    newMap.set(OVERFLOW_KEY, [...(newMap.get(OVERFLOW_KEY) ?? []), ...carrying]);
  }

  cardsByIso.value = newMap;
}

// ─── Add card ──────────────────────────────────────────────────────────────────

function addCardOn(iso: string) {
  const draft: Card = { id: newCardId(), unit: '', lessonNum: '', lesson: '', points: '', type: 'lesson' };
  const cal = calendarMap.get(iso);
  isNewCard.value     = true;
  isEditingCard.value = false;
  editingCard.value   = draft;
  editingIso.value    = iso;
  editingDow.value    = cal?.dow ?? '';
  editingDom.value    = `${cal?.dom} ${MONTH_ABBR[cal?.month ?? ''] ?? ''}`;
}

// ─── Save new card ────────────────────────────────────────────────────────────

async function saveCard() {
  if (!editingCard.value) return;

  isSavingAssignment.value = true;
  try {
    // Write to Firestore if this is an assignment
    if (editingCard.value.isAssignment) {
      const assignmentId = await syncAssignmentToFirestore(editingCard.value, editingIso.value);
      if (assignmentId) editingCard.value.assignmentId = assignmentId;
    }

    setCards(editingIso.value, [...getCards(editingIso.value), editingCard.value]);
    persistCards();
  } catch (e) {
    console.error('saveCard error:', e);
  } finally {
    isSavingAssignment.value = false;
  }

  isNewCard.value     = false;
  isEditingCard.value = false;
  editingCard.value   = null;
  confirmingDelete.value = false;
}

// ─── Save edited card ─────────────────────────────────────────────────────────

async function saveEditedCard() {
  if (!editingCard.value) return;

  isSavingAssignment.value = true;
  try {
    if (editingCard.value.isAssignment) {
      const assignmentId = await syncAssignmentToFirestore(editingCard.value, editingIso.value);
      if (assignmentId) editingCard.value.assignmentId = assignmentId;
    } else if (editingCard.value.assignmentId) {
      // Was an assignment, now toggled off — archive it
      await archiveAssignmentInFirestore(editingCard.value.assignmentId);
      editingCard.value.assignmentId = undefined;
    }

    // Replace card in place
    const existing = getCards(editingIso.value);
    setCards(editingIso.value, existing.map(c =>
        c.id === editingCard.value!.id ? { ...editingCard.value! } : c
    ));
    persistCards();
  } catch (e) {
    console.error('saveEditedCard error:', e);
  } finally {
    isSavingAssignment.value = false;
  }

  isEditingCard.value    = false;
  editingCard.value      = null;
  confirmingDelete.value = false;
  cardsByIso.value       = new Map(cardsByIso.value);
}

// ─── Delete card ─────────────────────────────────────────────────────────────

async function handleDeleteCard(card: Card, iso: string) {
  // Archive Firestore assignment if one exists
  if (card.assignmentId) {
    await archiveAssignmentInFirestore(card.assignmentId);
  }
  setCards(iso, getCards(iso).filter(c => c.id !== card.id));
  persistCards();
}

// ─── Drag & Drop ─────────────────────────────────────────────────────────────

const draggingCardId  = ref<string | null>(null);
const draggingFromIso = ref<string | null>(null);
const dragOverIso     = ref<string | null>(null);
const dropPrompt      = ref<DropPrompt | null>(null);

function onCardDragStart(card: Card, iso: string, e: DragEvent) {
  draggingCardId.value  = card.id;
  draggingFromIso.value = iso;
  e.dataTransfer?.setData('text/plain', card.id);
  e.dataTransfer!.effectAllowed = 'move';
}

function onCardDragEnd() {
  draggingCardId.value  = null;
  draggingFromIso.value = null;
  dragOverIso.value     = null;
}

function onDragOver(iso: string) { dragOverIso.value = iso; }

function onDragLeave(iso: string) {
  if (dragOverIso.value === iso) dragOverIso.value = null;
}

function onDrop(toIso: string, e: DragEvent) {
  const fromIso = draggingFromIso.value;
  const cardId  = draggingCardId.value;

  dragOverIso.value = null;

  if (!fromIso || !cardId) { onCardDragEnd(); return; }
  if (fromIso === toIso)   { onCardDragEnd(); return; }

  const fromCards = getCards(fromIso);
  const card = fromCards.find(c => c.id === cardId);
  if (!card) { onCardDragEnd(); return; }

  const cal      = calendarMap.get(toIso);
  const dom      = cal?.dom ?? toIso.slice(8);
  const dow      = cal?.dow ?? '';
  const monthA   = MONTH_ABBR[cal?.month ?? ''] ?? '';
  const toCards  = getCards(toIso);

  const px = Math.min(e.clientX + 12, window.innerWidth  - 240);
  const py = Math.min(e.clientY + 12, window.innerHeight - 190);

  dropPrompt.value = {
    x: px, y: py, toIso,
    toLabel: `${dow} ${dom} ${monthA}`,
    hasCards: toCards.length > 0,
    card, fromIso,
  };
}

function confirmDrop(mode: 'add' | 'bump') {
  const p = dropPrompt.value;
  if (!p) return;

  const fromCards = getCards(p.fromIso);
  const card = fromCards.find(c => c.id === p.card.id);
  if (!card) { cancelDrop(); return; }

  const newMap = new Map(cardsByIso.value);
  newMap.set(p.fromIso, fromCards.filter(c => c.id !== p.card.id));
  cardsByIso.value = newMap;

  if (mode === 'add') {
    setCards(p.toIso, [...getCards(p.toIso), card]);
  } else {
    bumpInsert(p.toIso, [card]);
  }

  // Note: dragging an assignment card doesn't update its dueDate in Firestore.
  // If you need that, call syncAssignmentToFirestore(card, p.toIso) here.

  dropPrompt.value      = null;
  draggingCardId.value  = null;
  draggingFromIso.value = null;
  persistCards();
}

function cancelDrop() {
  dropPrompt.value      = null;
  draggingCardId.value  = null;
  draggingFromIso.value = null;
}

// ─── Card modal ───────────────────────────────────────────────────────────────

const editingCard      = ref<Card | null>(null);
const editingIso       = ref<string>('');
const editingDow       = ref<string>('');
const editingDom       = ref<string>('');
const confirmingDelete = ref(false);
const isNewCard        = ref(false);
const isEditingCard    = ref(false);

function selectCard(card: Card, iso: string) {
  confirmingDelete.value = false;
  isNewCard.value        = false;
  isEditingCard.value    = false;
  editingCard.value      = { ...card };   // clone so edits don't mutate live data
  editingIso.value       = iso;
  const cal = calendarMap.get(iso);
  editingDow.value = cal?.dow ?? '';
  editingDom.value = `${cal?.dom ?? ''} ${MONTH_ABBR[cal?.month ?? ''] ?? ''}`;
}

function closeModal() {
  isNewCard.value        = false;
  isEditingCard.value    = false;
  editingCard.value      = null;
  confirmingDelete.value = false;
  cardsByIso.value       = new Map(cardsByIso.value);
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function saveRows() {
  persistCards();
  saveStatus.value    = 'saving';
  saveStatusMsg.value = 'Saving...';

  try {
    const obj: Record<string, Card[]> = {};
    cardsByIso.value.forEach((cards, iso) => { obj[iso] = cards; });
    await setDoc(doc(db, 'missionCards', MISSION_CARDS_ID), {
      cards:     obj,
      updatedAt: serverTimestamp(),
    });
    saveStatus.value    = 'saved';
    saveStatusMsg.value = '✓ Saved';
  } catch (e) {
    console.error('Failed to save to Firestore:', e);
    saveStatus.value    = 'error';
    saveStatusMsg.value = '⚠ Save failed';
  }

  setTimeout(() => { saveStatus.value = null; }, 2500);
}

// ─── Scroll to today ──────────────────────────────────────────────────────────

function scrollToToday() {
  nextTick(() => {
    const el       = document.querySelector('.is-today')?.closest('.week-row') as HTMLElement | null;
    const scroller = document.querySelector('.main-scroll') as HTMLElement | null;
    if (el && scroller) {
      const scrollerRect     = scroller.getBoundingClientRect();
      const elRect           = el.getBoundingClientRect();
      const scrollPaddingTop = parseInt(window.getComputedStyle(scroller).scrollPaddingTop) || 0;
      scroller.scrollTo({
        top: scroller.scrollTop + (elRect.top - scrollerRect.top) - scrollPaddingTop - 16,
        behavior: 'smooth',
      });
    }
  });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  const now = new Date();
  visibleMonth.value = Object.keys(MONTH_NUM).find(
      m => MONTH_NUM[m] === now.getMonth() + 1
  ) ?? '';

  initMonthObserver();

  // Load card data: Firestore > localStorage > lesson schedule seed
  try {
    const snap = await getDoc(doc(db, 'missionCards', MISSION_CARDS_ID));
    if (snap.exists()) {
      const data = snap.data() as { cards: Record<string, Card[]> };
      const migrated: Record<string, Card[]> = {};
      for (const [iso, cards] of Object.entries(data.cards ?? {})) {
        migrated[iso] = cards.map(c => ({ ...c, type: c.type ?? 'lesson' }));
      }
      cardsByIso.value = new Map(Object.entries(migrated));
    } else {
      // Nothing in Firestore yet — fall back to localStorage or CSV seed
      initCards(scheduleMap);
    }
  } catch (e) {
    console.error('Failed to load from Firestore, falling back to localStorage:', e);
    initCards(scheduleMap);
  }

  // 3. Backfill lessonNum for any existing cards that are missing it
  const needsSave = migrateCardLessonNums(scheduleMap);
  if (needsSave) {
    console.info('[Missions] Backfilling lessonNum — saving to Firestore…');
    await saveRows();
  }

  scrollToToday();
});

onBeforeUnmount(() => {
  monthObserver?.disconnect();
});
</script>

<style scoped>
/* ── Layout ── */
.kanban-wrap { max-width: 100%; overflow-x: clip; }
.lcars-text-bar { margin-bottom: .5rem; }

/* ── Sticky header wrapper ── */
.sticky-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(10, 10, 20, 0.97);
  border-bottom: 0.0625rem solid #2a3a50;
  min-width: 60rem;
  margin-bottom: 0.75rem;
}

.controls {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.5rem 0.5rem 0.5rem;
  border-bottom: 0.0625rem solid #444;
  justify-content: flex-end;
}

.pill { cursor: pointer; border: none; padding: .4rem .9rem; border-radius: 999px; color: #111; font-weight: 700; background: #ffd740; }
.pill:hover { background: #ffe57f; }
.pill:disabled { opacity: 0.5; cursor: not-allowed; }

.loading-status { color: #6C97D9; font-size: .85rem; font-weight: bold; }
.error-status   { color: #FF3131; font-size: .85rem; cursor: help; }
.save-status    { font-size: .85rem; font-weight: 600; }
.save-status.saved  { color: #69f0ae; }
.save-status.saving { color: #ffd740; }
.save-status.error  { color: #ff6e6e; }

.readonly-badge {
  font-size: 0.75rem; font-weight: 700; color: #556;
  letter-spacing: 0.06em; text-transform: uppercase;
}

/* ── DOW row ── */
.dow-header {
  display: grid;
  grid-template-columns: 4rem repeat(5, 1fr) 4rem;
  gap: 0.375rem; padding: 0.3rem 0.5rem;
}

/* ── Month strip ── */
.month-strip {
  display: flex; align-items: center; gap: 0.15rem;
  margin-right: auto; flex-wrap: nowrap;
}
.month-pip {
  font-size: .7rem; font-weight: 700;
  font-family: 'Antonio', sans-serif;
  letter-spacing: .04em; text-transform: uppercase;
  padding: 0.1rem 0.3rem; border-radius: 0.2rem;
  color: #6C97D9; transition: color 0.3s, text-shadow 0.3s, opacity 0.3s;
}
.month-pip-active {
  color: #fff;
  text-shadow: 0 0 6px rgba(108,151,217,1), 0 0 14px rgba(108,151,217,0.7), 0 0 28px rgba(108,151,217,0.4);
  font-weight: 800;
}
.month-pip-past   { color: #333; font-weight: 400; text-shadow: none; }
.month-pip-future { color: #4a5a6a; font-weight: 400; text-shadow: none; }

.dow-cell {
  text-align: center; font-size: .7rem; font-weight: 700;
  color: #667; text-transform: uppercase; letter-spacing: .08em; padding: 0.25rem 0;
}
.dow-cell.dow-weekend { color: #3a3a50; }

/* ── Board ── */
.kanban-board { display: flex; flex-direction: column; gap: 0.75rem; min-width: 60rem; }
.week-row {
  display: grid; grid-template-columns: 4rem repeat(5, 1fr) 4rem;
  gap: 0.375rem; align-items: stretch;
  padding: 0.5rem; border-radius: 0.5rem; scroll-margin-top: 1rem;
}

.month-aug { background: rgba(100,150,255,0.05); }
.month-sep { background: rgba(100,255,150,0.05); }
.month-oct { background: rgba(255,200,100,0.05); }
.month-nov { background: rgba(255,100,100,0.05); }
.month-dec { background: rgba(200,100,255,0.05); }
.month-jan { background: rgba(100,255,255,0.05); }
.month-feb { background: rgba(255,100,255,0.05); }
.month-mar { background: rgba(255,255,100,0.05); }
.month-apr { background: rgba(150,255,100,0.05); }
.month-may { background: rgba(100,100,255,0.05); }
.month-jun { background: rgba(255,150,100,0.05); }
.month-jul { background: rgba(150,100,255,0.05); }

/* ── Overflow row ── */
.overflow-row {
  display: flex; flex-direction: column; gap: 0.6rem;
  padding: 0.85rem 1rem;
  background: rgba(180,20,20,0.15);
  border: 0.15rem dashed #ff4444;
  border-radius: 0.5rem; margin-top: 0.25rem;
}
.overflow-label { font-size: .8rem; font-weight: 700; color: #ff6e6e; text-transform: uppercase; letter-spacing: .06em; }
.overflow-cards { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.overflow-card {
  border-color: rgba(255,100,100,0.5) !important;
  background: rgba(120,0,0,0.45) !important; min-width: 10rem;
}

/* ── Weekend columns ── */
.weekend-col {
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.35); border-radius: 0.375rem;
  border: 0.0625rem solid #2a2a3a; transition: border-color 0.15s;
}
.weekend-col.is-today { border-color: #ffd740; box-shadow: 0 0 0 0.0625rem rgba(255,215,64,0.3); }
.weekend-col.is-today .date-label .dom { color: #ffd740; }
.date-label { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; }
.date-label .dom       { font-size: 1rem; font-weight: 700; color: #555; }
.date-label .month-tag { font-size: .6rem; color: #444; text-transform: uppercase; }

/* ── Weekday columns ── */
.weekday-col {
  display: flex; flex-direction: column;
  border-radius: 0.375rem;
  border: 0.0625rem solid #2a3a50; overflow: hidden;
  min-height: 6rem; transition: border-color 0.15s;
}
.weekday-col.is-today  { border-color: #ffd740; box-shadow: 0 0 0 0.0625rem rgba(255,215,64,0.3); }
.day-col.is-past       { opacity: 0.25; filter: grayscale(50%); }
.weekday-col.locked-col { background: rgba(0,0,0,0.5); border-color: #1a1a1a; opacity: 0.6; }
.is-active-month .weekday-col:not(.locked-col):not(.is-today) {
  border-color: rgba(108,151,217,0.45);
  box-shadow: 0 0 0 0.0625rem rgba(108,151,217,0.12);
}

/* ── Day header ── */
.day-header {
  display: flex; align-items: center; gap: 0.3rem;
  justify-content: space-between;
  padding: 0.25rem 0.4rem; background: rgba(0,0,0,0.3);
  border-bottom: 0.0625rem solid #2a3a50; flex-wrap: wrap; cursor: pointer;
  span {
    color: aliceblue; font-size: 0.9rem; letter-spacing: .04em;
    text-shadow: 0 0 2px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1);
    text-transform: uppercase;
  }
}
.day-header:hover { filter: brightness(1.15); }
.day-header .dom { font-size: 1.15rem; font-weight: 700; }
.locked-header { background: rgba(0,0,0,0.5); }
.parity-badge {
  margin-left: auto; font-size: .6rem; font-weight: 800;
  letter-spacing: .1em; opacity: 0.7;
}

/* ── Cards area ── */
.cards-area {
  flex: 1; padding: 0.3rem;
  display: flex; flex-direction: column; gap: 0.3rem; transition: background 0.1s;
}
.cards-area.drag-over {
  background: rgba(100,180,255,0.08);
  outline: 0.125rem dashed rgba(100,200,255,0.5);
  outline-offset: -0.125rem; border-radius: 0.25rem;
}
.empty-slot {
  font-size: .65rem; color: #333; text-align: center; padding: .5rem 0;
  text-transform: uppercase; letter-spacing: .05em;
  border: 0.0625rem dashed #2a2a2a; border-radius: 0.25rem;
}

/* ── Cards ── */
.kanban-card {
  border-radius: 0.3rem; padding: 0.3rem 0.5rem;
  cursor: grab; position: relative;
  transition: background 0.1s, transform 0.1s;
  border-left-width: 0.5rem; border-left-style: solid;
  border-right: 0.0625rem solid transparent;
}
.kanban-card:active { cursor: grabbing; }
.kanban-card.dragging-card { opacity: 0.45; transform: scale(0.97); }
.kanban-card[draggable="false"] { cursor: default; }

/* Assignment card gets a subtle extra outline */
.is-assignment-card {
  outline: 0.0625rem solid rgba(105,240,174,0.35);
  outline-offset: -1px;
}

.card-type-warmup {
  background: rgba(255,255,255,0.95); border-left-color: #ffd740;
  border-top-color: rgba(255,215,64,0.15); border-right-color: rgba(255,215,64,0.08); border-bottom-color: rgba(255,215,64,0.08);
}
.card-type-warmup:hover { background: rgba(255,255,255,0.8); }
.card-type-lesson {
  background: rgba(255,255,255,0.95); border-left-color: rgba(100,160,255,1);
  border-top-color: rgba(100,160,255,0.15); border-right-color: rgba(100,160,255,0.1); border-bottom-color: rgba(100,160,255,0.1);
}
.card-type-lesson:hover { background: rgba(255,255,255,0.8); border-left-color: rgba(100,180,255,0.7); }
.card-type-extension {
  background: rgba(255,255,255,0.9); border-left: 0.5rem solid rgba(114, 176, 67, 1);
}
.card-type-extension:hover { background: rgba(255,255,255,0.75); }

.card-type-badge {
  font-size: .55rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: .07em; margin-bottom: 0.15rem; opacity: 0.8;
}
.badge-warmup    { color: #fbb603; }
.badge-lesson    { color: #6C97D9; }
.badge-extension { color: rgba(114, 176, 67, 1); }

/* Assignment badge on card */
.assignment-badge {
  font-size: .55rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: .06em;
  color: #69f0ae; margin-bottom: 0.1rem;
}

.card-unit      { font-size: .6rem; color: #6C97D9; text-transform: uppercase; letter-spacing: .04em; margin-bottom: .1rem; }
.card-lesson    { font-size: .78rem; color: #111; line-height: 1.3; }
.card-pts       { font-size: .65rem; color: #ffd740; margin-top: .15rem; }
.card-lesson-big { font-size: .88rem; font-weight: 700; color: #111; line-height: 1.25; margin-bottom: .15rem; }
.card-meta-line  { display: flex; align-items: center; gap: .35rem; flex-wrap: wrap; }
.card-meta-text  { font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; color:
    #6C97D9; opacity: 0.9; }

/* ── Drop prompt ── */
.drop-prompt-backdrop { position: fixed; inset: 0; z-index: 200; }
.drop-prompt {
  position: fixed; background: #0d1b2a;
  border: 0.0625rem solid #3a5a7a; border-radius: 0.5rem;
  padding: 1rem 1.1rem 0.85rem; min-width: 15rem;
  box-shadow: 0 0.5rem 2rem rgba(0,0,0,0.75); z-index: 201;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.drop-prompt-title    { font-size: .88rem; color: #cde; margin: 0; }
.drop-prompt-title strong { color: #9cf; }
.drop-prompt-subtitle { font-size: .72rem; color: #556; margin: 0; }
.drop-prompt-btns { display: flex; gap: 0.5rem; margin-top: 0.2rem; }
.drop-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  gap: 0.25rem; padding: 0.55rem 0.4rem;
  border-radius: 0.375rem; border: 0.0625rem solid;
  cursor: pointer; font-size: .72rem; font-weight: 700;
  transition: background 0.12s, opacity 0.12s; line-height: 1.2;
}
.drop-btn:disabled { opacity: .3; cursor: not-allowed; }
.drop-btn-icon { font-size: 1.1rem; }
.add-btn-choice  { background: rgba(105,240,174,0.12); border-color: rgba(105,240,174,0.4); color: #69f0ae; }
.add-btn-choice:hover:not(:disabled) { background: rgba(105,240,174,0.22); }
.bump-btn-choice { background: rgba(108,151,217,0.12); border-color: rgba(108,151,217,0.4); color: #9cf; }
.bump-btn-choice:hover:not(:disabled) { background: rgba(108,151,217,0.25); }
.drop-cancel {
  align-self: center; background: rgba(255,0,0,0.5);
  border: solid 1px rgba(255,0,0,0.5); border-radius: 3rem;
  color: rgba(255,255,255,0.7); font-size: .7rem; cursor: pointer; padding: .2rem 1rem;
}
.drop-cancel:hover { color: #778; }

/* ── Card modal ── */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: #0d1b2a; border: 0.0625rem solid #2a4a6a;
  box-sizing: border-box; border-radius: 0.5rem; padding: 1.5rem;
  min-width: 20rem; max-width: 30rem; width: 90vw;
  display: flex; flex-direction: column; gap: 0.75rem;
  max-height: 90vh; overflow-y: auto;
}
.modal-title { color: #9cf; font-size: 1rem; margin: 0 0 .25rem; font-family: 'Antonio', sans-serif; letter-spacing: .05em; }
.modal-label { font-size: .8rem; color: #aaa; text-transform: uppercase; letter-spacing: .04em; }
.modal label { display: flex; flex-direction: column; gap: 0.25rem; font-size: .8rem; color: #aaa; text-transform: uppercase; letter-spacing: .04em; }
.modal-inline-row { display: flex; gap: .75rem; }
.modal-inline-row label { flex: 1; }
.modal input[type="text"],
.modal input[type="number"] { background: rgba(255,255,255,0.06); border: 0.0625rem solid #2a4a6a; border-radius: 0.25rem; padding: .4rem .6rem; color: #dde; font-size: .9rem; }
.modal input:focus { outline: none; border-color: #6C97D9; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: .25rem; flex-wrap: wrap; }
.modal-actions .pill { flex: 1; text-align: center; min-width: 0; }

/* ── Assignment section in modal ── */
.assignment-section {
  border-top: 0.0625rem solid rgba(105,240,174,0.2);
  padding-top: 0.75rem;
  display: flex; flex-direction: column; gap: 0.6rem;
}
.assignment-toggle-label {
  display: flex !important; flex-direction: row !important; align-items: center;
  gap: 0.5rem; cursor: pointer;
  font-size: .85rem !important; color: #69f0ae !important;
  text-transform: uppercase; letter-spacing: .06em;
}
.assignment-toggle-label input[type="checkbox"] {
  width: 1rem; height: 1rem; accent-color: #69f0ae; cursor: pointer;
}
.assignment-fields { display: flex; flex-direction: column; gap: 0.6rem; padding-left: 0.25rem; }
.field-group { display: flex; flex-direction: column; gap: 0.3rem; }

.sub-type-selector { display: flex; gap: 0.4rem; }
.sub-type-pill {
  flex: 1; padding: 0.4rem 0.5rem;
  border-radius: 0.375rem; border: 0.0625rem solid rgba(105,240,174,0.25);
  cursor: pointer; font-size: .75rem; font-weight: 700; font-family: inherit;
  background: transparent; color: rgba(105,240,174,0.6);
  transition: background 0.12s;
}
.sub-type-pill.active { background: rgba(105,240,174,0.15); border-color: #69f0ae; color: #69f0ae; }
.sub-type-pill:hover:not(.active) { background: rgba(105,240,174,0.08); }

.period-checks { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.period-check {
  display: flex !important; flex-direction: row !important; align-items: center;
  gap: 0.3rem; cursor: pointer; padding: 0.25rem 0.5rem;
  border: 0.0625rem solid rgba(153,204,255,0.2); border-radius: 0.3rem;
  font-size: .75rem !important; color: rgba(153,204,255,0.6) !important;
  text-transform: uppercase; letter-spacing: .05em; transition: all 0.12s;
}
.period-check input[type="checkbox"] { width: 0.75rem; height: 0.75rem; accent-color: #9cf; cursor: pointer; }
.period-check.checked { background: rgba(153,204,255,0.1); border-color: #9cf; color: #9cf !important; }

/* ── Assignment detail badge in view mode ── */
.assignment-detail-badge { color: #69f0ae; font-size: 0.85rem; }

/* ── Card detail (view mode) ── */
.card-detail-row {
  display: flex; align-items: baseline; gap: 0.75rem;
  padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.card-detail-label {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;
  color: #556; min-width: 4rem; text-transform: uppercase;
}
.card-detail-value { font-size: 0.95rem; color: #dde; }

/* ── Type selector in modal ── */
.type-selector { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.type-pill {
  flex: 1; padding: 0.4rem 0.6rem; border-radius: 0.375rem; border: 0.0625rem solid;
  cursor: pointer; font-size: .75rem; font-weight: 700; font-family: inherit;
  transition: background 0.12s, opacity 0.12s; background: transparent; white-space: nowrap;
}
.type-pill-warmup    { color: #ffd740; border-color: rgba(255,215,64,0.3); }
.type-pill-warmup.active    { background: rgba(255,215,64,0.15); border-color: #ffd740; }
.type-pill-warmup:hover:not(.active) { background: rgba(255,215,64,0.08); }
.type-pill-lesson    { color: #9cf; border-color: rgba(100,180,255,0.3); }
.type-pill-lesson.active    { background: rgba(100,180,255,0.15); border-color: #9cf; }
.type-pill-lesson:hover:not(.active) { background: rgba(100,180,255,0.08); }
.type-pill-extension { color: #69f0ae; border-color: rgba(105,240,174,0.3); }
.type-pill-extension.active { background: rgba(105,240,174,0.15); border-color: #69f0ae; }
.type-pill-extension:hover:not(.active) { background: rgba(105,240,174,0.08); }

.pill-ghost { background: transparent; border: 0.0625rem solid #445; color: #889; }
.pill-ghost:hover { border-color: #778; color: #aaa; background: rgba(255,255,255,0.04); }
.pill-danger { background: rgba(255,80,80,0.15); border: 0.0625rem solid rgba(255,80,80,0.5); color: #ff6e6e; }
.pill-danger:hover { background: rgba(255,80,80,0.28); border-color: #ff6e6e; }
.pill-danger-ghost { background: transparent; border: 0.0625rem solid rgba(255,80,80,0.4); color: #ff6e6e; }
.pill-danger-ghost:hover { background: rgba(255,80,80,0.1); border-color: #ff6e6e; }
.delete-confirm-row {
  flex-direction: column; gap: 0.5rem; align-items: stretch;
  background: rgba(180,20,20,0.12); border: 0.0625rem solid rgba(255,80,80,0.25);
  border-radius: 0.375rem; padding: 0.6rem 0.75rem; margin-top: 0;
}
.delete-confirm-label { font-size: .78rem; font-weight: 700; color: #ff6e6e; letter-spacing: .04em; }
.delete-confirm-btns { display: flex; gap: 0.5rem; justify-content: flex-end; }
</style>