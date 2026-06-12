<template>
  <div class="warp-panel">

    <!-- Header row -->
    <div class="warp-header">
      <div class="warp-title-group">
        <span class="warp-period-label" v-if="periodLabel">{{ periodLabel }}</span>
        <span class="warp-title">WARP CORE ENERGY</span>
      </div>
      <span :class="['status-badge', statusClass]">{{ statusLabel }}</span>
    </div>

    <!-- Phase completion callout -->
    <Transition name="callout">
      <div v-if="activeCallout" :class="['callout-banner', calloutClass]">
        {{ activeCallout }}
      </div>
    </Transition>

    <!-- Loading / no-session states -->
    <div v-if="isLoading" class="warp-state-msg">Scanning…</div>
    <div v-else-if="noSession" class="warp-state-msg warp-state-msg--dim">No active session today</div>

    <!-- Big energy readout -->
    <div v-else class="energy-readout">
      <span class="energy-number">{{ totalEnergy.toFixed(0) }}</span>
      <span class="energy-unit">%</span>
    </div>

    <template v-if="!isLoading && !noSession">

    <!-- Main segmented bar -->
    <div class="main-bar" role="progressbar" :aria-valuenow="totalEnergy" aria-valuemin="0" aria-valuemax="100">
      <!-- Warm-Up zone: occupies 20% of bar width -->
      <div class="zone zone--warmup">
        <div class="zone-fill" :style="{ width: (warmUpProgress * 100) + '%' }"></div>
      </div>
      <div class="zone-gap"></div>
      <!-- Lesson zone: occupies 60% of bar width -->
      <div class="zone zone--lesson">
        <div class="zone-fill" :style="{ width: (lessonProgress * 100) + '%' }"></div>
      </div>
      <div class="zone-gap"></div>
      <!-- Extension zone: occupies 20% of bar width -->
      <div class="zone zone--extension">
        <div class="zone-fill" :style="{ width: (extensionProgress * 100) + '%' }"></div>
      </div>
    </div>

    <!-- Zone labels below main bar -->
    <div class="zone-legend">
      <span class="zone-legend-item zone-legend-item--warmup">WU</span>
      <span class="zone-legend-spacer"></span>
      <span class="zone-legend-item zone-legend-item--lesson">LESSON</span>
      <span class="zone-legend-spacer"></span>
      <span class="zone-legend-item zone-legend-item--extension">EXT</span>
    </div>

    <div class="divider"></div>

    <!-- Sub-bars -->
    <div class="sub-bars">

      <!-- Warm-Up -->
      <div class="sub-row">
        <div class="sub-meta">
          <span class="sub-dot sub-dot--warmup"></span>
          <span class="sub-name">WARM-UP</span>
          <span class="sub-value">{{ warmUpEnergy.toFixed(0) }}<span class="sub-max"> / 20%</span></span>
        </div>
        <div class="sub-track">
          <div class="sub-fill sub-fill--warmup" :style="{ width: (warmUpProgress * 100) + '%' }"></div>
        </div>
      </div>

      <!-- Lesson -->
      <div class="sub-row">
        <div class="sub-meta">
          <span class="sub-dot sub-dot--lesson"></span>
          <span class="sub-name">LESSON</span>
          <span class="sub-value">{{ lessonEnergy.toFixed(0) }}<span class="sub-max"> / 60%</span></span>
        </div>
        <div class="sub-track">
          <div class="sub-fill sub-fill--lesson" :style="{ width: (lessonProgress * 100) + '%' }"></div>
        </div>
      </div>

      <!-- Extension -->
      <div class="sub-row">
        <div class="sub-meta">
          <span class="sub-dot sub-dot--extension"></span>
          <span class="sub-name">EXTENSION</span>
          <span class="sub-value">{{ extensionEnergy.toFixed(0) }}<span class="sub-max"> / 20%</span></span>
        </div>
        <div class="sub-track">
          <div class="sub-fill sub-fill--extension" :style="{ width: (extensionProgress * 100) + '%' }"></div>
        </div>
      </div>

    </div>

    </template><!-- /bars -->
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWarpCore } from '@/composables/useWarpCore'

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  /**
   * When provided, the component fetches live data from Firestore for this period.
   * When omitted, mock props below are used instead (useful for standalone testing).
   */
  periodId?: string
  /** Display label shown above the title bar (e.g. "Period 1"). */
  periodLabel?: string

  // ── Mock / override props (only used when periodId is NOT provided) ──────
  /** Fraction of warm-up completed (0.0 – 1.0). */
  mockWarmUp?: number
  /** Fraction of lesson completed (0.0 – 1.0). */
  mockLesson?: number
  /** Fraction of extension completed (0.0 – 1.0). */
  mockExtension?: number
}

