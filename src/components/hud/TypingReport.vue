<template>
  <div class="hud-panel">
    <div class="panel-title">TYPING REPORT</div>

    <template v-if="isLoading">
      <div class="hud-loading">LOADING…</div>
    </template>

    <template v-else>
      <!-- Best WPM pair -->
      <div class="metric-group">
        <div class="metric-row">
          <span class="m-label">My Best WPM</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, stats.personalBestWpm ?? 0, WPM_TARGET, 'green')"
              />
            </div>
            <span class="m-val">{{ personalBestWpm }}</span>
          </div>
        </div>
        <div class="metric-row class-row">
          <span class="m-label">Class Best WPM</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, stats.classBestWpm ?? 0, WPM_TARGET, 'green')"
              />
            </div>
            <span class="m-val">{{ classBestWpm }}</span>
          </div>
        </div>
      </div>

      <!-- Average WPM pair -->
      <div class="metric-group">
        <div class="metric-row">
          <span class="m-label">My Avg WPM</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, stats.rollingAvgWpm ?? 0, WPM_TARGET, 'orange')"
              />
            </div>
            <span class="m-val">{{ rollingAvgWpm }}</span>
          </div>
        </div>
        <div class="metric-row class-row">
          <span class="m-label">Class Avg WPM</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, stats.classAvgWpm ?? 0, WPM_TARGET, 'orange')"
              />
            </div>
            <span class="m-val">{{ classAvgWpm }}</span>
          </div>
        </div>
      </div>

      <!-- Accuracy pair -->
      <div class="metric-group">
        <div class="metric-row">
          <span class="m-label">My Accuracy</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, stats.rollingAvgAccy ?? 0, ACC_TARGET, 'cyan')"
              />
            </div>
            <span class="m-val">{{ rollingAvgAccy }}</span>
          </div>
        </div>
        <div class="metric-row class-row">
          <span class="m-label">Class Accuracy</span>
          <div class="m-right">
            <div class="m-bar">
              <div
                v-for="i in SEGS" :key="i"
                class="m-seg"
                :class="segClass(i, stats.classAvgAccy ?? 0, ACC_TARGET, 'cyan')"
              />
            </div>
            <span class="m-val">{{ classAvgAccy }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { WPM_TARGET, ACC_TARGET, SEGS, segClass } from '@/composables/useHudMetrics'
import { useTypingStats } from '@/composables/useTypingStats'

const {
  stats,
  isLoading,
  fetchStats,
  personalBestWpm,
  rollingAvgWpm,
  rollingAvgAccy,
  classBestWpm,
  classAvgWpm,
  classAvgAccy,
} = useTypingStats()

onMounted(fetchStats)
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
