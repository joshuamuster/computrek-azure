<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import {
  useConductLog,
  CONDUCT_REASONS,
  type ConductEntry,
} from '@/composables/useConductLog'
import { pipColor, pipFilled, pipLabel } from '@/composables/useConductScore'
import { PERIOD_IDS } from '@/config/schoolYear'

const { userInfo } = useAuth()
const { entries, loading, fetchEntriesForCadet } = useConductLog()

// ── Current conduct score ─────────────────────────────────────────────────────
// Query approvedUsers by UID (email isn't always in localStorage for cadets)

const conductScore = ref<number>(4)

const loadScore = async () => {
  const uid = userInfo.value?.uid
  if (!uid) return
  try {
    const snap = await getDocs(
      query(collection(db, 'approvedUsers'), where('uid', '==', uid), limit(1))
    )
    if (!snap.empty) conductScore.value = snap.docs[0].data().conductScore ?? 4
  } catch (e) {
    console.warn('[ConductLog] could not load score:', e)
  }
}

// ── Feed ──────────────────────────────────────────────────────────────────────

onMounted(async () => {
  const uid = userInfo.value?.uid
  if (!uid) return
  await Promise.all([loadScore(), fetchEntriesForCadet(uid)])
})

// ── Display helpers ───────────────────────────────────────────────────────────

const periodLabel = (id: string) =>
  PERIOD_IDS.find(p => p.id === id)?.label ?? id

const reasonLabel = (entry: ConductEntry): string => {
  if (entry.source === 'auto' || entry.reason === 'auto') return entry.note || 'Conduct holding steady.'
  const r = CONDUCT_REASONS.find(r => r.key === entry.reason)
  if (!r) return entry.reason || '—'
  return entry.type === 'negative' ? r.negLabel : r.label
}

const fmtDate = (entry: ConductEntry): string => {
  // Prefer the explicit date field; fall back to loggedAt
  const raw = entry.date
    ? new Date(entry.date + 'T12:00:00')   // noon local to avoid TZ edge cases
    : entry.loggedAt
  if (!raw) return '—'
  return raw.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const deltaLabel = (entry: ConductEntry): string => {
  if (entry.scoreDelta > 0) return '+1'
  if (entry.scoreDelta < 0) return '−1'
  return '—'
}

const deltaClass = (entry: ConductEntry): string => {
  if (entry.scoreDelta > 0) return 'delta--pos'
  if (entry.scoreDelta < 0) return 'delta--neg'
  return 'delta--neu'
}

// Group entries by date string for the feed
interface FeedGroup {
  dateLabel: string
  entries:   ConductEntry[]
}

const feedGroups = computed<FeedGroup[]>(() => {
  const groups: Map<string, ConductEntry[]> = new Map()
  for (const e of entries.value) {
    const key = e.date ?? (e.loggedAt ? e.loggedAt.toISOString().slice(0, 10) : 'unknown')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(e)
  }
  return Array.from(groups.entries()).map(([key, items]) => ({
    dateLabel: fmtDate(items[0]),
    entries:   items,
  }))
})

// Mini pip row for scoreAfter display
const scoreAfterPips = (score: number | null) => {
  if (score == null) return null
  return Array.from({ length: 4 }, (_, i) => ({
    filled: score === 0 ? true : score >= i + 1,
    color:  pipColor(score),
  }))
}
</script>

<template>
  <section class="conduct-log-page">
    <div class="lcars-text-bar"><span>Conduct Log</span></div>

    <!-- ── Current standing ─────────────────────────────────────────────── -->
    <div class="standing-card">
      <div class="standing-label">CURRENT STANDING</div>
      <div class="standing-row">
        <div class="standing-pips">
          <span
            v-for="i in 4"
            :key="i"
            class="standing-pip"
            :style="pipFilled(conductScore, i)
              ? { background: pipColor(conductScore), boxShadow: '0 0 6px ' + pipColor(conductScore) }
              : {}"
          ></span>
        </div>
        <div class="standing-info">
          <span class="standing-score" :style="{ color: pipColor(conductScore) }">
            {{ conductScore }}/4
          </span>
          <span class="standing-tier" :style="{ color: pipColor(conductScore) }">
            {{ pipLabel(conductScore) }}
          </span>
        </div>
      </div>
    </div>

    <!-- ── Loading ──────────────────────────────────────────────────────── -->
    <div v-if="loading" class="feed-loading">Accessing personnel records…</div>

    <!-- ── Empty state ─────────────────────────────────────────────────── -->
    <div v-else-if="!loading && entries.length === 0" class="feed-empty">
      <div class="feed-empty-icon">📋</div>
      <div class="feed-empty-title">NO ENTRIES ON RECORD</div>
      <div class="feed-empty-sub">Your conduct log will appear here once your teacher starts logging class periods.</div>
    </div>

    <!-- ── Feed ────────────────────────────────────────────────────────── -->
    <div v-else class="feed">
      <div v-for="group in feedGroups" :key="group.dateLabel" class="feed-group">

        <div class="feed-date-bar">{{ group.dateLabel }}</div>

        <div
          v-for="entry in group.entries"
          :key="entry.id"
          class="feed-entry"
          :class="{
            'feed-entry--pos': entry.type === 'positive',
            'feed-entry--neg': entry.type === 'negative',
            'feed-entry--neu': entry.type === 'neutral',
          }"
        >
          <!-- Delta badge -->
          <div class="entry-delta" :class="deltaClass(entry)">
            {{ deltaLabel(entry) }}
          </div>

          <!-- Body -->
          <div class="entry-body">
            <div class="entry-reason">{{ reasonLabel(entry) }}</div>
            <div v-if="entry.type !== 'neutral' && entry.note" class="entry-note">
              "{{ entry.note }}"
            </div>
            <div class="entry-meta">
              <span class="entry-date">{{ fmtDate(entry) }}</span>
              <span class="entry-period">{{ periodLabel(entry.periodId) }}</span>
              <span v-if="entry.scoreAfter !== null" class="entry-score-after">
                Score →
                <span
                  class="entry-score-value"
                  :style="{ color: pipColor(entry.scoreAfter!) }"
                >{{ entry.scoreAfter }}/4</span>
                <span class="entry-mini-pips">
                  <span
                    v-for="(pip, idx) in scoreAfterPips(entry.scoreAfter)"
                    :key="idx"
                    class="entry-mini-pip"
                    :style="pip.filled ? { background: pip.color } : {}"
                  ></span>
                </span>
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>
</template>

