<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import './assets/styles/classic.css'
// import './assets/styles/style.css'
import CompuTrekAnimated from './components/CompuTrekAnimated.vue'
// import Connections from './components/og/Connections.vue'
// import PillboxDecks from "./components/PillboxDecks.vue";
// import TopCascade from './components/og/TopCascade.vue'
import TopNav from './components/TopNav.vue'
import BathroomTimer from './components/timers/Bathroom-Timer.vue'
import soundFile from './assets/sounds/SFX-Computer/keyok1.wav'
import ChampsPanel from './components/ChampsPanel.vue'
import AdminNav from './components/AdminNav.vue'
import SettingsModal from './components/modals/SettingsModal.vue'
import { useAuth } from './composables/useAuth.js'
import { useBroadcast } from './composables/useBroadcast'
import { PERIOD_IDS } from './config/schoolYear'

defineProps({
  msg: String,
})

const count = ref(0)
const route = useRoute()
const router = useRouter()
const { logout, userRole, isStaff, isAudit } = useAuth()
const { isBroadcasting, selectedPeriodId: broadcastPeriodId, stopBroadcast } = useBroadcast()

// When the route changes away from /broadcast mid-session, exit broadcast mode
watch(() => route.path, (path) => {
  // Allow navigating while broadcasting — only exit when explicitly requested
})

function exitBroadcast() {
  stopBroadcast()
  router.push('/admin/dashboard')
}

function broadcastPeriodLabel(id) {
  return PERIOD_IDS.find(p => p.id === id)?.label ?? id
}

// Opening intro dim state
const isOpeningDim = ref(false)
const isSettingsModalOpen = ref(false)
const showExitConfirm = ref(false)

const onDim = () => { isOpeningDim.value = true }
const onClear = () => { isOpeningDim.value = false }

const openSettings = () => {
  playSound();
  isSettingsModalOpen.value = true;
}

onMounted(() => {
  window.addEventListener('opening-intro-dim', onDim)
  window.addEventListener('opening-intro-clear', onClear)

  // Apply saved magnification
  const savedZoom = localStorage.getItem('terminalFontZoom');
  if (savedZoom) {
    document.documentElement.style.setProperty('--font-zoom', savedZoom);
  }

  // Initial scroll reset
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  const scroller = document.querySelector('.main-scroll');
  if (scroller) scroller.scrollTop = 0;
})

onBeforeUnmount(() => {
  window.removeEventListener('opening-intro-dim', onDim)
  window.removeEventListener('opening-intro-clear', onClear)
})

// Reset scroll on navigation to avoid layout shifts from internal scroll triggers
watch(() => route.path, () => {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  // Also reset the internal scroller to top for new pages
  const scroller = document.querySelector('.main-scroll');
  if (scroller) scroller.scrollTop = 0;
});

const getLessonsLink = () => {
  const path = route.path;

  // If we're already on a unit page like /courses/:section/:unitKey, stay there
  const unitMatch = path.match(/^\/courses\/[^/]+\/[^/]+\/?$/);
  if (unitMatch) {
    // Ensure no trailing lesson segment; return the unit path as-is
    return unitMatch[0].endsWith('/') ? unitMatch[0].slice(0, -1) : unitMatch[0];
  }

  // If we're on a lesson page like /courses/:section/:unitKey/:lessonId
  const lessonMatch = path.match(/^\/courses\/([^/]+)\/([^/]+)\/[^/]+\/?$/);
  if (lessonMatch) {
    const section = lessonMatch[1];
    const unitKey = lessonMatch[2];
    return `/courses/${section}/${unitKey}`;
  }

  // Default to main courses page
  return '/courses';
}

const playSound = () => {
  const audio = new Audio(soundFile);
  audio.play();
}

const navigateWithSound = (path) => {
  playSound();
  router.push(path);
}

const navigateToLessonsWithSound = () => {
  playSound();
  router.push(getLessonsLink());
}

