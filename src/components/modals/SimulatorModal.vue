<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isOpen"
        class="sim-modal-overlay"
        @click.self="$emit('close')"
      >
        <div class="sim-modal" role="dialog" :aria-label="isTeacher ? 'Simulator Controls' : 'Challenge a Classmate'">

          <!-- Header -->
          <div class="sim-header">
            <div class="sim-header-deco"></div>
            <h2>{{ isTeacher ? 'Tactical Simulator' : '⚔ Challenge a Classmate' }}</h2>
            <button class="sim-close" @click="$emit('close')" aria-label="Close">
              <img src="@/assets/icons/do-not-enter6.svg" alt="Close" class="sim-close-icon" />
            </button>
          </div>

          <!-- ── TEACHER VIEW ───────────────────────────────────────────────── -->
          <div v-if="isTeacher" class="sim-body">

            <!-- Active Period -->
            <div class="sim-group">
              <div class="sim-label">Active Period</div>
              <div class="period-grid">
                <button
                  v-for="p in PERIOD_IDS"
                  :key="p.id"
                  class="period-btn"
                  :class="{
                    selected:   draftPeriodId === p.id,
                    'not-mine': !teacherPeriodSet.has(p.id),
                  }"
                  :disabled="!teacherPeriodSet.has(p.id)"
                  @click="draftPeriodId = p.id"
                >{{ p.label }}</button>
              </div>
              <p v-if="!teacherPeriods.length" class="sim-no-periods">
                No periods are assigned to your account. Ask an admin to add them under Users.
              </p>
            </div>

            <div class="sim-divider"></div>

            <!-- Student Simulations toggle -->
            <div class="sim-group sim-group--row">
              <span class="sim-label">Student Simulations</span>
              <button
                class="sim-slide-toggle"
                :class="{ 'sim-slide-toggle--on': challengesEnabled }"
                :aria-pressed="challengesEnabled"
                @click="toggleSimulations"
              >
                <span class="sim-slide-track">
                  <span class="sim-slide-thumb"></span>
                </span>
                <span class="sim-slide-text">{{ challengesEnabled ? 'Open' : 'Closed' }}</span>
              </button>
            </div>

            <!-- Mode selector — always visible; greyed out when closed -->
            <div class="sim-group" :class="{ 'sim-group--disabled': !challengesEnabled }">
              <div class="sim-label">Who Can Play</div>
              <div class="sim-mode-btns">
                <button
                  class="sim-mode-btn"
                  :class="{ active: mode === 'all' }"
                  @click="handleSetMode('all')"
                >Everyone</button>
                <button
                  class="sim-mode-btn"
                  :class="{ active: mode === 'caughtUp' }"
                  @click="handleSetMode('caughtUp')"
                >Caught Up Only</button>
              </div>
            </div>

            <!-- Eligible pool refresh — always visible when caughtUp; greyed out when closed -->
            <div v-if="mode === 'caughtUp'" class="sim-group" :class="{ 'sim-group--disabled': !challengesEnabled }">
              <div class="sim-label">Eligible Pool</div>
              <button
                class="sim-refresh-btn"
                :disabled="refreshing"
                @click="handleRefreshPool"
              >{{ refreshing ? 'Scanning…' : '↻ Refresh Pool' }}</button>
              <div v-if="caughtUpRefreshedAt" class="sim-pool-meta">
                <span class="sim-pool-count">{{ caughtUpUids.length }} student(s) eligible</span>
                <span class="sim-pool-time">updated {{ refreshedAtLabel }}</span>
              </div>
              <div v-else class="sim-pool-meta sim-pool-meta--warn">
                Pool not yet computed — tap Refresh Pool
              </div>
            </div>

            <div class="sim-divider"></div>

            <!-- Broadcast -->
            <div class="sim-group">
              <div class="sim-label">Broadcast</div>
              <template v-if="isBroadcasting">
                <div class="bcast-live-row">
                  <span class="bcast-live-dot"></span>
                  <span class="bcast-live-label">LIVE — {{ broadcastPeriodLabel }}</span>
                </div>
                <button
                  v-if="draftPeriodId && draftPeriodId !== selectedPeriodId"
                  class="sim-ctrl-btn sim-ctrl-btn--switch"
                  @click="handleSwitchPeriod"
                >Switch to {{ draftPeriodLabel }}</button>
                <button
                  class="sim-ctrl-btn sim-ctrl-btn--exit"
                  :class="{ 'sim-ctrl-btn--confirming': confirmingExit }"
                  @click="handleExitBroadcast"
                >{{ confirmingExit ? 'Confirm Exit?' : 'Exit Broadcast' }}</button>
              </template>
              <template v-else>
                <p class="bcast-desc">
                  Switches the screen to student view — CHAMPS and the timer stay
                  interactive, and changes push live to everyone in the selected period.
                </p>
                <div class="bcast-start-row">
                  <button
                    class="sim-ctrl-btn sim-ctrl-btn--broadcast"
                    :disabled="!draftPeriodId"
                    @click="handleStartBroadcast"
                  >Start Broadcast</button>
                  <button
                    class="sim-ctrl-btn sim-ctrl-btn--broadcast"
                    :disabled="!draftPeriodId"
                    @click="handleStartBroadcastWithIntro"
                  >Broadcast with Intro</button>
                </div>
                <p v-if="!draftPeriodId" class="bcast-hint">Select a period above first</p>

                <div class="bcast-alt-section">
                  <div class="bcast-alt-divider"><span>or open for</span></div>
                  <div class="bcast-alt-grid">
                    <button class="bcast-alt-btn bcast-alt-btn--lunch" @click="openLunch">
                      🍕 Lunch
                    </button>
                    <button class="bcast-alt-btn bcast-alt-btn--after" @click="openAfterSchool">
                      🚌 After School
                    </button>
                    <button class="bcast-alt-btn bcast-alt-btn--testing" @click="openTesting">
                      📋 Testing
                    </button>
                  </div>
                </div>
              </template>
            </div>

          </div>

          <!-- ── STUDENT VIEW ───────────────────────────────────────────────── -->
          <div v-else class="sim-student-layout" :class="{ 'sim-student-layout--split': incoming.length > 0 }">

          <!-- Left col: send a challenge -->
          <div class="sim-body">

            <!-- Simulations closed -->
            <div v-if="!challengesEnabled" class="sim-empty">
              Holodeck simulations are currently offline.<br>
              <span class="sim-empty-sub">Your teacher will open them when they're ready.</span>
            </div>

            <!-- Not eligible -->
            <div v-else-if="!isStudentEligible" class="sim-empty">
              You have outstanding assignments.<br>
              <span class="sim-empty-sub">Complete your work first to unlock challenges.</span>
            </div>

            <template v-else>

              <!-- Step 1: Pick a game -->
              <div class="sim-section-label">Select Simulation</div>
              <div class="sim-game-grid">
                <button
                  v-for="g in CHALLENGE_GAMES"
                  :key="g.id"
                  class="sim-game-btn"
                  :class="{ selected: selectedGame === g.id }"
                  @click="selectGame(g.id)"
                >
                  <img :src="g.thumbnail" :alt="g.label" class="sim-game-thumb" />
                  <span class="sim-game-label">{{ g.label }}</span>
                </button>
              </div>

              <!-- Step 2: Variant (chess only) -->
              <template v-if="selectedGame === 'chess'">
                <div class="sim-section-label">Variant</div>
                <div class="sim-variant-grid">
                  <button
                    v-for="v in CHESS_VARIANTS"
                    :key="v.id"
                    class="sim-variant-btn"
                    :class="{ selected: selectedVariant === v.id }"
                    :style="{ '--vc': v.color }"
                    @click="selectedVariant = v.id"
                  >{{ v.label }}</button>
                </div>
              </template>

              <!-- Step 3: Opponent -->
              <template v-if="selectedGame">
                <div class="sim-section-label">Select Opponent</div>
                <div v-if="loadingRoster" class="sim-empty">Scanning crew manifest…</div>
                <div v-else-if="roster.length === 0" class="sim-empty">
                  <template v-if="mode === 'caughtUp'">No eligible classmates right now.</template>
                  <template v-else>No classmates found in your period.</template>
                </div>
                <div v-else class="sim-roster">
                  <button
                    v-for="cadet in roster"
                    :key="cadet.uid"
                    class="sim-cadet-btn"
                    :class="{ selected: selectedUid === cadet.uid }"
                    @click="selectedUid = cadet.uid"
                  >{{ cadet.displayName }}</button>
                </div>
              </template>

              <div v-if="sendError" class="sim-error">{{ sendError }}</div>

              <button
                class="sim-send-btn"
                :disabled="!selectedGame || !selectedUid || sending"
                @click="handleSend"
              >{{ sending ? 'Sending…' : 'Send Challenge' }}</button>

            </template>

          </div><!-- /sim-body (left col) -->

          <!-- Right col: incoming invitations -->
          <div v-if="incoming.length > 0" class="sim-invites-col">
            <div class="sim-invites-header">⚡ Incoming Challenges</div>
            <div class="sim-invite-list">
              <div
                v-for="ch in incoming"
                :key="ch.id"
                class="sim-invite-card"
                :class="{ 'sim-invite-card--urgent': timeLeftFor(ch) < 30 }"
              >
                <div class="sic-from">{{ ch.challengerName }}</div>
                <div class="sic-game-row">
                  <span class="sic-game">{{ GAME_LABELS[ch.game] ?? ch.game }}</span>
                  <span
                    v-if="ch.game === 'chess' && ch.variant && ch.variant !== 'standard'"
                    class="sic-variant"
                  >{{ VARIANT_LABELS[ch.variant] ?? ch.variant }}</span>
                </div>
                <div class="sic-timer" :class="{ 'sic-timer--urgent': timeLeftFor(ch) < 30 }">
                  {{ fmtTimer(timeLeftFor(ch)) }}
                </div>
                <div class="sic-actions">
                  <button
                    class="sic-btn sic-btn--accept"
                    :disabled="!!actingId"
                    @click="handleAccept(ch)"
                  >{{ actingId === ch.id ? 'Joining…' : 'Accept' }}</button>
                  <button
                    class="sic-btn sic-btn--decline"
                    :disabled="!!actingId"
                    @click="handleDecline(ch)"
                  >Decline</button>
                </div>
              </div>
            </div>
          </div>

          </div><!-- /sim-student-layout -->

        </div>
      </div>
    </Transition>

    <!-- Lives outside the Transition so it survives the simulator modal closing -->
    <PowerPointModal
      :showModal="showTestingModal"
      pptxUrl="https://fusd-my.sharepoint.com/:p:/g/personal/jonathan_muster_fresnounified_org/IQAqYQjHyTNpRZXrLzj-hI26AUolPmw0NfaJm0VZCbXRKII?e=qjsQUF&CID=e1a808c7-9c51-5aef-8a51-007b42225ed9"
      @close="showTestingModal = false"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth.js'
