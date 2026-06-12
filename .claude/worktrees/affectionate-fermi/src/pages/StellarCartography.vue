<template>
  <div class="quadrants-page">
    <!-- Header -->
    <header class="page-header">
      <div class="header-inner">
        <div class="header-text">
          <h1>FUSD School Pathways</h1>
          <p class="subtitle">Fresno Unified School District · 2025–26 Feeder Structure</p>
        </div>
        <div class="header-controls">
          <div class="search-wrap">
            <svg class="search-icon" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.5"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <input
                v-model="searchQuery"
                type="text"
                placeholder="Search schools…"
                class="search-input"
                @focus="searchFocused = true"
                @blur="searchFocused = false"
            />
          </div>
          <div class="view-toggle">
            <button
                :class="['toggle-btn', { active: viewMode === 'regions' }]"
                @click="viewMode = 'regions'"
            >By Region</button>
            <button
                :class="['toggle-btn', { active: viewMode === 'pipeline' }]"
                @click="viewMode = 'pipeline'"
            >Pipeline</button>
          </div>
        </div>
      </div>
    </header>

    <!-- Legend -->
    <div class="legend">
      <div class="legend-item">
        <span class="legend-dot elem"></span>Elementary
      </div>
      <div class="legend-item">
        <span class="legend-dot middle"></span>Middle
      </div>
      <div class="legend-item">
        <span class="legend-dot high"></span>High
      </div>
      <div class="legend-item">
        <span class="legend-dot district"></span>Districtwide
      </div>
    </div>

    <!-- REGIONS VIEW -->
    <div v-if="viewMode === 'regions'" class="regions-grid">
      <div
          v-for="region in filteredRegions"
          :key="region.name"
          :class="['region-card', `region-${slugify(region.name)}`]"
          :style="{ borderLeftColor: regionAccent(region.name), borderLeftWidth: '3px' }"
      >
        <div class="region-header" :style="{ borderColor: regionAccent(region.name) }">
          <div class="region-badge" :style="{ background: regionColor(region.name), color: regionText(region.name), borderColor: regionAccent(region.name) }">
            {{ region.name }}
          </div>
          <span class="region-count">{{ region.elementaries.length }} elem · {{ region.middles.length }} middle</span>
        </div>

        <!-- Tree: High → Middles → Elementaries -->
        <div class="tree-root">

          <!-- HIGH SCHOOL -->
          <div v-if="region.high" class="tree-high-wrap">
            <div
                :class="['tree-node', 'tree-node-high', { highlighted: isHighlighted(region.high), selected: selectedSchool === region.high }]"
                :style="{ background: regionColor(region.name) + '28', color: regionAccent(region.name), borderColor: regionAccent(region.name) + '66' }"
                @click="selectSchool(region.high, 'high')"
            >
              <span class="tree-node-icon">🎓</span>
              <span class="tree-node-label">{{ region.high }}</span>
            </div>
          </div>

          <!-- CONNECTOR: high → middles -->
          <div v-if="region.high && region.middles.length" class="tree-connector-v"></div>

          <!-- MIDDLE + ELEM BRANCHES -->
          <div v-if="region.middles.length" class="tree-middles">
            <!-- horizontal bar across top of middle nodes -->
            <div
                v-if="region.middles.length > 1"
                class="tree-h-bar"
                :style="{ '--cols': region.middles.length }"
            ></div>

            <div
                v-for="mid in region.middles"
                :key="mid.name"
                class="tree-branch"
            >
              <!-- vertical stem down to middle node -->
              <div class="tree-stem"></div>

              <!-- MIDDLE NODE -->
              <div
                  :class="['tree-node', 'tree-node-middle', { highlighted: isHighlighted(mid.name), selected: selectedSchool === mid.name }]"
                  @click="selectSchool(mid.name, 'middle')"
              >
                <span class="tree-node-icon">📚</span>
                <span class="tree-node-label">{{ mid.name }}</span>
                <span class="tree-node-count">{{ mid.elementaries.length }}</span>
              </div>

              <!-- connector: middle → elementaries -->
              <div class="tree-connector-v tree-connector-v--short"></div>

              <!-- ELEMENTARIES -->
              <div class="tree-elems">
                <div
                    v-for="elemName in mid.elementaries"
                    :key="elemName"
                    :class="['tree-node', 'tree-node-elem', {
                    highlighted: isHighlighted(elemName),
                    selected: selectedSchool === elemName,
                    dimmed: shouldDim({ name: elemName, middle: mid.name })
                  }]"
                    @click="selectSchool(elemName, 'elementary')"
                >
                  <span class="tree-node-icon">🏫</span>
                  <span class="tree-node-label">{{ elemName }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Districtwide Card -->
      <div class="region-card region-districtwide" v-if="showDistrictwide">
        <div class="region-header" :style="{ borderColor: regionAccent('Districtwide') }">
          <div class="region-badge" :style="{ background: regionColor('Districtwide'), color: regionText('Districtwide'), borderColor: regionAccent('Districtwide') }">
            Districtwide
          </div>
          <span class="region-count">Non-boundaried options</span>
        </div>

        <div v-for="group in districtwideGroups" :key="group.type" class="school-tier">
          <div class="tier-label">{{ group.type }}</div>
          <div class="chips-row">
            <div
                v-for="school in group.schools"
                :key="school.name"
                :class="['school-chip', 'chip-district', { highlighted: isHighlighted(school.name) }]"
                @click="selectSchool(school.name, 'district')"
                :title="school.notes"
            >
              <span class="chip-icon">{{ schoolTypeIcon(group.type) }}</span>
              {{ school.name }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PIPELINE VIEW -->
    <div v-if="viewMode === 'pipeline'" class="pipeline-view">
      <div class="pipeline-col pipeline-col-elem">
        <div class="pipeline-col-header">
          <span class="tier-dot elem"></span>
          Elementary
          <span class="tier-num">{{ allElementaries.length }}</span>
        </div>
        <div
            v-for="school in filteredElementaries"
            :key="school.name"
            :class="['pipeline-node', 'node-elem', { active: selectedPipeline === school.name || pipelineActive(school.name) }]"
            @mouseenter="hoveredSchool = school.name"
            @mouseleave="hoveredSchool = null"
            @click="selectPipeline(school.name)"
        >
          <span class="node-name">{{ school.name }}</span>
          <span class="node-arrow">→</span>
          <span class="node-dest">{{ school.middle || '—' }}</span>
        </div>
      </div>

      <div class="pipeline-col pipeline-col-middle">
        <div class="pipeline-col-header">
          <span class="tier-dot middle"></span>
          Middle
          <span class="tier-num">{{ allMiddles.length }}</span>
        </div>
        <div
            v-for="school in filteredMiddles"
            :key="school.name"
            :class="['pipeline-node', 'node-middle', { active: pipelineActive(school.name) }]"
            @mouseenter="hoveredSchool = school.name"
            @mouseleave="hoveredSchool = null"
            @click="selectPipeline(school.name)"
        >
          <span class="node-name">{{ school.name }}</span>
          <span class="node-sub">{{ school.elementaries.length }} feeders</span>
        </div>
      </div>

      <div class="pipeline-col pipeline-col-high">
        <div class="pipeline-col-header">
          <span class="tier-dot high"></span>
          High
          <span class="tier-num">{{ allHighs.length }}</span>
        </div>
        <div
            v-for="school in filteredHighs"
            :key="school.name"
            :class="['pipeline-node', 'node-high', { active: pipelineActive(school.name) }]"
            @mouseenter="hoveredSchool = school.name"
            @mouseleave="hoveredSchool = null"
            @click="selectPipeline(school.name)"
        >
          <span class="node-name">{{ school.name }}</span>
          <span class="node-sub">{{ regionForHigh(school.name) }}</span>
        </div>
      </div>
    </div>

    <!-- Detail Panel -->
    <Transition name="panel-slide">
      <div v-if="detailSchool" class="detail-panel" @click.stop>
        <button class="detail-close" @click="clearDetail">✕</button>
        <div class="detail-header">
          <div class="detail-icon">{{ detailSchool.icon }}</div>
          <div>
            <h2 class="detail-name">{{ detailSchool.name }}</h2>
            <p class="detail-type">{{ detailSchool.type }}</p>
          </div>
        </div>
        <div class="detail-body">
          <div v-if="detailSchool.region" class="detail-row">
            <span class="detail-label">Region</span>
            <span class="detail-value">{{ detailSchool.region }}</span>
          </div>
          <div v-if="detailSchool.feedsTo" class="detail-row">
            <span class="detail-label">Feeds into</span>
            <span class="detail-value chain">
              <span v-for="(dest, i) in detailSchool.feedsTo" :key="i" class="feed-chip">{{ dest }}</span>
            </span>
          </div>
          <div v-if="detailSchool.fedBy?.length" class="detail-row">
            <span class="detail-label">Fed by</span>
            <span class="detail-value chain">
              <span v-for="(src, i) in detailSchool.fedBy" :key="i" class="feed-chip feed-chip-sm">{{ src }}</span>
            </span>
          </div>
          <div v-if="detailSchool.notes" class="detail-row">
            <span class="detail-label">Notes</span>
            <span class="detail-value">{{ detailSchool.notes }}</span>
          </div>
          <!-- Stats placeholder -->
          <div class="stats-placeholder">
            <div class="stats-label">Test Score Stats</div>
            <div class="stats-coming-soon">
              <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
                <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              Stats coming soon — add scores per school to the data file
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Backdrop -->
    <div v-if="detailSchool" class="detail-backdrop" @click="clearDetail"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import rawJson from '@/data/fusd-regions-2526.json'

// ── Raw data ────────────────────────────────────────────────────────────────
// Normalise the JSON key "School Type" → SchoolType so the rest of the
// component can use a consistent camelCase field name.
interface RawRow {
  Elementary: string | null
  Middle: string | null
  High: string | null
  Boundaried: string
  Region: string
  SchoolType: string
  Notes: string | null
}

const rawData: RawRow[] = (rawJson as any[]).map(r => ({
  Elementary: r['Elementary'] ?? null,
  Middle:     r['Middle']     ?? null,
  High:       r['High']       ?? null,
  Boundaried: r['Boundaried'] ?? '',
  Region:     r['Region']     ?? '',
  SchoolType: r['School Type'] ?? r['SchoolType'] ?? '',
  Notes:      r['Notes']      ?? null,
}))

// ── School colours (actual school colors per high school) ────────────────────
// Edison Tigers          — Black & Gold
// Roosevelt Rough Riders — Kelly Green & Gold
// Sunnyside Wildcats     — Royal Blue & Yellow
// McLane Highlanders     — Red & White
// Hoover Patriots        — Hunter Green & White
// Bullard Knights        — Navy & White
// Fresno High Warriors   — Maroon & Gold
interface SchoolTheme { primary: string; accent: string; text: string }

const SCHOOL_THEMES: Record<string, SchoolTheme> = {
  'Edison':       { primary: '#1a1a1a', accent: '#d4a017', text: '#d4a017' },
  'Roosevelt':    { primary: '#2e7d32', accent: '#f9a825', text: '#f9a825' },
  'Sunnyside':    { primary: '#1565c0', accent: '#fdd835', text: '#fdd835' },
  'McLane':       { primary: '#c62828', accent: '#ffcdd2', text: '#ffcdd2' },
  'Hoover':       { primary: '#2d5a27', accent: '#c8e6c9', text: '#c8e6c9' },
  'Bullard':      { primary: '#0d2b6b', accent: '#bbdefb', text: '#bbdefb' },
  'Fresno High':  { primary: '#7b1f2a', accent: '#c9952c', text: '#c9952c' },
  'Districtwide': { primary: '#334155', accent: '#94a3b8', text: '#94a3b8' },
}

const regionColor  = (r: string) => SCHOOL_THEMES[r]?.primary ?? '#334155'
const regionAccent = (r: string) => SCHOOL_THEMES[r]?.accent  ?? '#94a3b8'
const regionText   = (r: string) => SCHOOL_THEMES[r]?.text    ?? '#94a3b8'

// ── Derived structures ───────────────────────────────────────────────────────
const BOUNDED_REGIONS = ['Edison', 'Roosevelt', 'Sunnyside', 'McLane', 'Hoover', 'Bullard', 'Fresno High']

const regions = computed(() => {
  return BOUNDED_REGIONS.map(regionName => {
    const rows = rawData.filter(r => r.Region === regionName && r.Elementary)
    const high = rows[0]?.High ?? null

    const middleMap: Record<string, string[]> = {}
    for (const r of rows) {
      if (r.Middle) {
        if (!middleMap[r.Middle]) middleMap[r.Middle] = []
        middleMap[r.Middle].push(r.Elementary!)
      }
    }

    const middles = Object.entries(middleMap).map(([name, elems]) => ({
      name,
      elementaries: elems,
    }))

    const elementaries = rows.map(r => ({
      name: r.Elementary!,
      middle: r.Middle,
      type: r.SchoolType,
    }))

    return { name: regionName, high, middles, elementaries }
  })
})

const districtwideRows = computed(() => rawData.filter(r => r.Region === 'Districtwide'))

const districtwideGroups = computed(() => {
  const groups: Record<string, { name: string; notes: string | null }[]> = {}
  for (const r of districtwideRows.value) {
    const name = r.Elementary || r.Middle || r.High
    if (!name) continue
    const type = r.SchoolType
    if (!groups[type]) groups[type] = []
    groups[type].push({ name, notes: r.Notes })
  }
  return Object.entries(groups).map(([type, schools]) => ({ type, schools }))
})

// Pipeline structures
const allElementaries = computed(() => {
  return rawData
      .filter(r => r.Elementary && r.Region !== 'Districtwide')
      .map(r => ({ name: r.Elementary!, middle: r.Middle, high: r.High, region: r.Region }))
      .filter((v, i, a) => a.findIndex(x => x.name === v.name) === i)
      .sort((a, b) => a.name.localeCompare(b.name))
})

const allMiddles = computed(() => {
  const map: Record<string, { elementaries: string[]; high: string | null; region: string }> = {}
  for (const r of rawData) {
    if (!r.Middle || r.Region === 'Districtwide') continue
    if (!map[r.Middle]) map[r.Middle] = { elementaries: [], high: r.High, region: r.Region }
    if (r.Elementary) map[r.Middle].elementaries.push(r.Elementary)
  }
  return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name))
})

