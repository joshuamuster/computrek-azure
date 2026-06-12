<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>Command Center</span></div>

    <div v-if="!isStaff && !isAdmin && !isAudit" class="denied-container">
      <div class="denied-icon">⛔</div>
      <h2 class="denied-title">ACCESS DENIED</h2>
      <p class="denied-sub">This section is restricted to staff.</p>
    </div>

    <div v-else class="hub-container">
      <p class="hub-sub">Administrative tools for managing missions, users, and settings.</p>

      <div class="hub-grid">

        <div class="hub-card" @click="go('/admin/dashboard')">
          <div class="hub-icon">🖥️</div>
          <div class="hub-label">Dashboard</div>
          <div class="hub-desc">Grading queue and live period health at a glance.</div>
        </div>

        <div class="hub-card" @click="go('/admin/missions')">
          <div class="hub-icon">📋</div>
          <div class="hub-label">Mission Library</div>
          <div class="hub-desc">Create, edit, and deploy missions to your classes.</div>
        </div>

        <div class="hub-card" @click="go('/admin/grading')">
          <div class="hub-icon">✏️</div>
          <div class="hub-label">Grading</div>
          <div class="hub-desc">Review cadet submissions and manage grades.</div>
        </div>

        <div class="hub-card" @click="go('/admin/reports')">
          <div class="hub-icon">📊</div>
          <div class="hub-label">Reports</div>
          <div class="hub-desc">Class performance analytics by period.</div>
        </div>

        <div class="hub-card" @click="go('/stellar-cartography')">
          <div class="hub-icon">🗺️</div>
          <div class="hub-label">Stellar Cartography</div>
          <div class="hub-desc">FUSD school structure and feeder pathways.</div>
        </div>

        <div class="hub-card" v-if="isAdmin" @click="go('/admin/users')">
          <div class="hub-icon">👥</div>
          <div class="hub-label">Users</div>
          <div class="hub-desc">Manage users and access permissions.</div>
        </div>

        <div class="hub-card hub-card--typing" @click="go('/admin/typing')">
          <div class="hub-icon">⌨️</div>
          <div class="hub-label">Typing Lab</div>
          <div class="hub-desc">Create and manage structured typing lessons for your cadets.</div>
        </div>

        <div class="hub-card hub-card--seed" v-if="isAdmin" @click="go('/admin/seed')">
          <div class="hub-icon">🧪</div>
          <div class="hub-label">Demo Seeder</div>
          <div class="hub-desc">Populate and clear test data across all periods.</div>
        </div>

      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth.js'

const { isStaff, isAdmin, isAudit } = useAuth()
const router = useRouter()
const go = (path: string) => router.push(path)
</script>

<style scoped>
@import '../assets/styles/classic.css';

.hub-container {
  display: flex; flex-direction: column; gap: 1.5rem;
  padding: 1.5rem 2rem 3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

.hub-sub {
  color: #99ccff; font-size: 0.95rem; margin: 0;
}

.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1.25rem;
}

.hub-card {
  background: rgba(0,30,60,0.5);
  border: 0.125rem solid rgba(153,204,255,0.15);
  border-radius: 0.75rem;
  padding: 1.5rem 1.25rem;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.hub-card:hover {
  border-color: rgba(255,153,0,0.5);
  background: rgba(0,40,80,0.55);
  transform: translateY(-0.2rem);
}

.hub-icon  { font-size: 2rem; line-height: 1; }
.hub-label { font-size: 1.25rem; font-weight: bold; color: #ff9900; letter-spacing: 0.05em; }
.hub-desc  { font-size: 0.85rem; color: #99ccff; line-height: 1.4; }

/* Typing Lab card — gold tint to match LCARS typing theme */
.hub-card--typing { border-color: rgba(255,196,0,0.15); }
.hub-card--typing:hover { border-color: rgba(255,196,0,0.45); }
.hub-card--typing .hub-label { color: #ffc400; }

/* Seed card gets a muted teal tint to signal it's a dev/test tool */
.hub-card--seed { border-color: rgba(77,200,216,0.15); }
.hub-card--seed:hover { border-color: rgba(77,200,216,0.45); }
.hub-card--seed .hub-label { color: #4dc8d8; }

/* Access denied */
.denied-container {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 6rem 2rem; gap: 1rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}
.denied-icon  { font-size: 4rem; }
.denied-title { color: #ff6e6e; font-size: 2.5rem; margin: 0; letter-spacing: 0.2em; }
.denied-sub   { color: #99ccff; font-size: 1.1rem; margin: 0; }
</style>
