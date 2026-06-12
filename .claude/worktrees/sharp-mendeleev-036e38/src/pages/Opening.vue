<template>
  <div class="opening-fullscreen">
    <video ref="videoRef" autoplay muted loop playsinline preload="auto" @click="pauseAllIfPlaying">
      <source src="/assets/videos/StarfieldLoop1b.mp4" type="video/mp4" />
    </video>

    <!-- Overlay container for timed content -->
    <div class="overlay-container">
      <!-- Quote (5s to 31s) -->
      <div class="overlay overlay-quote" :class="{ visible: showQuote }">
        <p>"Your job will never be any bigger than your imagination makes it."
          <br/>
          <br/>
        <span>- Some really old smart dude</span></p>
      </div>

      <!-- Federation Logo (31s to 51s) -->
      <img
        class="overlay overlay-image"
        :class="{ visible: showFederation }"
        :src="federationLogo"
        alt="Federation Logo"
      />

      <!-- CT TNG Logo (51s to 69s) -->
      <img
        class="overlay overlay-image cttng"
        :class="{ visible: showCT }"
        :src="ctTngLogo"
        alt="CT TNG Logo"
      />

      <!-- Ship Name (69s to end) -->
      <img
        class="overlay overlay-image curiosity"
        :class="{ visible: showShip }"
        :src="shipNameImg"
        alt="Ship Name"
      />
    </div>

    <button class="make-it-so" :class="{ 'fade-out': hasClicked }" @click="playMainTitle" aria-label="Play Main Title Theme">
      [ Engage ]
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onBeforeUnmount } from 'vue';
import federationLogo from '@/assets/images/Opening-FederationLogo-Glow-2x-min.png';
import ctTngLogo from '@/assets/images/Opening-CT-TNG-4x-min.png';
import shipNameImg from '@/assets/images/Opening-ShipName-1x-min.jpg';

const videoRef = ref<HTMLVideoElement | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);
const warmupRef = ref<HTMLAudioElement | null>(null);
const hasClicked = ref(false);
const currentTime = ref(0);
const audioDuration = ref<number | null>(null);

// Timing marks in seconds
const tQuoteStart = 5; // appear
const tQuoteEnd = 31;  // hide and fade to Federation
const tFederationEnd = 51; // fade to CT
const tCTEnd = 69; // fade to Ship

const showQuote = computed(() => currentTime.value >= tQuoteStart && currentTime.value < tQuoteEnd);
const showFederation = computed(() => currentTime.value >= tQuoteEnd && currentTime.value < tFederationEnd);
const showCT = computed(() => currentTime.value >= tFederationEnd && currentTime.value < tCTEnd);
const showShip = computed(() => currentTime.value >= tCTEnd && (audioDuration.value == null || currentTime.value < audioDuration.value));

let timeUpdateHandler: ((this: HTMLAudioElement, ev: Event) => any) | null = null;
let endedHandler: ((this: HTMLAudioElement, ev: Event) => any) | null = null;

onMounted(() => {
  // Preload audio for user-initiated playback
  const audio = new Audio('/assets/sounds/MainTitle.mp3');
  audio.preload = 'auto';
  audioRef.value = audio;

  // Preload warmup sound that should play as the interface fades back in
  const warmup = new Audio('/assets/sounds/LCARS-Bridge-Warmup.mp3');
  warmup.preload = 'auto';
  warmup.volume = 0.7; // a bit softer than the main title
  warmupRef.value = warmup;

  // Capture duration when metadata is loaded
  audio.addEventListener('loadedmetadata', () => {
    audioDuration.value = isFinite(audio.duration) ? audio.duration : null;
  });

  // Track currentTime as audio plays
  timeUpdateHandler = () => {
    currentTime.value = audio.currentTime || 0;
  };
  audio.addEventListener('timeupdate', timeUpdateHandler);

  // When the song ends, hide the ship image (let CSS fade handle)
  endedHandler = () => {
    currentTime.value = audio.duration || currentTime.value;
    // After a short delay, reset overlays by advancing time slightly beyond duration
    setTimeout(() => {
      currentTime.value = (audio.duration || currentTime.value) + 0.01;
    }, 50);

    // Notify layout to clear dimming once intro finishes
    window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));

    // As the interface fades back in, play the LCARS warmup sound
    setTimeout(() => {
      try {
        if (warmupRef.value) {
          warmupRef.value.currentTime = 0;
          const p = warmupRef.value.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
      } catch {}
    }, 50);
  };
  audio.addEventListener('ended', endedHandler);

  // Proactively start background video playback; browsers typically allow autoplay when muted.
  if (videoRef.value) {
    const playPromise = videoRef.value.play();
    if (playPromise && typeof (playPromise as any).catch === 'function') {
      (playPromise as Promise<void>).catch(() => {
        try {
          videoRef.value!.muted = true;
          videoRef.value!.play();
        } catch {}
      });
    }
  }

  // Preload overlay images to avoid flashes
  [federationLogo, ctTngLogo, shipNameImg].forEach((src) => {
    const img = new Image();
    img.src = src;
  });
});

