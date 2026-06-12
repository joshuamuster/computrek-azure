<template>
  <Transition name="banner-slide">
    <div v-if="visible" class="update-banner" role="alert">
      <div class="banner-icon">⚡</div>
      <div class="banner-text">
        <span class="banner-title">NEW VERSION DEPLOYED</span>
        <span class="banner-sub">
          <span class="banner-versions">v{{ currentVersion }} → v{{ latestVersion }}</span>
          Refresh your browser to avoid issues.
        </span>
      </div>
      <div class="banner-actions">
        <button class="banner-refresh-btn" @click="reload">REFRESH NOW</button>
        <button class="banner-dismiss-btn" @click="dismiss" aria-label="Dismiss">✕</button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue'
import { useVersionCheck } from '@/composables/useVersionCheck'

const { updateAvailable, currentVersion, latestVersion } = useVersionCheck()
const dismissed = ref(false)

const visible = ref(false)

// Watch updateAvailable separately so we can respect the dismiss flag
import { watch } from 'vue'
watch(updateAvailable, (val) => {
  if (val && !dismissed.value) visible.value = true
})

function reload() {
  window.location.reload()
}

function dismiss() {
  visible.value = false
  dismissed.value = true
}
</script>

<style scoped>
.update-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 2.25rem 1.5rem;
  background: linear-gradient(90deg,
    rgba(10, 15, 30, 0.75) 0%,
    rgba(13, 21, 51, 0.75) 50%,
    rgba(10, 15, 30, 0.75) 100%);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 2px solid #3366ff;
  box-shadow: 0 4px 24px rgba(51, 102, 255, 0.35);
  font-family: 'Antonio', sans-serif;
  justify-content: center;
}

.banner-icon {
  font-size: 1.4rem;
  flex-shrink: 0;
  color: #3366ff;
  filter: drop-shadow(0 0 6px #3366ff);
}

.banner-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.banner-title {
  font-size: 1.75rem;
  font-weight: bold;
  color: #3366ff;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1.2;
}

.banner-sub {
  font-size: 1rem;
  color: #aab4cc;
  letter-spacing: 0.03em;
  line-height: 1.3;
}

.banner-versions {
  color: #fff;
  font-weight: bold;
  margin-right: 0.5em;
  letter-spacing: 0.05em;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.banner-refresh-btn {
  font-family: 'Antonio', sans-serif;
  font-weight: bold;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.4rem 1.1rem;
  border-radius: 1.25rem;
  border: 2px solid #3366ff;
  background: #3366ff;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s;
  white-space: nowrap;
}

.banner-refresh-btn:hover {
  background: #4d7aff;
  box-shadow: 0 0 12px rgba(51, 102, 255, 0.6);
}

.banner-dismiss-btn {
  background: transparent;
  border: none;
  color: #667799;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem 0.4rem;
  line-height: 1;
  border-radius: 50%;
  transition: color 0.2s;
}

.banner-dismiss-btn:hover {
  color: #aab4cc;
}

/* Slide down from the top */
.banner-slide-enter-active,
.banner-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1),
              opacity   0.35s ease;
}

.banner-slide-enter-from,
.banner-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
