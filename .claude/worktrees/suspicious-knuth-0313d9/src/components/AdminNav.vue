<template>
  <nav class="admin-nav">
    <div class="admin-nav-inner">

      <router-link
        v-for="item in visibleItems"
        :key="item.path"
        :to="item.path"
        class="admin-nav-item"
        :class="{ 'is-active': isActive(item.path) }"
        :title="item.label"
      >
        <span class="admin-nav-icon">{{ item.icon }}</span>
        <span class="admin-nav-label">{{ item.short }}</span>
      </router-link>

      <!-- View As — admin only -->
      <div v-if="isAdmin" class="view-as-wrap" :class="{ 'is-emulating': emulatingEmail }">
        <span class="view-as-icon">👁️</span>
        <select
          class="view-as-select"
          :value="emulatingEmail ?? ''"
          @change="onViewAsChange"
          title="View as teacher"
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
          title="Stop emulating"
          @click="stopEmulation"
        >✕</button>
      </div>

    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'

const route  = useRoute()
const { isAdmin, emulatingEmail, startEmulation, stopEmulation } = useAuth()

// ── Staff user list for View As dropdown ──────────────────────────────────────
const staffUsers = ref<{ email: string; displayName: string }[]>([])

onMounted(async () => {
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

const ALL_ITEMS = [
  { path: '/admin/dashboard',      icon: '🖥️',  label: 'Dashboard',          short: 'DASH'  },
  { path: '/admin/missions',       icon: '📋',  label: 'Missions',     short: 'MISS'  },
  { path: '/admin/grading',        icon: '✏️',  label: 'Grading',             short: 'GRADE' },
  { path: '/admin/reports',        icon: '📊',  label: 'Reports',             short: 'RPTS'  },
  // { path: '/stellar-cartography',  icon: '🗺️',  label: 'Stellar Cartography', short: 'CART'  },
  { path: '/admin/typing',        icon: '⌨️',  label: 'Typing',               short: 'TYPE' },
  { path: '/admin/users',        icon: '👥',  label: 'Users',               short: 'USRS', adminOnly: true },
  { path: '/admin/seed',           icon: '🧪',  label: 'Demo Seeder',         short: 'SEED', adminOnly: true },
]

const visibleItems = computed(() =>
  ALL_ITEMS.filter(item => !item.adminOnly || isAdmin.value)
)

function isActive(path: string): boolean {
  // Exact match, but strip query string for comparison
  return route.path === path
}
</script>

<style scoped>

.admin-nav {
  position: sticky;
  top: var(--bar-height, 1.25rem);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
  padding: 0.5rem 1rem;
  pointer-events: none;
  background: transparent;
}

.admin-nav-inner {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
  background: rgba(11, 18, 32, 0.85);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid rgba(102, 136, 170, 0.2);
  border-radius: 0.5rem;
  padding: 0.2rem 0.4rem;
  pointer-events: all;
  a {
    background-color: transparent;
  }
}

.admin-nav::-webkit-scrollbar { display: none; }

.admin-nav-item {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0;
  text-decoration: none;
  color: #6688aa;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  cursor: pointer;
  width: fit-content;
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
  font-size: 2rem;
  margin-top: -0.35rem;
}

.admin-nav-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  font-weight: bold;
  line-height: 1;
}

/* ── View As ──────────────────────────────────────────────────────────────── */
.view-as-wrap {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: 1rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid rgba(153, 204, 255, 0.25);
  border-radius: 0.4rem;
  transition: border-color 0.2s, background 0.2s;
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
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 0.08em;
  outline: none;
  padding: 0;
  max-width: 10rem;
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
</style>
