<template>
  <div class="roster-panel">

    <!-- ── Header ───────────────────────────────────────────────────────── -->
    <div class="panel-header">
      <div>
        <div class="panel-title">LIVE ROSTER</div>
        <div class="panel-sub">
          {{ rows.length }} cadet{{ rows.length !== 1 ? 's' : '' }}
          <span class="sub-dot">·</span>
          conduct is live
          <span v-if="rows.some(r => !!r.alert)" class="sub-dot">·</span>
          <span v-if="rows.some(r => !!r.alert)" class="sub-risk-count">
            {{ rows.filter(r => !!r.alert).length }} flagged
          </span>
        </div>
      </div>
      <button
        class="refresh-btn"
        :class="{ 'refresh-btn--spinning': isRefreshing }"
        :disabled="isRefreshing"
        title="Refresh WPM, turn-in and zone data"
        @click="refreshStats"
      >↻</button>
    </div>

    <!-- ── Loading / empty states ────────────────────────────────────────── -->
    <div v-if="rosterLoading" class="roster-state">Scanning manifest…</div>
    <div v-else-if="rows.length === 0" class="roster-state roster-state--dim">
      No cadets found for this period.
    </div>

    <!-- ── Table ─────────────────────────────────────────────────────────── -->
    <div v-else>
      <div class="roster-head">
        <div :class="['col-name', 'col-sortable', { 'col-active': sortKey === 'name' }]" @click="sortBy('name')">
          Cadet <span class="sort-arrow">{{ sortIndicator('name') }}</span>
        </div>
        <div :class="['col-zone', 'col-sortable', { 'col-active': sortKey === 'zone' }]" @click="sortBy('zone')">
          Zone <span class="sort-arrow">{{ sortIndicator('zone') }}</span>
        </div>
        <div :class="['col-conduct', 'col-sortable', { 'col-active': sortKey === 'conduct' }]" @click="sortBy('conduct')">
          Conduct <span class="sort-arrow">{{ sortIndicator('conduct') }}</span>
        </div>
        <div :class="['col-wpm', 'col-sortable', { 'col-active': sortKey === 'wpm' }]" @click="sortBy('wpm')">
          WPM <span class="sort-arrow">{{ sortIndicator('wpm') }}</span>
        </div>
        <div :class="['col-turnin', 'col-sortable', { 'col-active': sortKey === 'turnin' }]" @click="sortBy('turnin')">
          Turn-in <span class="sort-arrow">{{ sortIndicator('turnin') }}</span>
        </div>
        <div class="col-action"></div>
      </div>

      <div
        v-for="row in rows"
        :key="row.uid"
        :class="['roster-row', { 'roster-row--risk': !!row.alert }]"
      >
        <!-- Name + risk info -->
        <div class="col-name">
          <span class="cadet-name">{{ row.displayName }}</span>
          <div v-if="row.alert" class="risk-line">
            <span class="risk-badge" :style="riskBadgeStyle(row.alert.riskLevel)">
              {{ row.alert.riskLevel }}
            </span>
            <span v-for="f in row.alert.factors" :key="f" class="risk-factor">{{ f }}</span>
          </div>
        </div>

        <!-- Zone pill -->
        <div class="col-zone">
          <span v-if="row.zone" :class="['zone-pill', `zone-pill--${row.zone}`]">
            {{ ZONE_LABELS[row.zone] }}
          </span>
          <span v-else class="zone-pill zone-pill--none">—</span>
        </div>

        <!-- Conduct pips (real-time) -->
        <div class="col-conduct">
          <div class="pip-row">
            <span
              v-for="i in 4"
              :key="i"
              :class="['pip', pipFilled(row.conductScore, i) ? 'pip--filled' : 'pip--empty']"
              :style="pipFilled(row.conductScore, i)
                ? { background: pipColor(row.conductScore), borderColor: pipColor(row.conductScore) }
                : {}"
            ></span>
          </div>
        </div>

        <!-- WPM -->
        <div class="col-wpm">
          <span v-if="isRefreshing && row.latestWpm == null" class="val-loading">…</span>
          <span v-else :class="['stat-val', wpmClass(row.latestWpm)]">
            {{ row.latestWpm != null ? row.latestWpm : '—' }}
          </span>
        </div>

        <!-- Turn-in rate -->
        <div class="col-turnin">
          <span v-if="isRefreshing && row.turnInRate == null" class="val-loading">…</span>
          <span v-else :class="['stat-val', turnInClass(row.turnInRate)]">
            {{ row.turnInRate != null ? row.turnInRate + '%' : '—' }}
          </span>
        </div>

        <!-- Detail link -->
        <div class="col-action">
          <RouterLink :to="`/admin/cadet/${row.uid}`" class="detail-link">→</RouterLink>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import {
  collection, query, where, onSnapshot, getDocs, orderBy, limit,
} from '@/data/db'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { useStruggleDetection, type RiskLevel } from '@/composables/useStruggleDetection'
import { pipColor, pipFilled } from '@/composables/useConductScore'
import type { WarpPhase } from '@/composables/useAssignments'
import { SCHOOL_YEAR_ID, getQuarterIdForDate } from '@/config/schoolYear'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{ periodId: string }>()

