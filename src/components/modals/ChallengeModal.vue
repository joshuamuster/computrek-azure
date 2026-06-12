<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="show"
        class="challenge-overlay"
        role="dialog"
        aria-label="Challenge a Classmate"
        @click.self="$emit('close')"
      >
        <div class="challenge-modal">

          <div class="cm-header">
            <span class="cm-title">⚔ Challenge a Classmate</span>
            <button class="cm-close" aria-label="Close" @click="$emit('close')">✕</button>
          </div>

          <div class="cm-game-label">{{ GAME_LABELS[game] }}</div>

          <!-- Variant picker (chess only) -->
          <template v-if="game === 'chess'">
            <div class="cm-section-label">Variant</div>
            <div class="cm-variant-grid">
              <button
                v-for="v in CHESS_VARIANTS"
                :key="v.id"
                class="cm-variant-btn"
                :class="{ selected: selectedVariant === v.id }"
                :style="{ '--vc': v.color }"
                @click="selectedVariant = v.id"
              >
                {{ v.label }}
              </button>
            </div>
          </template>

          <!-- Classmate roster — only online cadets shown -->
          <div class="cm-section-label">Select Opponent</div>

          <div v-if="loading" class="cm-empty">Scanning crew manifest…</div>
          <div v-else-if="roster.filter(c => presenceMap[c.uid]).length === 0" class="cm-empty">
            <template v-if="roster.length === 0 && mode === 'caughtUp'">
              No eligible classmates — challenges are limited to cadets with no outstanding assignments right now.
            </template>
            <template v-else-if="roster.length === 0">
              No classmates found in your period.
            </template>
            <template v-else>
              No classmates are online right now. Ask them to open CompuTrek!
            </template>
          </div>
          <div v-else class="cm-roster">
            <button
              v-for="cadet in roster.filter(c => presenceMap[c.uid])"
              :key="cadet.uid"
              class="cm-cadet-btn"
              :class="{ selected: selectedUid === cadet.uid }"
              @click="selectedUid = cadet.uid"
            >
              <span class="cm-online-dot" aria-hidden="true"></span>
              {{ cadet.displayName }}
            </button>
          </div>

          <div v-if="error" class="cm-error">{{ error }}</div>

          <button
            class="cm-send-btn"
            :disabled="!selectedUid || sending"
            @click="handleSend"
          >
            {{ sending ? 'Sending…' : 'Send Challenge' }}
          </button>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth.js'
import { useChallenges, type ChallengeGame } from '@/composables/useChallenges'
import { useChallengeSettings } from '@/composables/useChallengeSettings'
import { usePresence } from '@/composables/usePresence'
import { generateChess960FEN } from '@/utils/chess960'

const props = defineProps<{
  show: boolean
  game: ChallengeGame
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'sent'): void
}>()

const { userInfo } = useAuth()
const { loadRoster, sendChallenge } = useChallenges()
const { mode, caughtUpUids } = useChallengeSettings()
const { subscribeToPresence } = usePresence()

const roster = ref<{ uid: string; displayName: string }[]>([])
const loading = ref(false)
const error = ref('')
const sending = ref(false)
const selectedUid = ref('')
const selectedVariant = ref('standard')

// Presence tracking — populated after the roster loads, cleared on modal close.
let presenceUnsub: (() => void) | null = null
const presenceMap = ref<Record<string, boolean>>({})

const GAME_LABELS: Record<ChallengeGame, string> = {
  'chess':                      'Chess',
  'battle-of-the-mutara-nebula': 'Battle of the Mutara Nebula',
  'picard-maneuver':             'Picard Maneuver',
  'rules-of-acquisition':        'Rules of Acquisition',
  'fractured-frontier':          'Fractured Frontier',
}

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