const props = withDefaults(defineProps<Props>(), {
  mockWarmUp:    0.75,
  mockLesson:    0.50,
  mockExtension: 0.0,
})

// ── Data source ───────────────────────────────────────────────────────────────
// When a periodId is given, pull live data. Otherwise use mock props.
const liveData = props.periodId ? useWarpCore(props.periodId).warpCore : null

const isLoading = computed(() => liveData?.value.loading ?? false)
const noSession = computed(() => liveData?.value.noSession ?? false)

const warmUpProgress    = computed(() => liveData ? liveData.value.warmUpProgress    : props.mockWarmUp!)
const lessonProgress    = computed(() => liveData ? liveData.value.lessonProgress    : props.mockLesson!)
const extensionProgress = computed(() => liveData ? liveData.value.extensionProgress : props.mockExtension!)

// ── Energy calculations ──────────────────────────────────────────────────────
const warmUpEnergy    = computed(() => Math.min(warmUpProgress.value,    1) * 20)
const lessonEnergy    = computed(() => Math.min(lessonProgress.value,    1) * 60)
const extensionEnergy = computed(() => Math.min(extensionProgress.value, 1) * 20)

const totalEnergy = computed(() =>
  warmUpEnergy.value + lessonEnergy.value + extensionEnergy.value
)

// ── Phase completion callouts ─────────────────────────────────────────────────
// Fire once when a phase crosses from <1.0 to >=1.0. Clear after 5 seconds.

const activeCallout  = ref<string | null>(null)
const calloutClass   = ref('')
let calloutTimer: ReturnType<typeof setTimeout> | null = null

function triggerCallout(message: string, cssClass: string) {
  if (calloutTimer) clearTimeout(calloutTimer)
  activeCallout.value = message
  calloutClass.value  = cssClass
  calloutTimer = setTimeout(() => { activeCallout.value = null }, 5000)
}

// Track previous progress values so we only fire on the upward crossing
const prevWarmUp    = ref(0)
const prevLesson    = ref(0)
const prevExtension = ref(0)
const prevTotal     = ref(0)

watch(warmUpProgress, (next, prev) => {
  if (prev < 1 && next >= 1) triggerCallout('Systems Check Complete', 'callout--warmup')
  prevWarmUp.value = next
})
watch(lessonProgress, (next, prev) => {
  if (prev < 1 && next >= 1) triggerCallout('Mission Execution Complete', 'callout--lesson')
  prevLesson.value = next
})
watch(extensionProgress, (next, prev) => {
  if (prev < 1 && next >= 1) triggerCallout('Advanced Ops Complete', 'callout--extension')
  prevExtension.value = next
})
watch(totalEnergy, (next, prev) => {
  if (prev < 100 && next >= 100) triggerCallout('Warp Core Online', 'callout--warp')
  prevTotal.value = next
})

// ── Status label ─────────────────────────────────────────────────────────────
const statusLabel = computed(() => {
  const e = totalEnergy.value
  if (e >= 100) return 'Warp Ready'
  if (e >= 90)  return 'Warp Threshold'
  if (e >= 70)  return 'Warp Charging'
  if (e >= 40)  return 'Impulse Power'
  return 'Offline'
})

const statusClass = computed(() => {
  const e = totalEnergy.value
  if (e >= 100) return 'status--warp-ready'
  if (e >= 90)  return 'status--threshold'
  if (e >= 70)  return 'status--charging'
  if (e >= 40)  return 'status--impulse'
  return 'status--offline'
})
</script>

