import { ref, watch } from 'vue';
import scheduleData from '@/assets/data/calendar/2526-BellSchedule.json';
import academicCalendar from '@/assets/data/2526-AcademicCalendar.json';

// Singleton state shared across all consumers
const missionTimeline = ref([]);
const currentBlock = ref(null);
const missionClockSeconds = ref(0);
const showSchedulePopup = ref(false);
const scheduleType = ref('regular_schedule');
const dayType = ref('odd'); // Used for schedules that have odd/even
// Flag to indicate we're in the after-school window (between last period end and 16:20 today)
const afterSchoolWindow = ref(false);
// Flag for the "Until Launch" window: after 16:20 through next day's first bell
const untilLaunchWindow = ref(false);

let initialized = false;
let midnightTimerId = null;
// Absolute ms timestamp of the next block boundary. Set by _fullRecalc() so
// that every subsequent 1-second tick only does a single subtraction instead
// of re-running the full timeline search + calendar scan.
let _clockTargetMs = null;

// Time formatting functions
// Generic mm:ss formatter (kept for existing usages)
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Mission clock-specific formatter:
// Shows MMMM:SS (4-digit-padded minutes : 2-digit seconds) to handle long inter-mission gaps.
function formatMissionClock(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(4, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Parse time string to hours and minutes
function parseTime(str) {
  const [time, modifier] = str.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours !== 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}

// Convert time object to Date
function toDate({ hours, minutes }) {
  const now = new Date();
  now.setHours(hours, minutes, 0, 0);
  return new Date(now);
}

// Build schedule timeline from schedule data
function buildScheduleTimeline(data, type, selectedDayType = null) {
  const node = data[type];
  if (!node) {
    console.warn(`Schedule type ${type} not found.`);
    return [];
  }

  const silentPeriods = new Set(node.silentPeriods || []);

  // Only drill into odd/even if present on the node
  const hasOddEven = typeof node === 'object' && (node.odd || node.even);
  const schedule = hasOddEven ? node[selectedDayType || 'odd'] : node;

  if (!schedule) {
    console.warn(`Schedule type ${type} and day ${selectedDayType} not found.`);
    return [];
  }

  const periods = schedule.periods;
  if (!periods) return [];

  const timeline = [];
  const periodNames = Object.keys(periods);

  for (let i = 0; i < periodNames.length; i++) {
    const name = periodNames[i];
    const [startStr, endStr] = periods[name];

    const start = toDate(parseTime(startStr));
    const end = toDate(parseTime(endStr));

    if (i === 0 && schedule['1st_bell']) {
      const prepStart = toDate(parseTime(schedule['1st_bell']));
      timeline.push({
        type: 'prep',
        label: 'Pre-Class Countdown',
        start: prepStart,
        end: start,
      });
    } else if (i > 0) {
      const prevEnd = timeline[timeline.length - 1].end;
      timeline.push({
        type: 'prep',
        label: 'Passing Period',
        start: prevEnd,
        end: start,
      });
    }

    timeline.push({
      type: 'period',
      label: name,
      start,
      end,
      silent: silentPeriods.has(name),
    });
  }

  return timeline;
}

// Fast-path tick: if we already know the target boundary, just subtract.
// Full recalculation only runs when crossing a boundary or on first call.
// This means the expensive timeline search + 14-day calendar scan runs
// once per block (~60-90 min), not once per second.
const updateMissionClock = () => {
  const nowMs = Date.now();

  // Fast path — cached target not yet reached
  if (_clockTargetMs !== null && nowMs < _clockTargetMs) {
    missionClockSeconds.value = Math.floor((_clockTargetMs - nowMs) / 1000);
    return;
  }

  // Slow path — full recalculation needed (first call, boundary crossed, or schedule changed)
  _fullRecalc();
};

function _fullRecalc() {
  const now = new Date();
  const nowMs = now.getTime();
  const block = missionTimeline.value.find(b => now >= b.start && now < b.end);

  if (block) {
    currentBlock.value = block;
    afterSchoolWindow.value = false;
    untilLaunchWindow.value = false;
    _clockTargetMs = block.end.getTime();
    missionClockSeconds.value = Math.floor((_clockTargetMs - nowMs) / 1000);
    return;
  }

  // No active block
  currentBlock.value = null;
  afterSchoolWindow.value = false;
  untilLaunchWindow.value = false;

  // Find the last period end time for today (ignores prep/passing blocks)
  const periodEnds = missionTimeline.value
    .filter(b => b.type === 'period')
    .map(b => b.end);

  const lastPeriodEnd = periodEnds.length
    ? new Date(Math.max(...periodEnds.map(d => d.getTime())))
    : null;

  // Compute today's first bell or earliest period start
  let todayFirstStart = null;
  try {
    const today = new Date(now);
    const resToday = getScheduleForDate(today);
    if (resToday && resToday.scheduleKey) {
      const node = scheduleData[resToday.scheduleKey];
      const hasOddEven = node && (node.odd || node.even);
      const schedule = hasOddEven ? node[resToday.dayType || 'odd'] : node;
      if (schedule) {
        if (schedule['1st_bell']) {
          const { hours, minutes } = parseTime(schedule['1st_bell']);
          todayFirstStart = new Date(today);
          todayFirstStart.setHours(hours, minutes, 0, 0);
        } else if (schedule.periods) {
          for (const name of Object.keys(schedule.periods)) {
            const [startStr] = schedule.periods[name];
            const { hours, minutes } = parseTime(startStr);
            const candidate = new Date(today);
            candidate.setHours(hours, minutes, 0, 0);
            if (!todayFirstStart || candidate < todayFirstStart) todayFirstStart = candidate;
          }
        }
      }
    }
  } catch (_) { /* noop */ }

  const afterSchoolEnd = new Date(now);
  afterSchoolEnd.setHours(16, 20, 0, 0); // 16:20 local time today

  // Helper to find the next school day start time (1st bell if available, otherwise earliest period start)
  const getNextSchoolStart = () => {
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const res = getScheduleForDate(d);
      if (!res) continue;
      const key = res.scheduleKey;
      if (!key) continue;
      const node = scheduleData[key];
      if (!node) continue;
      const hasOddEven = typeof node === 'object' && (node.odd || node.even);
      const schedule = hasOddEven ? node[res.dayType || 'odd'] : node;
      if (!schedule) continue;

      if (schedule['1st_bell']) {
        const { hours, minutes } = parseTime(schedule['1st_bell']);
        const target = new Date(d);
        target.setHours(hours, minutes, 0, 0);
        return target;
      }

      const periods = schedule.periods || {};
      let earliest = null;
      for (const name of Object.keys(periods)) {
        const [startStr] = periods[name];
        const { hours, minutes } = parseTime(startStr);
        const candidate = new Date(d);
        candidate.setHours(hours, minutes, 0, 0);
        if (!earliest || candidate < earliest) earliest = candidate;
      }
      if (earliest) return earliest;
    }
    return null;
  };

  if (lastPeriodEnd && now >= lastPeriodEnd && now < afterSchoolEnd) {
    afterSchoolWindow.value = true;
    _clockTargetMs = afterSchoolEnd.getTime();
    missionClockSeconds.value = Math.floor((_clockTargetMs - nowMs) / 1000);
  } else if (now >= afterSchoolEnd) {
    const nextStart = getNextSchoolStart();
    untilLaunchWindow.value = !!nextStart;
    if (nextStart) {
      _clockTargetMs = nextStart.getTime();
      missionClockSeconds.value = Math.max(0, Math.floor((_clockTargetMs - nowMs) / 1000));
    } else {
      _clockTargetMs = null;
      missionClockSeconds.value = 0;
    }
  } else if (todayFirstStart && now < todayFirstStart) {
    untilLaunchWindow.value = true;
    _clockTargetMs = todayFirstStart.getTime();
    missionClockSeconds.value = Math.max(0, Math.floor((_clockTargetMs - nowMs) / 1000));
  } else {
    _clockTargetMs = null;
    missionClockSeconds.value = 0;
  }
}

// Popup management functions
const toggleSchedulePopup = () => {
  showSchedulePopup.value = !showSchedulePopup.value;
};

const closeSchedulePopup = () => {
  showSchedulePopup.value = false;
};

// Map AcademicCalendar numeric types to bell schedule keys
const calendarTypeToScheduleKey = {
  0: null, // Weekend / no school
  1: 'regular_schedule',
  2: 'early_dismissal',
  3: 'advisory_awards_schedule',
  4: 'rally_schedule',
  5: 'regular_schedule', // Golden Hour (assume regular unless a specific bell is added later)
  6: 'testing_schedule',
  7: 'testing_early_release',
  8: 'eight_period_schedule',
  9: 'minimum_day',
  10: null // Holiday / no bell
};

function getScheduleForDate(dateObj) {
  // academicCalendar: first entry contains type legend; rest entries are days
  const entries = academicCalendar.slice(2); // skip legends at index 0 and 1
  const targetISO = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).toISOString().slice(0, 10);
  const match = entries.find(e => typeof e?.Date === 'string' && e.Date.startsWith(targetISO));
  if (!match) return null;
  const scheduleNum = match['Schedule Type'];
  const parity = match['Parity'];
  const scheduleKey = calendarTypeToScheduleKey[scheduleNum];
  if (!scheduleKey) return { scheduleKey: null, dayType: 'odd' };
  let day = 'odd';
  if (parity === 'odd' || parity === 'even') day = parity;
  else if (parity === 'neutral') day = 'odd';
  return { scheduleKey, dayType: day };
}

