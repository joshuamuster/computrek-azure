<template>
  <div class="hud-panel">
    <div class="panel-title">MISSION REPORTS</div>

    <template v-if="isLoading">
      <div class="hud-loading">LOADING…</div>
    </template>

    <template v-else>
      <!-- Turn-in rate: did the student do the work? -->
      <div class="metric-group">
        <div class="metric-row">
          <span class="m-label">My Turn-In</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, personal?.turnInRate ?? 0, 100, 'green')"
              />
            </div>
            <span class="m-val">{{ myTurnIn !== null ? myTurnIn : '—' }}</span>
          </div>
        </div>
        <div class="metric-row class-row">
          <span class="m-label">Class Turn-In</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, classStat?.turnInRate ?? 0, 100, 'green')"
              />
            </div>
            <span class="m-val">{{ classTurnIn !== null ? classTurnIn : '—' }}</span>
          </div>
        </div>
      </div>

      <!-- Acceptance rate: of submitted work, how much was accepted? -->
      <div class="metric-group">
        <div class="metric-row">
          <span class="m-label">My Accepted</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, personal?.acceptanceRate ?? 0, 100, 'orange')"
              />
            </div>
            <span class="m-val">{{ myAcceptance !== null ? myAcceptance : '—' }}</span>
          </div>
        </div>
        <div class="metric-row class-row">
          <span class="m-label">Class Accepted</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, classStat?.acceptanceRate ?? 0, 100, 'orange')"
              />
            </div>
            <span class="m-val">{{ classAcceptance !== null ? classAcceptance : '—' }}</span>
          </div>
        </div>
      </div>

      <!-- On-time rate: of submitted work, how much was turned in by the due date? -->
      <div class="metric-group">
        <div class="metric-row">
          <span class="m-label">My On-Time</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, personal?.onTimeRate ?? 0, 100, 'cyan')"
              />
            </div>
            <span class="m-val">{{ myOnTime !== null ? myOnTime : '—' }}</span>
          </div>
        </div>
        <div class="metric-row class-row">
          <span class="m-label">Class On-Time</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, classStat?.onTimeRate ?? 0, 100, 'cyan')"
              />
            </div>
            <span class="m-val">{{ classOnTime !== null ? classOnTime : '—' }}</span>
          </div>
        </div>
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
  myOnTime,
  classTurnIn,
  classAcceptance,
  classOnTime,
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

</style>