const allHighs = computed(() => {
  const seen = new Set<string>()
  return rawData
      .filter(r => r.High && r.Region !== 'Districtwide' && !seen.has(r.High) && seen.add(r.High))
      .map(r => ({ name: r.High!, region: r.Region }))
      .sort((a, b) => a.name.localeCompare(b.name))
})

const regionForHigh = (name: string) => allHighs.value.find(h => h.name === name)?.region ?? ''

// ── State ────────────────────────────────────────────────────────────────────
const viewMode = ref<'regions' | 'pipeline'>('regions')
const searchQuery = ref('')
const searchFocused = ref(false)
const selectedSchool = ref<string | null>(null)
const selectedPipeline = ref<string | null>(null)
const hoveredSchool = ref<string | null>(null)
const detailSchool = ref<any | null>(null)

// ── Search / filter ──────────────────────────────────────────────────────────
const q = computed(() => searchQuery.value.toLowerCase().trim())

const filteredRegions = computed(() => {
  if (!q.value) return regions.value
  return regions.value.filter(region => {
    if (region.name.toLowerCase().includes(q.value)) return true
    if (region.high?.toLowerCase().includes(q.value)) return true
    if (region.middles.some(m => m.name.toLowerCase().includes(q.value))) return true
    if (region.elementaries.some(e => e.name.toLowerCase().includes(q.value))) return true
    return false
  })
})

