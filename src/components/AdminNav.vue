<template>
  <div class="admin-nav" role="navigation">

    <div class="admin-nav-inner">

      <!-- Admin section label -->
      <div class="full-row admin-label">Bridge Controls</div>

      <router-link
        v-for="item in visibleItems"
        :key="item.path"
        :to="item.path"
        class="admin-nav-item"
        :class="{ 'is-active': isActive(item.path) }"
        :title="canHover ? item.label : undefined"
      >
        <img v-if="item.svg" :src="navIcon(item)" class="admin-nav-icon" :alt="item.label" />
        <span v-else class="admin-nav-icon admin-nav-icon--emoji">{{ item.icon }}</span>
        <span class="admin-nav-label">{{ item.label }}</span>
      </router-link>

      <!-- View As — admin only -->
      <div v-if="isAdmin" class="full-row view-as-wrap" :class="{ 'is-emulating': emulatingEmail }">
        <span class="view-as-icon">👁️</span>
        <select
          class="view-as-select"
          :value="emulatingEmail ?? ''"
          @change="onViewAsChange"
          :title="canHover ? 'View as teacher' : undefined"
        >
          <option value="">VIEW AS: ALL</option>
          <option
            v-for="t in staffUsers"
            :key="t.email"
            :value="t.email"
          >{{ t.displayName || t.email }}</option>
        </select>
        <button
          v-if="emulatingEmail"
          class="view-as-clear"
          :title="canHover ? 'Stop emulating' : undefined"
          @click="stopEmulation"
        >✕</button>
      </div>

    </div>

    <!-- Preview — student-facing pages; styled like the rest of the nav, expands into a matching menu -->
    <div ref="previewWrapRef" class="preview-panel" :class="{ 'is-active': activePreviewPath, 'is-open': previewMenuOpen }">
      <button
        type="button"
        class="admin-nav-item preview-trigger"
        :class="{ 'is-active': activePreviewPath }"
        :title="canHover ? 'Preview a student-facing page' : undefined"
        @click="togglePreviewMenu"
      >
        <img :src="previewIcon" class="admin-nav-icon" alt="" />
        <span class="admin-nav-label">Preview</span>
      </button>

      <div v-if="previewMenuOpen" class="preview-menu">
        <router-link
          v-for="item in PREVIEW_ITEMS"
          :key="item.path"
          :to="item.path"
          class="admin-nav-item"
          :class="{ 'is-active': isActive(item.path) }"
          :title="canHover ? item.label : undefined"
          @click="closePreviewMenu"
        >
          <img v-if="item.svg" :src="navIcon(item)" class="admin-nav-icon" :alt="item.label" />
          <span v-else class="admin-nav-icon admin-nav-icon--emoji">{{ item.icon }}</span>
          <span class="admin-nav-label">{{ item.label }}</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'

// ── Nav icons (SVG) — each has a matching "...1b.svg" used while active ──────
import iconOpening     from '@/assets/images/icons/admin/admin-opening1.svg'
import iconDashboard   from '@/assets/images/icons/admin/admin-dashboard1.svg'
import iconDashboardB  from '@/assets/images/icons/admin/admin-dashboard1b.svg'
import iconSeating     from '@/assets/images/icons/admin/admin-seating1.svg'
import iconSeatingB    from '@/assets/images/icons/admin/admin-seating1b.svg'
import iconGrading     from '@/assets/images/icons/admin/admin-grading1.svg'
import iconGradingB    from '@/assets/images/icons/admin/admin-grading1b.svg'
import iconReports     from '@/assets/images/icons/admin/admin-reports1.svg'
import iconReportsB    from '@/assets/images/icons/admin/admin-reports1b.svg'
import iconMissions    from '@/assets/images/icons/admin/admin-missions1.svg'
import iconMissionsB   from '@/assets/images/icons/admin/admin-missions1b.svg'
import iconTyping      from '@/assets/images/icons/admin/admin-typing1.svg'
import iconTypingB     from '@/assets/images/icons/admin/admin-typing1b.svg'
import iconSimulator   from '@/assets/images/icons/admin/admin-simulator1.svg'
import iconSimulatorB  from '@/assets/images/icons/admin/admin-simulator1b.svg'
import iconSystems     from '@/assets/images/icons/admin/admin-systems1.svg'
import iconSystemsB    from '@/assets/images/icons/admin/admin-systems1b.svg'
import iconUsers       from '@/assets/images/icons/admin/admin-users1.svg'
import iconUsersB      from '@/assets/images/icons/admin/admin-users1b.svg'
import iconCalendarWeek  from '@/assets/images/icons/admin/admin-calendar-week1.svg'
import iconCalendarWeekB from '@/assets/images/icons/admin/admin-calendar-week1b.svg'
import iconPreview       from '@/assets/images/icons/admin/admin-preview1.svg'
import iconPreviewB      from '@/assets/images/icons/admin/admin-preview1b.svg'

const route  = useRoute()
const { isAdmin, emulatingEmail, startEmulation, stopEmulation } = useAuth()

