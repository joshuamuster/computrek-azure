<template>
  <div class="atrisk-panel">

    <!-- ── Header ───────────────────────────────────────────────────────── -->
    <div class="panel-header">
      <div>
        <div class="panel-title">FLAGGED CADETS</div>
        <div class="panel-sub">Students with active risk indicators this period</div>
      </div>
      <div class="header-right">
        <div v-if="!loading && alerts.length > 0" class="panel-badge" :style="badgeStyle">
          {{ alerts.length }}
        </div>
        <button
          class="refresh-btn"
          :class="{ 'refresh-btn--spinning': loading }"
          :disabled="loading"
          title="Re-scan for at-risk cadets"
          @click="doRefresh"
        >↻</button>
      </div>
    </div>

    <!-- ── Loading ──────────────────────────────────────────────────────── -->
    <div v-if="loading" class="state-msg">Scanning crew records…</div>

    <!-- ── All clear ────────────────────────────────────────────────────── -->
    <div v-else-if="alerts.length === 0" class="all-clear">
      <span class="all-clear-icon">✓</span>
      All cadets are on track — no risk indicators detected.
    </div>

    <!-- ── Alert rows ────────────────────────────────────────────────────── -->
    <div v-else class="alert-list">
      <div
        v-for="alert in alerts"
        :key="alert.uid"
        class="alert-row"
        :style="rowAccentStyle(alert.riskLevel)"
      >
        <!-- Left: name + badge + factor chips -->
        <div class="alert-main">
          <span class="alert-name">{{ alert.displayName }}</span>
          <span class="risk-badge" :style="riskBadgeStyle(alert.riskLevel)">
            {{ alert.riskLevel }}
          </span>
          <span v-for="f in alert.factors" :key="f" class="risk-factor">{{ f }}</span>
        </div>

        <!-- Middle: trend arrows -->
        <div class="alert-trends">
          <span
            v-if="alert.wpmTrend && alert.wpmTrend !== 'flat'"
            :class="['trend-chip', `trend-chip--${alert.wpmTrend}`]"
          >{{ trendIcon(alert.wpmTrend) }} WPM</span>
          <span
            v-if="alert.turnInTrend && alert.turnInTrend !== 'flat'"
            :class="['trend-chip', `trend-chip--${alert.turnInTrend}`]"
          >{{ trendIcon(alert.turnInTrend) }} Turn-in</span>
        </div>

        <!-- Right: link to cadet profile -->
        <RouterLink :to="`/admin/cadet/${alert.uid}`" class="detail-link">View →</RouterLink>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '@/composables/useAuth.js'
import { useStruggleDetection, type RiskLevel, type TrendDir } from '@/composables/useStruggleDetection'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{ periodId: string }>()

const { effectiveTeacherEmail } = useAuth()
const { alerts, loading, fetchAlerts } = useStruggleDetection()

// ── Data loading ──────────────────────────────────────────────────────────────
watch(
  [() => props.periodId, effectiveTeacherEmail],
  ([periodId]) => {
    fetchAlerts(periodId, effectiveTeacherEmail.value ?? undefined)
  },
  { immediate: true },
)

function doRefresh() {
  fetchAlerts(props.periodId, effectiveTeacherEmail.value ?? undefined)
}

// ── Display helpers ───────────────────────────────────────────────────────────
const RISK_COLOR: Record<RiskLevel, string> = {
  high:   '#c0392b',
  medium: '#ff9900',
  low:    '#e3c720',
}

// Count badge uses the highest risk level present
const badgeStyle = computed(() => {
  const top = alerts.value.some(a => a.riskLevel === 'high')   ? 'high'
            : alerts.value.some(a => a.riskLevel === 'medium') ? 'medium'
            : 'low'
  const c = RISK_COLOR[top]
  return { background: c, color: top === 'low' ? '#1a1a1a' : '#fff' }
})

function riskBadgeStyle(level: RiskLevel) {
  const c = RISK_COLOR[level]
  return { background: `${c}22`, color: c, borderColor: `${c}55` }
}

function rowAccentStyle(level: RiskLevel) {
  const c = RISK_COLOR[level]
  return { borderLeftColor: `${c}66` }
}

function trendIcon(dir: TrendDir): string {
  if (dir === 'up')   return '↑'
  if (dir === 'down') return '↓'
  return '→'
}
</script>

<style scoped>
/* ── Panel shell ─────────────────────────────────────────────────────────────── */
.atrisk-panel {
  background: rgba(0, 20, 45, 0.55);
  border: 1px solid rgba(153, 204, 255, 0.15);
  border-radius: 0.75rem;
  padding: 1.25rem 1.5rem 1.25rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

/* ── Header ──────────────────────────────────────────────────────────────────── */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.panel-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #4d99ee;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.panel-sub {
  font-size: 0.75rem;
  color: #6688aa;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 0.2rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.panel-badge {
  font-size: 0.8rem;
  font-weight: 800;
  border-radius: 999px;
  min-width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.4rem;
  letter-spacing: 0;
}

/* ── Refresh button ──────────────────────────────────────────────────────────── */
.refresh-btn {
  background: none;
  border: 1px solid rgba(77, 153, 238, 0.3);
  color: #6688aa;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  font-size: 1.1rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-btn:hover:not(:disabled) {
  color: #99ccff;
  border-color: rgba(77, 153, 238, 0.6);
}

.refresh-btn--spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── State messages ──────────────────────────────────────────────────────────── */
.state-msg {
  color: #99bbdd;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  padding: 0.5rem 0;
}

.all-clear {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #5e9f63;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  padding: 0.25rem 0;
}

.all-clear-icon {
  font-size: 1.1rem;
  font-weight: 700;
}

/* ── Alert list ──────────────────────────────────────────────────────────────── */
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.alert-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0.875rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(153, 204, 255, 0.08);
  border-left-width: 3px;
  border-radius: 0.4rem;
  transition: background 0.15s;
}

.alert-row:hover { background: rgba(255, 255, 255, 0.05); }

/* ── Alert row sections ──────────────────────────────────────────────────────── */
.alert-main {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.alert-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #cce0ff;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.risk-badge {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.12rem 0.5rem;
  border-radius: 3px;
  border: 1px solid transparent;
  white-space: nowrap;
  flex-shrink: 0;
}

.risk-factor {
  font-size: 0.68rem;
  color: #6688aa;
  letter-spacing: 0.04em;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.04);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

/* ── Trend chips ─────────────────────────────────────────────────────────────── */
.alert-trends {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

.trend-chip {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.1rem 0.45rem;
  border-radius: 3px;
  white-space: nowrap;
}

.trend-chip--up   { background: rgba(94, 159, 99, 0.15);  color: #5e9f63; }
.trend-chip--down { background: rgba(192, 57, 43, 0.15);  color: #c0392b; }

/* ── Detail link ─────────────────────────────────────────────────────────────── */
.detail-link {
  font-size: 0.78rem;
  font-weight: 700;
  color: #4d99ee;
  text-decoration: none;
  opacity: 0.55;
  transition: opacity 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.detail-link:hover { opacity: 1; }
</style>
