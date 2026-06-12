<template>
  <div class="systems-page">
    <div class="lcars-text-bar"><span>Ship's Systems</span></div>
    <p class="hint-text">Select a section of the ship to view its system status.</p>

    <!--
      ShipDiagram is a self-contained component that holds the full SVG.
      To swap to a new SVG design, only ShipDiagram.vue needs to change.
    -->
    <ShipDiagram
      :zone-filters="zoneFilters"
      @zone-click="openSystem"
    />

    <!-- System info modal -->
    <SystemModal
      :showModal="showModal"
      :system="currentSystem"
      @close="showModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ShipDiagram from '@/components/ShipDiagram.vue'
import SystemModal from '@/components/modals/SystemModal.vue'
import type { SystemInfo } from '@/types/systems'
import { useShipStatus } from '@/composables/useShipStatus'
import { getPeriodForSystem, SYSTEM_BONUS } from '@/config/shipSystems'

/* ─── Live health subscription ────────────────────────────────────────── */
const { statusByPeriod } = useShipStatus()

/* ─── System definitions ──────────────────────────────────────────────── */
const SYSTEMS: Record<string, SystemInfo> = {
  topWing: {
    name: 'Port Thruster Assembly',
    icon: '🚀',
    color: '#70C3F9',
    status: 'Nominal',
    description:
      'Port-side reaction control thrusters. Provides lateral maneuvering, attitude adjustment, and low-speed docking maneuvers. All nozzles and fuel lines reading within normal parameters.',
  },
  bottomWing: {
    name: 'Starboard Thruster Assembly',
    icon: '🚀',
    color: '#70C3F9',
    status: 'Nominal',
    description:
      'Starboard-side reaction control thrusters. Provides lateral maneuvering, attitude adjustment, and low-speed docking maneuvers. All nozzles and fuel lines reading within normal parameters.',
  },
  cockpit: {
    name: 'Bridge',
    icon: '🖥️',
    color: '#1E4682',
    status: 'Active',
    description:
      'Central command and control center. All ship-wide systems are monitored and directed from here. Command staff on duty. Primary consoles at full operational capacity.',
  },
  sectorN: {
    name: 'Power Core',
    icon: '⚡',
    color: '#1E4682',
    status: 'Stable',
    description:
      'Main power generation and distribution. Reactors operating within normal parameters. Reserve power at 94%. Emergency power systems on standby and ready.',
  },
  sectorNE: {
    name: 'Propulsion',
    icon: '🔥',
    color: '#2C5F8F',
    status: 'Nominal',
    description:
      'Main propulsion systems including impulse drives and warp nacelle controls. Currently at 40% output; capable of sustaining warp 6 on demand.',
  },
  sectorE: {
    name: 'Navigation',
    icon: '🧭',
    color: '#2F7A8C',
    status: 'Online',
    description:
      'Primary navigation array. Processes stellar cartography data and plots courses through known and uncharted space. Inertial navigation backup is active and synchronized.',
  },
  sectorSE: {
    name: 'Weapons',
    icon: '🎯',
    color: '#5E9F63',
    status: 'Armed',
    description:
      'Forward weapons array — phaser banks and photon torpedo launchers. Weapons are armed and on safety. Command authorization is required before deployment.',
  },
  sectorS: {
    name: 'Communications',
    icon: '📡',
    color: '#328936',
    status: 'Online',
    description:
      'Sub-space communications array. All hailing frequencies open. Encryption protocols active. Long-range transmission capability at full signal strength.',
  },
  sectorSW: {
    name: 'Life Support',
    icon: '🌬️',
    color: '#096A19',
    status: 'Optimal',
    description:
      'Environmental and life support systems. Regulates atmosphere, temperature, gravity plating, and emergency oxygen reserves across all habitable decks. All readings optimal.',
  },
}

/* ─── Zone filter map ─────────────────────────────────────────────────── */

/**
 * Returns a Record mapping systemKey → CSS brightness filter string.
 * ShipDiagram applies these to dim zones based on class health.
 * 100 % health → brightness(1.00)  — full colour
 *   0 % health → brightness(0.55)  — noticeably dimmed but never pitch black
 * Keys with no data (null period or no graded submissions yet) are omitted.
 */
const zoneFilters = computed((): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const key of Object.keys(SYSTEMS)) {
    const periodId = getPeriodForSystem(key)
    if (!periodId) continue
    const doc = statusByPeriod.value.get(periodId)
    if (!doc) continue
    const hasData = doc.gradedCount > 0 || doc.overdueCount > 0
    if (!hasData) continue
    const brightness = 0.55 + (doc.health / 100) * 0.45
    result[key] = `brightness(${brightness.toFixed(3)})`
  }
  return result
})

/* ─── Modal state ─────────────────────────────────────────────────────── */
const showModal = ref(false)
const currentSystem = ref<SystemInfo>(SYSTEMS.cockpit)

function openSystem(key: string): void {
  const base = SYSTEMS[key]
  if (!base) return

  const periodId = getPeriodForSystem(key)
  const statusDoc = periodId ? statusByPeriod.value.get(periodId) : undefined
  const hasData = statusDoc && (statusDoc.gradedCount > 0 || statusDoc.overdueCount > 0)

  currentSystem.value = {
    ...base,
    periodId,
    bonus:         SYSTEM_BONUS[key],
    health:        hasData ? statusDoc!.health        : undefined,
    gradedCount:   hasData ? statusDoc!.gradedCount   : undefined,
    overdueCount:  hasData ? statusDoc!.overdueCount  : undefined,
    totalEarned:   hasData ? statusDoc!.totalEarned   : undefined,
    totalPossible: hasData ? statusDoc!.totalPossible : undefined,
  }
  showModal.value = true
}
</script>

<style scoped>
.systems-page {
  display: block;
}

.hint-text {
  color: #aaa;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}
</style>