function scheduleNextMidnightReset() {
  if (midnightTimerId) {
    clearTimeout(midnightTimerId);
    midnightTimerId = null;
  }
  const now = new Date();
  const then = new Date(now);
  then.setDate(now.getDate() + 1);
  then.setHours(0, 0, 0, 50); // small offset to avoid 00:00:00 race, run at 00:00:00.050
  const delay = then - now;
  midnightTimerId = setTimeout(() => {
    applyTodayFromCalendar();
    scheduleNextMidnightReset();
  }, delay);
}

function applyTodayFromCalendar() {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = dow === 0 || dow === 6;

  if (isWeekend) {
    // Weekends are never in the calendar — always clear schedule, keep dayType
    scheduleType.value = null;
  } else {
    const res = getScheduleForDate(today);
    if (res) {
      scheduleType.value = res.scheduleKey; // null = holiday/no school
      dayType.value = res.dayType;
    } else {
      // Weekday not found in calendar (e.g. summer) — treat as no school
      scheduleType.value = null;
    }
  }

  // Persist today's applied schedule and the date stamp
  try {
    const todayISO = today.toISOString().slice(0, 10);
    localStorage.setItem('missionScheduleType', scheduleType.value ?? '');
    localStorage.setItem('missionDayType', dayType.value);
    localStorage.setItem('missionLastAppliedDate', todayISO);
  } catch (e) {
    console.warn('Failed to save today\'s mission schedule settings:', e);
  }
}

