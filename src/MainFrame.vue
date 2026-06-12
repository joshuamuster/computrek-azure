<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import './assets/styles/classic.css'
import './assets/styles/gameLanding.css'  // hoisted here so game pages never get a FOUC on hard refresh
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
import SettingsModal   from './components/modals/SettingsModal.vue'
import SimulatorModal  from './components/modals/SimulatorModal.vue'
import SettingsPanel   from './components/SettingsPanel.vue'
import { useAuth } from './composables/useAuth.js'
import { useBroadcast } from './composables/useBroadcast'
import { useGraphicsMode } from './composables/useGraphicsMode'
defineProps({
  msg: String,
})

const count = ref(0)
const route = useRoute()
const router = useRouter()
const { logout, userRole, isStaff, isAudit } = useAuth()
const { isBroadcasting } = useBroadcast()
const { graphicsMode } = useGraphicsMode()

// Drives the class on .starfield-bg so CSS shows the right layer set
const starfieldClass = computed(() => ({
  'starfield-mid': graphicsMode.value === 'medium',
  'starfield-low': graphicsMode.value === 'low',
}))

// When the route changes away from /broadcast mid-session, exit broadcast mode
watch(() => route.path, (path) => {
  // Allow navigating while broadcasting — only exit when explicitly requested
})

// Opening intro dim state
const isOpeningDim = ref(false)
const isSettingsModalOpen   = ref(false)
const isSimulatorModalOpen  = ref(false)

const onDim = () => { isOpeningDim.value = true }
const onClear = () => { isOpeningDim.value = false }

// ── CSS Starfield generators ──────────────────────────────────────────────────

// Standard (3-D warp-drive): stars centered at the element origin so they
// radiate outward under perspective. Subtle HSL brightness variation.
function generate3DStars(count) {
  const parts = []
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 3000) - 1500
    const y = Math.floor(Math.random() * 960)  - 480
    const l = 75 + Math.floor(Math.random() * 25)
    parts.push(`${x}px ${y}px hsl(0, 0%, ${l}%)`)
  }
  return parts.join(', ')
}

// Medium (Keith Clark 2-D scroll): stars move right-to-left via translateX(-2000px).
// X range matches the 2000px loop distance for a seamless wrap.
// Y range covers tall displays (1600px is more than enough for any laptop screen).
function generateKCStars(count) {
  const parts = []
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 2000)
    const y = Math.floor(Math.random() * 1600)
    parts.push(`${x}px ${y}px #FFF`)
  }
  return parts.join(', ')
}

const openSettings = () => {
  playSound();
  isSettingsModalOpen.value = true;
}

// ── Idle reload ───────────────────────────────────────────────────────────────
// On weak hardware, browser memory and Vue reactive overhead accumulate over a
// long session. After 45 minutes of no user activity, silently reload the page
// to reset both. Skips if a broadcast is active.
const IDLE_RELOAD_MS = 45 * 60 * 1000
let _idleTimer = null

function _resetIdleTimer() {
  clearTimeout(_idleTimer)
  _idleTimer = setTimeout(() => {
    if (!isBroadcasting.value) window.location.reload()
  }, IDLE_RELOAD_MS)
}

const _IDLE_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'touchstart', 'scroll']