// Only show native tooltips on hover-capable (mouse) devices
const canHover = ref(false)

// ── Staff user list for View As dropdown ──────────────────────────────────────
const staffUsers = ref<{ email: string; displayName: string }[]>([])

onMounted(async () => {
  canHover.value = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (!isAdmin.value) return
  try {
    const q    = query(collection(db, 'approvedUsers'), where('role', '==', 'staff'))
    const snap = await getDocs(q)
    staffUsers.value = snap.docs
      .map(d => ({ email: d.id, displayName: d.data().displayName ?? d.id }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  } catch (e) {
    console.warn('[AdminNav] Could not load staff list for View As:', e)
  }
})

const onViewAsChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (val) startEmulation(val)
  else     stopEmulation()
}

const PREVIEW_ITEMS = [
  { path: '/missions', icon: '🚀', svg: iconMissions, label: 'Missions',       short: 'MISS' },
  { path: '/typing',   icon: '⌨️', svg: iconTyping,   label: 'Typing Trainer', short: 'TYPE' },
]

// Reflect the current route in the dropdown — empty string shows the placeholder
const activePreviewPath = computed(() =>
  PREVIEW_ITEMS.find(item => isActive(item.path))?.path ?? ''
)

// ── Preview dropdown — styled & behaves like the rest of the nav ─────────────
const previewMenuOpen = ref(false)
const previewWrapRef = ref<HTMLElement | null>(null)

const previewIcon = computed(() => (activePreviewPath.value ? iconPreviewB : iconPreview))

function togglePreviewMenu() {
  previewMenuOpen.value = !previewMenuOpen.value
}

function closePreviewMenu() {
  previewMenuOpen.value = false
}

function onDocumentClick(e: MouseEvent) {
  if (previewWrapRef.value && !previewWrapRef.value.contains(e.target as Node)) {
    closePreviewMenu()
  }
}

watch(previewMenuOpen, (open) => {
  if (open) document.addEventListener('click', onDocumentClick)
  else      document.removeEventListener('click', onDocumentClick)
})

onUnmounted(() => document.removeEventListener('click', onDocumentClick))

const ALL_ITEMS = [
  { path: '/admin/dashboard', icon: '🖥️', svg: iconDashboard, svgActive: iconDashboardB, label: 'Dashboard',     short: 'DASH'  },
  { path: '/admin/seating',   icon: '🪑', svg: iconSeating,   svgActive: iconSeatingB,   label: 'Seating Chart', short: 'SEAT'  },
  { path: '/admin/grading',   icon: '✏️', svg: iconGrading,   svgActive: iconGradingB,   label: 'Grading',       short: 'GRADE' },
  { path: '/admin/reports',   icon: '📊', svg: iconReports,   svgActive: iconReportsB,   label: 'Reports',       short: 'RPTS'  },
  { path: '/admin/missions',  icon: '📋', svg: iconMissions,  svgActive: iconMissionsB,  label: 'Missions',      short: 'MISS'  },
  { path: '/flight-plan',     icon: '📅', svg: iconCalendarWeek, svgActive: iconCalendarWeekB, label: 'Flight Plan', short: 'PLAN' },
  { path: '/admin/typing',    icon: '⌨️', svg: iconTyping,    svgActive: iconTypingB,    label: 'Typing',        short: 'TYPE'  },
  { path: '/admin/games',     icon: '🎮', svg: iconSimulator, svgActive: iconSimulatorB, label: 'Games',         short: 'GAMES' },
  { path: '/systems',         icon: '⚙️', svg: iconSystems,   svgActive: iconSystemsB,   label: 'Systems',       short: 'SYS'   },
  { path: '/admin/users',     icon: '👥', svg: iconUsers,     svgActive: iconUsersB,     label: 'Users',         short: 'USRS' },
  { path: '/admin/seed',      icon: '🧪', svg: null,          svgActive: null,           label: 'Demo Seeder',   short: 'SEED', adminOnly: true },
  { path: '/admin/year-end',  icon: '📅', svg: null,          svgActive: null,           label: 'Year-End',      short: 'Y/E',  adminOnly: true },
]

const visibleItems = computed(() =>
  ALL_ITEMS.filter(item => !item.adminOnly || isAdmin.value)
)

function isActive(path: string): boolean {
  return route.path === path
}

// Swap to the "...b" active-state icon variant while that item's route is current
function navIcon(item: { path: string; svg: string | null; svgActive?: string | null }): string | undefined {
  if (isActive(item.path) && item.svgActive) return item.svgActive
  return item.svg ?? undefined
}
</script>

<style scoped>

.admin-nav {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: auto;
  //padding: 1.5rem 0.25rem 0.5rem;
  background: transparent;
  flex-shrink: 0;
  z-index: 100;
  /* Frozen — locked to the row's height, overflow clipped rather than
     scrolled. Mirrors .champs-wrapper (flex-shrink: 0; height: 100%;
     overflow: hidden) so both side panels behave the same way. */
  height: 100%;
  overflow: hidden;
}

.admin-nav-inner {
  display: grid;
  grid-template-columns: 1fr;
  //margin-top: 0.5rem;
  gap: 0;
  background: rgba(0, 0, 0, 0);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  //-webkit-backdrop-filter: blur(14px) saturate(160%);
  //border: 1px solid rgba(102, 136, 170, 0.2);
  border-radius: 0.5rem;
  padding: 0;
  a {
    background-color: transparent;
  }
}

.admin-nav::-webkit-scrollbar { display: none; }

/* Items that should always span both columns */
.full-row {
  grid-column: 1 / -1;
}

.admin-nav-item {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: 0.75rem;
  padding: 0 0.65rem;
  border-radius: 0;
  text-decoration: none;
  //color: #6688aa;
  color: #3279be;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  cursor: pointer;
  width: 100%;
}

.admin-nav-item:hover {
  color: #99ccff;
}

.admin-nav-item.is-active {
  color: #ff9900;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.4rem;
}

.admin-nav-icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  object-fit: contain;
  opacity: 0.9;
  transition: opacity 0.15s, filter 0.15s;
}

