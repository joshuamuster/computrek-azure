/**
 * useIdleTimer.ts
 *
 * Tracks user inactivity and fires a warning callback, then a logout callback.
 * Only intended for cadet sessions — start/stop it based on role in App.vue.
 *
 * Usage:
 *   const timer = useIdleTimer({
 *     warnAfter:   25 * 60 * 1000,  // show warning at 25 min
 *     logoutAfter: 30 * 60 * 1000,  // log out at 30 min
 *     onLogout: async () => { ... }
 *   })
 *   timer.start()   // begin watching — call once when cadet logs in
 *   timer.stop()    // tear down listeners — call on logout
 *   timer.reset()   // cadet clicked "Stay Logged In" — restart full clock
 *
 * Activity events that reset the clock:
 *   mousemove, mousedown, keydown, scroll, touchstart, click
 */

import { ref } from 'vue'

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const

export interface IdleTimerOptions {
  /** Milliseconds of inactivity before the warning appears. */
  warnAfter: number
  /** Milliseconds of inactivity before logout fires (must be > warnAfter). */
  logoutAfter: number
  /** Called when logout fires. Should call goOffline + logout. */
  onLogout: () => void | Promise<void>
}

export function useIdleTimer(options: IdleTimerOptions) {
  const { warnAfter, logoutAfter, onLogout } = options

  // Seconds remaining in the warning countdown (0 when warning is not showing).
  const secondsLeft = ref(0)
  // Whether the warning overlay should be visible.
  const isWarning   = ref(false)

  let warnTimeout:      ReturnType<typeof setTimeout>  | null = null
  let logoutTimeout:    ReturnType<typeof setTimeout>  | null = null
  let countdownInterval: ReturnType<typeof setInterval> | null = null

  // ── Internal helpers ────────────────────────────────────────────────────────

  function clearAllTimers() {
    if (warnTimeout)       { clearTimeout(warnTimeout);         warnTimeout       = null }
    if (logoutTimeout)     { clearTimeout(logoutTimeout);       logoutTimeout     = null }
    if (countdownInterval) { clearInterval(countdownInterval);  countdownInterval = null }
  }

  function startTimers() {
    const warningDuration = Math.round((logoutAfter - warnAfter) / 1000) // seconds

    warnTimeout = setTimeout(() => {
      isWarning.value   = true
      secondsLeft.value = warningDuration

      countdownInterval = setInterval(() => {
        if (secondsLeft.value > 0) {
          secondsLeft.value--
        } else {
          clearInterval(countdownInterval!)
          countdownInterval = null
        }
      }, 1_000)
    }, warnAfter)

    logoutTimeout = setTimeout(async () => {
      clearAllTimers()
      isWarning.value   = false
      secondsLeft.value = 0
      await onLogout()
    }, logoutAfter)
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Reset the idle clock — called on any user activity or "Stay Logged In" click. */
  function reset() {
    clearAllTimers()
    isWarning.value   = false
    secondsLeft.value = 0
    startTimers()
  }

  // Stable function reference so addEventListener/removeEventListener pair correctly.
  function onActivity() { reset() }

  /** Start watching for inactivity. Call once when a cadet session begins. */
  function start() {
    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, onActivity, { passive: true })
    )
    startTimers()
  }

  /** Stop watching and tear down all timers. Call when the session ends. */
  function stop() {
    clearAllTimers()
    isWarning.value   = false
    secondsLeft.value = 0
    ACTIVITY_EVENTS.forEach(evt =>
      window.removeEventListener(evt, onActivity)
    )
  }

  return { isWarning, secondsLeft, start, stop, reset }
}