const logoutWithSound = () => {
  playSound();
  logout();
}

const handleMouseMove = (e) => {
  const item = e.target.closest('.nav-item');
  if (item) {
    const rect = item.getBoundingClientRect();
    item.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    item.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  }
};
</script>

<template>
  <div class="video-background-container">
    <video autoplay muted loop class="background-video">
      <source src="/assets/videos/StarfieldLoop1b.mp4" type="video/mp4">
    </video>
    <div class="video-overlay"></div>
  </div>
  <!-- Full-screen flash overlay for alarms -->
  <div id="screen-flash-overlay" aria-hidden="true"></div>

  <SettingsModal :isOpen="isSettingsModalOpen" @close="isSettingsModalOpen = false" />

  <div class="wrap-everything" :class="{ 'opening-dim': isOpeningDim }">
    <section id="column-1">

      <!--the animated box at the top-->
      <ChampsPanel />
      <CompuTrekAnimated />
      <!--active links-->
      <!--      <Connections />-->

    </section>

    <!--right side content of page-->
    <section id="column-3">

      <!--right side top nav-->
      <div id="topnav" class="wrap" style="position: relative; z-index: 100;">
        <div class="right-frame-top">
          <div class="top-interface-wrapper">

            <!--<TopCascade />-->
            <TopNav />

          </div>