function initializeWatchers() {
  if (initialized) return;
  initialized = true;

  // Determine if we already applied today's schedule on this device
  const todayISO = new Date().toISOString().slice(0, 10);
  let lastApplied = null;
  try {
    lastApplied = localStorage.getItem('missionLastAppliedDate');
  } catch (e) {
    // ignore
  }

  const todayDow = new Date().getDay();
  const todayIsWeekend = todayDow === 0 || todayDow === 6;

  if (lastApplied !== todayISO || todayIsWeekend) {
    // New day, or it's a weekend — always re-derive from calendar (weekends always null)
    applyTodayFromCalendar();
  } else {
    // Same weekday: respect user's saved selection for today (with validation)
    try {
      const savedType = localStorage.getItem('missionScheduleType');
      const savedDay = localStorage.getItem('missionDayType');

      if (savedType && scheduleData[savedType]) {
        scheduleType.value = savedType;

        // Only apply saved day type if the selected schedule supports odd/even
        const node = scheduleData[savedType];
        const hasOddEven = node && (node.odd || node.even);
        if (hasOddEven && (savedDay === 'odd' || savedDay === 'even')) {
          dayType.value = savedDay;
        }
      } else {
        // savedType empty (no school) or invalid — clear schedule, keep dayType
        scheduleType.value = null;
        if (savedDay === 'odd' || savedDay === 'even') {
          dayType.value = savedDay;
        }
      }
    } catch (e) {
      console.warn('Failed to load saved mission schedule settings:', e);
    }
  }

  // Schedule nightly reset to calendar's schedule
  scheduleNextMidnightReset();

  // Initialize timeline when schedule changes and persist selection
  watch([scheduleType, dayType], () => {
    missionTimeline.value = buildScheduleTimeline(scheduleData, scheduleType.value, dayType.value);
    _clockTargetMs = null; // force full recalc on next tick

    // Persist current selections and stamp today's date so reloads today respect user choice
    try {
      const todayISO2 = new Date().toISOString().slice(0, 10);
      localStorage.setItem('missionScheduleType', scheduleType.value);
      localStorage.setItem('missionDayType', dayType.value);
      localStorage.setItem('missionLastAppliedDate', todayISO2);
    } catch (e) {
      console.warn('Failed to save mission schedule settings:', e);
    }

    // Note: Mission clock will only update when "Make It So" button is pressed
  }, { immediate: true });
}

export function useScheduleManager() {
  initializeWatchers();

  function resetScheduleToToday() {
    applyTodayFromCalendar();
  }

  return {
    // State
    missionClockSeconds,
    showSchedulePopup,
    scheduleType,
    dayType,
    currentBlock,
    missionTimeline,
    afterSchoolWindow,
    untilLaunchWindow,

    // Functions
    formatMissionClock,
    updateMissionClock,
    toggleSchedulePopup,
    closeSchedulePopup,
    buildScheduleTimeline,
    resetScheduleToToday
  };
}
