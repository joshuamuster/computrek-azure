<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { useSeatingChart } from '@/composables/useSeatingChart'
import { PERIOD_IDS } from '@/config/schoolYear'
import { useBroadcast } from '@/composables/useBroadcast'
import { usePeriodSelector } from '@/composables/usePeriodSelector'

const { userInfo } = useAuth()
const { isBroadcasting } = useBroadcast()
const { selectedPeriodId } = usePeriodSelector()

const {
  seats, layout, loading,
  fetchSeatingChart,
} = useSeatingChart()

const error = ref<string | null>(null)

async function load() {
  error.value = null

  if (isBroadcasting.value) {
    // Broadcast mode — teacher's own chart for the active period
    const teacherEmail = (userInfo.value as any)?.email as string | undefined
    const periodId     = selectedPeriodId.value

    if (!teacherEmail || !periodId) return  // no period chosen yet → blank grid
    await fetchSeatingChart(periodId, teacherEmail)
  } else {
    // Normal cadet view
    const periodId     = (userInfo.value as any)?.periodId  as string | undefined
    const teacherEmail = (userInfo.value as any)?.teacherEmail as string | undefined

    if (!periodId || !teacherEmail) {
      error.value = 'Your account is missing period or teacher information.'
      return
    }
    await fetchSeatingChart(periodId, teacherEmail)
  }
}

onMounted(load)

// Re-fetch whenever the teacher switches periods mid-broadcast
watch(selectedPeriodId, () => { if (isBroadcasting.value) load() })

const periodLabel = computed(() => {
  if (isBroadcasting.value) {
    return PERIOD_IDS.find(p => p.id === selectedPeriodId.value)?.label ?? selectedPeriodId.value ?? ''
  }
  const pid = (userInfo.value as any)?.periodId as string | undefined
  return PERIOD_IDS.find(p => p.id === pid)?.label ?? pid ?? ''
})

// In broadcast mode the teacher has no seat; suppress "my seat" highlighting
const myUid = computed(() => isBroadcasting.value ? '' : ((userInfo.value as any)?.uid ?? ''))

/** Build a flat ordered list of grid cells for rendering */
const gridSeats = computed(() => {
  const result: { row: number; col: number; key: string; student: { uid: string; displayName: string } | null }[] = []
  for (let r = 0; r < layout.value.rows; r++) {
    for (let c = 0; c < layout.value.cols; c++) {
      const key = `r${r}c${c}`
      result.push({ row: r, col: c, key, student: seats.value[key] ?? null })
    }
  }
  return result
})

const myRow = computed(() => {
  for (let r = 0; r < layout.value.rows; r++) {
    for (let c = 0; c < layout.value.cols; c++) {
      if (seats.value[`r${r}c${c}`]?.uid === myUid.value) return r
    }
  }
  return -1
})

const myCol = computed(() => {
  for (let r = 0; r < layout.value.rows; r++) {
    for (let c = 0; c < layout.value.cols; c++) {
      if (seats.value[`r${r}c${c}`]?.uid === myUid.value) return c
    }
  }
  return -1
})