import { useBroadcast } from '@/composables/useBroadcast'
import { useChallengeSettings } from '@/composables/useChallengeSettings'
import { useChallenges, type ChallengeGame } from '@/composables/useChallenges'
import { generateChess960FEN } from '@/utils/chess960'
import { PERIOD_IDS } from '@/config/schoolYear'
import PowerPointModal from '@/components/modals/PowerPointModal.vue'

import chessThumb         from '@/assets/images/games/thumbnail-chess.jpg'
import mutaranebulaThumb  from '@/assets/images/games/thumbnail-mutaranebula.jpg'
import picardThumb        from '@/assets/images/games/thumbnail-picardmaneuver.jpg'
import rulesThumb         from '@/assets/images/games/thumbnail-rulesofacquisition.jpg'
import orbitalThumb       from '@/assets/images/games/thumbnail-fracturedfrontier.jpg'

const props = defineProps<{ isOpen: boolean }>()
const emit  = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()
const { isTeacher, userInfo } = useAuth()

// ── Shared: challenge settings ────────────────────────────────────────────────

const {
  challengesEnabled, mode, caughtUpUids, caughtUpRefreshedAt,
  init: initChallengeSettings, setEnabled, setMode, refreshCaughtUpList,
} = useChallengeSettings()

watch(() => userInfo.value?.email ?? userInfo.value?.teacherEmail, (email) => {
  const target = isTeacher.value ? userInfo.value?.email : userInfo.value?.teacherEmail
  if (target) initChallengeSettings(target as string)
}, { immediate: true })

