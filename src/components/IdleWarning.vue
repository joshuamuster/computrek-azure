<template>
  <Teleport to="body">
    <Transition name="idle-fade">
      <div
        v-if="show"
        class="idle-overlay"
        role="alertdialog"
        aria-live="assertive"
        aria-label="Inactivity warning"
        @click="$emit('stay')"
      >
        <div class="idle-modal" @click.stop>

          <div class="idle-icon">⏱</div>

          <div class="idle-title">Still there, Cadet?</div>

          <p class="idle-body">
            You've been inactive for a while.<br>
            You'll be automatically signed out in
          </p>

          <div class="idle-countdown" :class="{ urgent: secondsLeft <= 60 }">
            {{ formattedTime }}
          </div>

          <button class="idle-stay-btn" @click="$emit('stay')">
            STAY LOGGED IN
          </button>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  show: boolean
  secondsLeft: number
}>()

defineEmits<{ (e: 'stay'): void }>()

const formattedTime = computed(() => {
  const m = Math.floor(props.secondsLeft / 60)
  const s = props.secondsLeft % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})
</script>

<style scoped>
.idle-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 5, 20, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99000;
}

.idle-modal {
  background: rgba(6, 14, 30, 0.97);
  border: 1px solid rgba(255, 153, 0, 0.45);
  border-radius: 1rem;
  box-shadow: 0 0 2.5rem rgba(255, 153, 0, 0.18);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding: 2.25rem 2.5rem 2rem;
  width: min(90vw, 22rem);
  text-align: center;
}

.idle-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.idle-title {
  font-family: 'Antonio', sans-serif;
  font-size: 1.55rem;
  font-weight: 700;
  color: #ff9900;
  letter-spacing: 0.05em;
}

.idle-body {
  font-family: 'Antonio', sans-serif;
  font-size: 0.95rem;
  color: #99bbdd;
  line-height: 1.5;
  margin: 0;
}

.idle-countdown {
  font-family: 'Antonio', sans-serif;
  font-size: 3.25rem;
  font-weight: 700;
  color: #ff9900;
  letter-spacing: 0.06em;
  line-height: 1;
  text-shadow: 0 0 1rem rgba(255, 153, 0, 0.5);
  transition: color 0.4s, text-shadow 0.4s;
  min-width: 5rem;
}

.idle-countdown.urgent {
  color: #ff4444;
  text-shadow: 0 0 1rem rgba(255, 68, 68, 0.7);
  animation: urgentPulse 1s ease-in-out infinite;
}

@keyframes urgentPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.65; }
}

.idle-stay-btn {
  background: linear-gradient(90deg, #1a6632 0%, #22aa44 50%, #1a6632 100%);
  border: none;
  border-radius: 62rem;
  box-shadow: 0 0 1rem rgba(34, 200, 80, 0.5);
  color: #ccffcc;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  margin-top: 0.25rem;
  padding: 0.85rem 2rem;
  text-shadow: 0 0 0.5rem rgba(180, 255, 180, 0.7);
  transition: background 0.2s, box-shadow 0.2s;
  width: 100%;
}

.idle-stay-btn:hover {
  background: linear-gradient(90deg, #22aa44 0%, #33cc55 50%, #22aa44 100%);
  box-shadow: 0 0 1.5rem rgba(34, 200, 80, 0.75);
}

/* Transition */
.idle-fade-enter-active,
.idle-fade-leave-active { transition: opacity 0.25s ease; }
.idle-fade-enter-from,
.idle-fade-leave-to     { opacity: 0; }
</style>
