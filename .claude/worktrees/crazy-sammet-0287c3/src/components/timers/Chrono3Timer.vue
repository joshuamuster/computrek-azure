<template>
  <div id="chrono3" class="chronobox">
      <div class="timer3-timer timer3-colors" :class="{ 'timer-active': countdownSeconds > 0 && isCountdownRunning }"><span class="t-d">{{ countdownDisplay[0] }}</span><span class="t-d">{{ countdownDisplay[1] }}</span>{{ countdownDisplay[2] }}<span class="t-d">{{ countdownDisplay[3] }}</span><span class="t-d">{{ countdownDisplay[4] }}</span></div>
    <div class="timer3-label pill-button" @click.prevent="toggleCountdownPopup">
<!--        <img src="@/assets/icons/compass4.svg" alt="Ship Time Icon" class="ship-time-icon" />-->
      Objective <br/>Timer
    </div>
  <!--    <div class="timer-bottom timer3-colors">PST</div>-->
    <!-- Countdown Timer Popup -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <ObjectiveTimerPopup
          v-if="showCountdownPopup"
          @close="closeCountdownPopup"
        />
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import ObjectiveTimerPopup from '../modals/ObjectiveTimerPopup.vue';
import { useTimerState as useCountdownTimer } from '@/composables/useTimerState';

// Use the countdown timer composable
const {
  showCountdownPopup,
  countdownSeconds,
  isCountdownRunning,
  countdownDisplay,
  toggleCountdownPopup,
  closeCountdownPopup,
  loadCountdownState,
  cleanup
} = useCountdownTimer();

// Initialize countdown state on mount
onMounted(() => {
  loadCountdownState(); // Restore countdown timer state from localStorage
});

// Clean up on unmount
onUnmounted(() => {
  cleanup();
});
</script>

<style scoped>
/* Timer active state styling */
.timer-active {
  opacity: 1 !important;
}

.ship-time-icon {
  display: block;
  margin: 0 auto 0.125rem;
  width: 1.5rem;
  height: 1.5rem;
}
</style>