<!--          <div class="bar-panel first-bar-panel">-->
<!--            <div class="bar-1"></div>-->
<!--            <div class="bar-2"></div>-->
<!--            <div class="bar-3"></div>-->
<!--            <div class="bar-4"></div>-->
<!--            <div class="bar-5"></div>-->
<!--          </div>-->
        </div>
        <div class="left-frame-top">
          <div class="panel-5"><a @click.prevent="openSettings" href="#">Settings</a></div>
          <!-- Broadcast exit replaces the Opening button when active -->
          <template v-if="isBroadcasting">
            <div class="panel-5 broadcast-exit-tag" @click="showExitConfirm = true">
              <span class="bcast-live-dot"></span>
              <span class="hop">{{ broadcastPeriodLabel(broadcastPeriodId) }}</span>
            </div>
          </template>
          <template v-else>
            <div class="panel-5" @click="navigateWithSound('/opening')"> <span class="hop"> Opening</span></div>
          </template>
          <!-- Slot 3: Bathroom pass indicator — always visible, synced to bell schedule -->
          <BathroomTimer />
        </div>
      </div>

      <!--main content of page-->
      <div class="wrap" id="gap">
        <div v-if="!isStaff && !isAudit || isBroadcasting" class="left-frame">
          <button @click="topFunction" id="topBtn"><span class="hop">screen?</span> top!</button>
          <div class="MainNav" @mousemove="handleMouseMove">

            <!-- ── All users ──────────────────────────────────── -->
            <div class="panel-3 nav-item" @click="navigateWithSound('/courses/CompSci')">
              <span class="hop"> Curriculum</span>
              <div class="nav-desc">Lessons, syllabi, and course materials.</div>
            </div>
            <div class="panel-5 nav-item" @click="navigateWithSound(userRole &&
            ['staff','admin','audit'].includes(userRole.toLowerCase()) && !isBroadcasting ? '/admin/dashboard' : '/dashboard')">
              <span class="hop"> Dashboard</span>
              <div class="nav-desc">View your active missions and assignment status.</div>
            </div>
            <div class="panel-5 nav-item" @click="navigateWithSound('/typing')">
              <span class="hop"> Typing Lab</span>
              <div class="nav-desc">Speed tests, lessons, and typing training.</div>
            </div>
            <div class="panel-5 nav-item" @click="navigateWithSound('/missions')">
              <span class="hop"> Mission Schedule</span>
              <div class="nav-desc">Year-at-a-glance calendar of missions.</div>
            </div>
            <div class="panel-7 nav-item" @click="navigateWithSound('/games')">
              <span class="hop">Simulator</span>
              <div class="nav-desc">Tactical simulations and holodeck training.</div>
            </div>
            <div class="panel-8 nav-item" @click="navigateWithSound('/seating')">
              <span class="hop"> Seating Chart</span>
              <div class="nav-desc">View your assigned seat for this period.</div>
            </div>
            <div class="panel-8 nav-item" @click="navigateWithSound('/crew')">
              <span class="hop"> Crew</span>
              <div class="nav-desc">View your crew and fellow cadets.</div>
            </div>

            <!-- ── Staff / Admin / Audit (hidden in broadcast mode) ────────── -->
            <div class="panel-7 nav-item"
                 v-if="userRole && ['staff','admin','audit'].includes(userRole.toLowerCase()) && !isBroadcasting"
                 @click="navigateWithSound('/admin')">
              <span class="hop"> Admin</span>
              <div class="nav-desc">Mission library, reports, and settings.</div>
            </div>
            <div class="panel-7 nav-item"
                 v-if="userRole && ['staff','admin','audit'].includes(userRole.toLowerCase()) && !isBroadcasting"
                 @click="navigateWithSound('/typing')">
              <span class="hop"> Typing</span>
              <div class="nav-desc">Mission library, reports, and settings.</div>
            </div>

            <!-- ── Always last ────────────────────────────────── -->
            <div class="panel-8 nav-item" @click="navigateWithSound('/')">
              <span class="hop"> Home</span>
              <div class="nav-desc">Return to main bridge display.</div>
            </div>
            <div class="panel-9 nav-item" @click="logoutWithSound">
              <span class="hop"> Sign Out</span>
              <div class="nav-desc">Terminate secure terminal session.</div>
            </div>

          </div>
        </div>
        <div class="right-frame" :class="{ 'is-admin-view': (isStaff || isAudit) && !isBroadcasting }">
          <div v-if="!isStaff && !isAudit || isBroadcasting" class="bar-panel">
            <div class="bar-6"></div>
            <div class="bar-7"></div>
            <div class="bar-8"></div>
            <div class="bar-9"></div>
            <div class="bar-10"></div>
          </div>
          <div class="main-and-sidenav">
            <AdminNav v-if="(isStaff || isAudit) && !isBroadcasting && route.path !== '/videos'" />
            <main>
              <div class="main-scroll">
                <div class="main-scroll-content">
                  <router-view />
                </div>
                <footer>
                  <div>
                    <span style="margin-right:3.125rem;">Website Interface Copyright <a
                        href="https://joshuamuster.com" target="_blank">Joshua Muster</a> &#169; 2026  </span>
                    <span>Academy CS Content & All Lessons Copyright <a
                        href="https://studio.code.org/home" target="_blank">Code.org</a> &#169; 2026</span>
                    <span style="margin-left:3.125rem;">Auth: {{ userRole ? userRole.toUpperCase() : 'UNKNOWN' }}</span>
                  </div>
                </footer>
              </div>
            </main>
          </div>
        </div>
      </div>
    </section>
  </div>

  <!-- Exit Broadcast confirmation modal -->
  <Teleport to="body">
    <Transition name="bcast-modal">
      <div v-if="showExitConfirm" class="bcast-confirm-backdrop" @click.self="showExitConfirm = false">
        <div class="bcast-confirm-panel" role="dialog" aria-label="Exit Broadcast">
          <div class="bcast-confirm-header">
            <h2 class="bcast-confirm-title">Exit Broadcast?</h2>
            <button class="bcast-confirm-close" @click="showExitConfirm = false" aria-label="Cancel">&#10005;</button>
          </div>
          <div class="bcast-confirm-body">
            <p class="bcast-confirm-msg">
              You're currently live on
              <strong class="bcast-period-name">{{ broadcastPeriodLabel(broadcastPeriodId) }}</strong>.
              Exiting will return you to the admin dashboard and end the broadcast session.
            </p>
            <div class="bcast-confirm-actions">
              <button class="bcast-btn bcast-btn-cancel" @click="showExitConfirm = false">Stay Live</button>
              <button class="bcast-btn bcast-btn-exit" @click="showExitConfirm = false; exitBroadcast()">Exit Broadcast</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
