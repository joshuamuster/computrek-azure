<template>
  <div v-if="isOpen" class="settings-modal-overlay" @click="$emit('close')">
    <div class="settings-modal-content" @click.stop>
      <div class="settings-header">
        <div class="header-decoration"></div>
        <h2>Terminal Settings</h2>
        <button class="close-btn" @click="$emit('close')" aria-label="Close Settings">
          <img src="@/assets/icons/do-not-enter6.svg" alt="Close" class="close-icon-img" />
        </button>
      </div>

      <div class="settings-body">

          <!-- Display Magnification -->
          <section class="setting-section">
            <div class="section-title">
              <div class="title-bar"></div>
              <h3>Display Magnification: <span class="zoom-value">{{ Math.round(currentZoom * 100) }}%</span></h3>
            </div>
            <div class="zoom-slider-wrapper">
              <div class="zoom-presets">
                <button class="zoom-preset-btn" :class="{ active: Math.round(currentZoom * 100) === 85 }" @click="setZoom(0.85)">Student Laptop</button>
                <button class="zoom-preset-btn zoom-preset-btn--b" :class="{ active: Math.round(currentZoom * 100) === 100 }" @click="setZoom(1)">Default Zoom</button>
              </div>
              <div class="zoom-controls">
                <button class="zoom-step-btn" @click="setZoom(Math.max(0.5, currentZoom - 0.05))">−</button>
                <div class="slider-and-ruler">
                  <div class="slider-ruler">
                    <div
                      v-for="n in 21"
                      :key="n"
                      class="ruler-mark"
                      :class="{ 'large': (n - 1) % 2 === 0 }"
                    ></div>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    v-model.number="currentZoom"
                    @input="handleSliderChange"
                    class="lcars-range-slider"
                  >
                </div>
                <button class="zoom-step-btn" @click="setZoom(Math.min(1.5, currentZoom + 0.05))">+</button>
              </div>
              <div class="slider-scale">
                <span>50%</span>
                <span>100%</span>
                <span>150%</span>
              </div>
            </div>
          </section>

          <!-- Graphics Mode -->
          <section class="setting-section">
            <div class="section-title">
              <div class="title-bar"></div>
              <h3>Graphics Mode</h3>
            </div>
            <div class="zoom-presets">
              <button
                class="zoom-preset-btn"
                :class="{ active: graphicsMode === 'standard' }"
                @click="setGraphicsMode('standard')"
              ><img :src="iconStandard" class="graphics-icon" alt="" /> Standard</button>
              <button
                class="zoom-preset-btn graphics-mid-btn"
                :class="{ active: graphicsMode === 'medium' }"
                @click="setGraphicsMode('medium')"
              ><img :src="iconMedium" class="graphics-icon" alt="" /> Medium</button>
              <button
                class="zoom-preset-btn graphics-low-btn"
                :class="{ active: graphicsMode === 'low' }"
                @click="setGraphicsMode('low')"
              ><img :src="iconLow" class="graphics-icon" alt="" /> Low</button>
            </div>
            <p class="graphics-hint">
              <template v-if="graphicsMode === 'standard'">Full 3D starfield &amp; all animations.</template>
              <template v-else-if="graphicsMode === 'medium'">Lighter scrolling starfield — good for most devices.</template>
              <template v-else>No background animations — best for older or slower devices.</template>
            </p>
          </section>

          <!-- System Controls -->
          <section class="setting-section">
            <div class="section-title">
              <div class="title-bar"></div>
              <h3>System Controls</h3>
            </div>
            <div class="control-grid">
              <button class="control-btn" @click="toggleFullscreen">Fullscreen</button>
              <button
                class="control-btn control-btn--danger"
                :class="{ 'control-btn--confirming': confirmingSignOut }"
                @click="handleSignOut"
              >
                {{ confirmingSignOut ? 'Confirm?' : 'Log Out' }}
              </button>
            </div>
          </section>

      </div>

      <div class="settings-footer">
        <div class="footer-version">v{{ appVersion }}</div>
        <div class="footer-bar"></div>
        <div class="footer-id">SETTINGS-TR-402</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth.js'
import { useGraphicsMode } from '@/composables/useGraphicsMode'
import { PERIOD_IDS } from '@/config/schoolYear'
import iconStandard from '@/assets/images/icons/battery-full4.svg'
import iconMedium   from '@/assets/images/icons/battery-half4.svg'
import iconLow      from '@/assets/images/icons/battery-exclamation2.svg'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const router = useRouter()
const { logout, userInfo } = useAuth()
const { graphicsMode, set: setGraphicsMode } = useGraphicsMode()