const showDistrictwide = computed(() => {
  if (!q.value) return true
  return districtwideRows.value.some(r =>
      [r.Elementary, r.Middle, r.High, r.Region].some(v => v?.toLowerCase().includes(q.value))
  )
})

const filteredElementaries = computed(() => {
  if (!q.value) return allElementaries.value
  return allElementaries.value.filter(s => s.name.toLowerCase().includes(q.value) || s.middle?.toLowerCase().includes(q.value))
})
const filteredMiddles = computed(() => {
  if (!q.value) return allMiddles.value
  return allMiddles.value.filter(s => s.name.toLowerCase().includes(q.value))
})
const filteredHighs = computed(() => {
  if (!q.value) return allHighs.value
  return allHighs.value.filter(s => s.name.toLowerCase().includes(q.value))
})

// ── Highlighting ─────────────────────────────────────────────────────────────
const isHighlighted = (name: string) => q.value && name.toLowerCase().includes(q.value)

const shouldDim = (elem: { name: string; middle: string | null }) => {
  if (!selectedSchool.value) return false
  return selectedSchool.value !== elem.name && selectedSchool.value !== elem.middle
}

// ── Selection ────────────────────────────────────────────────────────────────
const selectSchool = (name: string, tier: string) => {
  selectedSchool.value = selectedSchool.value === name ? null : name

  // Build detail panel
  const regionRows = rawData.filter(r =>
      r.Elementary === name || r.Middle === name || r.High === name
  )
  const first = regionRows[0]

  let feedsTo: string[] = []
  let fedBy: string[] = []
  let icon = '🏫'

  if (tier === 'elementary') {
    icon = '🏫'
    if (first?.Middle) feedsTo = [first.Middle, first.High].filter(Boolean) as string[]
  } else if (tier === 'middle') {
    icon = '📚'
    feedsTo = first?.High ? [first.High] : []
    fedBy = rawData.filter(r => r.Middle === name && r.Elementary).map(r => r.Elementary!)
  } else if (tier === 'high') {
    icon = '🎓'
    fedBy = rawData.filter(r => r.High === name && r.Middle).map(r => r.Middle!).filter((v, i, a) => a.indexOf(v) === i)
  } else {
    icon = '🌐'
  }

  detailSchool.value = {
    name,
    type: first?.SchoolType ?? tier,
    region: first?.Region,
    feedsTo: feedsTo.length ? feedsTo : null,
    fedBy: fedBy.length ? fedBy : null,
    notes: first?.Notes ?? null,
    icon,
  }
}