onMounted(() => {
  window.addEventListener('opening-intro-dim', onDim)
  window.addEventListener('opening-intro-clear', onClear)

  _IDLE_EVENTS.forEach(e => window.addEventListener(e, _resetIdleTimer, { passive: true }))
  _resetIdleTimer()

  // Seed all starfield layers up-front — all four CSS vars are always set so
  // switching graphics modes is instant (no regeneration on mode change).
  document.documentElement.style.setProperty('--stars-shadow',    generate3DStars(350))
  document.documentElement.style.setProperty('--stars-kc1-shadow', generateKCStars(700))
  document.documentElement.style.setProperty('--stars-kc2-shadow', generateKCStars(200))
  document.documentElement.style.setProperty('--stars-kc3-shadow', generateKCStars(100))

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
  _IDLE_EVENTS.forEach(e => window.removeEventListener(e, _resetIdleTimer))
  clearTimeout(_idleTimer)
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
  <!--
    CSS starfield — three graphics modes, switched via class on this element:
      (default)     Standard  — 3D warp-drive: perspective + translateZ
      .starfield-mid  Medium  — Keith Clark 2D scroll: translateY, no perspective
      .starfield-low  Low     — plain dark background, no animation at all
  -->
  <div class="starfield-bg" :class="starfieldClass">
    <!-- Standard: 3D layers (element + ::before + ::after handle depth) -->
    <div class="stars stars-3d"></div>
    <!-- Medium: Keith Clark 2D scroll (3 size/speed layers) -->
    <div class="stars-kc kc1"></div>
    <div class="stars-kc kc2"></div>
    <div class="stars-kc kc3"></div>
  </div>
  <!-- Full-screen flash overlay for alarms -->
  <div id="screen-flash-overlay" aria-hidden="true"></div>

  <SettingsModal  :isOpen="isSettingsModalOpen"  @close="isSettingsModalOpen = false" />
  <SimulatorModal :isOpen="isSimulatorModalOpen" @close="isSimulatorModalOpen = false" />

  <div class="wrap-everything" :class="{ 'opening-dim': isOpeningDim }">

    <!-- ── Full-width top bar: animated logo + top nav ─────────────────── -->
    <div id="topbar">
      <CompuTrekAnimated />
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
        <SettingsPanel
          @openSettings="isSettingsModalOpen = true"
          @openSimulator="isSimulatorModalOpen = true"
        />
      </div>
    </div><!-- /#topbar -->

    <!-- ── Main content row: CHAMPS panel + gap ────────────────────────── -->
    <div id="gap-row">
      <ChampsPanel />

      <!--main content of page-->
      <div class="wrap" id="gap">
        <div v-if="!isStaff && !isAudit || isBroadcasting" class="left-frame">
          <button @click="topFunction" id="topBtn"><span class="hop">screen?</span> top!</button>
          <div class="MainNav" @mousemove="handleMouseMove">

            <!-- ── All users ──────────────────────────────────── -->
            <div class="panel-3 nav-item" @click="navigateWithSound(userRole &&
            ['staff','admin','audit'].includes(userRole.toLowerCase()) && !isBroadcasting ? '/admin/dashboard' : '/dashboard')">
              <span class="hop"> Dashboard</span>
              <div class="nav-desc">Lessons, syllabi, and course materials.</div>
            </div>
            <div class="panel-5 nav-item" @click="navigateWithSound('/missions')">
              <span class="hop"> Missions</span>
              <div class="nav-desc">Your active missions, grades, and mission log.</div>
            </div>
            <div class="panel-5 nav-item" @click="navigateWithSound('/typing')">
              <span class="hop"> Typing Lab</span>
              <div class="nav-desc">Speed tests, lessons, and typing training.</div>
            </div>
            <div class="panel-3 nav-item" @click="navigateWithSound('/conduct')">
              <span class="hop"> Conduct Log</span>
              <div class="nav-desc">Your conduct history and standing.</div>
            </div>
            <div class="panel-7 nav-item" @click="navigateWithSound('/games')">
              <span class="hop">Simulator</span>
              <div class="nav-desc">Tactical simulations and holodeck training.</div>
            </div>
            <div class="panel-8 nav-item" @click="navigateWithSound('/seating')">
              <span class="hop"> Seating Chart</span>
              <div class="nav-desc">View your assigned seat for this period.</div>
            </div>
<!--            <div class="panel-5 nav-item" @click="navigateWithSound('/flight-plan')">-->
<!--              <span class="hop"> Flight Plan</span>-->
<!--              <div class="nav-desc">Year-at-a-glance calendar of missions.</div>-->
<!--            </div>-->
            <div class="panel-5 nav-item" @click="navigateWithSound('/courses/CompSci')">
              <span class="hop"> Curriculum</span>
              <div class="nav-desc">View your active missions and assignment status.</div>
            </div>

            <!-- ── Always last ────────────────────────────────── -->
<!--            <div class="panel-8 nav-item" @click="navigateWithSound('/')">-->
<!--              <span class="hop"> Home</span>-->
<!--              <div class="nav-desc">Return to main bridge display.</div>-->
<!--            </div>-->
            <div class="panel-9 nav-item" @click="navigateWithSound('/crew')">
              <span class="hop"> Ship's Crew</span>
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
                    <span style="margin-left:3.125rem;"><router-link to="/changelog" class="footer-link">Change Log</router-link></span>
                  </div>
                </footer>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div><!-- /#gap-row -->
  </div><!-- /.wrap-everything -->

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

.footer-link {
  color: #556688;
  text-decoration: none;
  font-style: italic;
  transition: color 0.15s;
}

.footer-link:hover {
  color: #7990fa;
  text-decoration: underline;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CSS STARFIELD — three graphics modes
   ═══════════════════════════════════════════════════════════════════════════

   Standard  (default)   — 3D warp-drive: perspective + translateZ
   Medium    .starfield-mid — Keith Clark 2D scroll: translateY, no perspective
   Low       .starfield-low — plain dark background, zero animation

   All four CSS var shadow sets are seeded at mount so mode switching is
   instant — no JS runs on toggle, only a class change.
   ═══════════════════════════════════════════════════════════════════════════ */

.starfield-bg {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: -2;
  overflow: hidden;
}

/* ── Standard: 3-D warp-drive ───────────────────────────────────────────── */

.starfield-bg { perspective: 340px; } /* perspective origin at center */

.stars-3d {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 2px;
  background: transparent;
  box-shadow: var(--stars-shadow, none);
  animation: fly 3s linear infinite;
  transform-style: preserve-3d;
}
.stars-3d::before {
  content: '';
  position: absolute;
  width: inherit;
  height: inherit;
  background: transparent;
  box-shadow: var(--stars-shadow, none);
  transform: translateZ(-300px);
  animation: fade1 3s linear infinite;
}
.stars-3d::after {
  content: '';
  position: absolute;
  width: inherit;
  height: inherit;
  background: transparent;
  box-shadow: var(--stars-shadow, none);
  transform: translateZ(-600px);
  animation: fade2 3s linear infinite;
}

@keyframes fly {
  from { transform: translateZ(0px); }
  to   { transform: translateZ(300px); }
}
@keyframes fade1 {
  from { opacity: 0.5; }
  to   { opacity: 1; }
}
@keyframes fade2 {
  from { opacity: 0; }
  to   { opacity: 0.5; }
}

/* ── Medium: Keith Clark 2-D scroll (translateY, no perspective) ─────────── */

/* Hidden by default — shown only in medium mode */
.stars-kc { display: none; }

.starfield-mid {
  perspective: none; /* no 3D projection needed */
}
.starfield-mid .stars-3d  { display: none; }
.starfield-mid .stars-kc  { display: block; }

/* Shared KC layer base */
.stars-kc {
  position: absolute;
  top: 0;
  left: 0;
  background: transparent;
  will-change: transform;
}

/* Layer 1 — 1 px dots, fastest (50 s), most stars */
.kc1 {
  width: 1px;
  height: 1px;
  box-shadow: var(--stars-kc1-shadow, none);
  animation: animStarKC 50s linear infinite;
}
.kc1::after {
  content: '';
  position: absolute;
  top: 0;
  left: 2000px;
  width: 1px;
  height: 1px;
  background: transparent;
  box-shadow: var(--stars-kc1-shadow, none);
}

/* Layer 2 — 2 px dots, mid speed (100 s) */
.kc2 {
  width: 2px;
  height: 2px;
  box-shadow: var(--stars-kc2-shadow, none);
  animation: animStarKC 100s linear infinite;
}
.kc2::after {
  content: '';
  position: absolute;
  top: 0;
  left: 2000px;
  width: 2px;
  height: 2px;
  background: transparent;
  box-shadow: var(--stars-kc2-shadow, none);
}

/* Layer 3 — 3 px dots, slowest (150 s), fewest stars */
.kc3 {
  width: 3px;
  height: 3px;
  box-shadow: var(--stars-kc3-shadow, none);
  animation: animStarKC 150s linear infinite;
}
.kc3::after {
  content: '';
  position: absolute;
  top: 0;
  left: 2000px;
  width: 3px;
  height: 3px;
  background: transparent;
  box-shadow: var(--stars-kc3-shadow, none);
}

/* translateX is compositor-only — zero repaints */
@keyframes animStarKC {
  from { transform: translateX(0px); }
  to   { transform: translateX(-2000px); }
}

/* ── Low Power: plain background, zero animation ────────────────────────── */

.starfield-low { perspective: none; }
.starfield-low .stars-3d { display: none; }
.starfield-low .stars-kc  { display: none; }

/* ── System: prefers-reduced-motion ─────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .stars-3d,
  .stars-3d::before,
  .stars-3d::after,
  .kc1, .kc2, .kc3 { animation: none; }
}

.wrap-everything {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 98vh;
  overflow: hidden;
}

/* ── Full-width top bar ──────────────────────────────────────────────────── */
#topbar {
  align-items: stretch;
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
  gap: 2rem;
  padding: 0 1.5rem;
}

/* Lock CompuTrekAnimated to a fixed rem width inside the top bar */
#topbar > :deep(.lcars-frame) {
  //width: 17rem;
  flex-shrink: 0;
  margin: 0;
}

#topnav {
  flex: 1;
  min-width: 0;
}

/* ── Main content row ────────────────────────────────────────────────────── */
#gap-row {
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  gap: 1.5rem;
  min-height: 0;
  overflow: hidden;
  margin-top: 1.25rem;
  padding: 0 1.5rem;
}

#gap {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
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

/* Layout adjustments to make left-frame fill height and right-frame scroll internally */
@media (min-width: 64rem) {
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


/* ── Touch / Tablet (iPad) responsive layout ─────────────────────────────── */
@media (hover: none) and (pointer: coarse) {
  /* Fix Safari iOS viewport height — 100vh includes browser chrome, dvh doesn't */
  .wrap-everything {
    height: 100dvh;
  }

  /* Tighten content row margins on touch devices */
  #gap-row {
    margin-top: 0.25rem;
    padding: 0 0.5rem;
  }

  /* Portrait (820px) falls below the min-width: 64rem breakpoint so the
     height/overflow rules for right-frame don't apply — add them here. */
  #gap .right-frame {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  #gap .right-frame .main-and-sidenav {
    flex: 1 1 auto;
    min-height: 0;
  }
}
</style>