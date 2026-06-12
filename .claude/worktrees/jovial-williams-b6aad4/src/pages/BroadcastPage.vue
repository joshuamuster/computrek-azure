<template>
  <div class="broadcast-setup">
  <PowerPointModal
    :showModal="showTestingModal"
    :pptxUrl="TESTING_URL"
    @close="showTestingModal = false"
  />
    <div class="setup-card">

      <div class="setup-header">
        <div class="setup-header-bar"></div>
        <h1 class="setup-title">📡 BROADCAST MODE</h1>
        <div class="setup-header-bar"></div>
      </div>

      <p class="setup-subtitle">
        The interface will switch to the student view. CHAMPS and the timer remain
        interactive — changes push to all student devices in the selected period.
      </p>

      <div class="period-grid">
        <button
          v-for="p in PERIOD_IDS"
          :key="p.id"
          class="period-btn"
          :class="{
            selected:  chosenPeriod === p.id,
            'not-mine': !teacherPeriodSet.has(p.id),
          }"
          :disabled="!teacherPeriodSet.has(p.id)"
          @click="chosenPeriod = p.id"
        >
          {{ p.label }}
        </button>
      </div>

      <p v-if="!teacherPeriods.length" class="no-periods">
        No periods are assigned to your account. Ask an admin to add them under Users.
      </p>

      <button
        class="enter-btn"
        :disabled="!chosenPeriod"
        @click="enterBroadcast"
      >
        ENTER BROADCAST
      </button>

      <div class="alt-section">
        <div class="alt-divider"><span>or open for</span></div>
        <div class="alt-grid">
          <button class="alt-btn alt-btn--lunch" @click="router.push('/videos?mode=lunch')">
            🍕 Lunch
          </button>
          <button class="alt-btn alt-btn--after" @click="router.push('/videos?mode=afterschool')">
            🚌 After School
          </button>
          <button class="alt-btn alt-btn--testing" @click="showTestingModal = true">
            📋 Testing
          </button>
        </div>
      </div>

      <button class="cancel-btn" @click="router.back()">← Back</button>

    </div>
  </div>

  <PowerPointModal
    :showModal="showTestingModal"
    pptxUrl="https://fusd-my.sharepoint.com/:p:/g/personal/jonathan_muster_fresnounified_org/IQAqYQjHyTNpRZXrLzj-hI26AUolPmw0NfaJm0VZCbXRKII?e=qjsQUF&CID=e1a808c7-9c51-5aef-8a51-007b42225ed9"
    @close="showTestingModal = false"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useBroadcast } from '@/composables/useBroadcast'
import { PERIOD_IDS } from '@/config/schoolYear'
import PowerPointModal from '@/components/modals/PowerPointModal.vue'

const router = useRouter()
const { userInfo } = useAuth()
const { selectedPeriodId, startBroadcast } = useBroadcast()

const chosenPeriod = ref<string>(selectedPeriodId.value ?? '')
const showTestingModal = ref(false)

const teacherPeriods = computed<string[]>(() =>
  (userInfo.value?.periodIds ?? []) as string[]
)

const teacherPeriodSet = computed(() => new Set(teacherPeriods.value))

const TESTING_URL = 'https://fusd-my.sharepoint.com/:p:/g/personal/jonathan_muster_fresnounified_org/IQAqYQjHyTNpRZXrLzj-hI26AUolPmw0NfaJm0VZCbXRKII?e=qjsQUF'
const showTestingModal = ref(false)

function enterBroadcast() {
  if (!chosenPeriod.value) return
  startBroadcast(chosenPeriod.value)
  router.push('/')
}
</script>

<style scoped>
.broadcast-setup {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
}

.setup-card {
  background: rgba(11, 18, 32, 0.95);
  border: 1px solid rgba(51, 102, 255, 0.4);
  border-radius: 1rem;
  box-shadow: 0 0 2rem rgba(51, 102, 255, 0.2);
  padding: 2.5rem 3rem;
  width: min(90vw, 36rem);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.setup-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.setup-header-bar {
  flex: 1;
  height: 3px;
  background: #3366ff;
  border-radius: 2px;
}

.setup-title {
  font-family: 'Antonio', sans-serif;
  font-size: 1.6rem;
  font-weight: 900;
  color: #99ccff;
  letter-spacing: 0.08em;
  margin: 0;
  white-space: nowrap;
}

.setup-subtitle {
  color: #6688aa;
  font-size: 0.88rem;
  line-height: 1.5;
  margin: 0;
}

.period-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.75rem;
}

.period-btn {
  background: rgba(51, 102, 255, 0.12);
  border: 1px solid rgba(51, 102, 255, 0.35);
  border-radius: 0.5rem;
  color: #99ccff;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 1rem 0.5rem;
  text-align: center;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.period-btn:hover:not(:disabled) {
  background: rgba(51, 102, 255, 0.25);
  border-color: #3366ff;
  color: #cce0ff;
}

.period-btn.selected {
  background: rgba(51, 102, 255, 0.35);
  border-color: #99ccff;
  color: #fff;
  box-shadow: 0 0 0.75rem rgba(51, 102, 255, 0.4);
}

.period-btn.not-mine {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.07);
  color: #2a3a4a;
  cursor: not-allowed;
}

.no-periods {
  color: #664444;
  font-size: 0.85rem;
  text-align: center;
  margin: 0;
}

.enter-btn {
  background: #ff9900;
  border: none;
  border-radius: 62rem;
  color: #000;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 1.2rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  padding: 1rem;
  transition: background 0.2s;
}

.enter-btn:hover:not(:disabled) { background: #ffcc00; }
.enter-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Lunch / After School ── */
.alt-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.alt-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #2a3a55;
  font-family: 'Antonio', sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.alt-divider::before,
.alt-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(51, 102, 255, 0.15);
}

.alt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
}

.alt-btn {
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.85rem 0.5rem;
  text-align: center;
  transition: background 0.2s, border-color 0.2s;
}

.alt-btn--lunch {
  background: rgba(255, 153, 0, 0.1);
  border: 1px solid rgba(255, 153, 0, 0.3);
  color: #cc8800;
}
.alt-btn--lunch:hover {
  background: rgba(255, 153, 0, 0.2);
  border-color: #ff9900;
  color: #ffaa22;
}

.alt-btn--after {
  background: rgba(105, 240, 174, 0.08);
  border: 1px solid rgba(105, 240, 174, 0.25);
  color: #3a8866;
}
.alt-btn--after:hover {
  background: rgba(105, 240, 174, 0.16);
  border-color: #69f0ae;
  color: #69f0ae;
}

.alt-btn--testing {
  background: rgba(153, 102, 255, 0.08);
  border: 1px solid rgba(153, 102, 255, 0.25);
  color: #8866cc;
}
.alt-btn--testing:hover {
  background: rgba(153, 102, 255, 0.18);
  border-color: #aa88ff;
  color: #aa88ff;
}

.cancel-btn {
  background: none;
  border: none;
  color: #6688aa;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  padding: 0.25rem;
  text-align: center;
  transition: color 0.15s;
}

.cancel-btn:hover { color: #99ccff; }
</style>