// ── Teacher: broadcast ────────────────────────────────────────────────────────

const { isBroadcasting, selectedPeriodId, startBroadcast, stopBroadcast } = useBroadcast()

const teacherPeriods   = computed(() => userInfo.value?.periodIds ?? [])
const teacherPeriodSet = computed(() => new Set(teacherPeriods.value))

const broadcastPeriodLabel = computed(() =>
  PERIOD_IDS.find(p => p.id === selectedPeriodId.value)?.label ?? selectedPeriodId.value ?? ''
)

const draftPeriodLabel = computed(() =>
  PERIOD_IDS.find(p => p.id === draftPeriodId.value)?.label ?? draftPeriodId.value ?? ''
)

// Draft period choice — purely local to the modal. Picking a period here doesn't
// touch the shared selector (and won't move CHAMPS/the dashboard) until the
// teacher actually commits by pressing one of the broadcast buttons below.
const draftPeriodId = ref<string | null>(selectedPeriodId.value)

// Re-sync the draft to whatever is live each time the modal is (re)opened
watch(() => props.isOpen, (open) => {
  if (open) draftPeriodId.value = selectedPeriodId.value
})

const confirmingExit     = ref(false)
let exitConfirmTimeout: ReturnType<typeof setTimeout> | null = null

function startBroadcastFlow(withIntro: boolean) {
  if (!draftPeriodId.value) return
  startBroadcast(draftPeriodId.value)
  emit('close')
  if (withIntro) router.push('/opening')
}

function handleStartBroadcast() {
  startBroadcastFlow(false)
}

function handleStartBroadcastWithIntro() {
  startBroadcastFlow(true)
}

