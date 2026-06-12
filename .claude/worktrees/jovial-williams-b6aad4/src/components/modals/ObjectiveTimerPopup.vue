<template>
  <div class="popup-overlay" @click="closePopup">
    <div class="countdown-popup" @click.stop>

      <div class="popup-header">
        <div class="header-decoration"></div>
        <h2>Objective Timer</h2>
        <button class="close-btn" @click="closePopup" aria-label="Close">
          <img src="../../assets/icons/do-not-enter6.svg" alt="Close" class="close-icon-img" />
        </button>
      </div>

      <div class="timer-display" :class="{ running: isCountdownRunning }">
        {{ countdownDisplay }}
      </div>

      <div class="popup-body">
        <div class="setting-section">
          <div class="section-title">
            <div class="title-bar"></div>
            <h3>Add Minutes</h3>
          </div>
          <div class="preset-options">
            <button @click="setCountdown(10)" class="preset-btn btn-minute">+10 min</button>
            <button @click="setCountdown(5)"  class="preset-btn btn-minute">+5 min</button>
            <button @click="setCountdown(3)"  class="preset-btn btn-minute">+3 min</button>
            <button @click="setCountdown(1)"  class="preset-btn btn-minute">+1 min</button>
          </div>
        </div>

        <div class="setting-section">
          <div class="section-title">
            <div class="title-bar"></div>
            <h3>Add Seconds</h3>
          </div>
          <div class="preset-options">
            <button @click="addSeconds(10)" class="preset-btn btn-second">+10 sec</button>
            <button @click="addSeconds(5)"  class="preset-btn btn-second">+5 sec</button>
            <button @click="addSeconds(3)"  class="preset-btn btn-second">+3 sec</button>
            <button @click="addSeconds(1)"  class="preset-btn btn-second">+1 sec</button>
          </div>
        </div>
      </div>

      <div class="timer-controls">
        <button
          @click="makeItSo"
          :disabled="countdownSeconds === 0 && customHours === 0 && customMinutes === 0 && customSeconds === 0"
          class="control-btn start-btn"
        >Make It So</button>
        <button @click="pauseCountdown" :disabled="!isCountdownRunning" class="control-btn pause-btn">Pause</button>
        <button @click="resetCountdown" class="control-btn reset-btn">Reset</button>
      </div>

      <div class="popup-footer">
        <div class="footer-bar"></div>
        <div class="footer-id">OBJ-TIMER-003</div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { onUnmounted } from 'vue';
import { useTimerState as useCountdownTimer } from '@/composables/useTimerState';

// Define emits
const emit = defineEmits(['close']);

// Use the countdown timer composable
const {
  countdownSeconds,
  isCountdownRunning,
  customHours,
  customMinutes,
  customSeconds,
  countdownDisplay,
  setCountdown,
  startCountdown,
  pauseCountdown,
  resetCountdown,
  addCountdownSeconds
} = useCountdownTimer();

// Add seconds via presets (increments)
const addSeconds = (sec) => {
  addCountdownSeconds(sec);
};

// Hold-to-increment support
let holdTimeout = null;
let holdInterval = null;
let boundStop = null;

const stopHold = () => {
  if (holdTimeout) {
    clearTimeout(holdTimeout);
    holdTimeout = null;
  }
  if (holdInterval) {
    clearInterval(holdInterval);
    holdInterval = null;
  }
  if (boundStop) {
    window.removeEventListener('mouseup', boundStop);
    window.removeEventListener('touchend', boundStop);
    boundStop = null;
  }
};

const startHold = (fn) => {
  // start immediately for responsive feel
  fn();
  // ensure no previous timers
  stopHold();
  // set global end listeners in case pointer leaves button
  boundStop = () => stopHold();
  window.addEventListener('mouseup', boundStop);
  window.addEventListener('touchend', boundStop, { passive: true });
  // after a short delay, start repeating quickly
  holdTimeout = setTimeout(() => {
    holdInterval = setInterval(() => {
      fn();
    }, 120);
  }, 300);
};

onUnmounted(() => {
  stopHold();
});

// Close popup
const closePopup = () => {
  stopHold();
  emit('close');
};

// Handle "Make It So": start countdown and close popup
const makeItSo = () => {
  startCountdown();
  closePopup();
};
</script>