// ── Confirm state ─────────────────────────────────────────────────────────

const confirmingSignOut = ref(false)
let confirmTimeout = null

function handleSignOut() {
  if (confirmingSignOut.value) {
    logout()
  } else {
    confirmingSignOut.value = true
    confirmTimeout = setTimeout(() => {
      confirmingSignOut.value = false
    }, 4000)
  }
}

// ── Zoom ──────────────────────────────────────────────────────────────────

const appVersion = __APP_VERSION__
const currentZoom = ref(Number(localStorage.getItem('terminalFontZoom')) || 1)

const setZoom = (value) => {
  currentZoom.value = value
  localStorage.setItem('terminalFontZoom', value)
  document.documentElement.style.setProperty('--font-zoom', value)
}

const handleSliderChange = () => {
  localStorage.setItem('terminalFontZoom', currentZoom.value)
  document.documentElement.style.setProperty('--font-zoom', currentZoom.value)
}

// ── Fullscreen ────────────────────────────────────────────────────────────

const isCurrentlyFullscreen = ref(false)

const checkFullscreen = () => {
  isCurrentlyFullscreen.value = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
  )
}

const toggleFullscreen = () => {
  if (isCurrentlyFullscreen.value) {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
    else if (document.msExitFullscreen) document.msExitFullscreen()
  } else {
    const el = document.documentElement
    if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
    else if (el.msRequestFullscreen) el.msRequestFullscreen()
  }
}

onMounted(() => {
  if (currentZoom.value !== 1) {
    document.documentElement.style.setProperty('--font-zoom', currentZoom.value)
  }
  checkFullscreen()
  document.addEventListener('fullscreenchange', checkFullscreen)
  document.addEventListener('webkitfullscreenchange', checkFullscreen)
  document.addEventListener('mozfullscreenchange', checkFullscreen)
  document.addEventListener('MSFullscreenChange', checkFullscreen)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', checkFullscreen)
  document.removeEventListener('webkitfullscreenchange', checkFullscreen)
  document.removeEventListener('mozfullscreenchange', checkFullscreen)
  document.removeEventListener('MSFullscreenChange', checkFullscreen)
  if (confirmTimeout) clearTimeout(confirmTimeout)
})
</script>

<style scoped>
.settings-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.settings-modal-content {
  background: #000;
  border: 0.125rem solid #3366ff;
  border-radius: 2.5rem;
  width: 90%;
  max-width: 28rem;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 0 2.5rem rgba(51, 102, 255, 0.3);
  font-family: 'Roboto', sans-serif;
}

/* Wider modal for staff two-column layout */
.settings-modal-content--wide {
  max-width: 56rem;
}

.settings-header {
  background: #3366ff;
  font-family: 'Antonio', sans-serif;
  display: flex;
  align-items: center;
  padding: 0;
  height: 3.75rem;
  text-align: center;
  flex-shrink: 0;
}

.header-decoration {
  width: 5rem;
  height: 100%;
  background: #99ccff;
  border-radius: 0 0 2.5rem 0;
}

.settings-header h2 {
  flex: 1;
  margin: 0;
  color: #000;
  font-size: 1.5rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.125rem;
}

.close-btn {
  background: #ff9900;
  border: none;
  width: 5rem;
  height: 100%;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 0 0 0 2.5rem;
  transition: background 0.2s;
}

.close-icon-img {
  width: 1.875rem;
  height: 1.875rem;
  filter: brightness(0);
  transition: transform 0.2s ease;
}

.close-btn:hover { background: #ffcc00; }
.close-btn:hover .close-icon-img { transform: scale(1.1); }

/* ── Body layout ─────────────────────────────────────────────────────────── */
.settings-body {
  padding: 1.25rem;
  color: #fff;
  overflow-y: auto;
  flex: 1 1 auto;
}

.settings-body--split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 0;
  align-items: start;
}

/* Left / shared column */
.s-col--shared {
  padding: 1.25rem;
}

/* Right / staff column */
.s-col--staff {
  padding: 1.25rem 1.5rem 1.25rem 1.25rem;
  background: rgba(51, 102, 255, 0.04);
  border-left: 1px solid rgba(51, 102, 255, 0.18);
  min-height: 100%;
}

/* ── Section titles ───────────────────────────────────────────────────────── */
.setting-section {
  margin-bottom: 1.5rem;
}