export default {
  methods: {
    topFunction() {
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      const scroller = document.querySelector('.main-scroll');
      if (scroller) scroller.scrollTop = 0;
    },
  },
};
</script>

<style scoped>
@import 'assets/styles/classic.css';

footer {
  color: #555;
  font-style: italic;
  margin-top: 0.25rem;
  padding-bottom: 0.5rem;
}

.video-background-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -2;
}

.background-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -2;
}

.video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: -1;
}

.wrap-everything {
  position: relative;
  z-index: 1;
}

.MainNav {
  cursor: crosshair;
}

.nav-item {
  position: relative;
  overflow: visible;
}

.nav-desc {
  position: absolute;
  left: var(--mouse-x, 100%);
  top: var(--mouse-y, 50%);
  transform: translate(0.9375rem, -50%);
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.7);
  border: 0.0625rem solid #3366ff;
  border-left: 0.375rem solid #3366ff;
  color: white;
  width: 12.5rem;
  font-size: 0.9rem;
  line-height: 1.3;
  font-family: 'Roboto', sans-serif;
  text-transform: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
  transition-delay: 0s;
  z-index: 1000;
  pointer-events: none;
  border-radius: 0 0.5rem 0.5rem 0;
  box-shadow: 0 0.25rem 0.9375rem rgba(0, 0, 0, 0.5);
}

@media (hover: hover) {
  .nav-item:hover .nav-desc {
    opacity: 1;
    visibility: visible;
    transition-delay: 0.5s;
  }
}

.nav-desc::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-width: 0.5rem;
  border-style: solid;
  border-color: transparent #3366ff transparent transparent;
}

.main-and-sidenav {
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

main {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0; /* allow inner scroller to size/overflow */
  position: relative;
}

.main-scroll {
  flex: 1 1 auto;
  min-height: 0; /* critical so children can scroll inside */
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 0 0 20px;
  scroll-padding-top: 4rem; /* Buffer for sticky headers inside */
  display: flex;
  flex-direction: column;
}

.main-scroll-content {
  flex: 1 1 auto; /* grows to push footer to bottom on short pages */
}

/* Layout adjustments to make left-frame fill viewport height and right-frame scroll internally */
@media (min-width: 64rem) {
  /* Make the right side column occupy the full viewport height and prevent page scroll */
  #column-3 {
    display: flex;
    flex-direction: column;
    height: 98vh;
    min-height: 56.25rem;
    overflow: hidden;
  }

  /* Ensure the content row (#gap) fills remaining space and allows its own scrolling children */
  #gap {
    flex: 1 1 auto;
    min-height: 0; /* critical so children can overflow/scroll within flex container */
    overflow: hidden;
  }

  /* Left frame should stretch to the visible height */
  #gap .left-frame {
    height: 100%;
  }

  /* Right frame should not scroll; inner main-scroll handles scrolling */
  #gap .right-frame {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* main-and-sidenav fills the remaining height below the bar */
  #gap .right-frame .main-and-sidenav {
    flex: 1 1 auto;
    min-height: 0;
  }

  /* Keep the top bar panel inside the right-frame stuck to the top while scrolling */
  #gap .right-frame > .bar-panel {
    position: sticky;
    top: 0;
    z-index: 5; /* above content inside right-frame */
  }
}
/* Alarm screen flash overlay */
#screen-flash-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 0, 0, 0.65);
  opacity: 0;
  pointer-events: none;
  z-index: 9999;
}

@keyframes screen-flash {
  0% { opacity: 0; }
  15% { opacity: 0.85; }
  100% { opacity: 0; }
}

#screen-flash-overlay.flash-active {
  animation: screen-flash 1600ms ease-in-out;
}