<style scoped>

.conduct-log-page {
  padding-bottom: 3rem;
}

/* ── Current standing card ──────────────────────────────────────────────── */

.standing-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 1rem 0 1.5rem;
  padding: 1rem 1.25rem;
  background: rgba(10, 20, 40, 0.55);
  border: 1px solid rgba(51, 102, 255, 0.25);
  border-radius: 0.5rem;
  max-width: 24rem;
}

.standing-label {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: #334455;
}

.standing-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.standing-pips {
  display: flex;
  gap: 5px;
  align-items: center;
}

.standing-pip {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  transition: background 0.25s, box-shadow 0.25s;
}

.standing-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.standing-score {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.3rem;
  line-height: 1;
  letter-spacing: 0.04em;
}

.standing-tier {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  opacity: 0.8;
}

/* ── Loading / empty ────────────────────────────────────────────────────── */

.feed-loading {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  color: #445566;
  padding: 2rem 0;
}

.feed-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 4rem 2rem;
  text-align: center;
  color: #445566;
}

.feed-empty-icon { font-size: 2.5rem; }
.feed-empty-title {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.95rem;
  letter-spacing: 0.18em;
  color: #556677;
}
.feed-empty-sub {
  font-size: 0.85rem;
  line-height: 1.5;
  max-width: 28rem;
}

/* ── Feed ───────────────────────────────────────────────────────────────── */

.feed {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 42rem;
}

/* ── Date group ─────────────────────────────────────────────────────────── */

.feed-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.feed-date-bar {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  color: #334455;
  padding: 0.5rem 0 0.1rem;
  border-top: 1px solid rgba(51, 102, 255, 0.1);
  text-transform: uppercase;
}

.feed-group:first-child .feed-date-bar {
  border-top: none;
  padding-top: 0;
}

/* ── Entry row ──────────────────────────────────────────────────────────── */

.feed-entry {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.35rem;
  border-left: 3px solid transparent;
  background: rgba(10, 20, 40, 0.4);
  transition: background 0.15s;
}

.feed-entry--pos {
  border-left-color: var(--conduct-pos);
  background: rgba(31, 120, 180, 0.06);
}

.feed-entry--neg {
  border-left-color: var(--conduct-neg);
  background: rgba(185, 74, 72, 0.06);
}

.feed-entry--neu {
  border-left-color: rgba(51, 102, 255, 0.3);
  background: rgba(51, 102, 255, 0.04);
}

/* ── Delta badge ────────────────────────────────────────────────────────── */

.entry-delta {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.85rem;
  font-weight: bold;
  width: 2rem;
  text-align: center;
  flex-shrink: 0;
  padding-top: 0.05rem;
  line-height: 1.4;
}

.delta--pos { color: var(--conduct-pos); }
.delta--neg { color: var(--conduct-neg); }
.delta--neu { color: #445566; }

/* ── Entry body ─────────────────────────────────────────────────────────── */

.entry-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.entry-reason {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  color: #99bbcc;
  line-height: 1.3;
}

.entry-note {
  font-size: 0.75rem;
  color: #556677;
  font-style: italic;
  line-height: 1.3;
}

.entry-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.1rem;
}

.entry-date {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  color: #556677;
}

.entry-period {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: #2a3a4a;
}

.entry-score-after {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: #2a3a4a;
}

.entry-score-value {
  font-size: 0.65rem;
  font-weight: bold;
}

.entry-mini-pips {
  display: flex;
  gap: 2px;
  align-items: center;
}

.entry-mini-pip {
  width: 5px;
  height: 5px;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.1);
  transition: background 0.2s;
}

</style>