.section-title {
  align-items: center;
  display: flex;
  font-family: 'Antonio', sans-serif;
  margin-bottom: 1.25rem;
  border-bottom: 2px dotted orange;
}

.staff-section-title {
  border-bottom-color: rgba(51, 102, 255, 0.5);
  margin-bottom: 1.25rem;
}

.title-bar {
  width: 0.5rem;
  height: 1.5rem;
  background: #ff9900;
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.title-bar--staff {
  background: #6699ff;
}

.section-title h3 {
  margin: 0;
  text-transform: uppercase;
  color: #ff9900;
  font-size: 1.25rem;
  letter-spacing: 0.125rem;
}

.staff-heading {
  color: #6699ff !important;
}

/* ── Teacher classroom controls ──────────────────────────────────────────── */
.teacher-group {
  margin-bottom: 1.25rem;
}

.teacher-group:last-child {
  margin-bottom: 0;
}

.teacher-group-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  color: #4466aa;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 0.45rem;
}

/* Period grid */
.period-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.period-btn {
  background: rgba(51, 102, 255, 0.08);
  border: 1px solid rgba(51, 102, 255, 0.25);
  border-radius: 0.4rem;
  color: #7799cc;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.3rem 0.6rem;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.period-btn:hover:not(:disabled) {
  background: rgba(51, 102, 255, 0.18);
  border-color: rgba(51, 102, 255, 0.5);
  color: #aaccff;
}

.period-btn.selected {
  background: rgba(51, 102, 255, 0.35);
  border-color: #6699ff;
  color: #fff;
}

.period-btn.not-mine {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.06);
  color: #223344;
  cursor: not-allowed;
}

/* Simulations toggle */
.sim-row {
  display: flex;
  align-items: center;
}

.sim-row .teacher-group-label {
  flex: 1;
  margin-bottom: 0;
}

.sim-toggle-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  color: #4a5a6a;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  min-width: 3.5rem;
  padding: 0.3rem 0.7rem;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.sim-toggle-btn.active {
  background: rgba(255, 153, 0, 0.15);
  border-color: #ff9900;
  color: #ff9900;
}

.sim-toggle-btn:hover {
  background: rgba(255, 153, 0, 0.08);
  border-color: rgba(255, 153, 0, 0.4);
  color: #cc7700;
}

.sim-toggle-btn.active:hover {
  background: rgba(255, 153, 0, 0.25);
  border-color: #ffbb33;
  color: #ffbb33;
}

/* ── Simulation mode selector ────────────────────────────────────────────── */
.sim-mode-btns {
  display: flex;
  gap: 0.35rem;
}

.sim-mode-btn {
  flex: 1;
  background: rgba(51, 102, 255, 0.06);
  border: 1px solid rgba(51, 102, 255, 0.22);
  border-radius: 0.4rem;
  color: #5577aa;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.35rem 0.6rem;
  text-transform: uppercase;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.sim-mode-btn:hover {
  background: rgba(51, 102, 255, 0.15);
  border-color: rgba(51, 102, 255, 0.45);
  color: #99bbee;
}

.sim-mode-btn.active {
  background: rgba(51, 102, 255, 0.28);
  border-color: #6699ff;
  color: #cce0ff;
}

/* ── Pool refresh button ─────────────────────────────────────────────────── */
.sim-refresh-btn {
  background: rgba(255, 153, 0, 0.07);
  border: 1px solid rgba(255, 153, 0, 0.3);
  border-radius: 0.4rem;
  color: #cc8822;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.35rem 0.8rem;
  text-transform: uppercase;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  width: 100%;
  margin-bottom: 0.5rem;
}

.sim-refresh-btn:hover:not(:disabled) {
  background: rgba(255, 153, 0, 0.15);
  border-color: rgba(255, 153, 0, 0.6);
  color: #ffaa33;
}

.sim-refresh-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Pool meta ───────────────────────────────────────────────────────────── */
.sim-pool-meta {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sim-pool-meta--warn {
  color: #776622;
  font-size: 0.72rem;
  font-style: italic;
}

.sim-pool-count {
  font-family: 'Antonio', sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
  color: #88bbff;
}

.sim-pool-time {
  font-size: 0.68rem;
  color: #445566;
}

/* Broadcast */
.bcast-live-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.bcast-live-dot {
  display: inline-block;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: #ff4444;
  flex-shrink: 0;
  animation: bcast-blink 1.2s infinite;
}

.bcast-live-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #ff6666;
  text-transform: uppercase;
}

@keyframes bcast-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.15; }
}