const { effectiveTeacherEmail } = useAuth()
const { alerts, fetchAlerts } = useStruggleDetection()

// ── Constants ─────────────────────────────────────────────────────────────────
const ZONE_LABELS: Record<WarpPhase, string> = {
  warmUp:    'WU',
  lesson:    'LES',
  extension: 'EXT',
}

// Numeric rank for zone sorting (higher = further along)
const ZONE_RANK: Record<string, number> = {
  warmUp:    1,
  lesson:    2,
  extension: 3,
}

// ── Sort state ────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'zone' | 'conduct' | 'wpm' | 'turnin'

const sortKey = ref<SortKey>('name')
const sortDir = ref<'asc' | 'desc'>('asc')

function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function sortIndicator(key: SortKey): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? '↑' : '↓'
}

// ── State ─────────────────────────────────────────────────────────────────────
interface StatEntry {
  latestWpm:  number | null
  turnInRate: number | null
  zone:       WarpPhase | null
}

const rosterMap     = ref(new Map<string, any>())
const statMap       = ref(new Map<string, StatEntry>())
const rosterLoading = ref(true)
const isRefreshing  = ref(false)

let unsubRoster: (() => void) | null = null
let zoneTimer:   ReturnType<typeof setInterval> | null = null

// ── Real-time roster via onSnapshot ───────────────────────────────────────────
// conductScore on the approvedUsers doc updates instantly when changed
function subscribeRoster(periodId: string) {
  if (unsubRoster) { unsubRoster(); unsubRoster = null }
  rosterLoading.value = true

  const constraints: any[] = [
    where('role',         '==', 'cadet'),
    where('periodId',     '==', periodId),
    where('schoolYearId', '==', SCHOOL_YEAR_ID),
  ]
  const email = effectiveTeacherEmail.value
  if (email) constraints.push(where('teacherEmail', '==', email))

  unsubRoster = onSnapshot(
    query(collection(db, 'approvedUsers'), ...constraints),
    snap => {
      const m = new Map<string, any>()
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.uid) m.set(data.uid as string, data)
      })
      rosterMap.value   = m
      rosterLoading.value = false
    },
  )
}

