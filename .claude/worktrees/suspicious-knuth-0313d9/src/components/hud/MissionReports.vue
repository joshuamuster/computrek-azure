<template>
  <div class="hud-panel">
    <div class="panel-title">MISSION REPORTS</div>

    <template v-if="isLoading">
      <div class="hud-loading">LOADING…</div>
    </template>

    <template v-else>
      <!-- Turn-in rate: did the student do the work? -->
      <div class="metric-row">
        <span class="m-label">My Turn-In</span>
        <div class="m-bar">
          <div
            v-for="i in SEGS" :key="i"
            class="m-seg"
            :class="segClass(i, personal?.turnInRate ?? 0, 100, 'green')"
          />
        </div>
        <span class="m-val">
          {{ myTurnIn !== null ? myTurnIn : '—' }}<span v-if="myTurnIn !== null" class="m-unit">%</span>
        </span>
      </div>

      <div class="metric-row class-row">
        <span class="m-label">Class Turn-In</span>
        <div class="m-bar">
          <div
            v-for="i in SEGS" :key="i"
            class="m-seg"
            :class="segClass(i, classStat?.turnInRate ?? 0, 100, 'green')"
          />
        </div>
        <span class="m-val">
          {{ classTurnIn !== null ? classTurnIn : '—' }}<span v-if="classTurnIn !== null" class="m-unit">%</span>
        </span>
      </div>

      <!-- Acceptance rate: of submitted work, how much was accepted? -->
      <div class="metric-row">
        <span class="m-label">My Accepted</span>
        <div class="m-bar">
          <div
            v-for="i in SEGS" :key="i"
            class="m-seg"
            :class="segClass(i, personal?.acceptanceRate ?? 0, 100, 'orange')"
          />
        </div>
        <span class="m-val">
          {{ myAcceptance !== null ? myAcceptance : '—' }}<span v-if="myAcceptance !== null" class="m-unit">%</span>
        </span>
      </div>

      <div class="metric-row class-row">
        <span class="m-label">Class Accepted</span>
        <div class="m-bar">
          <div
            v-for="i in SEGS" :key="i"
            class="m-seg"
            :class="segClass(i, classStat?.acceptanceRate ?? 0, 100, 'orange')"
          />
        </div>
        <span class="m-val">
          {{ classAcceptance !== null ? classAcceptance : '—' }}<span v-if="classAcceptance !== null" class="m-unit">%</span>
        </span>
      </div>

      <!-- Raw counts as a subtle reference line -->
      <div v-if="personal" class="mission-counts">
        {{ personal.submittedCount }} / {{ personal.assignedCount }} submitted
        <span v-if="personal.gradedCount > 0"> · {{ personal.gradedCount }} accepted</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { SEGS, segClass } from '@/composables/useHudMetrics'
import { useStudentMissionStats } from '@/composables/useStudentMissionStats'

const {
  personal,
  classStat,
  isLoading,
  fetchAll,
  startPolling,
  myTurnIn,
  myAcceptance,
  classTurnIn,
  classAcceptance,
} = useStudentMissionStats()

onMounted(async () => {
  await fetchAll()
  startPolling()   // class stats refresh every 5 minutes
})
</script>

<style scoped>
@import '@/assets/styles/hud.css';

.hud-loading {
  font-family: 'Antonio', sans-serif;
  font-size: 0.7rem;
  color: #3366ff;
  letter-spacing: 0.12em;
  text-align: center;
  padding: 0.5rem 0;
  opacity: 0.6;
}

.mission-counts {
  font-family: 'Antonio', sans-serif;
  font-size: 0.62rem;
  color: #334;
  letter-spacing: 0.06em;
  text-align: right;
  margin-top: 0.25rem;
  opacity: 0.55;
}
</style>
