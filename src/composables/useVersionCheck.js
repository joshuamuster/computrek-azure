/**
 * useVersionCheck
 *
 * Polls /version.json every `intervalMs` milliseconds (default 2 min) and
 * sets `updateAvailable` to true when the deployed version differs from the
 * version baked into this bundle at build time.
 *
 * Usage:
 *   const { updateAvailable } = useVersionCheck()
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

// __APP_VERSION__ is injected by Vite's define at build time (vite.config.js)
const BUILT_VERSION = __APP_VERSION__

export function useVersionCheck(intervalMs = 120_000) {
  const updateAvailable = ref(false)
  const latestVersion = ref('')
  let pollTimer = null

  async function checkVersion() {
    try {
      // Cache-bust so we always fetch the latest version.json from the server
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const { major, minor, patch } = await res.json()
      const latest = `${major}.${minor}.${patch}`
      if (latest !== BUILT_VERSION) {
        latestVersion.value = latest
        updateAvailable.value = true
      }
    } catch {
      // Network error — fail silently; we'll try again next interval
    }
  }

  onMounted(() => {
    // First check after 60 s so a fresh page-load doesn't immediately flag itself
    const initialDelay = setTimeout(() => {
      checkVersion()
      pollTimer = setInterval(checkVersion, intervalMs)
    }, 60_000)

    onBeforeUnmount(() => {
      clearTimeout(initialDelay)
      clearInterval(pollTimer)
    })
  })

  return { updateAvailable, currentVersion: BUILT_VERSION, latestVersion }
}
