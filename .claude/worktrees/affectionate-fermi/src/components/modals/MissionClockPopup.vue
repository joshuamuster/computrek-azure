<template>
  <div class="popup-overlay" @click="closePopup">
    <div class="mission-clock-popup" @click.stop>

      <div class="popup-header">
        <div class="header-decoration"></div>
        <h2>Mission Schedule</h2>
        <button class="close-btn" @click="closePopup" aria-label="Close">
          <img src="../../assets/icons/do-not-enter6.svg" alt="Close" class="close-icon-img" />
        </button>
      </div>

      <div class="popup-body">
        <div class="setting-section">
          <div class="section-title">
            <div class="title-bar"></div>
            <h3>Schedule Type</h3>
          </div>
          <div class="popup-columns">
            <div class="popup-col">
              <label v-for="type in leftTypes" :key="type" class="schedule-label">
                <input type="radio" :value="type" v-model="scheduleType" class="schedule-radio" />
                {{ getCategory(type) }}
              </label>
            </div>
            <div class="popup-col">
              <label v-for="type in rightTypes" :key="type" class="schedule-label">
                <input type="radio" :value="type" v-model="scheduleType" class="schedule-radio" />
                {{ getCategory(type) }}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="action-controls">
        <button @click="resetToToday" class="control-btn reset-btn" title="Reset to today's schedule from the Academic Calendar">Reset to Today</button>
        <button @click="makeItSo" class="control-btn start-btn">Make It So</button>
      </div>

      <div class="popup-footer">
        <div class="footer-bar"></div>
        <div class="footer-id">MISSION-CLK-002</div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { useScheduleManager } from '@/composables/useScheduleManager.js';
import scheduleData from '@/assets/data/calendar/2526-BellSchedule.json';

// Define emits
const emit = defineEmits(['close', 'update-schedule']);

// Use the schedule manager composable
const { scheduleType, resetScheduleToToday } = useScheduleManager();

// Schedule type options
const scheduleTypes = Object.keys(scheduleData);

// Split schedule types into two columns
const midIndex = Math.ceil(scheduleTypes.length / 2);
const leftTypes = scheduleTypes.slice(0, midIndex);
const rightTypes = scheduleTypes.slice(midIndex);

const getCategory = (type) => scheduleData[type]?.category || type;

// Close popup
const closePopup = () => {
  emit('close');
};

// Handle "Make It So" button click
const makeItSo = () => {
  emit('update-schedule');
  emit('close');
};

// Handle Reset button click
const resetToToday = () => {
  resetScheduleToToday();
  emit('update-schedule');
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
.modal-fade-enter-active .mission-clock-popup { animation: slideDown 0.3s ease-out; }
.modal-fade-leave-active .mission-clock-popup { animation: slideDown 0.3s ease-out reverse; }

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
.mission-clock-popup {
  background: #000;
  border: 0.125rem solid #3366ff;
  border-radius: 2.5rem;
  width: 90%;
  max-width: 34rem;
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

/* ── Body ────────────────────────────────────────────────────────────────── */
.popup-body {
  padding: 1.25rem;
  color: #fff;
}

.setting-section { margin-bottom: 0.5rem; }

.section-title {
  display: flex;
  align-items: center;
  font-family: 'Antonio', sans-serif;
  margin-bottom: 1rem;
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

.popup-columns {
  display: flex;
  gap: 1.5rem;
}

.popup-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schedule-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.2rem 0;
}

.schedule-label:hover { color: #99ccff; }

.schedule-radio {
  accent-color: #3366ff;
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

/* ── Action Controls ─────────────────────────────────────────────────────── */
.action-controls {
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
.start-btn:hover { background: #ffcc00; }

.reset-btn { background: rgba(51, 102, 255, 0.25); color: #99ccff; }
.reset-btn:hover { background: rgba(51, 102, 255, 0.5); color: #fff; }

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
