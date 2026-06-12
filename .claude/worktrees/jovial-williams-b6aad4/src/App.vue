<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MainFrame from './MainFrame.vue'
import LandingPage from './pages/LandingPage.vue'
import { useAuth } from './composables/useAuth.js'
import { useDriveFiles } from './composables/useDriveFiles'

const { isAuthenticated, login, initializeAuth } = useAuth()
const router = useRouter()
const { loadDriveFiles } = useDriveFiles()

onMounted(() => {
  initializeAuth()
  // Kick off Drive file listing immediately on app load so the file map
  // is ready (or nearly ready) by the time the user navigates to a lesson.
  loadDriveFiles()
})

const handleAuthentication = (role, user = null) => {
  login(role, user)
  router.push(role === 'cadet' ? '/dashboard' : '/')
}
</script>

<template>
  <div>
    <LandingPage
        v-if="!isAuthenticated"
        @authenticate="handleAuthentication"
    />
    <MainFrame
        v-else
        msg="CompuTrek CS"
    />
  </div>
</template>

<style scoped>
</style>