const selectPipeline = (name: string) => {
  selectedPipeline.value = selectedPipeline.value === name ? null : name
}

const pipelineActive = (name: string) => {
  if (!selectedPipeline.value) return false
  const sp = selectedPipeline.value
  // Check if name is in the same pipeline chain as selected
  const row = rawData.find(r => r.Elementary === sp || r.Middle === sp || r.High === sp)
  if (!row) return false
  return row.Elementary === name || row.Middle === name || row.High === name || name === sp
}

const clearDetail = () => {
  detailSchool.value = null
  selectedSchool.value = null
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

const schoolTypeIcon = (type: string) => {
  if (type.includes('CTE')) return '⚙️'
  if (type.includes('Magnet')) return '🧲'
  if (type.includes('Continuation')) return '🔄'
  if (type.includes('Adult')) return '👨‍🎓'
  if (type.includes('Alternative')) return '🔀'
  if (type.includes('Special')) return '♿'
  if (type.includes('Middle')) return '📚'
  return '🌐'
}
</script>

<style scoped>
/* ── Base ──────────────────────────────────────────────────────────────────── */
.quadrants-page {
  --bg: #0f1117;
  --surface: #181c27;
  --surface-2: #1e2335;
  --border: #2a2f45;
  --text: #e2e8f0;
  --text-muted: #7a84a0;
  --elem-clr: #38bdf8;
  --middle-clr: #a78bfa;
  --high-clr: #fb923c;
  --district-clr: #94a3b8;
  --radius: 10px;

  min-height: 100vh;
  /* background: var(--bg); */
  color: var(--text);
  font-family: 'DM Sans', 'Segoe UI', sans-serif;
  padding: 0 0 80px;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.page-header {
  background: rgba(0,0,0,0.5);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 40;
}
.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
h1 {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 1.4rem;
  font-weight: 400;
  margin: 0;
  letter-spacing: -0.02em;
  color: #f8fafc;
}
.subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 2px 0 0;
}
.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ── Search ──────────────────────────────────────────────────────────────── */
.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 10px;
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  pointer-events: none;
}
.search-input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.85rem;
  padding: 8px 12px 8px 34px;
  width: 220px;
  outline: none;
  transition: border-color 0.15s;
}
.search-input:focus { border-color: var(--elem-clr); }
.search-input::placeholder { color: var(--text-muted); }

