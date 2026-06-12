<template>
  <div class="admin-nav" role="navigation">
    <div class="admin-nav-inner">

      <!-- Admin section label -->
      <div class="full-row section-label admin-label">ADMIN</div>

      <router-link
        v-for="item in visibleItems"
        :key="item.path"
        :to="item.path"
        class="admin-nav-item"
        :class="{ 'is-active': isActive(item.path) }"
        :title="canHover ? item.label : undefined"
      >
        <span class="admin-nav-icon">{{ item.icon }}</span>
        <span class="admin-nav-label">{{ item.short }}</span>
      </router-link>

      <!-- Student Preview — links to student-facing pages -->
      <div class="full-row preview-section">
        <div class="preview-section-label">PREVIEW</div>
        <div class="preview-section-grid">
          <router-link
            v-for="item in PREVIEW_ITEMS"
            :key="item.path"
            :to="item.path"
            class="admin-nav-item preview-item"
            :class="{ 'is-active': isActive(item.path) }"
            :title="canHover ? 'Student view: ' + item.label : undefined"
          >
            <span class="admin-nav-icon">{{ item.icon }}</span>
            <span class="admin-nav-label">{{ item.short }}</span>
          </router-link>
        </div>
      </div>

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

      <!-- Sign Out -->
      <div class="full-row signout-divider"></div>
      <button class="full-row signout-btn" @click="logout" :title="canHover ? 'Sign out' : undefined">
        <span class="admin-nav-icon">🚪</span>
        <span class="admin-nav-label">SIGN OUT</span>
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'

const route  = useRoute()
const { isAdmin, emulatingEmail, startEmulation, stopEmulation, logout } = useAuth()

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
  { path: '/missions', icon: '📅', label: 'Mission Schedule', short: 'SCHD' },
  { path: '/typing',   icon: '⌨️', label: 'Typing Trainer',   short: 'TYPE' },
]

const ALL_ITEMS = [
  { path: '/admin/dashboard', icon: '🖥️', label: 'Dashboard',     short: 'DASH'  },
  { path: '/admin/missions',  icon: '📋', label: 'Missions',       short: 'MISS'  },
  { path: '/admin/grading',   icon: '✏️', label: 'Grading',        short: 'GRADE' },
  { path: '/admin/reports',   icon: '📊', label: 'Reports',        short: 'RPTS'  },
  { path: '/admin/typing',    icon: '⌨️', label: 'Typing',         short: 'TYPE'  },
  { path: '/admin/seating',   icon: '🪑', label: 'Seating Chart',  short: 'SEAT'  },
  { path: '/broadcast',       icon: '📡', label: 'Broadcast',      short: 'BCAST' },
  { path: '/systems',         icon: '⚙️', label: 'Systems',        short: 'SYS'   },
  { path: '/admin/users',     icon: '👥', label: 'Users',          short: 'USRS' },
  { path: '/admin/seed',      icon: '🧪', label: 'Demo Seeder',    short: 'SEED', adminOnly: true },
]

const visibleItems = computed(() =>
  ALL_ITEMS.filter(item => !item.adminOnly || isAdmin.value)
)

function isActive(path: string): boolean {
  return route.path === path
}
</script>

<style scoped>

.admin-nav {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: auto;
  padding: 1.5rem 0.25rem 0.5rem;
  background: transparent;
  flex-shrink: 0;
  z-index: 100;
}

.admin-nav-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  background: rgba(11, 18, 32, 0.85);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid rgba(102, 136, 170, 0.2);
  border-radius: 0.5rem;
  padding: 0.4rem 0.2rem;
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
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.2rem;
  padding: 0.6rem 0.4rem;
  border-radius: 0;
  text-decoration: none;
  color: #6688aa;
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
  font-size: 1.5rem;
  line-height: 1;
}

.admin-nav-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  font-weight: bold;
  line-height: 1;
  text-align: center;
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
  text-align: center;
  padding: 0.3rem 0.25rem 0.15rem;
  line-height: 1;
}

.admin-label {
  color: #5577aa;
  margin-bottom: 0.1rem;
}

/* ── Student Preview ──────────────────────────────────────────────────────── */
.preview-section {
  margin-top: 0.35rem;
  border-radius: 0.35rem;
  background: rgba(20, 45, 38, 0.55);
  border: 1px solid rgba(74, 138, 122, 0.25);
  padding: 0 0 0.2rem;
  overflow: hidden;
}

.preview-section-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.45rem;
  letter-spacing: 0.15em;
  color: #4a7a6a;
  text-align: center;
  padding: 0.3rem 0.25rem 0.15rem;
  line-height: 1;
}

.preview-section-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.preview-item {
  color: #4a8a7a !important;
  opacity: 0.85;
}

.preview-item:hover {
  color: #5cb8a0 !important;
  opacity: 1;
}

.preview-item.is-active {
  color: #5cb8a0 !important;
  background: rgba(92, 184, 160, 0.1);
}

/* ── Sign Out ─────────────────────────────────────────────────────────────── */
.signout-divider {
  height: 1px;
  background: rgba(153, 204, 255, 0.08);
  margin: 0.4rem 0.5rem 0.2rem;
}

.signout-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.5rem 0.4rem 0.6rem;
  background: none;
  border: none;
  color: #664444;
  cursor: pointer;
  width: 100%;
  font-family: inherit;
  transition: color 0.15s;
  border-radius: 0 0 0.4rem 0.4rem;
}

.signout-btn:hover {
  color: #cc6666;
}
</style>
