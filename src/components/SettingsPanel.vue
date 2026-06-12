<template>
  <div class="settings-panel">

    <!-- Settings -->
    <div class="settings-btn" @click="$emit('openSettings')">
      <img :src="gearIcon" class="settings-icon" alt="Settings" />
    </div>

    <!-- Simulator + challenge notification bubble -->
    <div
      class="simulator-wrap"
      :class="{ 'simulator-wrap--active': isSimulatorActive }"
      @click="$emit('openSimulator')"
      title="Tactical Simulator"
    >
      <div class="simulator-btn">
        <img :src="simulatorIcon" class="simulator-icon" alt="Simulator" />
      </div>
      <!-- Badge floats over the top-right corner; it's a passive notification
           now (not clickable), so swallow clicks rather than letting them
           open the Simulator underneath -->
      <div v-if="isCadet" class="challenge-badge-overlay" @click.stop>
        <ChallengeBadge />
      </div>
    </div>

    <!-- Bathroom pass — wrapper takes flex:1; custom icon overlaid on top -->
    <div class="bathroom-wrap">
      <BathroomTimer ref="bathroomRef" />
      <img
        :src="bathroomRef?.isRestrictedNow ? toiletSlashIcon : toiletIcon"
        class="bathroom-custom-icon"
        alt=""
      />
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { useChallengeSettings } from '@/composables/useChallengeSettings'
import BathroomTimer  from '@/components/timers/Bathroom-Timer.vue'
import ChallengeBadge from '@/components/ChallengeBadge.vue'
import gearIcon       from '@/assets/images/icons/gears7.svg'
import simulatorIcon  from '@/assets/images/icons/game-board6.svg'
import toiletIcon      from '@/assets/images/icons/toilet3.svg'
import toiletSlashIcon from '@/assets/images/icons/toilet-paper-slash4.svg'

defineEmits<{
  (e: 'openSettings'): void
  (e: 'openSimulator'): void
}>()

const { isCadet, isStaff, userInfo } = useAuth()
const bathroomRef = ref<InstanceType<typeof BathroomTimer> | null>(null)

const { challengesEnabled, mode, caughtUpUids, init } = useChallengeSettings()

// Cadets subscribe via their teacherEmail; staff subscribe via their own email.
// The singleton skips if the same email is already being watched.
watch(() => userInfo.value?.teacherEmail, (email) => {
  if (email && isCadet.value) init(email as string)
}, { immediate: true })
watch(() => userInfo.value?.email, (email) => {
  if (email && isStaff.value) init(email as string)
}, { immediate: true })

const isSimulatorActive = computed(() => {
  if (isStaff.value)  return challengesEnabled.value
  if (isCadet.value)  return challengesEnabled.value &&
    (mode.value === 'all' || caughtUpUids.value.includes(userInfo.value?.uid ?? ''))
  return false
})
</script>

<style scoped>
/* ── Column shell ────────────────────────────────────────────────────────── */
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 6rem;
  /* inherits width from left-frame-top in classic.css */
}

/* ── All three main buttons stretch to fill equal height ─────────────────── */
.settings-btn,
.simulator-wrap,
.bathroom-wrap {
  flex: 1 !important;
  padding-block: 0 !important;
  height: unset !important;
  margin-top: 0;
  border-radius: 0.5rem;
}

/* ── Bathroom wrap ───────────────────────────────────────────────────────── */
.bathroom-wrap {
  position: relative;
  overflow: hidden;
}
/* BathroomTimer fills the wrap (provides background colour + click handler) */
.bathroom-wrap :deep(.bathroom-timer) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
  margin: 0;
}
/* Hide the original SVG — we supply our own icon below */
.bathroom-wrap :deep(.bathroom-icon) {
  display: none;
}
/* Custom icon centred over the coloured background */
.bathroom-custom-icon {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 2.5rem;
  height: 2.5rem;
  filter: invert(1) opacity(0.75);
  pointer-events: none;
  display: block;
}

/* ── Settings button ─────────────────────────────────────────────────────── */

.settings-btn,
.simulator-wrap {
  background-color: #777;
}
.simulator-wrap {
  transition: background-color 0.3s ease;
}
.simulator-wrap--active {
  background-color: #3279BE;
}
.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding-right: 0 !important;
}
.settings-icon {
  height: 3rem;
  filter: invert(1) opacity(1);
  transition: transform 0.3s ease, filter 0.2s;
}
.settings-btn:hover .settings-icon {
  transform: scale(1.08) rotate(15deg);
  filter: invert(1) opacity(1);
}

/* ── Simulator wrapper + button ──────────────────────────────────────────── */
.simulator-wrap {
  position: relative;
  cursor: pointer;
}
.simulator-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.simulator-icon {
  height: 3rem;
  filter: invert(1) opacity(1);
  transition: filter 0.2s, transform 0.2s;
}
.simulator-wrap:hover .simulator-icon {
  transform: scale(1.08) rotate(15deg);
}

/* ── Challenge notification bubble ──────────────────────────────────────── */
.challenge-badge-overlay {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  pointer-events: auto;
}
.challenge-badge-overlay :deep(.challenge-badge-wrap) {
  display: block;
}
.challenge-badge-overlay :deep(.challenge-badge-indicator) {
  width: 1.4rem;
  height: 1.4rem;
  font-size: 0.65rem;
  border-radius: 50%;
}
</style>