.bcast-hint {
  font-size: 0.7rem;
  color: #445566;
  text-align: center;
  margin: 0.4rem 0 0;
  font-style: italic;
}

/* ── Zoom controls ───────────────────────────────────────────────────────── */
.zoom-slider-wrapper {
  padding: 0 0.5rem;
}

.zoom-presets {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  gap: 0.5rem;
}

.zoom-value {
  font-size: 1.15rem;
  font-weight: 900;
  color: #ffcc00;
  line-height: 1;
  text-align: center;
  flex-shrink: 0;
}

/* ── Preset / graphics buttons — shared hollow base ─────────────────────── */
.zoom-preset-btn {
  background: transparent;
  color: #7799ff;
  border: 0.125rem solid rgba(51, 102, 255, 0.45);
  padding: 0.75rem;
  border-radius: 62rem;
  font-family: 'Antonio', sans-serif;
  font-size: 1.2rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05rem;
  cursor: pointer;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35em;
  position: relative;
  overflow: hidden;
  transition: all 0.2s;
  box-shadow: 0 0 0.6rem rgba(51, 102, 255, 0.25), 0 0 1.2rem rgba(51, 102, 255, 0.1);
  text-shadow: 0 0 0.4rem rgba(100, 150, 255, 0.5);
}

.zoom-preset-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: -75%;
  width: 50%;
  height: 100%;
  background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
  animation: shineSwipe 2.2s ease-in-out infinite;
  pointer-events: none;
}

.zoom-preset-btn:hover {
  color: #99ccff;
  border-color: rgba(51, 102, 255, 0.8);
  box-shadow: 0 0 0.9rem rgba(51, 102, 255, 0.45), 0 0 1.8rem rgba(51, 102, 255, 0.2);
}

.zoom-preset-btn.active {
  background: rgba(51, 102, 255, 0.85);
  color: #fff;
  border-color: #3366ff;
  box-shadow: 0 0 1rem rgba(51, 102, 255, 0.6), 0 0 2rem rgba(51, 102, 255, 0.25);
  text-shadow: 0 0 0.5rem rgba(200, 220, 255, 0.9);
}

.zoom-preset-btn.active:hover {
  background: #3366ff;
  box-shadow: 0 0 1.25rem rgba(51, 102, 255, 0.75), 0 0 2.5rem rgba(51, 102, 255, 0.35);
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.slider-and-ruler {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.slider-ruler {
  display: flex;
  justify-content: space-between;
  padding: 0 1.5rem;
  margin-top: 1rem;
}

.ruler-mark {
  width: 0.125rem;
  height: 0.5rem;
  background: rgba(153, 204, 255, 0.3);
  border-radius: 0.0625rem;
}

.ruler-mark.large {
  height: 0.875rem;
  background: #99ccff;
  width: 0.1875rem;
}

.lcars-range-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 1.5rem;
  background: #222;
  border-radius: 0.75rem;
  outline: none;
  margin: 0.5rem 0 1rem;
  border: 0.125rem solid #3366ff;
}

.lcars-range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 3rem;
  height: 2.5rem;
  background: #ff9900;
  cursor: pointer;
  border-radius: 0.5rem;
  border: none;
  box-shadow: 0 0 0.625rem rgba(255, 153, 0, 0.4);
}

.lcars-range-slider::-moz-range-thumb {
  width: 3rem;
  height: 2.5rem;
  background: #ff9900;
  cursor: pointer;
  border-radius: 0.5rem;
  border: none;
  box-shadow: 0 0 0.625rem rgba(255, 153, 0, 0.4);
}

.zoom-step-btn {
  background: #3366ff;
  color: #fff;
  border: none;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
  line-height: 1;
}

.zoom-step-btn:hover {
  background: #99ccff;
  color: #000;
}

.slider-scale {
  display: flex;
  justify-content: space-between;
  color: #99ccff;
  font-size: 0.75rem;
  font-weight: bold;
  margin-top: 0.25rem;
  padding: 0 1.5rem;
}

.graphics-icon {
  height: 1.1em;
  width: auto;
  filter: invert(1);
  flex-shrink: 0;
}

.graphics-hint {
  color: #5577aa;
  font-size: 0.75rem;
  margin: 0.5rem 0.5rem 0;
  font-style: italic;
  line-height: 1.4;
}

/* ── Shimmer stagger ─────────────────────────────────────────────────────── */
.zoom-preset-btn--b::after  { animation-delay: 0.6s;  }
.graphics-mid-btn::after    { animation-delay: 0.45s; }
.graphics-low-btn::after    { animation-delay: 0.9s;  }

