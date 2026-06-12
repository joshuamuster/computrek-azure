<template>
  <div id="chrono1" class="chronobox">
      <div class="timer1-timer timer1-colors current-pst-time"><span class="t-d">{{ currentPSTTime[0] }}</span><span class="t-d">{{ currentPSTTime[1] }}</span>{{ currentPSTTime[2] }}<span class="t-d">{{ currentPSTTime[3] }}</span><span class="t-d">{{ currentPSTTime[4] }}</span></div>
<!--        <div class="timer-bottom timer1-colors">{{ currentPSTDate }}</div>-->

    <div class="timer1-label pill-button" @click.prevent="toggleCalendar">
<!--        <img src="@/assets/icons/calendar-clock1.svg" alt="Ship Time Icon" class="ship-time-icon" />-->
      Universal <br/>Time
    </div>

    <Teleport to="body">
      <CalendarModal
          :showModal="showCalendarModal"
          @close="showCalendarModal = false"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import CalendarModal from '@/components/modals/CalendarModal.vue';

// Reactive references
const currentPSTTime = ref('00:00');
const currentPSTDate = ref('');

// Calendar modal state
const showCalendarModal = ref(false);
const toggleCalendar = () => {
  showCalendarModal.value = !showCalendarModal.value;
};

// Time in America/Los_Angeles
const getPSTTime = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
};

// Date in America/Los_Angeles
const getPSTDate = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(now);
};

// Update both time and date
const updateTime = () => {
  currentPSTTime.value = getPSTTime();
  currentPSTDate.value = getPSTDate();
};

let timeInterval = null;

onMounted(() => {
  updateTime();
  timeInterval = setInterval(updateTime, 1000);
});

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval);
});
</script>

<style scoped>

.ship-time-icon {
  display: block;
  margin: 0 auto 0.125rem;
  width: 1.5rem;
  height: 1.5rem;
}
</style>