function handleSwitchPeriod() {
  if (!draftPeriodId.value) return
  startBroadcast(draftPeriodId.value)
}

function handleExitBroadcast() {
  if (confirmingExit.value) {
    if (exitConfirmTimeout) clearTimeout(exitConfirmTimeout)
    stopBroadcast()
    confirmingExit.value = false
    emit('close')
  } else {
    confirmingExit.value = true
    exitConfirmTimeout = setTimeout(() => { confirmingExit.value = false }, 4000)
  }
}

// "Or open for…" alternates — these navigate away / overlay, so close the modal first
const showTestingModal = ref(false)

function openLunch() {
  emit('close')
  router.push('/videos?mode=lunch')
}

function openAfterSchool() {
  emit('close')
  router.push('/videos?mode=afterschool')
}

function openTesting() {
  emit('close')
  showTestingModal.value = true
}

// ── Teacher: simulations ──────────────────────────────────────────────────────

const refreshing = ref(false)

function toggleSimulations() {
  const email = userInfo.value?.email
  if (!email) return
  setEnabled(email, !challengesEnabled.value)
}

function handleSetMode(value: string) {
  const email = userInfo.value?.email
  if (!email) return
  setMode(email, value)
}

async function handleRefreshPool() {
  const email = userInfo.value?.email
  if (!email || refreshing.value) return
  refreshing.value = true
  try { await refreshCaughtUpList(email) }
  finally { refreshing.value = false }
}

const refreshedAtLabel = computed(() =>
  caughtUpRefreshedAt.value
    ? caughtUpRefreshedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''
)

// Reset confirm state on close
watch(() => props.isOpen, (open) => {
  if (!open) {
    confirmingExit.value = false
    if (exitConfirmTimeout) clearTimeout(exitConfirmTimeout)
  }
})

// ── Student: game / variant / opponent ───────────────────────────────────────

const CHALLENGE_GAMES: { id: ChallengeGame; label: string; thumbnail: string }[] = [
  { id: 'chess',                       label: 'Chess',                     thumbnail: chessThumb },
  { id: 'battle-of-the-mutara-nebula', label: 'Battle of the Mutara Nebula', thumbnail: mutaranebulaThumb },
  { id: 'picard-maneuver',             label: 'Picard Maneuver',           thumbnail: picardThumb },
  { id: 'rules-of-acquisition',        label: 'Rules of Acquisition',      thumbnail: rulesThumb },
  { id: 'fractured-frontier',          label: 'Fractured Frontier',        thumbnail: orbitalThumb },
]

const CHESS_VARIANTS = [
  { id: 'standard',    label: 'Standard',        color: '#99ccff' },
  { id: '960',         label: 'Chess 960',        color: '#ffc400' },
  { id: 'crazyhouse',  label: 'Crazyhouse',       color: '#ff6b6b' },
  { id: 'koth',        label: 'King of the Hill', color: '#4caf50' },
  { id: 'threecheck',  label: 'Three-Check',      color: '#ff9800' },
  { id: 'antichess',   label: 'Antichess',        color: '#ab47bc' },
  { id: 'horde',       label: 'Horde',            color: '#f06292' },
  { id: 'racingkings', label: 'Racing Kings',     color: '#29b6f6' },
]

const isStudentEligible = computed(() =>
  mode.value === 'all' || caughtUpUids.value.includes(userInfo.value?.uid ?? '')
)

const selectedGame    = ref<ChallengeGame | null>(null)
const selectedVariant = ref('standard')
const selectedUid     = ref('')
const roster          = ref<{ uid: string; displayName: string }[]>([])
const loadingRoster   = ref(false)
const sending         = ref(false)
const sendError       = ref('')

const { loadRoster, sendChallenge, incoming, acceptChallenge, declineChallenge } = useChallenges()

// ── Incoming invitations ──────────────────────────────────────────────────────

const GAME_LABELS: Record<string, string> = {
  'chess':                       'Chess',
  'battle-of-the-mutara-nebula': 'Battle of the Mutara Nebula',
  'picard-maneuver':             'Picard Maneuver',
  'rules-of-acquisition':        'Rules of Acquisition',
  'fractured-frontier':          'Fractured Frontier',
}

const VARIANT_LABELS: Record<string, string> = {
  '960':         'Chess 960',
  'crazyhouse':  'Crazyhouse',
  'koth':        'King of the Hill',
  'threecheck':  'Three-Check',
  'antichess':   'Antichess',
  'horde':       'Horde',
  'racingkings': 'Racing Kings',
}

// Single ticker — only runs while the modal is open
const nowMs  = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

watch(() => props.isOpen, (open) => {
  if (open) {
    nowMs.value = Date.now()
    ticker = setInterval(() => { nowMs.value = Date.now() }, 1000)
  } else {
    if (ticker) { clearInterval(ticker); ticker = null }
  }
})

