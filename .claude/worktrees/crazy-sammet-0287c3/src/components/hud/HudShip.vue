<template>
  <div class="hud-panel hud-center" :class="{ 'clickable': isActingAsTeacher, 'selector-open': isSelectorOpen }" @click="handlePanelClick">
    <div class="panel-title">SYSTEMS</div>

    <!-- For teachers: show current selected period label -->
    <div v-if="isActingAsTeacher" class="current-period">
      {{ selectedPeriodLabel }}
    </div>

    <RouterLink v-if="!isActingAsTeacher" to="/systems" class="ship-link">
      <img class="ship-img" :src="shipSrc" alt="Systems" />
    </RouterLink>
    <div v-else class="ship-link no-link">
      <img class="ship-img" :src="shipSrc" alt="Systems" />
    </div>

    <div class="panel-title">{{ identityLabel }}</div>

    <PeriodSelector
      v-if="isActingAsTeacher"
      :isOpen="isSelectorOpen"
      @close="isSelectorOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import shipSrc from '@/assets/images/hud/Vector-Ship-Vert-Up.svg'
import { usePeriodSelector } from '@/composables/usePeriodSelector'
import { useAuth }           from '@/composables/useAuth.js'
import { useBroadcast }      from '@/composables/useBroadcast'
import { PERIOD_IDS } from '@/config/schoolYear'
import PeriodSelector from './PeriodSelector.vue'

const { selectedPeriodId, isActingAsTeacher } = usePeriodSelector()
const { isAdmin, isStaff, userInfo } = useAuth()
const { isBroadcasting } = useBroadcast()
const router = useRouter()

const isSelectorOpen = ref(false)

const selectedPeriodLabel = computed(() => {
  if (!selectedPeriodId.value) return 'Select Period'
  const found = PERIOD_IDS.find(p => p.id === selectedPeriodId.value)
  return found ? found.label : selectedPeriodId.value
})

// Identity label shown below the ship
const identityLabel = computed(() => {
  if (isAdmin.value)  return 'Admin'
  if (isStaff.value)  return "Staff"
  // Cadet — show period short label if available
  const pid = userInfo.value?.periodId
  if (pid) {
    const short = pid.replace('period-', 'P')
    return `Cadet, ${short}`
  }
  return 'Cadet'
})

const handlePanelClick = () => {
  if (isActingAsTeacher.value) {
    if (isBroadcasting.value) {
      router.push('/systems')
    } else {
      isSelectorOpen.value = !isSelectorOpen.value
    }
  }
}

// Close selector on click outside
const handleClickOutside = (event) => {
  if (isSelectorOpen.value && !event.target.closest('.hud-center')) {
    isSelectorOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
@import '@/assets/styles/hud.css';

.hud-center {
  align-self:      stretch;    /* fill the full height set by the sibling panels */
  display:         flex;
  flex-direction:  column;
  align-items:     center;
  justify-content: center;
  flex: unset;
  padding:         0 1rem;
  /* overflow: hidden; */ /* Removed to allow slide-down visibility */
  position: relative;
}

.clickable {
  cursor: pointer;
}

.selector-open {
  z-index: 1001; /* Stay above sibling panels */
}

.current-period {
  font-family: 'Antonio', sans-serif;
  font-size: 0.7rem;
  color: #3366ff;
  letter-spacing: 0.05em;
  margin-top: 0.1rem;
  text-transform: uppercase;
}

.ship-link {
  display:         flex;
  align-items:     center;
  justify-content: center;
  height:          100%;
}

.ship-img {
  height: 100%;
  margin-top: 0.125rem;
  max-width: 6rem;
  display: block;
  object-fit: contain;
  transition: filter 0.15s ease;
}

.ship-link:hover .ship-img {
  filter: brightness(1.4);
}

.identity-label {
  font-family:    'Antonio', sans-serif;
  font-size:      0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color:          rgba(153, 204, 255, 0.5);
  margin-top:     0.15rem;
  white-space:    nowrap;
}
</style>
