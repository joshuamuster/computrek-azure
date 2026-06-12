<script setup>
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import MainFrame from './MainFrame.vue'
import LandingPage from './pages/LandingPage.vue'
import UpdateBanner from './components/UpdateBanner.vue'
import IdleWarning from './components/IdleWarning.vue'
import { useAuth } from './composables/useAuth.js'
import { useActivityLog } from './composables/useActivityLog.js'
import { useDriveFiles } from './composables/useDriveFiles'
import { usePresence } from './composables/usePresence'
import { useIdleTimer } from './composables/useIdleTimer'

const { isAuthenticated, isCadet, login, logout, userInfo, initializeAuth } = useAuth()
const router = useRouter()
const { loadDriveFiles } = useDriveFiles()
const { logEvent } = useActivityLog()
const { goOnline, goOffline } = usePresence()

// ── Idle-timeout (cadets only) ────────────────────────────────────────────────
// Warning at 25 min, auto-logout at 30 min.
const idleTimer = useIdleTimer({
  warnAfter:   7 * 60 * 1000,
  logoutAfter: 10 * 60 * 1000,
  onLogout: async () => {
    const uid = userInfo?.value?.uid
    if (uid) await goOffline(uid)
    await logout()
    router.push('/')
  },
})

onMounted(() => {
  initializeAuth()
  // Kick off Drive file listing immediately on app load so the file map
  // is ready (or nearly ready) by the time the user navigates to a lesson.
  loadDriveFiles()

  // If a cadet session was restored from localStorage on page refresh,
  // re-register presence (the previous onDisconnect fired and cleared it)
  // and restart the idle timer.
  const info = userInfo?.value
  if (info?.uid && info.role === 'cadet') {
    goOnline(info.uid)
    idleTimer.start()
  }
})

// Start/stop the idle timer as the cadet role changes.
// Covers login (isCadet flips true) and logout/role-switch (isCadet flips false).
watch(isCadet, (nowCadet, wasCadet) => {
  if (nowCadet && !wasCadet) idleTimer.start()
  if (!nowCadet && wasCadet) idleTimer.stop()
})

// Detect logout regardless of who calls it (MainFrame's logout button, session
// expiry, etc.). Watch for uid disappearing and mark the cadet offline first.
watch(() => userInfo?.value?.uid, (newUid, oldUid) => {
  if (!newUid && oldUid) goOffline(oldUid)
})

const handleAuthentication = (role, user = null) => {
  login(role, user)
  // Log sign-in for cadets — pass user explicitly since userInfo hasn't
  // propagated through the reactivity system yet at this point.
  if (role === 'cadet' && user) {
    logEvent('sign_in', {}, user)
    // Mark cadet online in RTDB; the server-side onDisconnect handler will
    // automatically mark them offline if the tab closes or connection drops.
    goOnline(user.uid)
  }
  router.push(role === 'cadet' ? '/dashboard' : '/')
}
</script>

<template>
  <div>
    <UpdateBanner />
    <LandingPage
        v-if="!isAuthenticated"
        @authenticate="handleAuthentication"
    />
    <MainFrame
        v-else
        msg="CompuTrek CS"
    />
    <!-- Idle-timeout warning — only rendered when a cadet is near the limit -->
    <IdleWarning
      :show="idleTimer.isWarning.value"
      :seconds-left="idleTimer.secondsLeft.value"
      @stay="idleTimer.reset()"
    />
  </div>
</template>

<style scoped>
</style>