// ── Stats: WPM + turn-in + zone ───────────────────────────────────────────────
// Fetched on period change, every 60s, and on manual refresh
async function loadStatsInternal(periodId: string) {
  const today     = new Date().toISOString().slice(0, 10)
  const quarterId = getQuarterIdForDate(today)
  const email     = effectiveTeacherEmail.value

  // 1. Latest WPM per student (most recent typingResult for this period)
  const tConstraints: any[] = [
    where('periodId',     '==', periodId),
    where('schoolYearId', '==', SCHOOL_YEAR_ID),
    orderBy('completedAt', 'desc'),
    limit(500),
  ]
  if (email) tConstraints.splice(2, 0, where('teacherEmail', '==', email))
  const typingSnap = await getDocs(query(collection(db, 'typingResults'), ...tConstraints))

  const latestWpmByUid: Record<string, number> = {}
  typingSnap.docs.forEach(d => {
    const data = d.data()
    if (!latestWpmByUid[data.uid] && data.wpm != null) {
      latestWpmByUid[data.uid as string] = data.wpm as number
    }
  })

  // 2. Turn-in rate: submitted/graded/returned vs total for this quarter
  const sConstraints: any[] = [
    where('periodId',     '==', periodId),
    where('schoolYearId', '==', SCHOOL_YEAR_ID),
  ]
  if (quarterId !== 'unknown') sConstraints.push(where('quarterId', '==', quarterId))
  const subSnap = await getDocs(query(collection(db, 'submissions'), ...sConstraints))

  const turnInByUid: Record<string, { assigned: number; submitted: number }> = {}
  subSnap.docs.forEach(d => {
    const data = d.data()
    const uid  = data.studentId as string
    if (!uid) return
    if (!turnInByUid[uid]) turnInByUid[uid] = { assigned: 0, submitted: 0 }
    turnInByUid[uid].assigned++
    if (['submitted', 'graded', 'returned'].includes(data.status)) turnInByUid[uid].submitted++
  })

  // 3. Zone: furthest categorized activity the student has completed today
  //    extension > lesson > warmUp > null (not started)
  const assignSnap = await getDocs(query(
    collection(db, 'assignments'),
    where('periodId',     '==', periodId),
    where('dueDate',      '==', today),
    where('schoolYearId', '==', SCHOOL_YEAR_ID),
  ))

  const assignsByPhase = new Map<WarpPhase, string[]>()
  assignSnap.docs.forEach(d => {
    const cat = d.data().category as WarpPhase | undefined
    if (!cat) return
    if (!assignsByPhase.has(cat)) assignsByPhase.set(cat, [])
    assignsByPhase.get(cat)!.push(d.id)
  })

  const zoneByUid = new Map<string, WarpPhase | null>()
  if (assignsByPhase.size > 0) {
    const allIds = [...assignsByPhase.values()].flat()
    const completedByUid = new Map<string, Set<string>>()

    for (let i = 0; i < allIds.length; i += 30) {
      const chunk = allIds.slice(i, i + 30)
      const zSubSnap = await getDocs(query(
        collection(db, 'submissions'),
        where('assignmentId', 'in', chunk),
        where('periodId',     '==', periodId),
      ))
      zSubSnap.docs.forEach(d => {
        const status = d.data().status as string
        if (!['submitted', 'graded', 'returned'].includes(status)) return
        const uid = d.data().studentId as string
        if (!completedByUid.has(uid)) completedByUid.set(uid, new Set())
        completedByUid.get(uid)!.add(d.data().assignmentId as string)
      })
    }

    const PHASE_ORDER: WarpPhase[] = ['extension', 'lesson', 'warmUp']
    completedByUid.forEach((completed, uid) => {
      for (const phase of PHASE_ORDER) {
        const ids = assignsByPhase.get(phase) ?? []
        if (ids.length > 0 && ids.some(id => completed.has(id))) {
          zoneByUid.set(uid, phase)
          break
        }
      }
    })
  }

  // 4. Build statMap keyed by uid
  const m = new Map<string, StatEntry>()
  rosterMap.value.forEach((_, uid) => {
    const ti = turnInByUid[uid]
    m.set(uid, {
      latestWpm:  latestWpmByUid[uid] ?? null,
      turnInRate: ti ? Math.round((ti.submitted / ti.assigned) * 100) : null,
      zone:       zoneByUid.get(uid) ?? null,
    })
  })
  statMap.value = m
}

async function refreshStats() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await Promise.all([
      loadStatsInternal(props.periodId),
      fetchAlerts(props.periodId, effectiveTeacherEmail.value ?? undefined),
    ])
  } finally {
    isRefreshing.value = false
  }
}

// ── Combined rows ─────────────────────────────────────────────────────────────
const alertMap = computed(() => {
  const m = new Map<string, (typeof alerts.value)[number]>()
  alerts.value.forEach(a => m.set(a.uid, a))
  return m
})

