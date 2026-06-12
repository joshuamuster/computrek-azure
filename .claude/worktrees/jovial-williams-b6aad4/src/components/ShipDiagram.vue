<template>
  <div class="ship-container">
    <!-- Spinner shown while the SVG asset is loading -->
    <div v-if="!svgContent" class="spinner-wrap">
      <img :src="spinnerUrl" alt="Loading…" class="spinner" />
    </div>

    <!-- Ship diagram injected once fetched -->
    <div v-else ref="containerRef" v-html="svgContent" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import shipSvgUrl from '@/assets/ship-diagram.svg?url'
import spinnerUrl from '@/assets/images/Spinner-Disc.png'

const props = defineProps<{
  zoneFilters?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'zone-click', key: string): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const svgContent = ref('')

/** Apply zoneFilters prop as inline filter styles on each [data-zone] element */
function applyFilters() {
  if (!containerRef.value) return
  const filters = props.zoneFilters ?? {}
  containerRef.value.querySelectorAll<HTMLElement>('[data-zone]').forEach(el => {
    el.style.filter = filters[el.dataset.zone!] ?? ''
  })
}

/** Wire up click + keyboard handlers on each [data-zone] element */
function attachHandlers() {
  if (!containerRef.value) return
  containerRef.value.querySelectorAll<HTMLElement>('[data-zone]').forEach(el => {
    const zone = el.dataset.zone!
    el.addEventListener('click', () => emit('zone-click', zone))
    el.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') emit('zone-click', zone)
      if (e.key === ' ') { e.preventDefault(); emit('zone-click', zone) }
    })
  })
}

onMounted(async () => {
  const res = await fetch(shipSvgUrl)
  svgContent.value = await res.text()
  await nextTick()
  attachHandlers()
  applyFilters()
})

watch(() => props.zoneFilters, applyFilters, { deep: true })
</script>

<style scoped>
.ship-container {
  width: 100%;
  padding: 1rem 0;
}

.spinner-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 20rem;
}

.spinner {
  width: 12rem;
  height: 12rem;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* v-html content isn't scoped automatically — use :deep() */
:deep(.ship-svg) {
  display: block;
  width: 100%;
  height: auto;
  max-height: 35rem;
  margin: 0 auto;
}

:deep(.zone) {
  cursor: pointer;
  transition: filter 0.15s ease;
  outline: none;
}

:deep(.zone:hover),
:deep(.zone:focus-visible) {
  filter: brightness(1.25) drop-shadow(0 0 6px rgba(255, 255, 255, 0.45));
}

:deep(.sector-zone) {
  cursor: pointer;
  transition: filter 0.15s ease;
  outline: none;
}

:deep(.sector-zone:hover),
:deep(.sector-zone:focus-visible) {
  filter: brightness(1.75);
}
</style>
