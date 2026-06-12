<template>
  <div class="ic-board-wrapper">
    <div
      class="ic-board"
      :style="{ gridTemplateColumns: `repeat(${size}, ${cellPx}px)` }"
    >
      <button
        v-for="(lit, idx) in board"
        :key="idx"
        class="ic-cell"
        :class="{
          lit,
          'flash':          flashIdx === idx,
          'neighbor-flash': neighborSet.has(idx),
          'can-toggle':     playable && !lit,
        }"
        :aria-label="`Cell ${idx + 1}, ${lit ? 'lit' : 'dark'}`"
        :aria-pressed="lit"
        :disabled="!playable"
        @click="handleClick(idx)"
      >
        <span class="cell-glare" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getAffectedCells } from './engine';

const props = defineProps<{
  board: boolean[];
  size: number;
  playable: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle', idx: number): void;
}>();

// Cell sizing scales with grid size
const cellPx = computed(() => (props.size <= 4 ? 80 : 64));

// Flash feedback managed locally
const flashIdx    = ref<number | null>(null);
const neighborSet = ref<Set<number>>(new Set());
let   flashTimer: ReturnType<typeof setTimeout> | null = null;

function handleClick(idx: number) {
  if (!props.playable) return;

  if (flashTimer) clearTimeout(flashTimer);
  flashIdx.value    = idx;
  neighborSet.value = new Set(getAffectedCells(idx, props.size).filter(i => i !== idx));

  flashTimer = setTimeout(() => {
    flashIdx.value    = null;
    neighborSet.value = new Set();
  }, 280);

  emit('toggle', idx);
}

// Clear flash if board is reset from outside
watch(() => props.board, () => {
  if (flashTimer) clearTimeout(flashTimer);
  flashIdx.value    = null;
  neighborSet.value = new Set();
});
</script>

<style scoped>
.ic-board-wrapper {
  padding: 1rem;
  background: rgba(8, 6, 0, 0.78);
  border-radius: 0.6rem;
  border: 0.125rem solid rgba(255, 215, 64, 0.18);
  box-shadow:
    inset 0 0 2rem rgba(0, 0, 0, 0.8),
    0 0 3rem rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(0.5rem);
}

.ic-board {
  display: grid;
  gap: 0.42rem;
  user-select: none;
  -webkit-user-select: none;
}

.ic-cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: 0.3rem;
  border: 0.0625rem solid rgba(255, 215, 64, 0.12);
  cursor: default;
  overflow: hidden;
  background: rgba(18, 14, 2, 0.82);
  transition: background 0.14s ease, box-shadow 0.14s ease, transform 0.08s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.cell-glare {
  position: absolute;
  top: 8%;
  left: 12%;
  width: 38%;
  height: 30%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at 40% 40%,
    rgba(255, 255, 220, 0.22),
    transparent 70%
  );
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.14s ease;
}

.ic-cell.can-toggle {
  cursor: pointer;
}

.ic-cell.can-toggle:hover {
  background: rgba(255, 215, 64, 0.10);
  border-color: rgba(255, 215, 64, 0.35);
  box-shadow: 0 0 0.5rem rgba(255, 215, 64, 0.18);
  transform: scale(1.04);
  z-index: 2;
}

.ic-cell.can-toggle:active {
  transform: scale(0.93);
}

.ic-cell.lit {
  background: #ffd740;
  border-color: #ffe680;
  box-shadow:
    0 0 0.55rem  rgba(255, 215, 64, 0.95),
    0 0 1.3rem   rgba(255, 215, 64, 0.55),
    0 0 2.8rem   rgba(255, 215, 64, 0.20),
    inset 0 0 0.7rem rgba(255, 255, 200, 0.35);
  animation: bulb-glow 2.6s ease-in-out infinite alternate;
}

.ic-cell.lit .cell-glare { opacity: 1; }

@keyframes bulb-glow {
  from {
    box-shadow:
      0 0 0.45rem rgba(255, 215, 64, 0.85),
      0 0 1.1rem  rgba(255, 215, 64, 0.45),
      0 0 2.3rem  rgba(255, 215, 64, 0.15),
      inset 0 0 0.55rem rgba(255, 255, 200, 0.28);
  }
  to {
    box-shadow:
      0 0 0.75rem rgba(255, 215, 64, 1),
      0 0 1.8rem  rgba(255, 215, 64, 0.65),
      0 0 3.8rem  rgba(255, 215, 64, 0.28),
      inset 0 0 0.9rem rgba(255, 255, 200, 0.45);
  }
}

.ic-cell.flash {
  animation: toggle-flash 0.28s ease-out forwards !important;
}

@keyframes toggle-flash {
  0%   { filter: brightness(2.8) saturate(1.5); }
  100% { filter: brightness(1)   saturate(1); }
}

.ic-cell.neighbor-flash {
  animation: neighbor-ripple 0.28s ease-out forwards !important;
}

@keyframes neighbor-ripple {
  0%   { filter: brightness(1.9); }
  100% { filter: brightness(1); }
}

.ic-cell:disabled {
  cursor: default;
  pointer-events: none;
}
</style>
