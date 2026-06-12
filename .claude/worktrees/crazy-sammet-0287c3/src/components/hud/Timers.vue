<template>
    <div class="hud-panel">
      <div class="panel-title">Stellar Chronology</div>
      <div v-if="scheduleLabel" class="schedule-label">{{ scheduleLabel }}</div>
      <Chrono1Timer />
      <Chrono2Timer />
      <Chrono3Timer />
    </div>
</template>

<script setup>
import { computed } from 'vue'
import Chrono1Timer   from '@/components/timers/Chrono1Timer.vue'
import Chrono2Timer   from '@/components/timers/Chrono2Timer.vue'
import Chrono3Timer   from '@/components/timers/Chrono3Timer.vue'
import { useScheduleManager } from '@/composables/useScheduleManager'

const { scheduleType, dayType } = useScheduleManager()

const scheduleKeyToLabel = {
  regular_schedule:          'Normal Day',
  early_dismissal:           'Early Dismissal',
  advisory_awards_schedule:  'Advisory/Awards Day',
  rally_schedule:            'Rally Day',
  testing_schedule:          'Testing Day',
  eight_period_schedule:     '8-Period Day',
  minimum_day:               'Minimum Day',
  interstellar_gas_day:      'Interstellar Gas Day',
}

const scheduleLabel = computed(() => {
  if (!scheduleType.value) return null
  const typeLabel = scheduleKeyToLabel[scheduleType.value] ?? scheduleType.value
  const day = dayType.value ? dayType.value.charAt(0).toUpperCase() + dayType.value.slice(1) : ''
  return day ? `${day} ${typeLabel}` : typeLabel
})
</script>

<style scoped>
@import '@/assets/styles/classic.css';
@import '@/assets/styles/hud.css';

.hud-panel {
  flex: initial !important;
  //padding-left: 1.5rem !important;
  //padding-right: 1.5rem !important;
}

.schedule-label {
  color: var(--champsdefault);
  text-align: center;
  font-size: 0.75rem;
  opacity: 1;
  margin-top: -0.25rem;
  margin-bottom: 0.25rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
</style>