/* ── Toggle ──────────────────────────────────────────────────────────────── */
.view-toggle {
  display: flex;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.toggle-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.82rem;
  padding: 7px 14px;
  transition: all 0.15s;
}
.toggle-btn.active {
  background: var(--surface-2);
  color: var(--text);
}

/* ── Legend ──────────────────────────────────────────────────────────────── */
.legend {
  display: flex;
  gap: 20px;
  justify-content: center;
  padding: 12px 24px;
  font-size: 0.78rem;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
}
.legend-dot.elem     { background: var(--elem-clr); }
.legend-dot.middle   { background: var(--middle-clr); }
.legend-dot.high     { background: var(--high-clr); }
.legend-dot.district { background: var(--district-clr); }

/* ── Regions Grid ──────────────────────────────────────────────────────────── */
.regions-grid {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 20px;
}

.region-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: box-shadow 0.2s;
}
.region-card:hover {
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
}

.region-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 2px solid;
}
.region-badge {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 20px;
  color: #fff;
}
.region-count {
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* ── Tree layout ───────────────────────────────────────────────────────────── */
.tree-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding-bottom: 4px;
}

/* High school node row */
.tree-high-wrap {
  display: flex;
  justify-content: center;
  width: 100%;
}

/* Vertical connector line */
.tree-connector-v {
  width: 2px;
  height: 18px;
  background: var(--border);
  margin: 0 auto;
  flex-shrink: 0;
}
.tree-connector-v--short {
  height: 10px;
}

