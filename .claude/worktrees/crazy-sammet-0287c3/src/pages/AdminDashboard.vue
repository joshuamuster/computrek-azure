<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>Admin Dashboard</span></div>

    <div class="dashboard-layout">

      <!-- ── LEFT COLUMN ──────────────────────────────────────────────── -->
      <div class="col-main">

      <!-- ── PERIOD HEALTH ─────────────────────────────────────────── -->
      <div class="panel panel-1">
        <div class="panel-header">
          <div>
            <div class="panel-title">PERIOD HEALTH</div>
            <div class="panel-sub">Live status across all departments</div>
          </div>
        </div>

        <!-- Cascade chain indicators -->
        <div class="cascade-section">
          <div class="cascade-row">
            <span class="shift-label">ODD SHIFT</span>
            <template v-for="(pid, idx) in ODD_CHAIN" :key="pid">
              <span :class="['chain-node', healthTierClass(getHealth(pid))]">
                {{ shortLabel(pid) }}
              </span>
              <span v-if="idx < ODD_CHAIN.length - 1" class="chain-arrow">→</span>
            </template>
            <span v-if="oddCascadeActive" class="cascade-badge">⚡ CASCADE ACTIVE</span>
            <span v-else class="cascade-badge cascade-badge--dim">⚡ Inactive</span>
          </div>
          <div class="cascade-row">
            <span class="shift-label">EVEN SHIFT</span>
            <template v-for="(pid, idx) in EVEN_CHAIN" :key="pid">
              <span :class="['chain-node', healthTierClass(getHealth(pid))]">
                {{ shortLabel(pid) }}
              </span>
              <span v-if="idx < EVEN_CHAIN.length - 1" class="chain-arrow">→</span>
            </template>
            <span v-if="evenCascadeActive" class="cascade-badge">⚡ CASCADE ACTIVE</span>
            <span v-else class="cascade-badge cascade-badge--dim">⚡ Inactive</span>
          </div>
        </div>

        <!-- Period cards grid -->
        <div class="period-grid">
          <div
            v-for="p in ACTIVE_PERIODS"
            :key="p.id"
            class="period-card"
            :class="healthTierClass(getHealth(p.id))"
          >
            <div class="card-top">
              <span class="card-period-label">{{ p.label }}</span>
              <span :class="['card-tier-badge', healthTierClass(getHealth(p.id))]">
                {{ tierName(getHealth(p.id)) }}
              </span>
            </div>

            <div class="health-bar-track">
              <div
                class="health-bar-fill"
                :style="{ width: getHealth(p.id) + '%', background: tierColor(getHealth(p.id)) }"
              ></div>
            </div>

            <div class="card-bottom">
              <span class="stat-health">{{ getHealth(p.id).toFixed(1) }}%</span>
              <span
                class="stat-chip"
                :class="{ 'stat-chip--warn': getPendingCount(p.id) > 0 }"
              >
                {{ getPendingCount(p.id) }} pending
              </span>
              <span
                class="stat-chip"
                :class="{ 'stat-chip--danger': getOverdue(p.id) > 0 }"
              >
                {{ getOverdue(p.id) }} overdue
              </span>
            </div>
          </div>
        </div>
      </div>

      </div><!-- /col-main -->

      <!-- ── RIGHT SIDEBAR ────────────────────────────────────────────── -->
      <div class="col-sidebar">

        <!-- ── GRADING QUEUE ─────────────────────────────────────────── -->
        <div class="panel panel-2">
        <div class="panel-header">
          <div>
            <div class="panel-title">GRADING QUEUE</div>
            <div class="panel-sub">Submissions awaiting your review</div>
          </div>
          <div v-if="totalPending > 0" class="panel-badge">{{ totalPending }}</div>
        </div>

        <div v-if="loadingQueue" class="queue-empty">Scanning submissions…</div>

        <div v-else-if="pendingByPeriod.length === 0" class="queue-empty">
          <span class="queue-clear-icon">✓</span>
          All clear — no submissions pending review.
        </div>

        <div v-else class="queue-list">
          <div
            v-for="row in pendingByPeriod"
            :key="row.periodId"
            class="queue-row"
            @click="goToGrading(row.periodId)"
          >
            <div class="queue-period-label">{{ row.label }}</div>
            <div class="queue-count-badge">{{ row.count }}</div>
            <div class="queue-awaiting">awaiting review</div>
            <div class="queue-cta">Grade →</div>
          </div>
        </div>
        </div><!-- /panel-2 -->

      </div><!-- /col-sidebar -->

      <!-- ── WARP CORE STATUS ──────────────────────────────────────────── -->
      <div class="warp-core-section">
        <div class="warp-section-header">
          <div class="panel-title">WARP CORE STATUS</div>
          <div class="panel-sub">Live session energy by department — updates every 60 seconds</div>
        </div>
        <div class="warp-core-grid">
          <WarpCorePanel
            v-for="p in ACTIVE_PERIODS"
            :key="p.id"
            :period-id="p.id"
            :period-label="p.label"
          />
        </div>
      </div>

    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { collection, query, where, onSnapshot, type QueryConstraint } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useShipStatus } from '@/composables/useShipStatus'
