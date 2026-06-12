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
import soundFile from './assets/sounds/SFX-Computer/keyok1.wav'
import ChampsPanel from './components/ChampsPanel.vue'
import AdminNav from './components/AdminNav.vue'
import SettingsModal from './components/modals/SettingsModal.vue'
import { useAuth } from './composables/useAuth.js'

defineProps({
  msg: String,
})

const count = ref(0)
const route = useRoute()
const router = useRouter()
const { logout, userRole, isStaff, isAudit } = useAuth()

// Opening intro dim state
const isOpeningDim = ref(false)
const isSettingsModalOpen = ref(false)

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
        <div class="left-frame-top">
          <div class="panel-1"><a @click.prevent="openSettings" href="#">Settings</a></div>
          <div class="panel-2" @click="navigateWithSound('/opening')"> <span class="hop"> Opening</span></div>
        </div>
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
      </div>

      <!--main content of page-->
      <div class="wrap" id="gap">
        <div class="left-frame">
          <button @click="topFunction" id="topBtn"><span class="hop">screen?</span> top!</button>
          <div class="MainNav" @mousemove="handleMouseMove">

            <!-- ── All users ──────────────────────────────────── -->
            <div class="panel-3 nav-item" @click="navigateWithSound('/courses/CompSci')">
              <span class="hop"> Courses</span>
              <div class="nav-desc">Lessons, syllabi, and course materials.</div>
            </div>
            <div class="panel-5 nav-item" @click="navigateWithSound(userRole &&
            ['staff','admin','audit'].includes(userRole.toLowerCase()) ? '/admin/dashboard' : '/dashboard')">
              <span class="hop"> Dashboard</span>
              <div class="nav-desc">View your active missions and assignment status.</div>
            </div>
            <div class="panel-6 nav-item" @click="navigateWithSound('/games')">
              <span class="hop">Simulator</span>
              <div class="nav-desc">Tactical simulations and holodeck training.</div>
            </div>
            <div class="panel-7 nav-item" @click="navigateWithSound('/missions')">
              <span class="hop"> Mission Schedule</span>
              <div class="nav-desc">Year-at-a-glance calendar of missions.</div>
            </div>

            <!-- ── Staff / Admin / Audit ──────────────────────── -->
            <div class="panel-7 nav-item" v-if="userRole && ['staff','admin','audit'].includes(userRole.toLowerCase())"
                 @click="navigateWithSound('/admin')">
              <span class="hop"> Admin</span>
              <div class="nav-desc">Mission library, reports, and settings.</div>
            </div>
            <div class="panel-7 nav-item" v-if="userRole && ['staff','admin','audit'].includes(userRole.toLowerCase())"
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
        <div class="right-frame">
          <div class="bar-panel">
            <div class="bar-6"></div>
            <div class="bar-7"></div>
            <div class="bar-8"></div>
            <div class="bar-9"></div>
            <div class="bar-10"></div>
          </div>
          <AdminNav v-if="isStaff || isAudit" />
          <main>
            <div class="main-scroll">
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
          </main>
        </div>
      </div>
    </section>
  </div>
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

main {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0; /* allow inner scroller to size/overflow */
  justify-content: space-between;
  position: relative;
}

.main-scroll {
  flex: 1 1 auto;
  min-height: 0; /* critical so children can scroll inside */
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 0 0 20px;
  scroll-padding-top: 4rem; /* Buffer for sticky headers inside */
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
</style>