<template>
  <Transition name="modal-fade">
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="header-decoration"></div>
          <h2>Ship's Calendar</h2>
          <button @click="closeModal" class="close-btn" aria-label="Close">
            <img src="@/assets/icons/do-not-enter6.svg" alt="Close" class="close-icon-img" />
          </button>
        </div>
        <div class="modal-body">
          <div class="calendar-layout">
            <!-- Sidebar: School-year months -->
            <aside class="months-sidebar">
              <div
                v-for="m in months"
                :key="`${m.year}-${m.month}`"
                class="month-item"
                :class="{ active: m.month === selectedMonth && m.year === selectedYear }"
                @click="selectMonth(m.year, m.month)"
              >
                {{ monthNames[m.month] }} {{ m.year }}
              </div>
            </aside>

            <!-- Main: Calendar for selected month -->
            <section class="calendar-panel">
              <header class="calendar-header">
                <div class="calendar-title">{{ monthNames[selectedMonth] }} {{ selectedYear }}</div>
              </header>
              <div class="weekdays-row">
                <div v-for="d in weekdayNames" :key="d" class="weekday">
                  {{ d }}
                </div>
              </div>
              <div class="days-grid">
                <div
                  v-for="(cell, idx) in calendarCells"
                  :key="idx"
                  class="day-cell"
                  :class="{ muted: !cell.inMonth, today: cell.isToday, clickable: isCellClickable(cell) }"
                  :style="getDayStyle(cell)"
                  @click="onDayCellClick(cell)"
                >
                  <span class="day-type-label" v-if="getDayTypeLabel(cell)">{{ getDayTypeLabel(cell) }}</span>
                  <span class="day-number" v-if="cell.day">{{ cell.day }}</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <!-- Day Type Image Modal (nested) -->
        <Transition name="modal-fade">
          <div v-if="showDayTypeModal" class="daytype-overlay" @click="closeDayTypeModal">
            <div class="daytype-content" @click.stop>
              <button class="close-btn daytype-close" @click="closeDayTypeModal" aria-label="Close">
                <img src="@/assets/icons/do-not-enter6.svg" alt="Close" class="close-icon-img" />
              </button>
              <img v-if="selectedDayTypeImage" :src="selectedDayTypeImage" :alt="selectedDayTypeAlt" class="daytype-image" />
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
// Academic calendar with Day Colors and schedule entries
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import academicCalendar from '@/assets/data/2526-AcademicCalendar.json';
// Overlay image for even parity days
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import tigerStripes from '@/assets/images/colors/TigerStripes-min.png';
// Day type images (1..9)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import imgNormal from '@/assets/images/calendars/Day-Normal-min.png';
// @ts-ignore
import imgEarlyRelease from '@/assets/images/calendars/Day-EarlyRelease-min.png';
// @ts-ignore
import imgAdvisoryAwards from '@/assets/images/calendars/Day-AdvisoryAwards-min.png';
// @ts-ignore
import imgRally from '@/assets/images/calendars/Day-Rally-min.png';
// @ts-ignore
import imgGoldenHour from '@/assets/images/calendars/Day-GoldenHour-min.png';
// @ts-ignore
import imgTesting from '@/assets/images/calendars/Day-Testing-min.png';
// @ts-ignore
import imgTestingEarly from '@/assets/images/calendars/Day-TestingEarly-min.png';
// @ts-ignore
import imgEightPeriod from '@/assets/images/calendars/Day-8-Period-min.png';
// @ts-ignore
import imgMinimum from '@/assets/images/calendars/Day-Minimum-min.png';

interface Props {
  showModal: boolean;
}