import { SCHOOL_YEAR_ID, PERIOD_IDS } from '@/config/schoolYear'
import WarpCorePanel from '@/components/WarpCorePanel.vue'

const router = useRouter()
const { userInfo, isAdmin } = useAuth()
const { statusByPeriod } = useShipStatus()

// ── Period config ────────────────────────────────────────────────────────────
// Only show the 6 periods that have ship system mappings
const ACTIVE_PERIODS = PERIOD_IDS.filter(p =>
  ['period-1','period-2','period-3','period-4','period-5','period-6'].includes(p.id)
)
const ODD_CHAIN  = ['period-1', 'period-3', 'period-5']
const EVEN_CHAIN = ['period-2', 'period-4', 'period-6']

// A period must be at Commendation tier (≥70%) to propagate the cascade
const CASCADE_THRESHOLD = 70

// ── Grading queue ────────────────────────────────────────────────────────────
interface PendingSub {
  id: string
  periodId: string
  submittedAt: any
}

const pendingSubmissions = ref<PendingSub[]>([])
const loadingQueue = ref(true)
let unsubQueue: (() => void) | null = null

// Set up (or replace) the Firestore listener scoped to this user's role.
// Admins see all submitted work. Staff see only the periods listed in their
// approvedUsers doc (periodIds field), which keeps reads proportional to their
// own class load rather than downloading the whole school's queue.
watch(
  userInfo,
  (user) => {
    if (unsubQueue) { unsubQueue(); unsubQueue = null }
    if (!user) return

    const constraints: QueryConstraint[] = [
      where('status', '==', 'submitted'),
      where('schoolYearId', '==', SCHOOL_YEAR_ID),
    ]

    // Non-admin staff: scope the query server-side to their assigned periods.
    // Falls back to an unscoped query if periodIds isn't set yet on their doc
    // (e.g., before an admin assigns them periods via the Users page).
    if (!isAdmin.value) {
      const myPeriodIds: string[] = (user as any).periodIds ?? []
      if (myPeriodIds.length > 0) {
        constraints.push(where('periodId', 'in', myPeriodIds))
      }
      // If no periodIds configured, show nothing rather than the entire school's queue
      else {
        pendingSubmissions.value = []
        loadingQueue.value = false
        return
      }
    }

    const q = query(collection(db, 'submissions'), ...constraints)

    unsubQueue = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as PendingSub))
      pendingSubmissions.value = docs
      loadingQueue.value = false
    })
  },
  { immediate: true },
)

onUnmounted(() => { if (unsubQueue) unsubQueue() })

// ── Derived data ─────────────────────────────────────────────────────────────
const totalPending = computed(() => pendingSubmissions.value.length)