<style scoped>
/* ── Transition ──────────────────────────────────────────────────────────── */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-0.625rem); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.modal-fade-enter-active { animation: fadeIn 0.3s ease-out; }
.modal-fade-leave-active { animation: fadeIn 0.3s ease-out reverse; }
.modal-fade-enter-active .countdown-popup { animation: slideDown 0.3s ease-out; }
.modal-fade-leave-active .countdown-popup { animation: slideDown 0.3s ease-out reverse; }

/* ── Overlay ─────────────────────────────────────────────────────────────── */
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

/* ── Container ───────────────────────────────────────────────────────────── */
.countdown-popup {
  background: #000;
  border: 0.125rem solid #3366ff;
  border-radius: 2.5rem;
  width: 90%;
  max-width: 28rem;
  overflow: hidden;
  box-shadow: 0 0 2.5rem rgba(51, 102, 255, 0.3);
  font-family: 'Roboto', sans-serif;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.popup-header {
  background: #3366ff;
  font-family: 'Antonio', sans-serif;
  display: flex;
  align-items: center;
  padding: 0;
  height: 3.75rem;
}

.header-decoration {
  width: 5rem;
  height: 100%;
  background: #99ccff;
  border-radius: 0 0 2.5rem 0;
  flex-shrink: 0;
}

.popup-header h2 {
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
}

.close-icon-img {
  width: 1.875rem;
  height: 1.875rem;
  filter: brightness(0);
  transition: transform 0.2s ease;
}

.close-btn:hover { background: #ffcc00; }
.close-btn:hover .close-icon-img { transform: scale(1.1); }

/* ── Timer Display ───────────────────────────────────────────────────────── */
.timer-display {
  text-align: center;
  font-family: 'Antonio', sans-serif;
  font-size: 3.5rem;
  font-weight: 900;
  letter-spacing: 0.2rem;
  color: #99ccff;
  padding: 1rem 1.25rem 0.25rem;
  line-height: 1;
  transition: color 0.3s;
}

.timer-display.running {
  color: #ff9900;
  text-shadow: 0 0 1rem rgba(255, 153, 0, 0.5);
}

/* ── Body ────────────────────────────────────────────────────────────────── */
.popup-body {
  padding: 1.25rem 1.25rem 0.5rem;
  color: #fff;
}

.setting-section { margin-bottom: 1.25rem; }

.section-title {
  display: flex;
  align-items: center;
  font-family: 'Antonio', sans-serif;
  margin-bottom: 0.75rem;
}

.title-bar {
  width: 0.5rem;
  height: 1.5rem;
  background: #ff9900;
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.section-title h3 {
  margin: 0;
  text-transform: uppercase;
  color: #ff9900;
  font-size: 1rem;
  letter-spacing: 0.0625rem;
}

.preset-options {
  display: flex;
  gap: 0.5rem;
}

.preset-btn {
  flex: 1;
  border: none;
  padding: 0.65rem 0.5rem;
  border-radius: 62rem;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05rem;
  transition: background 0.2s, color 0.2s;
  color: #fff;
}

.btn-minute { background: #3366ff; }
.btn-minute:hover { background: #99ccff; color: #000; }

.btn-second { background: rgba(51, 102, 255, 0.45); }
.btn-second:hover { background: #99ccff; color: #000; }

/* ── Controls ────────────────────────────────────────────────────────────── */
.timer-controls {
  display: flex;
  gap: 0.5rem;
  padding: 0 1.25rem 1.25rem;
}

.control-btn {
  flex: 1;
  border: none;
  padding: 0.75rem;
  border-radius: 62rem;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05rem;
  transition: background 0.2s, color 0.2s;
}

.start-btn { background: #ff9900; color: #000; }
.start-btn:hover:not(:disabled) { background: #ffcc00; }

.pause-btn { background: #3366ff; color: #fff; }
.pause-btn:hover:not(:disabled) { background: #99ccff; color: #000; }

.reset-btn { background: rgba(51, 102, 255, 0.25); color: #99ccff; }
.reset-btn:hover { background: rgba(51, 102, 255, 0.5); color: #fff; }

.control-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Footer ──────────────────────────────────────────────────────────────── */
.popup-footer {
  display: flex;
  align-items: flex-end;
}

.footer-bar {
  flex: 1;
  height: 1.25rem;
  background: #3366ff;
}

.footer-id {
  background: #3366ff;
  color: #000;
  padding: 0 1.25rem;
  font-size: 0.75rem;
  font-weight: bold;
  height: 1.25rem;
  display: flex;
  align-items: center;
  font-family: 'Antonio', sans-serif;
}
</style>