onBeforeUnmount(() => {
  if (audioRef.value) {
    if (timeUpdateHandler) audioRef.value.removeEventListener('timeupdate', timeUpdateHandler);
    if (endedHandler) audioRef.value.removeEventListener('ended', endedHandler);
    audioRef.value.pause();
    audioRef.value.src = '';
  }
  if (warmupRef.value) {
    try {
      warmupRef.value.pause();
      warmupRef.value.src = '';
    } catch {}
  }
  // Ensure any dimming is cleared when leaving the page
  window.dispatchEvent(new CustomEvent('opening-intro-clear', { detail: true }));
});

const playMainTitle = async () => {
  try {
    hasClicked.value = true; // fade the button

    // Stop any warmup sound if it's currently playing
    if (warmupRef.value) {
      try {
        warmupRef.value.pause();
        warmupRef.value.currentTime = 0;
      } catch {}
    }

    if (!audioRef.value) {
      audioRef.value = new Audio('/assets/sounds/MainTitle.mp3');
      audioRef.value.preload = 'auto';
    }

    // Restart from beginning
    audioRef.value.currentTime = 0;
    currentTime.value = 0;
    const playPromise = audioRef.value.play();
    if (playPromise && typeof (playPromise as any).then === 'function') {
      await playPromise;
    }

    // Notify layout to dim surrounding UI while intro plays
    window.dispatchEvent(new CustomEvent('opening-intro-dim', { detail: true }));
  } catch (e) {
    // ignore play errors
  }
};

const pauseAllIfPlaying = async () => {
  const v = videoRef.value;
  const a = audioRef.value;
  const w = warmupRef.value;

  const videoIsPlaying = !!(v && !v.paused && !v.ended);
  const audioIsPlaying = !!(a && !a.paused && !a.ended);
  const warmupIsPlaying = !!(w && !w.paused && !w.ended);

  if (videoIsPlaying || audioIsPlaying || warmupIsPlaying) {
    // Pause all if any is playing
    if (v && !v.paused && !v.ended) v.pause();
    if (a && !a.paused && !a.ended) a.pause();
    if (w && !w.paused && !w.ended) w.pause();
    return;
  }

  // Otherwise, all are paused or not started: resume as appropriate
  if (v && v.paused) {
    try {
      const p = v.play();
      if (p && typeof p.catch === 'function') await p.catch(() => {});
    } catch {}
  }

  if (a && a.paused && !a.ended) {
    try {
      // Only attempt to play if user has already initiated audio (button clicked)
      // We infer that by currentTime > 0 or hasClicked
      if (hasClicked.value || (a.currentTime ?? 0) > 0) {
        const p2 = a.play();
        if (p2 && typeof p2.catch === 'function') await p2.catch(() => {});
      }
    } catch {}
  }

  if (w && w.paused && !w.ended) {
    try {
      // Warmup should be allowed to resume only after user interaction
      if (hasClicked.value || (w.currentTime ?? 0) > 0) {
        const p3 = w.play();
        if (p3 && typeof p3.catch === 'function') await p3.catch(() => {});
      }
    } catch {}
  }
};
</script>

<style scoped>
.opening-fullscreen {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.opening-fullscreen video {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100vw;
  object-fit: cover;
  border: none;
}

/* Overlay container fills screen */
.overlay-container {
  pointer-events: none;
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 3;
}

.overlay {
  opacity: 0;
  transition: opacity 1s ease; /* smooth fade */
  position: absolute;
  max-width: 90vw;
  max-height: 80vh;
}

.overlay.visible {
  opacity: 1;
}

/* Quote styling */
.overlay-quote p {
  color: #ffffff;
  text-align: center;
  font-family: 'Georgia', serif;
  font-size: clamp(1.25rem, 4.5vw, 2.625rem);
  font-weight: 700;
  line-height: 1.3;
  padding: 1rem 1.5rem;
  text-shadow: 0 0.25rem 0.75rem rgba(0,0,0,0.7);
  background: rgba(0,0,0,0.35);
  span {
    font-size: 0.7em;
    font-weight: 200;
    font-style: italic;
  }
}

/* Image overlays */
.overlay-image {
  filter: drop-shadow(0 0.5rem 1.5rem rgba(0,0,0,0.6));
  max-height: 31.25rem;
  max-width: 80%;
}

.curiosity {
  max-width: 100% !important;
}

.make-it-so {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 4; /* Above overlays so it is clickable initially */
  color: #ffffff;
  font-size: clamp(1.5rem, 6vw, 3.5rem);
  font-weight: 800;
  letter-spacing: 0.0625rem;
  text-shadow: 0 0.125rem 0.375rem rgba(0,0,0,0.6);
  background: rgba(0, 0, 0, 0.35);
  border: none;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: opacity 0.6s ease;
}

.make-it-so.fade-out {
  opacity: 0;
  pointer-events: none;
}

.make-it-so:hover,
.make-it-so:focus-visible {
  background: rgba(0, 0, 0, 0.55);
  outline: none;
}
</style>
