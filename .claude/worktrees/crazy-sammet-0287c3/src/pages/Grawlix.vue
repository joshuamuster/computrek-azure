<template>
  <div class="error-container">
    <div class="lcars-text-bar"><span>A 404 page?!</span></div>
    <div class="center-content">
      <p class="escaping">In your wanderings, you've arrived someplace that you're not supposed to be.</p>

      <div class="image-wrapper">
        <Transition name="reveal">
          <img
              v-if="revealed"
              src="@/assets/images/Grawlix.png"
              alt="Grawlix"
              class="grawlix-image shaking"
          />
        </Transition>
        <span v-if="!revealed" class="countdown">{{ count }}</span>
      </div>

      <p class="subheader">Beware the Grawlix...</p>
      <p class="escaping"><a href="/games">Flee to safety!</a></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const count = ref(3);
const revealed = ref(false);
let interval: ReturnType<typeof setInterval>;

onMounted(() => {
  interval = setInterval(() => {
    count.value--;
    if (count.value === 0) {
      clearInterval(interval);
      setTimeout(() => revealed.value = true, 300);
    }
  }, 2000);
});

onBeforeUnmount(() => clearInterval(interval));
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Rubik+Wet+Paint&display=swap');

.error-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.center-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: start;
}

.image-wrapper {
  width: 20rem;
  height: 20rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.countdown {
  font-family: 'Rubik Wet Paint', cursive;
  font-size: 20rem;
  line-height: 1;
  background: linear-gradient(135deg, #ff2200, #ff6600, #ff0066, #ff2200);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-shift 1s ease infinite, countdown-flare 2s ease-out infinite;
}

.escaping {
  color: white;
  font-family: 'Antonio', 'Arial Narrow', 'Avenir Next Condensed', sans-serif;
  font-weight: 900;
}

.escaping a {
  color: white;
  position: relative;
  text-decoration: none;
}

.escaping a::before {
  content: '-----> ';
  display: inline-block;
  animation: shake 0.2s ease infinite;
  margin: 0 1rem;
}

.escaping a::after {
  content: ' <-----';
  display: inline-block;
  animation: shake 0.2s ease infinite;
  margin: 0 1rem;
}

.grawlix-image {
  height: stretch;
  max-width: 20rem;
}

.grawlix-image.shaking {
  animation: shake 0.6s ease infinite;
}

.grawlix-image:hover {
  animation: shake 0.6s ease infinite;
}

.subheader {
  font-family: 'Rubik Wet Paint', cursive;
  font-size: 4rem;
  background: linear-gradient(135deg, #ff2200, #ff6600, #ff0066, #ff2200);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-shift 4s ease infinite, glow-pulse 2s ease-in-out infinite;
}

.subheader:hover {
  animation: gradient-shift 4s ease infinite, glow-pulse 2s ease-in-out infinite, shake 0.4s ease infinite;
}

/* Reveal transition */
.reveal-enter-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.reveal-enter-from {
  opacity: 0;
  transform: scale(0.5);
}
.reveal-enter-to {
  opacity: 1;
  transform: scale(1);
}

@keyframes shake {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20%       { transform: translate(-4px, 2px) rotate(-1.5deg); }
  40%       { transform: translate(4px, -2px) rotate(1.5deg); }
  60%       { transform: translate(-3px, -2px) rotate(0.5deg); }
  80%       { transform: translate(3px, 2px) rotate(-0.5deg); }
}

@keyframes gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 0.5rem #ff2200) drop-shadow(0 0 1.5rem #ff440088); }
  50%       { filter: drop-shadow(0 0 1.5rem #ff6600) drop-shadow(0 0 3rem #ff2200) drop-shadow(0 0 5rem #ff006688); }
}

@keyframes countdown-flare {
  0%   { filter: drop-shadow(0 0 2rem #ff6600) drop-shadow(0 0 5rem #ff2200) drop-shadow(0 0 8rem #ff006688); opacity: 1; }
  75%  { filter: drop-shadow(0 0 0.5rem #ff2200) drop-shadow(0 0 1.5rem #ff440044); opacity: 0.3; }
  100% { filter: drop-shadow(0 0 0.5rem #ff2200) drop-shadow(0 0 1.5rem #ff440044); opacity: 0.3; }
}
</style>