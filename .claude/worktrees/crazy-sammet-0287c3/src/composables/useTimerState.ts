/**
 * useTimerState — Firestore-backed countdown timer (singleton).
 *
 * Architecture
 * ────────────
 *  • Firestore collection: `timerState`
 *  • Document key:         `{teacherEmail}__{periodId}`
 *  • Document fields:
 *      isRunning : boolean
 *      endsAt    : Timestamp | null   (absolute end time when running)
 *      pausedAt  : number   | null    (seconds remaining when paused)
 *      updatedAt : Timestamp
 *
 * Roles
 * ─────
 *  cadet         → reads (onSnapshot) from their teacher's doc
 *  admin emulating → reads (onSnapshot) from the emulated teacher's doc
 *  teacher/admin → writes to Firestore; local tick drives UI immediately
 *
 * The subscription is maintained in a detached effectScope so it outlives
 * any individual component that calls useTimerState().
 */

import { ref, computed, watch, effectScope } from 'vue'
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { usePeriodSelector } from '@/composables/usePeriodSelector'
import alarmSound from '@/assets/sounds/SFX-Computer/alarm1.wav'

// ── Module-level singleton state ──────────────────────────────────────────────

const showCountdownPopup = ref(false)
const countdownSeconds   = ref(0)
const isCountdownRunning = ref(false)
const customHours        = ref(0)
const customMinutes      = ref(0)
const customSeconds      = ref(0)

// ── Internal sync bookkeeping ─────────────────────────────────────────────────

let unsubscribeTimer: (() => void) | null = null
let subscribedKey   = ''          // "{email}__{period}" currently subscribed to
let tickInterval: ReturnType<typeof setInterval> | null = null
let endsAtMs: number | null = null
let scopeInitialized = false      // effectScope only created once

// ── Tick interval (drives local countdown from absolute endsAt) ───────────────

function stopTick() {
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null }
}

function startTick() {
  stopTick()
  tickInterval = setInterval(() => {
    if (!endsAtMs) { stopTick(); return }
    const rem = Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000))
    countdownSeconds.value = rem
    if (rem <= 0) {
      isCountdownRunning.value = false
      endsAtMs = null
      stopTick()
      playAlarmSound()
    }
  }, 500) // poll twice a second for smooth display
}

// ── Firestore apply ───────────────────────────────────────────────────────────

function applyRemoteState(data: Record<string, any>) {
  if (data.isRunning && data.endsAt) {
    const ms: number = data.endsAt instanceof Timestamp
      ? data.endsAt.toMillis()
      : (data.endsAt.seconds ?? 0) * 1000
    endsAtMs = ms
    const rem = Math.max(0, Math.floor((ms - Date.now()) / 1000))
    countdownSeconds.value = rem
    isCountdownRunning.value = rem > 0
    if (rem > 0) startTick()
    else { stopTick(); playAlarmSound() }
  } else {
    endsAtMs = null
    stopTick()
    isCountdownRunning.value = false
    countdownSeconds.value = typeof data.pausedAt === 'number' ? data.pausedAt : 0
  }
}

function subscribeToTimerDoc(teacherEmail: string, periodId: string) {
  const key = `${teacherEmail}__${periodId}`
  if (key === subscribedKey) return // already on this doc

  if (unsubscribeTimer) { unsubscribeTimer(); unsubscribeTimer = null }

  if (!teacherEmail || !periodId) {
    subscribedKey = ''
    return
  }

  subscribedKey = key
  const docRef = doc(db, 'timerState', key)
  unsubscribeTimer = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) applyRemoteState(snap.data() as Record<string, any>)
      else {
        endsAtMs = null; stopTick()
        countdownSeconds.value = 0
        isCountdownRunning.value = false
      }
    },
    (err) => console.warn('[useTimerState] snapshot error:', err),
  )
}

function clearSubscription() {
  if (unsubscribeTimer) { unsubscribeTimer(); unsubscribeTimer = null }
  subscribedKey = ''
  endsAtMs = null
  stopTick()
  countdownSeconds.value  = 0
  isCountdownRunning.value = false
}

// ── Sound & screen flash ───────────────────────────────────────────────────────

function triggerScreenFlash() {
  try {
    const el = document.getElementById('screen-flash-overlay')
    if (!el) return
    el.classList.remove('flash-active')
    void el.offsetWidth
    el.classList.add('flash-active')
  } catch { /* non-fatal */ }
}

function playAlarmSound() {
  try {
    const audio = new Audio(alarmSound)
    let count = 0
    const doPlay = () => {
      triggerScreenFlash()
      audio.currentTime = 0
      audio.play().catch((e) => console.warn('[useTimerState] alarm play:', e))
      count++
    }
    const onEnded = () => {
      if (count >= 3) { audio.removeEventListener('ended', onEnded); return }
      setTimeout(() => {
        doPlay()
        if (count >= 3) audio.removeEventListener('ended', onEnded)
      }, 500)
    }
    audio.addEventListener('ended', onEnded)
    doPlay()
  } catch (e) { console.warn('[useTimerState] alarm setup:', e) }
}

