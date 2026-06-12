<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="showModal"
        class="system-modal-overlay"
        role="dialog"
        :aria-label="system.name"
        @click.self="$emit('close')"
      >
        <div class="system-modal">

          <!-- ── Header ── -->
          <div class="modal-header" :style="{ borderLeftColor: system.color }">
            <span class="modal-icon">{{ system.icon }}</span>
            <div class="modal-title-block">
              <h2 class="modal-title">{{ system.name }}</h2>
              <span class="modal-status-badge" :style="{ backgroundColor: system.color }">
                ● {{ system.status }}
              </span>
            </div>
            <button class="modal-close" aria-label="Close" @click="$emit('close')">✕</button>
          </div>

          <!-- ── Body ── -->
          <div class="modal-body">
            <p class="modal-desc">{{ system.description }}</p>

            <!-- ── Health panel (only shown when this system has an owning period) ── -->
            <div v-if="system.periodId !== undefined" class="health-panel">

              <!-- No data state -->
              <div v-if="system.health === undefined" class="health-no-data">
                <span class="health-label">SYSTEM HEALTH</span>
                <span class="health-pending">No graded work yet — health will display once assignments are evaluated.</span>
              </div>

              <!-- Live health state -->
              <template v-else>
                <div class="health-header">
                  <span class="health-label">SYSTEM HEALTH</span>
                  <span class="health-pct" :style="{ color: healthColor }">{{ system.health.toFixed(1) }}%</span>
                </div>

                <!-- Progress bar -->
                <div class="health-bar-track">
                  <div
                    class="health-bar-fill"
                    :style="{ width: system.health + '%', backgroundColor: healthColor }"
                  />
                </div>

                <!-- Counts row -->
                <div class="health-counts">
                  <span v-if="system.gradedCount">
                    {{ system.gradedCount }} graded
                    ({{ system.totalEarned }}/{{ system.totalPossible }} pts)
                  </span>
                  <span v-if="system.overdueCount" class="overdue-count">
                    · {{ system.overdueCount }} overdue (scored 0)
                  </span>
                </div>
              </template>
            </div>

            <!-- ── Bonus description (only for owned, non-collective systems) ── -->
            <div v-if="system.bonus" class="bonus-panel">
              <span class="bonus-label">⚡ CREW BONUS</span>
              <p class="bonus-desc">{{ system.bonus }}</p>
            </div>

            <!-- ── Collective infrastructure note ── -->
            <div v-if="system.periodId === null" class="collective-note">
              This is shared ship infrastructure. It comes online when the overall crew health is strong.
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { SystemInfo } from '@/types/systems'

const props = defineProps<{
  showModal: boolean
  system:    SystemInfo
}>()

const emit = defineEmits<{ close: [] }>()

/** Maps a 0–100 health score to a colour: green → amber → red. */
const healthColor = computed((): string => {
  const h = props.system.health ?? 100
  if (h >= 80) return '#4FAE6A'   // green
  if (h >= 55) return '#E3C720'   // amber
  return '#e05252'                // red
})

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(()  => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
/* ── Overlay ── */
.system-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* ── Modal card ── */
.system-modal {
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 0.5rem;
  width: min(90vw, 480px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1rem 1rem 1.25rem;
  background: #12122a;
  border-left: 4px solid #70c3f9;
}

.modal-icon {
  font-size: 1.6rem;
  flex-shrink: 0;
}

.modal-title-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.modal-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #e8e8ff;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.modal-status-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #000;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  width: fit-content;
}

.modal-close {
  background: transparent;
  border: none;
  color: #888;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.modal-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* ── Body ── */
.modal-body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-desc {
  margin: 0;
  color: #b0b8d4;
  font-size: 0.95rem;
  line-height: 1.65;
}

/* ── Health panel ── */
.health-panel {
  background: #0f0f22;
  border: 1px solid #333;
  border-radius: 0.375rem;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.health-no-data {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.health-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #666;
  text-transform: uppercase;
}

.health-pending {
  font-size: 0.82rem;
  color: #666;
  font-style: italic;
}

.health-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.health-pct {
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.health-bar-track {
  height: 6px;
  background: #2a2a42;
  border-radius: 999px;
  overflow: hidden;
}

.health-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease, background-color 0.4s ease;
}

.health-counts {
  font-size: 0.78rem;
  color: #777;
}

.overdue-count {
  color: #c07070;
}

/* ── Bonus panel ── */
.bonus-panel {
  background: #0a1a0a;
  border: 1px solid #2a4a2a;
  border-radius: 0.375rem;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.bonus-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #4FAE6A;
  text-transform: uppercase;
}

.bonus-desc {
  margin: 0;
  font-size: 0.85rem;
  color: #9dbf9d;
  line-height: 1.55;
}

/* ── Collective note ── */
.collective-note {
  font-size: 0.82rem;
  color: #666;
  font-style: italic;
}

/* ── Transition ── */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