/* ── Admin/Staff view — hide student-only LCARS decorations ─────────────── */
.right-frame.is-admin-view::before,
.right-frame.is-admin-view::after {
  display: none;
}

/* ── Bathroom timer in left-frame-top slot 3 ─────────────────────────────── */
.left-frame-top :deep(.bathroom-timer) {
  width: 100%;
  height: 5rem;
  flex-shrink: 0;
  border-radius: 0.5rem;
  margin-top: 0;
}

/* ── Broadcast mode combined exit button ─────────────────────────────────── */
.broadcast-exit-tag {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  cursor: pointer;
  color: #ff9900 !important;
  transition: color 0.15s, background-color 0.15s;
  opacity: 1 !important;
}

.broadcast-exit-tag:hover {
  color: #ffcc66 !important;
  background-color: rgba(255, 100, 50, 0.9) !important;
}

.bcast-live-dot {
  display: inline-block;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: #ff4444;
  flex-shrink: 0;
  animation: bcast-blink 1.2s infinite;
}

@keyframes bcast-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.15; }
}

/* ── Exit Broadcast confirm modal ────────────────────────────────────────── */
.bcast-confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(0.375rem);
  -webkit-backdrop-filter: blur(0.375rem);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 600;
  padding: 1.5rem;
}

.bcast-confirm-panel {
  background: rgba(8, 15, 28, 0.97);
  border: 0.0625rem solid rgba(255, 153, 0, 0.35);
  border-radius: 1rem;
  box-shadow: 0 0 3rem rgba(255, 100, 0, 0.1), 0 0 0.5rem rgba(0, 0, 0, 0.8);
  width: 100%;
  max-width: 28rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bcast-confirm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.75rem;
  border-bottom: 0.0625rem solid rgba(255, 153, 0, 0.2);
}

.bcast-confirm-title {
  font-family: 'Antonio', sans-serif;
  font-size: 1.4rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  color: #ff9900;
  margin: 0;
}

.bcast-confirm-close {
  background: transparent;
  border: 0.0625rem solid rgba(255, 153, 0, 0.3);
  border-radius: 50%;
  color: rgba(255, 153, 0, 0.7);
  cursor: pointer;
  font-size: 0.9rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.bcast-confirm-close:hover {
  background: rgba(255, 153, 0, 0.15);
  border-color: #ff9900;
  color: #fff;
}

.bcast-confirm-body {
  padding: 1.5rem 1.75rem;
}

.bcast-confirm-msg {
  font-family: 'Roboto', sans-serif;
  color: #c8d8e8;
  font-size: 1rem;
  line-height: 1.7;
  margin: 0 0 1.5rem;
  border-left: 0.25rem solid #ff9900;
  padding-left: 1rem;
}

.bcast-period-name {
  color: #ff9900;
}

.bcast-confirm-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.bcast-btn {
  font-family: 'Antonio', sans-serif;
  font-size: 0.95rem;
  letter-spacing: 0.05rem;
  text-transform: uppercase;
  border: none;
  border-radius: 0.5rem;
  padding: 0.6rem 1.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.bcast-btn-cancel {
  background: rgba(255, 255, 255, 0.08);
  color: #aac;
  border: 0.0625rem solid rgba(255, 255, 255, 0.15);
}

.bcast-btn-cancel:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.bcast-btn-exit {
  background: rgba(200, 60, 40, 0.75);
  color: #fff;
}

.bcast-btn-exit:hover {
  background: rgba(220, 80, 60, 0.9);
}

/* Transition */
.bcast-modal-enter-active,
.bcast-modal-leave-active {
  transition: opacity 0.2s ease;
}
.bcast-modal-enter-active .bcast-confirm-panel,
.bcast-modal-leave-active .bcast-confirm-panel {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.bcast-modal-enter-from,
.bcast-modal-leave-to {
  opacity: 0;
}
.bcast-modal-enter-from .bcast-confirm-panel,
.bcast-modal-leave-to .bcast-confirm-panel {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.98);
}
</style>