const rows = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1

  return Array.from(rosterMap.value.values())
    .map(s => {
      const uid   = s.uid as string
      const stats = statMap.value.get(uid)
      return {
        uid,
        displayName:  s.displayName ?? '—',
        conductScore: typeof s.conductScore === 'number' ? s.conductScore : 4,
        latestWpm:    stats?.latestWpm  ?? null,
        turnInRate:   stats?.turnInRate ?? null,
        zone:         stats?.zone       ?? null,
        alert:        alertMap.value.get(uid),
      }
    })
    .sort((a, b) => {
      // Secondary tie-breaker: always alphabetical
      const alpha = () => a.displayName.localeCompare(b.displayName)

      switch (sortKey.value) {
        case 'name':
          return dir * a.displayName.localeCompare(b.displayName)

        case 'zone': {
          const zA = ZONE_RANK[a.zone ?? ''] ?? 0
          const zB = ZONE_RANK[b.zone ?? ''] ?? 0
          return zA !== zB ? dir * (zA - zB) : alpha()
        }

        case 'conduct':
          return a.conductScore !== b.conductScore
            ? dir * (a.conductScore - b.conductScore)
            : alpha()

        case 'wpm': {
          // Nulls always sink to the bottom regardless of direction
          if (a.latestWpm == null && b.latestWpm == null) return alpha()
          if (a.latestWpm == null) return 1
          if (b.latestWpm == null) return -1
          return a.latestWpm !== b.latestWpm ? dir * (a.latestWpm - b.latestWpm) : alpha()
        }

        case 'turnin': {
          if (a.turnInRate == null && b.turnInRate == null) return alpha()
          if (a.turnInRate == null) return 1
          if (b.turnInRate == null) return -1
          return a.turnInRate !== b.turnInRate ? dir * (a.turnInRate - b.turnInRate) : alpha()
        }

        default:
          return alpha()
      }
    })
})

// ── Display helpers ───────────────────────────────────────────────────────────
function wpmClass(wpm: number | null): string {
  if (wpm == null) return 'val--dim'
  if (wpm >= 50)   return 'val--excellent'  // blue
  if (wpm >= 35)   return 'val--good'       // green
  if (wpm >= 20)   return 'val--caution'    // yellow
  return 'val--critical'                     // red
}

function turnInClass(pct: number | null): string {
  if (pct == null) return 'val--dim'
  if (pct >= 90)   return 'val--excellent'  // blue
  if (pct >= 70)   return 'val--good'       // green
  if (pct >= 50)   return 'val--caution'    // yellow
  return 'val--critical'                     // red
}