// ── Firestore write helper ─────────────────────────────────────────────────────

async function writeTimerDoc(
  teacherEmail: string,
  periodId: string,
  payload: Record<string, unknown>,
) {
  try {
    const docRef = doc(db, 'timerState', `${teacherEmail}__${periodId}`)
    await setDoc(docRef, { ...payload, updatedAt: serverTimestamp() }, { merge: true })
  } catch (e) {
    console.error('[useTimerState] write error:', e)
  }
}

// ── Subscription scope (detached — outlives any single component) ─────────────

function ensureSubscriptionScope() {
  if (scopeInitialized) return
  scopeInitialized = true

  const scope = effectScope(true) // detached from any component
  scope.run(() => {
    const {
      isCadet,
      isAdmin,
      isTeacher,
      emulatingEmail,
      userInfo,
    } = useAuth()
    const { selectedPeriodId } = usePeriodSelector()

    watch(
      [
        () => isCadet.value   ? (userInfo.value?.teacherEmail ?? '') : '',
        () => isCadet.value   ? (userInfo.value?.periodId ?? '')     : '',
        () => isAdmin.value   ? (emulatingEmail.value ?? '')         : '',
        () => isAdmin.value   ? (selectedPeriodId.value ?? '')       : '',
        () => isTeacher.value ? (userInfo.value?.email ?? '')        : '',
        () => isTeacher.value ? (selectedPeriodId.value ?? '')       : '',
      ],
      ([cadetTeacher, cadetPeriod, adminEmail, adminPeriod, teacherEmail, teacherPeriod]) => {
        if (isCadet.value && cadetTeacher && cadetPeriod) {
          subscribeToTimerDoc(cadetTeacher, cadetPeriod)
        } else if (isAdmin.value && adminEmail && adminPeriod) {
          subscribeToTimerDoc(adminEmail, adminPeriod)
        } else if (isTeacher.value && teacherEmail && teacherPeriod) {
          // Teachers subscribe to their own doc so the timer survives a page refresh
          subscribeToTimerDoc(teacherEmail, teacherPeriod)
        } else if (isAdmin.value && !adminEmail) {
          // Admin stopped emulating — clear subscription
          clearSubscription()
        }
      },
      { immediate: true },
    )
  })
}

// ── Composable export ──────────────────────────────────────────────────────────