<style scoped>
/* ── Panel shell ────────────────────────────────────────────────────────────── */
.warp-panel {
  background: rgba(0, 15, 35, 0.65);
  border: 1px solid rgba(153, 204, 255, 0.15);
  border-radius: 0.75rem;
  padding: 1rem 1.125rem 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.warp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.warp-title-group {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.warp-period-label {
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #99ccff;
  text-transform: uppercase;
  line-height: 1;
}

.warp-title {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #445566;
  text-transform: uppercase;
}

/* ── State messages ──────────────────────────────────────────────────────────── */
.warp-state-msg {
  font-size: 0.8rem;
  color: #99bbdd;
  letter-spacing: 0.06em;
  padding: 0.5rem 0;
}

.warp-state-msg--dim {
  color: #3a5070;
  font-style: italic;
}

/* ── Status badge ───────────────────────────────────────────────────────────── */
.status-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  white-space: nowrap;
}

.status--offline    { color: #664455; background: rgba(102,68,85,0.15); }
.status--impulse    { color: #4d99ee; background: rgba(77,153,238,0.12); }
.status--charging   { color: #34b8cc; background: rgba(52,184,204,0.12); }
.status--threshold  { color: #cc9900; background: rgba(204,153,0,0.12); }
.status--warp-ready { color: #ff9900; background: rgba(255,153,0,0.15); }

/* ── Energy readout ─────────────────────────────────────────────────────────── */
.energy-readout {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  line-height: 1;
}

.energy-number {
  font-size: 3rem;
  font-weight: 800;
  color: #cce4ff;
  letter-spacing: -0.02em;
  line-height: 1;
}

.energy-unit {
  font-size: 1.1rem;
  font-weight: 700;
  color: #6688aa;
  letter-spacing: 0.04em;
  align-self: flex-end;
  padding-bottom: 0.3rem;
}

/* ── Main segmented bar ─────────────────────────────────────────────────────── */
.main-bar {
  display: flex;
  align-items: stretch;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  background: rgba(255,255,255,0.04);
}

/* Each zone occupies its proportional share of the bar via flex */
.zone {
  position: relative;
  overflow: hidden;
  background: rgba(255,255,255,0.05);
}

.zone--warmup    { flex: 20; }
.zone--lesson    { flex: 60; }
.zone--extension { flex: 20; }

.zone-gap {
  flex: 0 0 2px;
  background: rgba(0, 15, 35, 0.65); /* same as panel background — acts as a groove */
}

.zone-fill {
  height: 100%;
  border-radius: 0;
  transition: width 0.35s ease;
}

.zone--warmup    .zone-fill { background: #4dc8d8; }
.zone--lesson    .zone-fill { background: #4d88ee; }
.zone--extension .zone-fill { background: #8855cc; }

/* ── Zone legend ────────────────────────────────────────────────────────────── */
.zone-legend {
  display: flex;
  align-items: center;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #3a5070;
}

.zone-legend-item         { text-transform: uppercase; }
.zone-legend-item--warmup { color: #3a9aaa; flex: 20; }
.zone-legend-item--lesson { color: #3a6aaa; flex: 60; text-align: center; }
.zone-legend-item--extension { color: #663399; flex: 20; text-align: right; }
.zone-legend-spacer       { flex: 0 0 2px; }

/* ── Divider ────────────────────────────────────────────────────────────────── */
.divider {
  height: 1px;
  background: rgba(153, 204, 255, 0.08);
  margin: 0.125rem 0;
}

/* ── Sub-bars ───────────────────────────────────────────────────────────────── */
.sub-bars {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sub-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sub-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.sub-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sub-dot--warmup    { background: #4dc8d8; }
.sub-dot--lesson    { background: #4d88ee; }
.sub-dot--extension { background: #8855cc; }

.sub-name {
  flex: 1;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #6688aa;
  text-transform: uppercase;
}

.sub-value {
  font-size: 0.72rem;
  font-weight: 700;
  color: #99bbdd;
  letter-spacing: 0.04em;
}

.sub-max {
  color: #3a5070;
  font-weight: 400;
}

.sub-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
}

.sub-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.35s ease;
}

.sub-fill--warmup    { background: #4dc8d8; }
.sub-fill--lesson    { background: #4d88ee; }
.sub-fill--extension { background: #8855cc; }

/* ── Phase callout banner ───────────────────────────────────────────────────── */
.callout-banner {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: center;
  padding: 0.35rem 0.75rem;
  border-radius: 0.4rem;
  border: 1px solid currentColor;
}

.callout--warmup    { color: #4dc8d8; background: rgba(77, 200, 216, 0.10); }
.callout--lesson    { color: #4d88ee; background: rgba(77, 136, 238, 0.10); }
.callout--extension { color: #8855cc; background: rgba(136, 85, 204, 0.10); }
.callout--warp      { color: #ff9900; background: rgba(255, 153, 0,  0.12); }

/* ── Callout transition ─────────────────────────────────────────────────────── */
.callout-enter-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.callout-leave-active { transition: opacity 0.5s ease, transform 0.5s ease; }
.callout-enter-from   { opacity: 0; transform: translateY(-4px); }
.callout-leave-to     { opacity: 0; transform: translateY(-4px); }
</style>
