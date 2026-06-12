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
        <section class="setting-section">
          <div class="section-title">
            <div class="title-bar"></div>
            <h3>Display Magnification: <span class="zoom-value">{{ Math.round(currentZoom * 100) }}%</span></h3>
          </div>

          <div class="zoom-slider-wrapper">
            <div class="zoom-presets">
              <button class="zoom-preset-btn" :class="{ active: Math.round(currentZoom * 100) === 85 }" @click="setZoom(0.85)">Student Laptop</button>
              <button class="zoom-preset-btn" :class="{ active: Math.round(currentZoom * 100) === 100 }" @click="setZoom(1)">Default Zoom</button>
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

        <section class="setting-section">
          <div class="section-title">
            <div class="title-bar"></div>
            <h3>System Controls</h3>
          </div>
          <div class="control-grid">
            <button class="control-btn" @click="toggleFullscreen">
              <span class="btn-label">{{ isCurrentlyFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen' }}</span>
              <span class="btn-subtext">Terminal Display Mode</span>
            </button>
          </div>
        </section>

        <section class="setting-section">
          <div class="section-title">
            <div class="title-bar"></div>
            <h3>Interface Information</h3>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">System Status:</span>
              <span class="value">Operational</span>
            </div>
            <div class="info-item">
              <span class="label">LCARS Version:</span>
              <span class="value">24.1.19</span>
            </div>
          </div>
        </section>
      </div>

      <div class="settings-footer">
        <div class="footer-bar"></div>
        <div class="footer-id">SETTINGS-TR-402</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const currentZoom = ref(Number(localStorage.getItem('terminalFontZoom')) || 1)
const isCurrentlyFullscreen = ref(false)

const setZoom = (value) => {
  currentZoom.value = value
  localStorage.setItem('terminalFontZoom', value)
  document.documentElement.style.setProperty('--font-zoom', value)
}

const handleSliderChange = () => {
  localStorage.setItem('terminalFontZoom', currentZoom.value)
  document.documentElement.style.setProperty('--font-zoom', currentZoom.value)
}

const checkFullscreen = () => {
  isCurrentlyFullscreen.value = !!(
      document.fullscreenElement ||
      // @ts-ignore
      document.webkitFullscreenElement ||
      // @ts-ignore
      document.msFullscreenElement
  );
};

const toggleFullscreen = () => {
  if (isCurrentlyFullscreen.value) {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    // @ts-ignore
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    // @ts-ignore
    else if (document.msExitFullscreen) document.msExitFullscreen();
  } else {
    const el = document.documentElement;
    // @ts-ignore
    if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    // @ts-ignore
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    // @ts-ignore
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  }
}

onMounted(() => {
  if (currentZoom.value !== 1) {
    document.documentElement.style.setProperty('--font-zoom', currentZoom.value)
  }

  checkFullscreen();
  document.addEventListener('fullscreenchange', checkFullscreen);
  document.addEventListener('webkitfullscreenchange', checkFullscreen);
  document.addEventListener('mozfullscreenchange', checkFullscreen);
  document.addEventListener('MSFullscreenChange', checkFullscreen);
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', checkFullscreen);
  document.removeEventListener('webkitfullscreenchange', checkFullscreen);
  document.removeEventListener('mozfullscreenchange', checkFullscreen);
  document.removeEventListener('MSFullscreenChange', checkFullscreen);
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
  overflow: hidden;
  box-shadow: 0 0 2.5rem rgba(51, 102, 255, 0.3);
  font-family: 'Roboto', sans-serif;
}

.settings-header {
  background: #3366ff;
  font-family: 'Antonio', sans-serif;
  display: flex;
  align-items: center;
  padding: 0;
  height: 3.75rem;
  text-align: center;
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

.close-btn:hover {
  background: #ffcc00;
}

.close-btn:hover .close-icon-img {
  transform: scale(1.1);
}

.settings-body {
  padding: 1.25rem;
  color: #fff;
}

.setting-section {
  margin-bottom: 1.5rem;
}

.section-title {
  align-items: center;
  display: flex;
  font-family: 'Antonio', sans-serif;
  margin-bottom: 1.25rem;
}

.title-bar {
  width: 0.5rem;
  height: 1.5rem;
  background: #ff9900;
  margin-right: 0.75rem;
}

.section-title h3 {
  margin: 0;
  text-transform: uppercase;
  color: #ff9900;
  font-size: 1rem;
  letter-spacing: 0.0625rem;
}

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

.zoom-preset-btn {
  background: rgba(51,102,255,1);
  color: #fff;
  border: none;
  padding: 0.75rem;
  border-radius: 62rem;
  font-family: 'Antonio', sans-serif;
  font-size: 1.2rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05rem;
  cursor: pointer;
  flex: 1;
  transition: background 0.2s, color 0.2s;
}

.zoom-preset-btn:hover {
  background: #99ccff;
  color: #000;
}

.zoom-preset-btn.active {
  background: rgba(51,102,255,0.5);
  color: #000;
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

.control-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.control-btn {
  background: #ff9900;
  color: #000;
  border: none;
  padding: 1rem;
  border-radius: 20rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.2s;
  text-transform: uppercase;
  font-weight: bold;
  width: 100%;
}

.control-btn:hover {
  background: #ffcc00;
  box-shadow: 0 0 0.9375rem rgba(255, 204, 0, 0.4);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  background: rgba(51, 102, 255, 0.1);
  padding: 1.25rem;
  border-radius: 0.75rem;
  border: 0.0625rem solid rgba(51, 102, 255, 0.3);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item .label {
  color: #99ccff;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.info-item .value {
  color: #fff;
  font-size: 1rem;
}

.settings-footer {
  display: flex;
  align-items: flex-end;
  /* height: 3.125rem; */
}

.footer-bar {
  flex: 1;
  height: 1.25rem;
  background: #3366ff;
}

.footer-id {
  background: #3366ff;
  color: #000;
  padding: 0 1.25rem;
  font-size: 0.75rem;
  font-weight: bold;
  height: 1.25rem;
  display: flex;
  align-items: center;
}
</style>