export function useTimerState() {
  // Boot the subscription scope the first time any component calls this
  ensureSubscriptionScope()

  const { isTeacher, userInfo } = useAuth()
  const { selectedPeriodId }    = usePeriodSelector()

  // ── Computed display string ────────────────────────────────────────────────

  const countdownDisplay = computed(() => {
    const secs = countdownSeconds.value
    if (secs > 0) {
      const m = Math.floor(secs / 60)
      const s = secs % 60
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    const h     = customHours.value   || 0
    const m     = customMinutes.value || 0
    const s     = customSeconds.value || 0
    const total = (h * 3600) + (m * 60) + s
    if (total > 0) {
      const dm = Math.floor(total / 60)
      const ds = total % 60
      return `${dm.toString().padStart(2, '0')}:${ds.toString().padStart(2, '0')}`
    }
    return '00:00'
  })

  // ── Resolve active teacher context ─────────────────────────────────────────

  function activeTeacher(): { email: string; periodId: string } | null {
    const email    = userInfo.value?.email as string | undefined
    const periodId = selectedPeriodId.value
    if (!email || !periodId) return null
    return { email, periodId }
  }

  // ── Timer control — write operations ───────────────────────────────────────

  const startCountdown = async () => {
    let secs = countdownSeconds.value
    if (secs === 0) {
      const h = customHours.value   || 0
      const m = customMinutes.value || 0
      const s = customSeconds.value || 0
      secs = (h * 3600) + (m * 60) + s
      if (secs > 0) {
        customHours.value   = 0
        customMinutes.value = 0
        customSeconds.value = 0
      }
    }
    if (secs <= 0 || isCountdownRunning.value) return

    const endsAt = new Date(Date.now() + secs * 1000)
    endsAtMs = endsAt.getTime()
    countdownSeconds.value  = secs
    isCountdownRunning.value = true
    startTick()

    const t = activeTeacher()
    if (t) {
      await writeTimerDoc(t.email, t.periodId, {
        isRunning: true,
        endsAt:    Timestamp.fromDate(endsAt),
        pausedAt:  null,
      })
    }
  }

  const pauseCountdown = async () => {
    const remaining = countdownSeconds.value
    endsAtMs = null
    isCountdownRunning.value = false
    stopTick()

    const t = activeTeacher()
    if (t) {
      await writeTimerDoc(t.email, t.periodId, {
        isRunning: false,
        endsAt:    null,
        pausedAt:  remaining,
      })
    }
  }

  const resetCountdown = async () => {
    endsAtMs = null
    isCountdownRunning.value = false
    countdownSeconds.value   = 0
    stopTick()

    const t = activeTeacher()
    if (t) {
      await writeTimerDoc(t.email, t.periodId, {
        isRunning: false,
        endsAt:    null,
        pausedAt:  0,
      })
    }
  }

  const setCountdown = (minutes: number) => {
    const delta     = minutes * 60
    const wasRunning = isCountdownRunning.value

    if (wasRunning || countdownSeconds.value > 0) {
      const newSecs = Math.max(0, countdownSeconds.value + delta)
      countdownSeconds.value = newSecs
      if (wasRunning && endsAtMs) {
        endsAtMs += delta * 1000
        const t = activeTeacher()
        if (t) {
          writeTimerDoc(t.email, t.periodId, {
            isRunning: true,
            endsAt:    Timestamp.fromMillis(endsAtMs),
            pausedAt:  null,
          })
        }
      } else if (!wasRunning) {
        // Adjust the paused value; push to Firestore too
        const t = activeTeacher()
        if (t) {
          writeTimerDoc(t.email, t.periodId, {
            isRunning: false,
            endsAt:    null,
            pausedAt:  newSecs,
          })
        }
      }
    } else {
      const h     = customHours.value   || 0
      const m     = customMinutes.value || 0
      const s     = customSeconds.value || 0
      const total = (h * 3600) + (m * 60) + s + delta
      customHours.value   = Math.floor(total / 3600)
      const rem           = total % 3600
      customMinutes.value = Math.floor(rem / 60)
      customSeconds.value = rem % 60
    }
  }

  const addCountdownSeconds = (sec: number) => {
    const wasRunning = isCountdownRunning.value

    if (wasRunning || countdownSeconds.value > 0) {
      const newSecs = Math.max(0, countdownSeconds.value + sec)
      countdownSeconds.value = newSecs
      if (wasRunning && endsAtMs) {
        endsAtMs += sec * 1000
        const t = activeTeacher()
        if (t) {
          writeTimerDoc(t.email, t.periodId, {
            isRunning: true,
            endsAt:    Timestamp.fromMillis(endsAtMs),
            pausedAt:  null,
          })
        }
      } else if (!wasRunning) {
        const t = activeTeacher()
        if (t) {
          writeTimerDoc(t.email, t.periodId, {
            isRunning: false,
            endsAt:    null,
            pausedAt:  newSecs,
          })
        }
      }
    } else {
      const h     = customHours.value   || 0
      const m     = customMinutes.value || 0
      const s     = customSeconds.value || 0
      const total = (h * 3600) + (m * 60) + s + sec
      customHours.value   = Math.floor(total / 3600)
      const rem           = total % 3600
      customMinutes.value = Math.floor(rem / 60)
      customSeconds.value = rem % 60
    }
  }

  // ── Popup helpers ──────────────────────────────────────────────────────────

  const toggleCountdownPopup = () => { showCountdownPopup.value = !showCountdownPopup.value }
  const closeCountdownPopup  = () => { showCountdownPopup.value = false }

  // ── Custom time picker ─────────────────────────────────────────────────────

  const incrementHours   = () => { if (customHours.value < 23)   customHours.value++ }
  const decrementHours   = () => { if (customHours.value > 0)    customHours.value-- }
  const incrementMinutes = () => { if (customMinutes.value < 59) customMinutes.value++ }
  const decrementMinutes = () => { if (customMinutes.value > 0)  customMinutes.value-- }
  const incrementSeconds = () => { if (customSeconds.value < 59) customSeconds.value++ }
  const decrementSeconds = () => { if (customSeconds.value > 0)  customSeconds.value-- }

  // Backward-compat no-ops (localStorage functions no longer needed)
  const loadCountdownState = () => {}
  const cleanup            = () => {}

  return {
    // State
    showCountdownPopup,
    countdownSeconds,
    isCountdownRunning,
    customHours,
    customMinutes,
    customSeconds,
    countdownDisplay,
    // Functions
    toggleCountdownPopup,
    closeCountdownPopup,
    setCountdown,
    startCountdown,
    pauseCountdown,
    resetCountdown,
    incrementHours,
    decrementHours,
    incrementMinutes,
    decrementMinutes,
    incrementSeconds,
    decrementSeconds,
    addCountdownSeconds,
    loadCountdownState,
    cleanup,
  }
}