/* Row of middle-school branches */
.tree-middles {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  gap: 10px;
  width: 100%;
  position: relative;
}

/* Horizontal bar connecting the tops of all branches */
.tree-h-bar {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 60px);
  height: 2px;
  background: var(--border);
  pointer-events: none;
}

/* One branch = stem + middle + elems */
.tree-branch {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
}

/* Vertical stem from h-bar down to middle node */
.tree-stem {
  width: 2px;
  height: 16px;
  background: var(--border);
  flex-shrink: 0;
}

/* Elementary list under each middle */
.tree-elems {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  align-items: center;
}

/* ── Tree nodes ────────────────────────────────────────────────────────────── */
.tree-node {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 7px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  user-select: none;
  max-width: 100%;
  min-width: 0;
}

.tree-node-icon {
  font-size: 0.8rem;
  flex-shrink: 0;
}

.tree-node-label {
  font-size: 1.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tree-node-count {
  margin-left: auto;
  padding-left: 6px;
  font-size: 0.65rem;
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 1px 6px;
  flex-shrink: 0;
}

/* High — colors applied inline per region */
.tree-node-high {
  font-weight: 600;
  width: 100%;
  justify-content: center;
  border-width: 1px;
  border-style: solid;
}
.tree-node-high:hover { filter: brightness(1.15); }

/* Middle */
.tree-node-middle {
  background: rgba(167,139,250,0.12);
  color: var(--middle-clr);
  border-color: rgba(167,139,250,0.25);
  font-weight: 500;
  width: 100%;
}
.tree-node-middle:hover { background: rgba(167,139,250,0.22); }

/* Elementary */
.tree-node-elem {
  background: rgba(56,189,248,0.07);
  color: #94d8f0;
  border-color: rgba(56,189,248,0.12);
  font-size: 0.73rem;
  width: 100%;
}
.tree-node-elem:hover { background: rgba(56,189,248,0.15); }

/* Highlight / selected / dim states */
.tree-node.highlighted {
  outline: 2px solid #fbbf24;
  outline-offset: 1px;
}
.tree-node.selected {
  outline: 2px solid #60a5fa;
  outline-offset: 1px;
}
.tree-node.dimmed {
  opacity: 0.28;
}

/* Districtwide chips (unchanged style, just removing old flow-arrow/tier cruft) */
.school-tier { display: flex; flex-direction: column; gap: 6px; }
.tier-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  font-weight: 600;
}
.chips-row { display: flex; flex-wrap: wrap; gap: 6px; }
.school-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  user-select: none;
}
.chip-district {
  background: rgba(148,163,184,0.08);
  color: var(--district-clr);
  border-color: rgba(148,163,184,0.15);
  font-size: 0.76rem;
}
.chip-district:hover { background: rgba(148,163,184,0.16); }
.school-chip.highlighted { outline: 2px solid #fbbf24; outline-offset: 1px; }
.chip-icon { font-size: 0.8rem; }

/* ── Pipeline View ─────────────────────────────────────────────────────────── */
.pipeline-view {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  align-items: start;
}

.pipeline-col {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.pipeline-col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.tier-dot {
  width: 8px; height: 8px; border-radius: 50%;
}
.tier-dot.elem     { background: var(--elem-clr); }
.tier-dot.middle   { background: var(--middle-clr); }
.tier-dot.high     { background: var(--high-clr); }

.tier-num {
  margin-left: auto;
  background: var(--surface-2);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 0.7rem;
}

.pipeline-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.12s;
  font-size: 0.8rem;
}
.pipeline-node:last-child { border-bottom: none; }
.pipeline-node:hover { background: var(--surface-2); }
.pipeline-node.active { background: rgba(96,165,250,0.1); }

.node-name { flex: 1; color: var(--text); font-weight: 500; }
.node-sub  { font-size: 0.7rem; color: var(--text-muted); }
.node-arrow { color: var(--border); font-size: 0.75rem; }
.node-dest { font-size: 0.72rem; color: var(--text-muted); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Detail Panel ──────────────────────────────────────────────────────────── */
.detail-panel {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 340px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  z-index: 100;
  overflow-y: auto;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-close {
  position: absolute;
  top: 14px;
  right: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 6px;
  width: 30px; height: 30px;
  cursor: pointer;
  font-size: 0.8rem;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s;
}
.detail-close:hover { color: var(--text); }

.detail-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding-top: 8px;
}
.detail-icon { font-size: 2rem; line-height: 1; }
.detail-name {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 1.2rem;
  font-weight: 400;
  margin: 0;
  color: #f8fafc;
}
.detail-type {
  font-size: 0.73rem;
  color: var(--text-muted);
  margin: 4px 0 0;
}

.detail-body { display: flex; flex-direction: column; gap: 14px; }

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.detail-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  font-weight: 600;
}
.detail-value {
  font-size: 0.85rem;
  color: var(--text);
}
.detail-value.chain { display: flex; flex-wrap: wrap; gap: 5px; }

.feed-chip {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 3px 9px;
  font-size: 0.75rem;
}
.feed-chip-sm { font-size: 0.7rem; padding: 2px 8px; }

.stats-placeholder {
  margin-top: 8px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 16px;
}
.stats-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  font-weight: 600;
  margin-bottom: 8px;
}
.stats-coming-soon {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.detail-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 99;
}

/* ── Transitions ────────────────────────────────────────────────────────────── */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateX(100%);
}
</style>