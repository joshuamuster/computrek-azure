<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="challenge"
        class="incoming-overlay"
        role="dialog"
        aria-label="Incoming challenge"
      >
        <div class="incoming-modal">

          <div class="im-header">
            <span class="im-ping">⚡ INCOMING CHALLENGE</span>
          </div>

          <p class="im-from">
            <span class="im-name">{{ challenge.challengerName }}</span>
            <span class="im-verb"> challenged you to</span>
          </p>

          <div class="im-game-row">
            <span class="im-game">{{ GAME_LABELS[challenge.game] }}</span>
            <span v-if="challenge.game === 'chess' && challenge.variant !== 'standard'" class="im-variant">
              {{ VARIANT_LABELS[challenge.variant] ?? challenge.variant }}
            </span>
          </div>

          <div class="im-timer" :class="{ 'im-timer--urgent': timeLeft < 30 }">
            {{ timerDisplay }}
          </div>

          <div class="im-actions">
            <button class="im-btn im-btn--accept" :disabled="acting" @click="handleAccept">
              {{ acting ? 'Joining…' : 'Accept' }}
            </button>
            <button class="im-btn im-btn--decline" :disabled="acting" @click="handleDecline">
              Decline
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useChallenges, type Challenge } from '@/composables/useChallenges'

const props = defineProps<{ challenge: Challenge | null }>()

const { acceptChallenge, declineChallenge, expireChallenge } = useChallenges()

const acting = ref(false)
const timeLeft = ref(0)
let ticker: ReturnType<typeof setInterval> | null = null

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

const timerDisplay = computed(() => {
  const m = Math.floor(timeLeft.value / 60)
  const s = timeLeft.value % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

watch(() => props.challenge, (ch, oldCh) => {
  clearInterval(ticker ?? 0)
  ticker = null
  // New challenge arrived — always reset acting so the button isn't stuck disabled
  if (ch?.id !== oldCh?.id) acting.value = false
  if (!ch) return

  const expMs = ch.expiresAt?.toMillis?.() ?? (ch.expiresAt?.seconds ?? 0) * 1000
  function tick() {
    const remaining = Math.max(0, Math.round((expMs - Date.now()) / 1000))
    timeLeft.value = remaining
    if (remaining === 0) {
      clearInterval(ticker!)
      ticker = null
      expireChallenge(ch!.id).catch(() => {})
    }
  }
  tick()
  ticker = setInterval(tick, 1000)
}, { immediate: true })

onBeforeUnmount(() => { if (ticker) clearInterval(ticker) })

async function handleAccept() {
  if (!props.challenge || acting.value) return
  acting.value = true
  try {
    await acceptChallenge(props.challenge)
  } catch (e) {
    console.error('Accept failed:', e)
    acting.value = false
  }
}

async function handleDecline() {
  if (!props.challenge || acting.value) return
  acting.value = true
  try {
    await declineChallenge(props.challenge.id)
  } finally {
    acting.value = false
  }
}
</script>

<style scoped>
.incoming-overlay {
  position: fixed;
  bottom: 6rem;
  right: 1.5rem;
  z-index: 9100;
}

.incoming-modal {
  background: rgba(4, 10, 25, 0.97);
  border: 1px solid rgba(255, 153, 0, 0.5);
  border-radius: 0.875rem;
  box-shadow: 0 0 2rem rgba(255, 153, 0, 0.25);
  padding: 1.25rem 1.5rem;
  width: min(92vw, 22rem);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  animation: slide-in 0.3s ease;
}

@keyframes slide-in {
  from { transform: translateY(1.5rem); opacity: 0; }
  to   { transform: translateY(0);      opacity: 1; }
}

.im-header {
  display: flex;
  align-items: center;
  justify-content: center;
}

.im-ping {
  font-family: 'Antonio', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  color: #ff9900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.im-from {
  font-size: 0.9rem;
  color: #99bbdd;
  margin: 0;
  text-align: center;
}
.im-name {
  font-weight: 700;
  color: #cce0ff;
  font-family: 'Antonio', sans-serif;
  font-size: 1.05rem;
}

.im-game-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.im-game {
  font-family: 'Antonio', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #ff9900;
  text-align: center;
}

.im-variant {
  font-size: 0.7rem;
  font-weight: 700;
  color: #ffcc66;
  background: rgba(255, 153, 0, 0.12);
  border: 1px solid rgba(255, 153, 0, 0.3);
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.im-timer {
  font-family: 'Press Start 2P', monospace;
  font-size: 1rem;
  color: #66aadd;
  text-align: center;
  letter-spacing: 0.1em;
  transition: color 0.3s;
}

.im-timer--urgent {
  color: #ff4444;
}

.im-actions {
  display: flex;
  gap: 0.6rem;
}

.im-btn {
  flex: 1;
  border: none;
  border-radius: 62rem;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.65rem 0.5rem;
  transition: background 0.18s;
}
.im-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.im-btn--accept {
  background: #ff9900;
  color: #000;
}
.im-btn--accept:hover:not(:disabled) { background: #ffcc00; }

.im-btn--decline {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #99aacc;
}
.im-btn--decline:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #cce0ff;
}

/* Transition */
.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }
</style>