interface Emits {
  (e: 'close'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Map of schedule type -> image and alt label
const dayTypeImages: Record<number, { src: string; alt: string }> = {
  1: { src: imgNormal, alt: 'Normal Day' },
  2: { src: imgEarlyRelease, alt: 'Early Release Day' },
  3: { src: imgAdvisoryAwards, alt: 'Awards/Advisory Day' },
  4: { src: imgRally, alt: 'Rally Day' },
  5: { src: imgGoldenHour, alt: 'Golden Hour Day' },
  6: { src: imgTesting, alt: 'Testing Day' },
  7: { src: imgTestingEarly, alt: 'Testing Early Release Day' },
  8: { src: imgEightPeriod, alt: '8-Period Day' },
  9: { src: imgMinimum, alt: 'Minimum Day' },
};

const showDayTypeModal = ref(false);
const selectedDayTypeImage = ref<string>('');
const selectedDayTypeAlt = ref<string>('');

// Month/weekday labels
const monthNames = [
  'January','February','March','April','May','June','July','August','September','October','November','December'
];
const weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Build school-year months: Aug 2025 .. Jul 2026
const months = ref<{ year: number; month: number }[]>([]);
for (let y = 2025, m = 7; y <= 2026; ) {
  months.value.push({ year: y, month: m });
  if (y === 2026 && m === 6) break; // stop at July 2026
  m++;
  if (m > 11) { m = 0; y++; }
}

// Selected month/year defaults to current if in range else Aug 2025
const now = new Date();
const inRange = months.value.some(mm => mm.year === now.getFullYear() && mm.month === now.getMonth());
const defaultSel = inRange ? { year: now.getFullYear(), month: now.getMonth() } : { year: 2025, month: 7 };

const selectedYear = ref<number>(defaultSel.year);
const selectedMonth = ref<number>(defaultSel.month); // 0-based

const selectMonth = (year: number, month: number) => {
  selectedYear.value = year;
  selectedMonth.value = month;
};

// Calendar computation
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
}

// Build maps from academic calendar: day colors and date -> schedule type / parity
const rawCalendar = academicCalendar as any[];
const dayColors: Record<string, string> = (rawCalendar.find((o: any) => o && o['Day Colors'])?.['Day Colors']) || {};
const dayTypes: Record<string, string> = (rawCalendar.find((o: any) => o && o['Day Types'])?.['Day Types']) || {};

// Map YYYY-MM-DD to schedule type number and parity string
const dateToType: Record<string, number> = {};
const dateToParity: Record<string, string> = {};
for (const entry of rawCalendar) {
  if (entry && typeof entry === 'object' && entry.Date) {
    const iso = String(entry.Date);
    const key = iso.slice(0, 10); // e.g., 2025-08-18
    if (entry['Schedule Type'] != null) {
      const t = Number(entry['Schedule Type']);
      if (!Number.isNaN(t)) {
        dateToType[key] = t;
      }
    }
    if (entry['Parity']) {
      dateToParity[key] = String(entry['Parity']);
    }
  }
}

const calendarCells = computed(() => {
  const y = selectedYear.value;
  const m = selectedMonth.value;
  const totalDays = daysInMonth(y, m);
  const startDay = firstWeekday(y, m); // leading blanks

  const cells: { day: number | null; inMonth: boolean; isToday: boolean }[] = [];

  // leading blanks
  for (let i = 0; i < startDay; i++) {
    cells.push({ day: null, inMonth: false, isToday: false });
  }

  // days of month
  for (let d = 1; d <= totalDays; d++) {
    const isToday = (y === now.getFullYear() && m === now.getMonth() && d === now.getDate());
    cells.push({ day: d, inMonth: true, isToday });
  }

  // pad to complete weeks (multiple of 7)
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, inMonth: false, isToday: false });
  }

  return cells;
});

// Return style for a day cell based on its schedule type color and parity overlay
function getDayStyle(cell: { day: number | null; inMonth: boolean; isToday: boolean }) {
  if (!cell.inMonth || !cell.day) return undefined;
  const y = selectedYear.value;
  const m = selectedMonth.value; // 0-based
  const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
  const t = dateToType[key];
  // Ignore undefined only; apply colors for all defined types (including 0=Weekend and 10=Holiday)
  if (t == null) return undefined;
  const color = dayColors[String(t)];
  if (!color) return undefined;

  const parity = dateToParity[key];
  const style: Record<string, string> = {
    backgroundColor: color,
    borderColor: '#1f2a44'
  };

  // If parity is even, overlay the tiger stripes image on top of the color
  if (parity === 'even') {
    style.backgroundImage = `url(${tigerStripes})`;
    style.backgroundRepeat = 'repeat';
    // Keep pattern from overwhelming text; adjust size if needed
    style.backgroundSize = 'cover';
  }

  return style;
}