watch(() => props.show, async (visible) => {
  if (!visible) {
    // Clean up presence listeners when modal closes
    presenceUnsub?.()
    presenceUnsub = null
    presenceMap.value = {}
    selectedUid.value = ''
    selectedVariant.value = 'standard'
    error.value = ''
    roster.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    const info = userInfo.value
    if (!info?.uid || !info.teacherEmail || !info.periodId) {
      error.value = 'Session data unavailable.'
      return
    }
    let result = await loadRoster(info.teacherEmail as string, info.periodId as string, info.uid)
    // When teacher restricts to caught-up students only, hide ineligible classmates
    if (mode.value === 'caughtUp') {
      const eligible = new Set(caughtUpUids.value)
      result = result.filter(c => eligible.has(c.uid))
    }
    roster.value = result

    // Subscribe to real-time presence for everyone in this period.
    // The list of UIDs came from Firestore's secured loadRoster query
    // (teacherEmail + periodId scoped) — no PII reaches RTDB.
    presenceUnsub?.()
    const sub = subscribeToPresence(result.map(c => c.uid))
    presenceMap.value = sub.presenceMap.value
    // Keep presenceMap reactive by watching the inner ref
    watch(sub.presenceMap, (map) => { presenceMap.value = map })
    presenceUnsub = sub.unsubscribe
  } catch (e: any) {
    error.value = 'Failed to load crew manifest.'
  } finally {
    loading.value = false
  }
})

async function handleSend() {
  if (!selectedUid.value || sending.value) return
  const info = userInfo.value
  if (!info?.uid || !info.teacherEmail || !info.periodId) return
  sending.value = true
  error.value = ''
  try {
    const startFen = props.game === 'chess' && selectedVariant.value === '960'
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
      game:           props.game,
      variant:        props.game === 'chess' ? selectedVariant.value : 'standard',
      startFen,
    })
    emit('sent')
    emit('close')
  } catch (e: any) {
    error.value = 'Failed to send challenge. Try again.'
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.challenge-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 5, 20, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  backdrop-filter: blur(4px);
}

.challenge-modal {
  background: rgba(6, 14, 30, 0.97);
  border: 1px solid rgba(51, 102, 255, 0.4);
  border-radius: 0.875rem;
  box-shadow: 0 0 2.5rem rgba(51, 102, 255, 0.2);
  width: min(92vw, 34rem);
  padding: 1.75rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cm-title {
  font-family: 'Antonio', sans-serif;
  font-size: 1.35rem;
  font-weight: 700;
  color: #99ccff;
  letter-spacing: 0.06em;
}

.cm-close {
  background: none;
  border: none;
  color: #5577aa;
  cursor: pointer;
  font-size: 1.1rem;
  transition: color 0.15s;
}
.cm-close:hover { color: #99ccff; }

.cm-game-label {
  font-family: 'Antonio', sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #ff9900;
  border-left: 3px solid #ff9900;
  padding-left: 0.6rem;
}

.cm-section-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #4466aa;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: -0.25rem;
}

/* Variant grid */
.cm-variant-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.cm-variant-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.4rem;
  color: #88aacc;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  padding: 0.35rem 0.75rem;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.cm-variant-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: #cce0ff;
}
.cm-variant-btn.selected {
  background: color-mix(in srgb, var(--vc) 18%, transparent);
  border-color: var(--vc);
  color: var(--vc);
}

/* Roster */
.cm-roster {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 13rem;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.cm-cadet-btn {
  align-items: center;
  background: rgba(51, 102, 255, 0.07);
  border: 1px solid rgba(51, 102, 255, 0.2);
  border-radius: 0.4rem;
  color: #99bbdd;
  cursor: pointer;
  display: flex;
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  gap: 0.5rem;
  letter-spacing: 0.04em;
  padding: 0.6rem 0.875rem;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}

.cm-online-dot {
  background: #3ddc84;
  border-radius: 50%;
  box-shadow: 0 0 5px #3ddc84;
  display: inline-block;
  flex-shrink: 0;
  height: 0.5rem;
  width: 0.5rem;
}
.cm-cadet-btn:hover {
  background: rgba(51, 102, 255, 0.14);
  border-color: rgba(51, 102, 255, 0.4);
}
.cm-cadet-btn.selected {
  background: rgba(51, 102, 255, 0.22);
  border-color: #6699ff;
  color: #cce0ff;
}

.cm-empty {
  font-size: 0.85rem;
  color: #4466aa;
  text-align: center;
  padding: 0.75rem 0;
}

.cm-error {
  font-size: 0.8rem;
  color: #ff6e6e;
  text-align: center;
}

.cm-send-btn {
  background: #ff9900;
  border: none;
  border-radius: 62rem;
  color: #000;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 0.85rem 1rem;
  transition: background 0.2s;
}
.cm-send-btn:hover:not(:disabled) { background: #ffcc00; }
.cm-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* Transition */
.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }
</style>
