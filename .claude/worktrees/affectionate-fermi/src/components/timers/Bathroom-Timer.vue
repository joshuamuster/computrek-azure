<template>
  <div
    class="bathroom-timer"
    :class="isRestrictedNow ? 'bathroom-no' : 'bathroom-yes'"
    :title="isRestrictedNow ? 'Bathroom Pass Unavailable' : 'Bathroom Pass Available'"
    role="button"
    tabindex="0"
    @click="playFlushSound"
    @keydown.space.prevent="playFlushSound"
    @keydown.enter.prevent="playFlushSound"
    :aria-label="(isRestrictedNow ? 'Bathroom Not Available' : 'Bathroom Available') + '. Click to play sound'"
  >
    <!-- Inline SVG via <img> using CSS filters/colors won't work reliably; use raw import to inject markup so we can style fills -->
    <div class="bathroom-icon" v-html="bathroomSvg"></div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useScheduleManager } from '@/composables/useScheduleManager.js'
import bathroomSvgRaw from '@/assets/images/bathroom.svg?raw'
import flushSoundUrl from '@/assets/sounds/toilet-flush.mp3'

// Use schedule manager to determine current period window
const { currentBlock, missionTimeline, updateMissionClock } = useScheduleManager()

// Determine if we are within a class period
const nowRef = ref(new Date())
let intervalId = null
let boundaryTimeoutId = null

function clearBoundaryTimer() {
  if (boundaryTimeoutId) {
    clearTimeout(boundaryTimeoutId)
    boundaryTimeoutId = null
  }
}

function scheduleNextBoundary() {
  clearBoundaryTimer()
  const now = new Date()

  // Determine candidate boundaries (only 10-minute marks, never at period start or end)
  let candidateTimes = []

  // Prefer currentBlock if it's a period, else search for an active one
  let block = currentBlock?.value
  if (!block || block.type !== 'period') {
    block = missionTimeline.value.find(b => b.type === 'period' && now >= b.start && now < b.end) || null
  }

  // Ignore Lunch blocks entirely when scheduling
  const isLunch = (b) => (b?.label || '').toLowerCase() === 'lunch'

  if (block && !isLunch(block)) {
    const startMs = block.start.getTime()
    const endMs = block.end.getTime()
    const first10End = new Date(startMs + 10 * 60 * 1000)
    const last10Start = new Date(endMs - 10 * 60 * 1000)
    candidateTimes.push(first10End, last10Start)
  }

  // Always consider the next period's start+10 as a fallback/next target (skipping Lunch)
  const upcoming = missionTimeline.value.find(b => b.type === 'period' && !isLunch(b) && b.start > now)
  if (upcoming) {
    candidateTimes.push(new Date(upcoming.start.getTime() + 10 * 60 * 1000))
  }

  // Filter to future times strictly greater than now, pick the soonest
  const next = candidateTimes
    .filter(d => d && d > now)
    .sort((a, b) => a.getTime() - b.getTime())[0]

  if (next) {
    const delay = Math.max(0, next.getTime() - now.getTime())
    boundaryTimeoutId = setTimeout(() => {
      // Play sound at the exact 10-minute mark only
      playFlushSound()
      // Then advance the timers/state
      tick()
    }, delay)
  }
}

function tick() {
  nowRef.value = new Date()
  updateMissionClock()
  // After each tick, re-schedule to the next boundary to stay precise
  scheduleNextBoundary()
}

onMounted(() => {
  // Safety heartbeat: update every 5s in case schedule changes or the page throttles timers
  intervalId = setInterval(() => tick(), 5000)
  tick() // initial will also schedule precise boundary
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
  clearBoundaryTimer()
})

// Helper to see if a Date is between start and end (inclusive)
function isBetween(now, start, end) {
  return now >= start && now <= end
}

const isRestrictedNow = computed(() => {
  const now = nowRef.value

  // Find the active period block from missionTimeline (type === 'period')
  // Prefer currentBlock if it's a period, else search
  let block = currentBlock?.value
  if (!block || block.type !== 'period') {
    block = missionTimeline.value.find(b => b.type === 'period' && isBetween(now, b.start, b.end)) || null
  }

  // Treat Lunch as unrestricted (available), same as outside periods
  if (!block || (block.label || '').toLowerCase() === 'lunch') return false

  const startMs = block.start.getTime()
  const endMs = block.end.getTime()
  const nowMs = now.getTime()

  const first10End = startMs + 10 * 60 * 1000 // first 10 minutes inclusive
  const last10Start = endMs - 10 * 60 * 1000 // last 10 minutes inclusive

  return (nowMs >= startMs && nowMs < first10End) || (nowMs >= last10Start && nowMs <= endMs)
})

const bathroomSvg = bathroomSvgRaw

// Sound is triggered by precise boundary timer at 10-minute marks only.

// Single audio instance to minimize latency and allow rapid replays
let audioEl = null
function ensureAudio() {
  if (!audioEl) {
    audioEl = new Audio(flushSoundUrl)
    audioEl.volume = 0.75
  }
  return audioEl
}

function playFlushSound() {
  const el = ensureAudio()
  el.volume = 0.8
  try {
    el.currentTime = 0
  } catch (e) {
    // ignore if not yet loaded
  }
  const p = el.play()
  if (p && typeof p.catch === 'function') {
    p.catch(() => {/* ignore autoplay errors */})
  }
}
</script>

<style scoped>
.bathroom-timer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 5.625rem;
  height: 5.8125rem;
  border-radius: 100% 0 0 100%;
  overflow: hidden;
  margin-top: -0.5625rem;
  cursor: pointer;
}

/* Ensure the injected SVG scales to fit */
.bathroom-icon :deep(svg) {
  width: 3.125rem;
  height: 100%;
  display: block;
  margin-left: 0.625rem;
}

/* YES state: blue background, white icon */
.bathroom-yes {
  background-color: #3279BE; /* divisionColors.blue */
}
.bathroom-yes :deep(svg *),
.bathroom-yes :deep(svg path),
.bathroom-yes :deep(svg rect),
.bathroom-yes :deep(svg circle),
.bathroom-yes :deep(svg polygon),
.bathroom-yes :deep(svg g) {
  fill: #FFFFFF !important;
  stroke: #FFFFFF !important;
}

/* NO state: red background, black icon */
.bathroom-no {
  background-color: #ff0000; /* divisionColors.red */
}
.bathroom-no :deep(svg *),
.bathroom-no :deep(svg path),
.bathroom-no :deep(svg rect),
.bathroom-no :deep(svg circle),
.bathroom-no :deep(svg polygon),
.bathroom-no :deep(svg g) {
  fill: #000000 !important;
  stroke: #000000 !important;
}
</style>