const pendingByPeriod = computed(() => {
  const counts = new Map<string, number>()
  for (const sub of pendingSubmissions.value) {
    counts.set(sub.periodId, (counts.get(sub.periodId) ?? 0) + 1)
  }
  return ACTIVE_PERIODS
    .map(p => ({ periodId: p.id, label: p.label, count: counts.get(p.id) ?? 0 }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)
})

function getPendingCount(periodId: string): number {
  return pendingByPeriod.value.find(r => r.periodId === periodId)?.count ?? 0
}

function getHealth(periodId: string): number {
  return statusByPeriod.value.get(periodId)?.health ?? 100
}

function getOverdue(periodId: string): number {
  return statusByPeriod.value.get(periodId)?.overdueCount ?? 0
}

// ── Cascade ───────────────────────────────────────────────────────────────────
const oddCascadeActive  = computed(() => ODD_CHAIN.every(pid => getHealth(pid) >= CASCADE_THRESHOLD))
const evenCascadeActive = computed(() => EVEN_CHAIN.every(pid => getHealth(pid) >= CASCADE_THRESHOLD))

// ── Tier helpers ──────────────────────────────────────────────────────────────
function healthTierClass(health: number): string {
  if (health >= 90) return 'tier--fullsignal'
  if (health >= 70) return 'tier--commendation'
  if (health >= 50) return 'tier--battleready'
  return 'tier--offduty'
}

function tierName(health: number): string {
  if (health >= 90) return 'Full Signal'
  if (health >= 70) return 'Commendation'
  if (health >= 50) return 'Battle Ready'
  return 'Off-Duty'
}

function tierColor(health: number): string {
  if (health >= 90) return '#ff9900'
  if (health >= 70) return '#5e9f63'
  if (health >= 50) return '#2c5f8f'
  return '#7a2233'
}

function shortLabel(periodId: string): string {
  return periodId.replace('period-', 'P')
}

function goToGrading(periodId?: string): void {
  router.push(periodId ? `/admin/grading?period=${periodId}` : '/admin/grading')
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────────── */
.dashboard-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem 3rem;
  max-width: 1200px;
  align-items: start;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

.col-main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.col-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

@media (max-width: 800px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }
}

/* ── Warp Core section ────────────────────────────────────────────────────────  */
.warp-core-section {
  grid-column: 1 / -1; /* span both columns */
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.warp-section-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.warp-core-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

/* ── Panel shell ──────────────────────────────────────────────────────────────  */
.panel {
  background: rgba(0, 20, 45, 0.55);
  border: 1px solid rgba(153, 204, 255, 0.15);
  border-radius: 0.75rem;
  padding: 1.25rem 1.5rem 1.5rem;
}

.panel-1 {
  flex: 1;
}

.panel-2 {
  flex: 1;
  max-width: 20rem;
}

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

.panel-badge {
  background: #4d99ee;
  color: #fff;
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
  flex-shrink: 0;
}

/* ── Grading queue ────────────────────────────────────────────────────────────  */
.queue-empty {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #6688aa;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  padding: 0.5rem 0;
}

.queue-clear-icon {
  color: #5e9f63;
  font-size: 1.1rem;
  font-weight: 700;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.queue-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(77, 153, 238, 0.06);
  border: 1px solid rgba(77, 153, 238, 0.18);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s;
}

.queue-row:hover {
  background: rgba(77, 153, 238, 0.12);
  border-color: rgba(77, 153, 238, 0.4);
}

.queue-period-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: #aaccff;
  letter-spacing: 0.06em;
  min-width: 4rem;
}

.queue-count-badge {
  background: #4d99ee;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  border-radius: 999px;
  min-width: 1.6rem;
  height: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.35rem;
}

.queue-awaiting {
  flex: 1;
  font-size: 0.78rem;
  color: #99aacc;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.queue-cta {
  font-size: 0.82rem;
  font-weight: 700;
  color: #4d99ee;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* ── Cascade section ──────────────────────────────────────────────────────────  */
.cascade-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 0.5rem;
  border: 1px solid rgba(153, 204, 255, 0.08);
}

.cascade-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.shift-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: #6688aa;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  min-width: 5.5rem;
}

.chain-node {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  border: 2px solid currentColor;
}

.chain-arrow {
  font-size: 0.9rem;
  color: #3a4a66;
}

.cascade-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: #4d99ee;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-left: 0.5rem;
  padding: 0.2rem 0.6rem;
  background: rgba(77, 153, 238, 0.12);
  border-radius: 999px;
  border: 1px solid rgba(77, 153, 238, 0.3);
}

.cascade-badge--dim {
  color: #3a4a66;
  background: rgba(58, 74, 102, 0.12);
  border-color: rgba(58, 74, 102, 0.25);
}

/* ── Period cards grid ────────────────────────────────────────────────────────  */
.period-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: 0.875rem;
}

.period-card {
  background: rgba(0, 15, 35, 0.6);
  border: 1px solid rgba(153, 204, 255, 0.1);
  border-radius: 0.5rem;
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: border-color 0.2s;
}

.period-card:hover {
  border-color: rgba(153, 204, 255, 0.25);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.card-period-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: #99ccff;
  letter-spacing: 0.06em;
}

.card-tier-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
}

.health-bar-track {
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.07);
  border-radius: 2px;
  overflow: hidden;
}

.health-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.card-bottom {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.125rem;
}

.stat-health {
  font-size: 0.8rem;
  font-weight: 700;
  color: #ccdaee;
  letter-spacing: 0.04em;
  flex: 1;
}

.stat-chip {
  font-size: 0.68rem;
  color: #6688aa;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.1rem 0.4rem;
  background: rgba(255,255,255,0.05);
  border-radius: 3px;
}

.stat-chip--warn  { color: #4d99ee; background: rgba(77,153,238,0.1); }
.stat-chip--danger { color: #ff6e6e; background: rgba(255,110,110,0.1); }

/* ── Tier color classes ───────────────────────────────────────────────────────  */
/* Used on chain-node and card-tier-badge */
.tier--fullsignal   { color: #ff9900; border-color: #ff9900; background: rgba(255,153,0,0.12); }
.tier--commendation { color: #5e9f63; border-color: #5e9f63; background: rgba(94,159,99,0.12); }
.tier--battleready  { color: #2c7fcc; border-color: #2c7fcc; background: rgba(44,127,204,0.12); }
.tier--offduty      { color: #7a2233; border-color: #7a2233; background: rgba(122,34,51,0.12); }
</style>
