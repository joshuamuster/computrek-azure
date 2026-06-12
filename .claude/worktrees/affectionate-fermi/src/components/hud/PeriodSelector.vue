<template>
  <div class="period-selector-wrap">
    <!-- The trigger is the SYSTEMS block itself, handled by the parent -->
    
    <Transition name="slide">
      <div v-if="isOpen" class="slide-down-menu">
        <div class="menu-header">SELECT PERIOD</div>
        <div class="periods-list">
          <button
            v-for="p in periods"
            :key="p.id"
            class="period-btn"
            :class="{ active: p.id === selectedPeriodId }"
            @click="selectPeriod(p.id)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { usePeriodSelector } from '@/composables/usePeriodSelector'
import { PERIOD_IDS } from '@/config/schoolYear'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const { userInfo } = useAuth()
const { selectedPeriodId, setPeriod } = usePeriodSelector()

const periods = computed(() => {
  const ids = userInfo.value?.periodIds || []
  return ids.map(id => {
    const found = PERIOD_IDS.find(p => p.id === id)
    return { id, label: found ? found.label : id }
  })
})

const selectPeriod = (id) => {
  setPeriod(id)
  emit('close')
}
</script>

<style scoped>
.period-selector-wrap {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
}

.slide-down-menu {
  background: rgba(10, 20, 40, 0.95);
  border: 2px solid #3366ff;
  border-top: none;
  padding: 0.5rem;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 10rem;
}

.menu-header {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
  color: #3366ff;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(51, 102, 255, 0.3);
  text-align: center;
}

.periods-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.period-btn {
  background: rgba(51, 102, 255, 0.1);
  border: 1px solid rgba(51, 102, 255, 0.3);
  color: #fff;
  padding: 0.4rem;
  font-family: 'Antonio', sans-serif;
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}

.period-btn:hover {
  background: rgba(51, 102, 255, 0.3);
}

.period-btn.active {
  background: #3366ff;
  color: #fff;
  border-color: #fff;
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease-out;
  max-height: 20rem;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