// Get the display label for a day-cell from the JSON Day Types mapping
function getDayTypeLabel(cell: { day: number | null; inMonth: boolean }) {
  if (!cell.inMonth || !cell.day) return '';
  const y = selectedYear.value;
  const m = selectedMonth.value;
  const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
  const t = dateToType[key];
  if (t == null) return '';
  return dayTypes[String(t)] || '';
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.showModal) {
    if (showDayTypeModal.value) {
      // Close inner modal first
      closeDayTypeModal();
      return;
    }
    closeModal();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

const closeModal = () => {
  emit('close');
};

function isCellClickable(cell: { day: number | null; inMonth: boolean }) {
  if (!cell.inMonth || !cell.day) return false;
  const y = selectedYear.value;
  const m = selectedMonth.value;
  const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
  const t = dateToType[key];
  return !!dayTypeImages[t as number];
}

function onDayCellClick(cell: { day: number | null; inMonth: boolean }) {
  if (!cell.inMonth || !cell.day) return;
  const y = selectedYear.value;
  const m = selectedMonth.value;
  const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
  const t = dateToType[key];
  const img = dayTypeImages[t as number];
  if (!img) return; // no modal for weekend/holiday/undefined
  selectedDayTypeImage.value = img.src;
  selectedDayTypeAlt.value = img.alt;
  showDayTypeModal.value = true;
}

function closeDayTypeModal() {
  showDayTypeModal.value = false;
  selectedDayTypeImage.value = '';
  selectedDayTypeAlt.value = '';
}
</script>

<style scoped>
/* A larger modal than the small popups, but contained around the triggering control (like other timers) */

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-0.625rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Transition classes */
.modal-fade-enter-active {
  animation: fadeIn 0.3s ease-out;
}
.modal-fade-leave-active {
  animation: fadeIn 0.3s ease-out reverse;
}

.modal-fade-enter-active .modal-content,
.modal-fade-enter-active .daytype-content {
  animation: slideDown 0.3s ease-out;
}
.modal-fade-leave-active .modal-content,
.modal-fade-leave-active .daytype-content {
  animation: slideDown 0.3s ease-out reverse;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.modal-content {
  background: #000;
  border: 0.125rem solid #3366ff;
  border-radius: 2.5rem;
  width: min(62.5rem, 95vw);
  height: min(40.625rem, 85vh);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 0 2.5rem rgba(51, 102, 255, 0.3);
  font-family: 'Roboto', sans-serif;
}

.modal-header {
  background: #3366ff;
  font-family: 'Antonio', sans-serif;
  display: flex;
  align-items: center;
  padding: 0;
  height: 3.75rem;
  flex-shrink: 0;
}

.header-decoration {
  width: 5rem;
  height: 100%;
  background: #99ccff;
  border-radius: 0 0 2.5rem 0;
  flex-shrink: 0;
}

.modal-header h2 {
  flex: 1;
  margin: 0;
  color: #000;
  font-size: 1.5rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.125rem;
  text-align: center;
}

.close-btn {
  background: #ff9900;
  border: none;
  width: 5rem;
  height: 100%;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 0 0 0 2.5rem;
  flex-shrink: 0;
  transition: background 0.2s;
  padding: 0;
}

.close-icon-img {
  width: 1.875rem;
  height: 1.875rem;
  filter: brightness(0);
  transition: transform 0.2s ease;
}

.close-btn:hover { background: #ffcc00; }
.close-btn:hover .close-icon-img { transform: scale(1.1); }

.modal-body {
  flex: 1;
  background: #0b1220;
  padding: 0.75rem;
  overflow: hidden;
}

/* Layout */
.calendar-layout {
  display: grid;
  grid-template-columns: 13.75rem 1fr;
  gap: 0.75rem;
  height: 100%;
}

.months-sidebar {
  background: #0b1220;
  border: 0.0625rem solid #374151;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  overflow-y: auto;
}

.month-item {
  border-bottom: 0.0625rem dashed #1f2937;
  color: #cbd5e1;
  cursor: pointer;
  padding: 0.4375rem 0.75rem;
}
.month-item:hover { background: #16223a; }
.month-item.active {
  background: #1f2a44;
  color: #ffffff;
  font-weight: 700;
}

.calendar-panel {
  border: 0.0625rem solid #374151;
  border-radius: 0.5rem;
  background: #0b1220;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.calendar-header {
  padding: 0.625rem 0.875rem;
  border-bottom: 0.0625rem solid #223047;
  color: #e5e7eb;
}
.calendar-title { font-size: 1.1rem; font-weight: 700; }

.weekdays-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.125rem;
  padding: 0.5rem 0.5rem 0;
  color: #93c5fd;
  font-size: 0.85rem;
}
.weekday { text-align: center; opacity: 0.9; }

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.125rem;
  padding: 0.5rem;
  overflow: auto;
}

.day-cell {
  min-height: 4rem;
  border-radius: 0.1875rem;
  background: #0e1526;
  border: 0.0625rem solid #1f2a44;
  color: #e5e7eb;
  position: relative;
}
.day-cell.muted {
  opacity: 0.35;
}

.day-cell.today {
  border: 0.125rem solid transparent;
  background-image:
      linear-gradient(#0e1526, #0e1526),
      linear-gradient(
          135deg,
          #c0c0c0 0%,
          #f0f0f0 20%,
          #a8a8a8 35%,
          #e8e8e8 50%,
          #b0b0b0 65%,
          #f5f5f5 80%,
          #c0c0c0 100%
      );
  background-origin: border-box;
  background-clip: padding-box, border-box;
  box-shadow:
      0 0 0.5rem rgba(192, 220, 255, 0.6),
      0 0 1.25rem rgba(180, 210, 255, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      inset 0 -1px 0 rgba(0, 0, 0, 0.4);
  position: relative;
  overflow: hidden;
  .day-number, .day-type-label {
    color: rgba(0, 0, 255, 1);
    text-shadow: 0 0 0.5rem rgba(255, 255, 255, 1);
    z-index: 1000;
  }
}

.day-cell.today::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
      115deg,
      transparent 30%,
      rgba(255, 255, 255, 0.18) 45%,
      rgba(255, 255, 255, 0.35) 50%,
      rgba(255, 255, 255, 0.18) 55%,
      transparent 70%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
  pointer-events: none;
  border-radius: inherit;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  60%  { background-position: -200% 0; }
  100% { background-position: -200% 0; }
}

.day-cell.today::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.5); /* light blue tint — adjust opacity to taste */
  border-radius: inherit;
  pointer-events: none;
}

.day-cell.clickable {
  cursor: pointer;
}

.day-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  color: #fafafa;
  font-weight: 700;
  text-shadow: 0 0 0.25rem rgba(0, 0, 0, 1);
}

.day-type-label {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: #ffffff;
  font-weight: 800;
  text-shadow: 0 0 0.3125rem rgba(0, 0, 0, 1);
  pointer-events: none;
  width: max-content;
}

/* Nested Day Type modal styling */
.daytype-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.daytype-content {
  position: relative;
  background: #0b1220;
  border: 0.125rem solid #374151;
  border-radius: 0.75rem;
  max-width: min(56.25rem, 92vw);
  max-height: min(37.5rem, 80vh);
  padding: 0.625rem 0.75rem 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.daytype-image {
  max-width: 100%;
  max-height: inherit;
  border-radius: 0.375rem;
}

.daytype-close {
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: #ff9900;
  border: none;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  transition: background 0.2s;
}

.daytype-close:hover { background: #ffcc00; }
</style>
