<template>
  <div v-if="isCadet" class="challenge-badge-wrap">

    <!-- Passive notification — appears only while an invitation is pending.
         Sending a challenge and accepting/declining one now both happen via
         the Simulator modal (and the auto-popup IncomingChallengeModal below);
         this is just a heads-up, not something to click. -->
    <div
      v-if="incoming.length > 0"
      class="challenge-badge-indicator"
      :title="incoming.length === 1 ? '1 incoming challenge' : `${incoming.length} incoming challenges`"
    >
      ⚔
      <span class="badge-count">{{ incoming.length }}</span>
    </div>

    <!-- Incoming challenge modal — shows automatically when a challenge arrives -->
    <IncomingChallengeModal :challenge="incoming[0] ?? null" />

  </div>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { useChallenges } from '@/composables/useChallenges'
import IncomingChallengeModal from '@/components/modals/IncomingChallengeModal.vue'

const { isCadet, userInfo } = useAuth()
const { incoming, initBadge, destroy } = useChallenges()

// Watch so initBadge runs as soon as auth resolves, even if it loads after mount
// (school browsers block localStorage, so userInfo starts null and resolves async)
watch(
  () => userInfo.value?.uid,
  (uid) => { if (uid && isCadet.value) initBadge(uid) },
  { immediate: true },
)

onBeforeUnmount(destroy)
</script>

<style scoped>
.challenge-badge-wrap {
  display: flex;
  align-items: center;
}

.challenge-badge-indicator {
  position: relative;
  background: rgba(255, 153, 0, 0.15);
  border: 1px solid #ff9900;
  border-radius: 50%;
  color: #ff9900;
  font-size: 0.9rem;
  height: 2rem;
  width: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 1.5s ease infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 153, 0, 0.35); }
  50%       { box-shadow: 0 0 0 5px rgba(255, 153, 0, 0); }
}

.badge-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ff9900;
  color: #000;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.45rem;
  font-weight: 700;
  border-radius: 50%;
  min-width: 1rem;
  height: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.2rem;
  line-height: 1;
}
</style>