const amSeated = computed(() => myRow.value >= 0)

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${layout.value.cols}, 1fr)`,
}))
</script>

<template>
  <section class="adventure-page">
    <div class="lcars-text-bar">
      <span>Seating Chart</span>
      <span class="period-label" v-if="periodLabel">{{ periodLabel }}</span>
    </div>

    <!-- Error -->
    <div v-if="error" class="status-msg status-msg--error">{{ error }}</div>

    <!-- Loading -->
    <div v-else-if="loading" class="status-msg">Loading seating chart…</div>

    <!-- No chart saved yet -->
    <div v-else-if="Object.keys(seats).length === 0" class="status-msg status-msg--empty">
      <div class="empty-icon">🪑</div>
      <div class="empty-title">NO SEATING CHART YET</div>
      <div class="empty-sub">Your teacher hasn't published a seating arrangement for {{ periodLabel }} yet. Check back soon.</div>
    </div>

    <!-- Chart -->
    <div v-else class="chart-wrapper">

      <!-- My seat callout (hidden in broadcast mode — teacher has no seat) -->
      <template v-if="!isBroadcasting">
        <div v-if="amSeated" class="my-seat-banner">
          <span class="my-seat-icon">★</span>
          Your seat: Row {{ myRow + 1 }}, Seat {{ myCol + 1 }}
        </div>
        <div v-else class="my-seat-banner my-seat-banner--none">
          You haven't been assigned a seat yet.
        </div>
      </template>

      <!-- Front banner -->
      <div class="front-banner">▲ FRONT OF ROOM</div>

      <!-- Seating grid -->
      <div class="seating-grid" :style="gridStyle">
        <div
          v-for="seat in gridSeats"
          :key="seat.key"
          class="seat"
          :class="{
            'is-occupied': !!seat.student,
            'is-mine':     seat.student?.uid === myUid && !!myUid,
          }"
        >
          <template v-if="seat.student">
            <span class="seat-name" :class="{ 'seat-name--mine': seat.student.uid === myUid && !!myUid }">
              {{ seat.student.uid === myUid && myUid ? '★ ' + seat.student.displayName : seat.student.displayName }}
            </span>
          </template>
          <template v-else>
            <span class="seat-vacant"></span>
          </template>
        </div>
      </div>

      <div class="grid-footer">
        <template v-if="isBroadcasting">
          {{ layout.rows }} rows · {{ layout.cols }} columns · {{ Object.keys(seats).length }} seated
        </template>
        <template v-else>
          Row {{ myRow + 1 }} of {{ layout.rows }} · Seat {{ myCol + 1 }} of {{ layout.cols }}
          <span v-if="!amSeated" class="grid-footer--unseated"> · not yet assigned</span>
        </template>
      </div>

    </div>
  </section>
</template>

<style scoped>

.lcars-text-bar {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.period-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  color: #ff9900;
  font-weight: normal;
}

/* ── Status messages ────────────────────────────────────────────────────── */

.status-msg {
  text-align: center;
  padding: 3rem 2rem;
  color: #6688aa;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  letter-spacing: 0.08em;
}

.status-msg--error { color: #ff6644; }

.status-msg--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.empty-icon   { font-size: 2.5rem; margin-bottom: 0.5rem; }
.empty-title  { font-size: 1.1rem; letter-spacing: 0.18em; color: #99ccff; }
.empty-sub    { font-size: 0.85rem; color: #556677; line-height: 1.5; max-width: 26rem; font-family: 'Roboto', sans-serif; letter-spacing: normal; }

/* ── Chart wrapper ──────────────────────────────────────────────────────── */

.chart-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.5rem 0.5rem 1.5rem;
}

/* ── My seat banner ─────────────────────────────────────────────────────── */

.my-seat-banner {
  text-align: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  color: #ffcc44;
  background: rgba(255, 200, 50, 0.07);
  border: 1px solid rgba(255, 200, 50, 0.2);
  border-radius: 0.3rem;
  padding: 0.45rem 1rem;
}

.my-seat-banner--none {
  color: #6688aa;
  background: rgba(51, 102, 255, 0.04);
  border-color: rgba(51, 102, 255, 0.12);
}

.my-seat-icon { margin-right: 0.4rem; }

/* ── Front banner ───────────────────────────────────────────────────────── */

.front-banner {
  text-align: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  color: #ff9900;
  padding: 0.35rem 1rem;
  background: rgba(255, 153, 0, 0.05);
  border: 1px solid rgba(255, 153, 0, 0.18);
  border-radius: 0.3rem;
}

/* ── Grid ───────────────────────────────────────────────────────────────── */

.seating-grid {
  display: grid;
  gap: 0.35rem;
}

.seat {
  min-height: 3rem;
  border: 1px solid rgba(51, 102, 255, 0.15);
  border-radius: 0.3rem;
  background: rgba(8, 15, 30, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.4rem;
  transition: border-color 0.15s;
}

.seat.is-occupied {
  background: rgba(51, 102, 255, 0.08);
  border-color: rgba(51, 102, 255, 0.3);
}

.seat.is-mine {
  background: rgba(255, 200, 50, 0.1);
  border-color: rgba(255, 200, 50, 0.55);
  box-shadow: 0 0 0.6rem rgba(255, 200, 50, 0.15);
}

.seat-name {
  font-family: 'Roboto', sans-serif;
  font-size: 0.7rem;
  color: #aabbcc;
  text-align: center;
  line-height: 1.2;
  word-break: break-word;
}

.seat-name--mine {
  color: #ffcc44;
  font-weight: bold;
}

.seat-vacant {
  display: block;
  width: 1rem;
  height: 1px;
  background: rgba(51, 102, 255, 0.12);
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

.grid-footer {
  text-align: center;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: #334455;
  padding-top: 0.2rem;
}

.grid-footer--unseated { color: #554; }

</style>