function riskBadgeStyle(level: RiskLevel) {
  const colors: Record<RiskLevel, string> = {
    high:   '#c0392b',
    medium: '#ff9900',
    low:    '#e3c720',
  }
  const c = colors[level]
  return { background: `${c}22`, color: c, borderColor: `${c}55` }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
watch(
  [() => props.periodId, effectiveTeacherEmail],
  async ([periodId]) => {
    subscribeRoster(periodId)
    isRefreshing.value = true
    try {
      await Promise.all([
        loadStatsInternal(periodId),
        fetchAlerts(periodId, effectiveTeacherEmail.value ?? undefined),
      ])
    } finally {
      isRefreshing.value = false
    }
  },
  { immediate: true },
)

onMounted(() => {
  // Re-run stats on the same 60s cycle as WarpCorePanel
  zoneTimer = setInterval(() => loadStatsInternal(props.periodId), 60_000)
})

onUnmounted(() => {
  if (unsubRoster) unsubRoster()
  if (zoneTimer) clearInterval(zoneTimer)
})
</script>

<style scoped>
/* ── Panel shell ─────────────────────────────────────────────────────────────── */
.roster-panel {
  background: rgba(0, 20, 45, 0.55);
  border: 1px solid rgba(153, 204, 255, 0.15);
  border-radius: 0.75rem;
  padding: 1.25rem 1.5rem 1.25rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

/* ── Panel header ────────────────────────────────────────────────────────────── */
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

.sub-dot        { margin: 0 0.3rem; opacity: 0.5; }
.sub-risk-count { color: #ff9900; }

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
  flex-shrink: 0;
}

.refresh-btn:hover:not(:disabled) {
  color: #99ccff;
  border-color: rgba(77, 153, 238, 0.6);
}

.refresh-btn--spinning { animation: spin 0.8s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

/* ── State messages ──────────────────────────────────────────────────────────── */
.roster-state {
  color: #99bbdd;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  padding: 0.5rem 0;
}

.roster-state--dim { color: #3a5070; font-style: italic; }

/* ── Table ───────────────────────────────────────────────────────────────────── */
.roster-head,
.roster-row {
  display: grid;
  grid-template-columns: 1fr 4.5rem 5.5rem 5rem 5.5rem 2.5rem;
  gap: 0.5rem;
  align-items: center;
}

.roster-head {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid rgba(153, 204, 255, 0.1);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #3a5070;
  text-transform: uppercase;
}

.roster-row {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(153, 204, 255, 0.06);
  transition: background 0.15s;
}

.roster-row:last-child  { border-bottom: none; }
.roster-row:hover       { background: rgba(77, 153, 238, 0.05); }
.roster-row--risk       { background: rgba(255, 110, 110, 0.025); }
.roster-row--risk:hover { background: rgba(255, 110, 110, 0.055); }

/* ── Column alignments ───────────────────────────────────────────────────────── */
.col-name    { min-width: 0; }
.col-zone,
.col-conduct,
.col-wpm,
.col-turnin  { display: flex; align-items: center; }
.col-action  { display: flex; align-items: center; justify-content: flex-end; }

/* ── Cadet name ──────────────────────────────────────────────────────────────── */
.cadet-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: #cce0ff;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* ── Risk info ───────────────────────────────────────────────────────────────── */
.risk-line {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
}

.risk-badge {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.1rem 0.45rem;
  border-radius: 3px;
  border: 1px solid transparent;
  flex-shrink: 0;
}

.risk-factor {
  font-size: 0.6rem;
  color: #6688aa;
  letter-spacing: 0.04em;
}

/* ── Zone pills ──────────────────────────────────────────────────────────────── */
.zone-pill {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  text-transform: uppercase;
  white-space: nowrap;
}

.zone-pill--warmUp    { background: rgba(77, 200, 216, 0.15); color: #4dc8d8; }
.zone-pill--lesson    { background: rgba(77, 136, 238, 0.15); color: #4d88ee; }
.zone-pill--extension { background: rgba(136, 85, 204, 0.15); color: #8855cc; }
.zone-pill--none      { color: #3a5070; }

/* ── Conduct pips ────────────────────────────────────────────────────────────── */
.pip-row { display: flex; gap: 0.2rem; align-items: center; }

.pip {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

/* ── Stat values — colors use the 5-step performance scale (--scale-*) ──────── */
.stat-val    { font-size: 0.85rem; font-weight: 700; letter-spacing: 0.04em; }
.val-loading { color: #3a5070; font-size: 0.8rem; }

.val--dim       { color: #3a5070; }
.val--excellent { color: var(--scale-excellent); }  /* blue   — top tier  */
.val--good      { color: var(--scale-good);      }  /* green  — solid     */
.val--caution   { color: var(--scale-caution);   }  /* yellow — watch out */
.val--critical  { color: var(--scale-critical);  }  /* red    — urgent    */

/* ── Sortable column headers ─────────────────────────────────────────────────── */
.col-sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.col-sortable:hover { color: #6688aa; }
.col-active         { color: #4d99ee !important; }

.sort-arrow {
  font-size: 0.7rem;
  margin-left: 0.15rem;
  color: #4d99ee;
}

/* ── Detail link ─────────────────────────────────────────────────────────────── */
.detail-link {
  font-size: 0.85rem;
  font-weight: 700;
  color: #4d99ee;
  text-decoration: none;
  opacity: 0.5;
  transition: opacity 0.15s;
}

.detail-link:hover { opacity: 1; }
</style>