onBeforeUnmount(() => { if (ticker) clearInterval(ticker) })

function timeLeftFor(ch: { expiresAt: any }): number {
  const expMs = ch.expiresAt?.toMillis?.() ?? (ch.expiresAt?.seconds ?? 0) * 1000
  return Math.max(0, Math.round((expMs - nowMs.value) / 1000))
}

function fmtTimer(secs: number): string {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

const actingId = ref<string | null>(null)

async function handleAccept(ch: typeof incoming.value[number]) {
  if (actingId.value) return
  actingId.value = ch.id
  try { await acceptChallenge(ch) }
  catch (e) { console.error('Accept failed:', e); actingId.value = null }
}

async function handleDecline(ch: typeof incoming.value[number]) {
  if (actingId.value) return
  actingId.value = ch.id
  try { await declineChallenge(ch.id) }
  finally { actingId.value = null }
}

async function selectGame(gameId: ChallengeGame) {
  selectedGame.value    = gameId
  selectedVariant.value = 'standard'
  selectedUid.value     = ''
  roster.value          = []
  loadingRoster.value   = true
  sendError.value       = ''
  try {
    const info = userInfo.value
    if (!info?.uid || !info.teacherEmail || !info.periodId) return
    let result = await loadRoster(info.teacherEmail as string, info.periodId as string, info.uid)
    if (mode.value === 'caughtUp') {
      const eligible = new Set(caughtUpUids.value)
      result = result.filter(c => eligible.has(c.uid))
    }
    roster.value = result
  } catch {
    sendError.value = 'Failed to load crew manifest.'
  } finally {
    loadingRoster.value = false
  }
}

async function handleSend() {
  if (!selectedGame.value || !selectedUid.value || sending.value) return
  const info = userInfo.value
  if (!info?.uid || !info.teacherEmail || !info.periodId) return
  sending.value = true
  sendError.value = ''
  try {
    const startFen = selectedGame.value === 'chess' && selectedVariant.value === '960'
      ? generateChess960FEN()
      : undefined
    const challengedEntry = roster.value.find(c => c.uid === selectedUid.value)
    await sendChallenge({
      uid:            info.uid,
      displayName:    info.displayName,
      teacherEmail:   info.teacherEmail as string,
      periodId:       info.periodId as string,
      challengedId:   selectedUid.value,
      challengedName: challengedEntry?.displayName ?? selectedUid.value,
      game:           selectedGame.value,
      variant:        selectedGame.value === 'chess' ? selectedVariant.value : 'standard',
      startFen,
    })
    emit('close')
  } catch {
    sendError.value = 'Failed to send challenge. Try again.'
  } finally {
    sending.value = false
  }
}

// Reset student state on close
watch(() => props.isOpen, (open) => {
  if (!open) {
    selectedGame.value    = null
    selectedVariant.value = 'standard'
    selectedUid.value     = ''
    roster.value          = []
    sendError.value       = ''
  }
})
</script>

<style scoped>
/* ── Overlay / shell ─────────────────────────────────────────────────────── */
.sim-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 5, 20, 0.78);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 8500;
}