.admin-nav-icon--emoji {
  width: auto;
  height: auto;
  font-size: 1.35rem;
  line-height: 1;
  opacity: 1;
}

.admin-nav-item:hover .admin-nav-icon {
  opacity: 0.95;
}

.admin-nav-item.is-active .admin-nav-icon {
  opacity: 1;
  filter: drop-shadow(0 0 0.3rem rgba(255, 153, 0, 0.55));
}

.admin-nav-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1rem;
  letter-spacing: 0.06em;
  font-weight: bold;
  line-height: 1.1;
  text-align: left;
  padding: 1rem 0.5rem;
}

.admin-nav-item.is-active .admin-nav-label {
  border-left: orange solid 2px;
}

  /* ── View As ──────────────────────────────────────────────────────────────── */
.view-as-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid rgba(153, 204, 255, 0.25);
  border-radius: 0.4rem;
  transition: border-color 0.2s, background 0.2s;
  width: 100%;
}

.view-as-wrap.is-emulating {
  border-color: #ff9900;
  background: rgba(255, 153, 0, 0.08);
  box-shadow: 0 0 0.5rem rgba(255, 153, 0, 0.2);
}

.view-as-icon {
  font-size: 0.9rem;
  opacity: 0.7;
  flex-shrink: 0;
}

.view-as-select {
  background: transparent;
  border: none;
  color: #6688aa;
  cursor: pointer;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.6rem;
  font-weight: bold;
  letter-spacing: 0.08em;
  outline: none;
  padding: 0;
  max-width: 5rem;
  text-align: center;
}

.view-as-wrap.is-emulating .view-as-select {
  color: #ff9900;
}

.view-as-select option {
  background: #0b1220;
  color: #e6f0ff;
}

.view-as-clear {
  background: none;
  border: none;
  color: #ff9900;
  cursor: pointer;
  font-size: 0.7rem;
  line-height: 1;
  padding: 0 0.1rem;
  opacity: 0.8;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.view-as-clear:hover { opacity: 1; }

/* ── Section labels (ADMIN / PREVIEW) ────────────────────────────────────── */
.section-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.45rem;
  letter-spacing: 0.15em;
  text-align: left;
  padding: 0.3rem 0.65rem 0.15rem;
  line-height: 1;
}

.admin-label {
  color: #5577aa;
  margin-bottom: 2rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.45rem;
  //letter-spacing: 0.15em;
  text-align: left;
  padding: 0.3rem 0.65rem 0.15rem;
  line-height: 1;
  text-transform: uppercase;
}

/* ── Student Preview — trigger looks like a regular nav item; the menu that
   drops down reuses the very same .admin-nav-item styling for consistency ── */
.preview-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-top: 0.5rem;
}

.preview-trigger {
  background: none;
  border: none;
  font: inherit;
  width: 100%;
}

.preview-menu {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* ── Opening button (pinned, top of nav) ──────────────────────────────────── */
.opening-btn-icon {
  width: 1.4rem;
  height: 1.4rem;
  object-fit: contain;
}

.opening-btn-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.55rem;
  font-weight: bold;
  letter-spacing: 0.1em;
}

/* ── Opening button ───────────────────────────────────────────────────────── */
.opening-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  margin-top: 0.5rem;
  padding: 0.55rem 0.4rem;
  background: rgba(120, 80, 220, 0.08);
  border: 1px solid rgba(120, 80, 220, 0.3);
  border-radius: 0.5rem;
  color: #8866cc;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.opening-btn:hover {
  background: rgba(120, 80, 220, 0.18);
  border-color: rgba(120, 80, 220, 0.6);
  color: #bb99ff;
}

.opening-btn--active {
  background: rgba(120, 80, 220, 0.15);
  border-color: rgba(120, 80, 220, 0.6);
  color: #bb99ff;
  box-shadow: 0 0 0.6rem rgba(120, 80, 220, 0.2);
}
</style>
