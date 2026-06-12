<template>
  <div class="lcars-frame">
    <div class="frame-col-3">
      <div v-if="graphicsMode === 'standard'" class="animation-container">
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
      </div>
      <img src="../assets/images/FederationLogo.svg"
           :class="['federation-logo', { 'federation-logo--glow': graphicsMode === 'medium' }]"
           alt="Federation Logo"
           role="button"
           title="Toggle Fullscreen"
           @click="toggleFullscreen"
           @touchstart.prevent="toggleFullscreen"
      >
<!--      <img src="../assets/images/FederationLogoPlanet1-ring1b.svg" class="federation-ring1" alt="Federation Logo">-->
<!--      <img src="../assets/images/FederationLogoPlanet1-ring2b.svg" class="federation-ring2" alt="Federation Logo">-->
<!--      <img src="../assets/images/FederationLogoPlanet1-disk.svg" class="federation-logo" alt="Federation Logo">-->
    </div>
<!--    <div class="frame-col-4"></div>-->
<!--    <div class="frame-col-5">-->
<!--      <div class="frame-col-5-cell-a"></div>-->
<!--      <div class="frame-col-5-cell-b"></div>-->
<!--      <div class="frame-col-5-cell-c"></div>-->
<!--    </div>-->
  </div>
</template>

<script setup>
import { useGraphicsMode } from '@/composables/useGraphicsMode';
const { graphicsMode } = useGraphicsMode();

// Toggle fullscreen on click/touch of the federation logo
const isFullscreen = () => {
  return !!(
    document.fullscreenElement ||
    // @ts-ignore - webkit-prefixed for older Safari
    document.webkitFullscreenElement ||
    // @ts-ignore - ms-prefixed for old Edge
    document.msFullscreenElement
  );
};

const requestFullscreen = (el) => {
  if (el.requestFullscreen) return el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  // @ts-ignore
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  // @ts-ignore
  if (el.msRequestFullscreen) return el.msRequestFullscreen();
};

const exitFullscreen = () => {
  if (document.exitFullscreen) return document.exitFullscreen().catch(() => {});
  // @ts-ignore
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  // @ts-ignore
  if (document.msExitFullscreen) return document.msExitFullscreen();
};

const toggleFullscreen = () => {
  if (isFullscreen()) {
    exitFullscreen();
  } else {
    // Prefer making the entire document fullscreen
    requestFullscreen(document.documentElement);
  }
};
</script>

<script>
export default {
  name: 'LcarsFrame',
};
</script>

<style scoped>
@import '../assets/styles/classic.css';

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@keyframes spin-reverse {
  from {
    transform: rotate(360deg);
  }
  to {
    transform: rotate(0deg);
  }
}

.lcars-frame {
  margin: 0.125rem 0 1.875rem;
  min-height: 12.5rem !important;
}
.frame-col-3 {
  align-items: center;
  display: flex;
  height: 12.5rem;
  justify-content: center;
  position: relative;
}

.animation-container {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  scale: 1.4;
  transform: rotate(90deg);
  z-index: 1;
}

.federation-logo {
  position: absolute;
  min-width: 12.5rem;
  z-index: 2;
  transform: rotate(0deg);
  cursor: pointer;
}

.federation-ring1 {
  position: absolute;
  min-width: 12.5rem;
  z-index: 3;
  animation: spin 6s linear infinite;
}
.federation-ring2 {
  position: absolute;
  min-width: 12.5rem;
  z-index: 3;
  animation: spin-reverse 45s linear infinite;
}

.line {
  position: relative;
  margin: 0 -0.015625rem;
}

/* Low Power mode — pause all scan-line animations in the logo container */
/* (kept as a safety net; v-if already removes the container in medium/low) */
:global(.low-graphics) .animation-container .line {
  animation-play-state: paused;
}

/* ── Medium mode: federation logo glow ───────────────────────────────────── */
@keyframes federation-glow {
  0%, 100% {
    filter: drop-shadow(0 0 0.4rem rgba(153, 204, 255, 0.55))
            drop-shadow(0 0 1.2rem rgba(153, 204, 255, 0.25));
  }
  50% {
    filter: drop-shadow(0 0 0.75rem rgba(153, 204, 255, 0.85))
            drop-shadow(0 0 2rem   rgba(153, 204, 255, 0.45))
            drop-shadow(0 0 3.5rem rgba(100, 180, 255, 0.2));
  }
}

.federation-logo--glow {
  animation: federation-glow 4s ease-in-out infinite;
}
</style>
