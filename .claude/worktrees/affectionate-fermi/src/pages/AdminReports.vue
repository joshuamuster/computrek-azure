<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>Admin Reports</span></div>

    <div class="dashboard-container">

      <div class="cadet-header">
        <div class="cadet-name">{{ userInfo?.displayName ?? 'Administrator' }}</div>
        <div class="cadet-meta">Analytics Console</div>
      </div>

      <!-- Class Performance Chart -->
      <div class="chart-panel">
        <div class="chart-heading">Class Performance by Period</div>
        <div class="chart-subheading">Avg Grade &amp; Turn-in Rate — placeholder data</div>

        <svg class="perf-chart" viewBox="0 0 600 260" preserveAspectRatio="xMidYMid meet">

          <!-- Gridlines + Y-axis labels -->
          <g v-for="tick in yTicks" :key="tick">
            <line
              :x1="LEFT" :y1="yScale(tick)"
              :x2="LEFT + PLOT_W" :y2="yScale(tick)"
              stroke="#2d3050" stroke-width="1"
            />
            <text
              :x="LEFT - 6" :y="yScale(tick) + 4"
              text-anchor="end" fill="#556" font-size="11" font-family="monospace"
            >{{ tick }}%</text>
          </g>

          <!-- Grouped bars -->
          <g v-for="(period, i) in periods" :key="period.label">

            <!-- Avg Grade bar -->
            <rect
              :x="gradeX(i)" :y="yScale(period.avgGrade)"
              :width="BAR_W" :height="BOTTOM - yScale(period.avgGrade)"
              fill="#89f" rx="2"
            />
            <!-- Avg Grade value label -->
            <text
              :x="gradeX(i) + BAR_W / 2" :y="yScale(period.avgGrade) - 5"
              text-anchor="middle" fill="#89f" font-size="10" font-family="monospace"
            >{{ period.avgGrade }}%</text>

            <!-- Turn-in bar -->
            <rect
              :x="turnInX(i)" :y="yScale(period.turnIn)"
              :width="BAR_W" :height="BOTTOM - yScale(period.turnIn)"
              fill="#f96" rx="2"
            />
            <!-- Turn-in value label -->
            <text
              :x="turnInX(i) + BAR_W / 2" :y="yScale(period.turnIn) - 5"
              text-anchor="middle" fill="#f96" font-size="10" font-family="monospace"
            >{{ period.turnIn }}%</text>

            <!-- Period label -->
            <text
              :x="groupCenterX(i)" :y="BOTTOM + 18"
              text-anchor="middle" fill="#89a" font-size="11" font-family="monospace"
              font-weight="600"
            >{{ period.label }}</text>
          </g>

          <!-- Axes -->
          <line :x1="LEFT" :y1="TOP" :x2="LEFT" :y2="BOTTOM" stroke="#445" stroke-width="1" />
          <line :x1="LEFT" :y1="BOTTOM" :x2="LEFT + PLOT_W" :y2="BOTTOM" stroke="#445" stroke-width="1" />

        </svg>

        <!-- Legend -->
        <div class="chart-legend">
          <span class="legend-item">
            <span class="legend-swatch" style="background:#89f"></span>
            Avg Grade
          </span>
          <span class="legend-item">
            <span class="legend-swatch" style="background:#f96"></span>
            Turn-in Rate
          </span>
        </div>
      </div>

    </div>
  </section>
</template>

<script setup>
import { useAuth } from '@/composables/useAuth';

const { userInfo } = useAuth();

// ── Placeholder data — replace with real Firestore queries later ──
const periods = [
  { label: 'Period 1', avgGrade: 84, turnIn: 91 },
  { label: 'Period 2', avgGrade: 77, turnIn: 68 },
  { label: 'Period 3', avgGrade: 88, turnIn: 95 },
  { label: 'Period 4', avgGrade: 72, turnIn: 74 },
  { label: 'Period 5', avgGrade: 80, turnIn: 83 },
];

// ── Chart geometry (SVG units, viewBox 600×260) ──
const LEFT    = 46;
const TOP     = 16;
const BOTTOM  = 210;
const PLOT_W  = 540;

const GROUP_W = PLOT_W / periods.length;
const BAR_W   = GROUP_W * 0.28;
const BAR_GAP = GROUP_W * 0.05;

const yTicks = [0, 25, 50, 75, 100];

function yScale(val) {
  return BOTTOM - (val / 100) * (BOTTOM - TOP);
}

function groupCenterX(i) {
  return LEFT + i * GROUP_W + GROUP_W / 2;
}

function gradeX(i) {
  return groupCenterX(i) - BAR_W - BAR_GAP / 2;
}

function turnInX(i) {
  return groupCenterX(i) + BAR_GAP / 2;
}
</script>

<style scoped>
.dashboard-container {
  padding: 1.25rem 1.5rem;
  max-width: 900px;
}

.cadet-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.75rem 0 1rem;
  border-bottom: 2px solid #2d3050;
  margin-bottom: 1.5rem;
}
.cadet-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--almond-creme, #fba);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.cadet-meta {
  font-size: 0.78rem;
  color: var(--gray, #668);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Chart panel */
.chart-panel {
  background: #12141f;
  border: 1px solid #2d3050;
  border-radius: 4px;
  padding: 1.25rem 1.5rem 1rem;
  margin-bottom: 1.5rem;
}
.chart-heading {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--almond-creme, #fba);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.2rem;
}
.chart-subheading {
  font-size: 0.72rem;
  color: var(--gray, #668);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.75rem;
}
.perf-chart {
  width: 100%;
  height: auto;
  display: block;
}

/* Legend */
.chart-legend {
  display: flex;
  gap: 1.5rem;
  padding-left: 2.5rem;
  margin-top: 0.25rem;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--almond-creme, #fba);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}
</style>