.sim-modal {
  background: linear-gradient(160deg, #0a1020 0%, #060d1a 100%);
  border: 1px solid rgba(51, 102, 255, 0.25);
  border-radius: 0.75rem;
  box-shadow: 0 0 40px rgba(51, 102, 255, 0.15), 0 24px 64px rgba(0, 0, 0, 0.6);
  width: min(480px, 94vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.25s ease;
}
/* Widen when the invitations column is showing */
.sim-modal:has(.sim-student-layout--split) {
  width: min(820px, 94vw);
}

/* ── Student two-column layout ───────────────────────────────────────────── */
.sim-student-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.sim-student-layout .sim-body {
  flex: 1;
  min-width: 0;
  border-right: none;
}
.sim-student-layout--split .sim-body {
  border-right: 1px solid rgba(51, 102, 255, 0.15);
}

/* ── Invitations column ──────────────────────────────────────────────────── */
.sim-invites-col {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sim-invites-header {
  flex-shrink: 0;
  padding: 0.75rem 1rem 0.5rem;
  font-family: 'Antonio', sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #ff9900;
  border-bottom: 1px solid rgba(255, 153, 0, 0.2);
}

.sim-invite-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* ── Individual invite card ──────────────────────────────────────────────── */
.sim-invite-card {
  background: rgba(255, 153, 0, 0.05);
  border: 1px solid rgba(255, 153, 0, 0.2);
  border-radius: 0.5rem;
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  transition: border-color 0.2s;
}
.sim-invite-card--urgent {
  border-color: rgba(255, 68, 68, 0.45);
  background: rgba(255, 68, 68, 0.05);
}

.sic-from {
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #cce0ff;
  line-height: 1.1;
}

.sic-game-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.sic-game {
  font-family: 'Antonio', sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  color: #ff9900;
}
.sic-variant {
  font-size: 0.65rem;
  font-weight: 700;
  color: #ffcc66;
  background: rgba(255, 153, 0, 0.12);
  border: 1px solid rgba(255, 153, 0, 0.3);
  border-radius: 999px;
  padding: 0.1rem 0.4rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.sic-timer {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.75rem;
  color: #66aadd;
  letter-spacing: 0.08em;
  transition: color 0.3s;
}
.sic-timer--urgent { color: #ff4444; }

.sic-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.1rem;
}
.sic-btn {
  flex: 1;
  border: none;
  border-radius: 62rem;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.4rem 0.25rem;
  transition: background 0.15s;
}
.sic-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sic-btn--accept  { background: #ff9900; color: #000; }
.sic-btn--accept:hover:not(:disabled)  { background: #ffcc00; }
.sic-btn--decline { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #99aacc; }
.sic-btn--decline:hover:not(:disabled) { background: rgba(255,255,255,0.12); color: #cce0ff; }

/* ── Header ──────────────────────────────────────────────────────────────── */
.sim-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem 0.9rem;
  border-bottom: 1px solid rgba(51, 102, 255, 0.18);
  flex-shrink: 0;
}

.sim-header-deco {
  width: 3px;
  height: 1.4rem;
  background: linear-gradient(180deg, #6699ff, #3355cc);
  border-radius: 2px;
  flex-shrink: 0;
}

.sim-header h2 {
  flex: 1;
  margin: 0;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #cce0ff;
}

.sim-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0.55;
  transition: opacity 0.15s;
}
.sim-close:hover { opacity: 1; }
.sim-close-icon { width: 1.4rem; height: 1.4rem; display: block; filter: invert(1); }

/* ── Body ────────────────────────────────────────────────────────────────── */
.sim-body {
  padding: 1rem 1.25rem 1.25rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

/* ── Shared group / label ────────────────────────────────────────────────── */
.sim-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.sim-group--row {
  flex-direction: row;
  align-items: center;
}

.sim-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #4a6080;
  flex: 1;
}

.sim-divider {
  height: 1px;
  background: rgba(51, 102, 255, 0.12);
  margin: 0.2rem 0;
}

/* ── Period grid ─────────────────────────────────────────────────────────── */
.period-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.period-btn {
  background: rgba(51, 102, 255, 0.08);
  border: 1px solid rgba(51, 102, 255, 0.25);
  border-radius: 0.4rem;
  color: #7799cc;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.3rem 0.6rem;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.period-btn:hover:not(:disabled) {
  background: rgba(51, 102, 255, 0.18);
  border-color: rgba(51, 102, 255, 0.5);
  color: #aaccff;
}
.period-btn.selected {
  background: rgba(51, 102, 255, 0.35);
  border-color: #6699ff;
  color: #fff;
}
.period-btn.not-mine {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.06);
  color: #223344;
  cursor: not-allowed;
}

/* ── Simulations sliding toggle ──────────────────────────────────────────── */
.sim-slide-toggle {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
}
.sim-slide-track {
  position: relative;
  width: 2.6rem;
  height: 1.25rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  flex-shrink: 0;
  transition: background 0.25s, border-color 0.25s;
}
.sim-slide-toggle--on .sim-slide-track {
  background: rgba(50, 121, 190, 0.25);
  border-color: #3279BE;
}
.sim-slide-thumb {
  position: absolute;
  top: 50%;
  left: 2px;
  transform: translateY(-50%);
  width: 0.85rem;
  height: 0.85rem;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transition: left 0.25s, background 0.25s;
}
.sim-slide-toggle--on .sim-slide-thumb {
  left: calc(100% - 0.85rem - 2px);
  background: #3279BE;
}
.sim-slide-text {
  font-family: 'Antonio', sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.3);
  min-width: 2.8rem;
  text-align: left;
  transition: color 0.25s;
}
.sim-slide-toggle--on .sim-slide-text { color: #3279BE; }

/* ── Mode buttons ────────────────────────────────────────────────────────── */
/* Greyed-out state for sections when challenges are closed */
.sim-group--disabled {
  opacity: 0.35;
  pointer-events: none;
}

.sim-mode-btns { display: flex; gap: 0.35rem; }

.sim-mode-btn {
  flex: 1;
  background: rgba(51,102,255,0.06);
  border: 1px solid rgba(51,102,255,0.22);
  border-radius: 0.4rem;
  color: #5577aa;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.35rem 0.6rem;
  text-transform: uppercase;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.sim-mode-btn:hover  { background: rgba(51,102,255,0.15); border-color: rgba(51,102,255,0.45); color: #99bbee; }
.sim-mode-btn.active { background: rgba(51,102,255,0.28); border-color: #6699ff; color: #cce0ff; }

/* ── Pool refresh ────────────────────────────────────────────────────────── */
.sim-refresh-btn {
  background: rgba(255,153,0,0.07);
  border: 1px solid rgba(255,153,0,0.3);
  border-radius: 0.4rem;
  color: #cc8822;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.35rem 0.8rem;
  text-transform: uppercase;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  width: 100%;
}
.sim-refresh-btn:hover:not(:disabled) { background: rgba(255,153,0,0.15); border-color: rgba(255,153,0,0.6); color: #ffaa33; }
.sim-refresh-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.sim-pool-meta { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
.sim-pool-meta--warn { color: #776622; font-size: 0.72rem; font-style: italic; }
.sim-pool-count { font-family: 'Antonio', sans-serif; font-size: 0.82rem; font-weight: 700; color: #88bbff; }
.sim-pool-time  { font-size: 0.68rem; color: #445566; }

/* ── Broadcast ───────────────────────────────────────────────────────────── */
.bcast-live-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }

.bcast-live-dot {
  display: inline-block;
  width: 0.45rem; height: 0.45rem;
  border-radius: 50%;
  background: #ff4444;
  animation: bcast-blink 1.2s infinite;
}

.bcast-live-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.82rem; font-weight: 700;
  letter-spacing: 0.08em; color: #ff6666;
  text-transform: uppercase;
}

@keyframes bcast-blink { 0%,100%{opacity:1} 50%{opacity:0.15} }

.bcast-desc {
  font-size: 0.74rem;
  color: #4a6080;
  line-height: 1.5;
  margin: 0 0 0.15rem;
}

.bcast-hint { font-size: 0.7rem; color: #445566; text-align: center; margin: 0.3rem 0 0; font-style: italic; }

.sim-no-periods {
  color: #664444;
  font-size: 0.76rem;
  text-align: center;
  margin: 0.3rem 0 0;
}

/* ── Broadcast: "or open for" alternates ─────────────────────────────────── */
.bcast-alt-section {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 0.65rem;
}

.bcast-alt-divider {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #2a3a55;
  font-family: 'Antonio', sans-serif;
  font-size: 0.64rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.bcast-alt-divider::before,
.bcast-alt-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(51, 102, 255, 0.15);
}

.bcast-alt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.4rem;
}

.bcast-alt-btn {
  border-radius: 0.4rem;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 0.55rem 0.35rem;
  text-align: center;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.bcast-alt-btn--lunch {
  background: rgba(255, 153, 0, 0.08);
  border: 1px solid rgba(255, 153, 0, 0.28);
  color: #cc8800;
}
.bcast-alt-btn--lunch:hover {
  background: rgba(255, 153, 0, 0.18);
  border-color: #ff9900;
  color: #ffaa22;
}

.bcast-alt-btn--after {
  background: rgba(105, 240, 174, 0.06);
  border: 1px solid rgba(105, 240, 174, 0.22);
  color: #3a8866;
}
.bcast-alt-btn--after:hover {
  background: rgba(105, 240, 174, 0.14);
  border-color: #69f0ae;
  color: #69f0ae;
}

.bcast-alt-btn--testing {
  background: rgba(153, 102, 255, 0.07);
  border: 1px solid rgba(153, 102, 255, 0.22);
  color: #8866cc;
}
.bcast-alt-btn--testing:hover {
  background: rgba(153, 102, 255, 0.16);
  border-color: #aa88ff;
  color: #aa88ff;
}

.sim-ctrl-btn {
  width: 100%; padding: 0.55rem 0.75rem;
  border-radius: 20rem; cursor: pointer;
  font-family: 'Antonio', sans-serif; font-size: 0.95rem; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase;
  transition: all 0.2s; position: relative; overflow: hidden;
}

/* Two broadcast-start buttons sharing a row, each taking half the width */
.bcast-start-row {
  display: flex;
  gap: 0.5rem;
}
.bcast-start-row .sim-ctrl-btn {
  flex: 1;
  width: auto;
  font-size: 0.76rem;
  padding: 0.55rem 0.4rem;
}

.sim-ctrl-btn--broadcast {
  background: transparent; color: #5599ff;
  border: 2px solid rgba(51,102,255,0.45);
  box-shadow: 0 0 12px rgba(51,102,255,0.2);
}
.sim-ctrl-btn--broadcast:hover:not(:disabled) {
  color: #99ccff; border-color: rgba(51,102,255,0.85);
  box-shadow: 0 0 18px rgba(51,102,255,0.45);
}
.sim-ctrl-btn--broadcast:disabled { opacity: 0.3; cursor: not-allowed; }

.sim-ctrl-btn--switch {
  background: rgba(0,207,255,0.08); color: #00cfff;
  border: 2px solid rgba(0,207,255,0.4);
}
.sim-ctrl-btn--switch:hover { background: rgba(0,207,255,0.18); border-color: #00cfff; }

.sim-ctrl-btn--exit {
  background: transparent; color: #ff9900;
  border: 2px solid rgba(255,153,0,0.45);
}
.sim-ctrl-btn--exit:hover { color: #ffcc44; border-color: rgba(255,153,0,0.85); }

.sim-ctrl-btn--confirming {
  background: rgba(255,110,110,0.15); border-color: #ff6e6e; color: #ff6e6e;
  animation: confirm-pulse 0.6s ease-in-out infinite alternate;
}

@keyframes confirm-pulse { from{box-shadow:0 0 6px rgba(255,110,110,0.3)} to{box-shadow:0 0 18px rgba(255,110,110,0.7)} }

/* ── Student: empty / error ──────────────────────────────────────────────── */
.sim-empty {
  text-align: center;
  padding: 1.5rem 1rem;
  color: #4a6080;
  font-size: 0.9rem;
  line-height: 1.5;
}
.sim-empty-sub { font-size: 0.78rem; color: #334455; display: block; margin-top: 0.4rem; }
.sim-error { color: #ff6e6e; font-size: 0.8rem; text-align: center; }

/* ── Student: section label ──────────────────────────────────────────────── */
.sim-section-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: #334466;
}

/* ── Student: game picker ────────────────────────────────────────────────── */
.sim-game-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.sim-game-btn {
  background: rgba(10,20,40,0.7);
  border: 1px solid rgba(51,102,255,0.18);
  border-radius: 0.5rem;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  transition: border-color 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
}
.sim-game-btn:hover { border-color: rgba(51,102,255,0.45); box-shadow: 0 0 12px rgba(51,102,255,0.15); }
.sim-game-btn.selected { border-color: #6699ff; box-shadow: 0 0 16px rgba(51,102,255,0.35); }

.sim-game-thumb {
  width: 100%; height: 60px; object-fit: cover; display: block;
  opacity: 0.8; transition: opacity 0.15s;
}
.sim-game-btn:hover .sim-game-thumb,
.sim-game-btn.selected .sim-game-thumb { opacity: 1; }

.sim-game-label {
  display: block; padding: 0.3rem 0.5rem;
  font-family: 'Antonio', sans-serif;
  font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: #7799bb; text-align: center;
}
.sim-game-btn.selected .sim-game-label { color: #99ccff; }

/* ── Student: variant grid ───────────────────────────────────────────────── */
.sim-variant-grid { display: flex; flex-wrap: wrap; gap: 0.35rem; }

.sim-variant-btn {
  background: rgba(10,20,40,0.8);
  border: 1px solid color-mix(in srgb, var(--vc, #6699ff) 30%, transparent);
  border-radius: 0.35rem;
  color: color-mix(in srgb, var(--vc, #6699ff) 60%, #aaa);
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.75rem; font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.3rem 0.65rem;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.sim-variant-btn:hover { border-color: var(--vc, #6699ff); }
.sim-variant-btn.selected {
  background: color-mix(in srgb, var(--vc, #6699ff) 20%, transparent);
  border-color: var(--vc, #6699ff);
  color: var(--vc, #99ccff);
}

/* ── Student: roster ─────────────────────────────────────────────────────── */
.sim-roster { display: flex; flex-direction: column; gap: 0.3rem; }

.sim-cadet-btn {
  background: rgba(15,25,45,0.6);
  border: 1px solid rgba(51,102,255,0.15);
  border-radius: 0.35rem;
  color: #6688aa;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.9rem; font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.45rem 0.75rem;
  text-align: left;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.sim-cadet-btn:hover  { background: rgba(51,102,255,0.1); border-color: rgba(51,102,255,0.4); color: #99bbee; }
.sim-cadet-btn.selected { background: rgba(51,102,255,0.22); border-color: #6699ff; color: #cce0ff; }

/* ── Student: send button ────────────────────────────────────────────────── */
.sim-send-btn {
  background: rgba(51,102,255,0.15);
  border: 1px solid rgba(51,102,255,0.45);
  border-radius: 20rem;
  color: #7799ff;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 1rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  padding: 0.6rem 1.25rem;
  margin-top: 0.25rem;
  transition: all 0.2s; width: 100%;
}
.sim-send-btn:hover:not(:disabled) { background: rgba(51,102,255,0.3); border-color: #6699ff; color: #cce0ff; box-shadow: 0 0 16px rgba(51,102,255,0.3); }
.sim-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Transition ──────────────────────────────────────────────────────────── */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: scale(0.97); }
</style>