.control-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

/* ── System control buttons ──────────────────────────────────────────────── */
.control-btn {
  background: transparent;
  color: #ff9900;
  border: 0.125rem solid rgba(255, 153, 0, 0.45);
  padding: 0.6rem 0.75rem;
  border-radius: 20rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  text-transform: uppercase;
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  font-weight: bold;
  letter-spacing: 0.04em;
  width: 100%;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 0.75rem rgba(255, 153, 0, 0.3), 0 0 1.5rem rgba(255, 153, 0, 0.12);
  text-shadow: 0 0 0.4rem rgba(255, 200, 60, 0.6);
}

.control-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: -75%;
  width: 50%;
  height: 100%;
  background: linear-gradient(120deg, transparent 0%, rgba(255, 200, 80, 0.2) 50%, transparent 100%);
  animation: shineSwipe 2.2s ease-in-out infinite;
  pointer-events: none;
}

.control-btn:hover {
  color: #ffcc44;
  border-color: rgba(255, 153, 0, 0.85);
  box-shadow: 0 0 1rem rgba(255, 153, 0, 0.55), 0 0 2rem rgba(255, 153, 0, 0.25);
}

.control-btn--exit {
  color: #ff9900;
  border-color: rgba(255, 153, 0, 0.45);
}

.control-btn--exit:hover {
  color: #ffcc44;
  border-color: rgba(255, 153, 0, 0.85);
  box-shadow: 0 0 1rem rgba(255, 153, 0, 0.55), 0 0 2rem rgba(255, 153, 0, 0.25);
}

.control-btn--broadcast {
  color: #5599ff;
  border-color: rgba(51, 102, 255, 0.45);
  box-shadow: 0 0 0.75rem rgba(51, 102, 255, 0.25), 0 0 1.5rem rgba(51, 102, 255, 0.1);
  text-shadow: 0 0 0.4rem rgba(100, 150, 255, 0.5);
}

.control-btn--broadcast::after {
  background: linear-gradient(120deg, transparent 0%, rgba(100, 150, 255, 0.2) 50%, transparent 100%);
}

.control-btn--broadcast:hover:not(:disabled) {
  color: #99ccff;
  border-color: rgba(51, 102, 255, 0.85);
  box-shadow: 0 0 1rem rgba(51, 102, 255, 0.55), 0 0 2rem rgba(51, 102, 255, 0.25);
}

.control-btn--broadcast:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  box-shadow: none;
}

.control-btn--danger {
  background: transparent;
  color: #ff6e6e;
  border: 0.125rem solid rgba(255, 110, 110, 0.4);
  box-shadow: 0 0 0.75rem rgba(255, 110, 110, 0.4), 0 0 1.5rem rgba(255, 110, 110, 0.2);
  text-shadow: 0 0 0.4rem rgba(255, 150, 150, 0.7);
}

.control-btn--danger::after {
  background: linear-gradient(120deg, transparent 0%, rgba(255, 180, 180, 0.25) 50%, transparent 100%);
  animation-delay: 0.8s;
}

.control-btn--danger:hover {
  background: rgba(255, 110, 110, 0.12);
  border-color: #ff6e6e;
  box-shadow: 0 0 1.25rem rgba(255, 110, 110, 0.6), 0 0 2.5rem rgba(255, 110, 110, 0.3);
}

.control-btn--confirming {
  background: rgba(255, 110, 110, 0.15);
  border-color: #ff6e6e;
  color: #ff6e6e;
  animation: confirm-pulse 0.6s ease-in-out infinite alternate;
}

.control-btn--confirming::after {
  animation: none;
}

@keyframes shineSwipe {
  0%   { left: -75%; }
  60%  { left: 125%; }
  100% { left: 125%; }
}

@keyframes confirm-pulse {
  from { box-shadow: 0 0 0.25rem rgba(255, 110, 110, 0.3); }
  to   { box-shadow: 0 0 0.75rem rgba(255, 110, 110, 0.7); }
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.settings-footer {
  display: flex;
  align-items: flex-end;
  flex-shrink: 0;
}

.footer-bar {
  flex: 1;
  height: 1.25rem;
  background: #3366ff;
}

.footer-version,
.footer-id {
  background: #3366ff;
  color: #000;
  padding: 0 1.25rem;
  font-size: 1rem;
  font-weight: bold;
  height: 1.25rem;
  display: flex;
  align-items: center;
}
</style>
