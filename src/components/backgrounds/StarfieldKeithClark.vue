<!--
  StarfieldKeithClark.vue
  ────────────────────────────────────────────────────────────────────────────
  CSS starfield background using Keith Clark's box-shadow scroll technique.
  Source: https://codepen.io/keithclark/pen/JjWyBb

  Effect: stars drift upward past the viewer (sideways/scrolling parallax).
  Three layers at different sizes and speeds give a parallax depth feel.

  Usage:
    <StarfieldKeithClark />   (drop it as the first child of a position:relative
                               wrapper, or directly inside <body>)

  Contrast with StarfieldWarpDrive.vue (3D translateZ fly-toward-viewer effect).
  ────────────────────────────────────────────────────────────────────────────
-->
<template>
  <div class="starfield-bg">
    <div class="stars stars1"></div>
    <div class="stars stars2"></div>
    <div class="stars stars3"></div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

// Generates a box-shadow string of `count` white star dots at random positions.
// x range covers wide screens (2560px); y range matches the animation loop height (2000px).
function generateStars(count) {
  const parts = []
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 2560)
    const y = Math.floor(Math.random() * 2000)
    parts.push(`${x}px ${y}px #FFF`)
  }
  return parts.join(', ')
}

onMounted(() => {
  document.documentElement.style.setProperty('--stars1-shadow', generateStars(700))
  document.documentElement.style.setProperty('--stars2-shadow', generateStars(200))
  document.documentElement.style.setProperty('--stars3-shadow', generateStars(100))
})
</script>

<style scoped>
.starfield-bg {
  position: fixed;
  inset: 0;
  background: #060915;
  z-index: -2;
  overflow: hidden;
}

.stars {
  position: absolute;
  top: 0;
  left: 0;
  background: transparent;
  will-change: transform;
}

/* Layer 1 — small (1 px), fastest, most stars */
.stars1 {
  width: 1px;
  height: 1px;
  box-shadow: var(--stars1-shadow, none);
  animation: animStar 50s linear infinite;
}
.stars1::after {
  content: '';
  position: absolute;
  top: -2000px;
  left: 0;
  width: 1px;
  height: 1px;
  background: transparent;
  box-shadow: var(--stars1-shadow, none);
}

/* Layer 2 — medium (2 px), mid speed */
.stars2 {
  width: 2px;
  height: 2px;
  box-shadow: var(--stars2-shadow, none);
  animation: animStar 100s linear infinite;
}
.stars2::after {
  content: '';
  position: absolute;
  top: -2000px;
  left: 0;
  width: 2px;
  height: 2px;
  background: transparent;
  box-shadow: var(--stars2-shadow, none);
}

/* Layer 3 — large (3 px), slowest, fewest */
.stars3 {
  width: 3px;
  height: 3px;
  box-shadow: var(--stars3-shadow, none);
  animation: animStar 150s linear infinite;
}
.stars3::after {
  content: '';
  position: absolute;
  top: -2000px;
  left: 0;
  width: 3px;
  height: 3px;
  background: transparent;
  box-shadow: var(--stars3-shadow, none);
}

/* translateY is compositor-only — zero repaints */
@keyframes animStar {
  from { transform: translateY(0px); }
  to   { transform: translateY(2000px); }
}

@media (prefers-reduced-motion: reduce) {
  .stars1, .stars2, .stars3 { animation: none; }
}
</style>
