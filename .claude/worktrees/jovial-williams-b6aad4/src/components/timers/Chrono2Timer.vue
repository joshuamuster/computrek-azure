<template>
  <div id="chrono2" class="chronobox">
      <div class="timer2-timer timer2-colors" :class="{ 'urgent-blink': missionClockSeconds > 0 && missionClockSeconds <= 120 }"><span v-if="clockChars.suppress < 1" class="t-d">{{ clockChars.chars[0] }}</span><span v-if="clockChars.suppress < 2" class="t-d">{{ clockChars.chars[1] }}</span><span v-if="clockChars.suppress < 3" class="t-d">{{ clockChars.chars[2] }}</span><span class="t-d">{{ clockChars.chars[3] }}</span>{{ clockChars.chars[4] }}<span class="t-d">{{ clockChars.chars[5] }}</span><span class="t-d">{{ clockChars.chars[6] }}</span></div>
<!--        <div class="timer-bottom timer2-colors">{{ scheduleLabel }}</div>-->

    <div class="timer2-label pill-button" @click.prevent="toggleSchedulePopup">
<!--        <img src="@/assets/icons/hourglass-half3.svg" alt="Ship Time Icon" class="ship-time-icon" />-->
      Mission <br/>Clock
    </div>
    <!-- Schedule Settings Popup -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <MissionClockPopup
          v-if="showSchedulePopup"
          @close="closeSchedulePopup"
          @update-schedule="handleScheduleUpdate"
        />
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import MissionClockPopup from '../modals/MissionClockPopup.vue';
import { useScheduleManager } from '@/composables/useScheduleManager';
import scheduleData from '@/assets/data/calendar/2526-BellSchedule.json';

// Use the schedule manager composable
const {
  missionClockSeconds,
  showSchedulePopup,
  toggleSchedulePopup,
  closeSchedulePopup,
  updateMissionClock,
  formatMissionClock,
  scheduleType,
  dayType,
  currentBlock,
  afterSchoolWindow,
  untilLaunchWindow
} = useScheduleManager();

// Suppress leading zeros from the 4-digit minute portion (positions 0–1 only).
// Positions 2–3 (last two minute digits) are always shown, so minimum is "MM:SS".
// e.g. "0885:51" → suppress=1 → shows "885:51"
//      "0085:51" → suppress=2 → shows  "85:51"
//      "0005:51" → suppress=2 → shows  "05:51"
const clockChars = computed(() => {
  const str = formatMissionClock(missionClockSeconds.value); // "MMMM:SS"
  let suppress = 0;
  for (let i = 0; i < 2; i++) {
    if (str[i] === '0') suppress++;
    else break;
  }
  return { chars: str.split(''), suppress };
});

// Human-readable schedule label with contextual overrides
const scheduleLabel = computed(() => {
  // During Lunch: show "Lunch"
  const label = currentBlock?.value?.label || '';
  if (label && /lunch/i.test(label)) {
    return 'Lunch';
  }

  // Between last class end and 16:20: show "After School"
  if (afterSchoolWindow?.value) {
    return 'After School';
  }

  // After After School through next day's first bell: show "Until Launch"
  if (untilLaunchWindow?.value) {
    return 'Until Next Mission';
  }

  // Otherwise, show schedule name as before
  const key = scheduleType?.value;
  if (!key) return 'No School';
  const node = scheduleData[key];
  const category = node?.category || key;
  const hasOddEven = node && (node.odd || node.even);
  if (hasOddEven) {
    const parity = dayType?.value === 'even' ? 'Even' : 'Odd';
    return `${category} (${parity})`;
  }
  return category;
});

// Handle schedule updates from the popup
const handleScheduleUpdate = () => {
  updateMissionClock();
  closeSchedulePopup();
};

// Set up mission clock interval
let missionClockInterval = null;

onMounted(() => {
  // Update mission clock immediately on mount
  updateMissionClock();

  // Set up interval to update mission clock every second
  missionClockInterval = setInterval(updateMissionClock, 1000);
});

// Clean up interval when component unmounts
onUnmounted(() => {
  if (missionClockInterval) {
    clearInterval(missionClockInterval);
  }
});
</script>

<style scoped>
.ship-time-icon {
  display: block;
  margin: 0 auto 0.125rem;
  width: 1.5rem;
  height: 1.5rem;
}

/* When 2 minutes (120s) remain, turn red and blink at 1 Hz */
.timer2-timer.urgent-blink {
  color: #d00; /* red */
  animation: blink-1hz 1s steps(1, end) infinite alternate;
}

@keyframes blink-1hz {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Respect users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  .timer2-timer.urgent-blink {
    animation: none;
  }
}
</style>
