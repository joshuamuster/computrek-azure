<template>
  <div class="df-board-wrapper">
    <div
        class="df-board"
        :style="{ gridTemplateColumns: `repeat(${cols}, ${cellPx}px)` }"
    >
      <button
          v-for="(cell, idx) in cells"
          :key="idx"
          class="df-cell"
          :class="cellClass(cell, idx)"
          :aria-label="ariaLabel(cell, idx)"
          :disabled="!playable || cell.content.kind === 'wall' || cell.content.kind === 'start' || idx === exitIdx"
          @click="handleClick(idx)"
      >
        <!-- Pipe SVG layer -->
        <svg
            v-if="cell.content.kind === 'pipe' || cell.content.kind === 'start'"
            class="pipe-svg"
            viewBox="0 0 40 40"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
          <PipeSvgPaths
              :type="cell.content.kind === 'start' ? startPipeType(cell.content.openings) : cell.content.type"
              :filled="cell.content.filled"
              :fill-pct="cell.content.kind === 'pipe' ? cell.content.fillPct : (cell.content.filled ? 1 : 0)"
          />
        </svg>

        <!-- Exit cell marker -->
        <img
            v-if="idx === exitIdx"
            :src="warpCoreIcon"
            class="exit-icon"
            :class="{ 'exit-icon-reached': exitReached }"
            alt="Exit"
            aria-hidden="true"
        />

        <!-- Flash ripple overlay -->
        <span v-if="flashSet.has(idx)" class="cell-ripple" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, defineComponent, h } from 'vue';
import type { GridCell, PipeType, Direction } from '@/components/games/WarpCoreBreach/engine';

// ── Pipe SVG renderer ─────────────────────────────────────────────────────────
const PipeSvgPaths = defineComponent({
  name: 'PipeSvgPaths',
  props: {
    type:    { type: String as () => PipeType, required: true },
    filled:  { type: Boolean, default: false },
    fillPct: { type: Number,  default: 0 },
  },
  setup(props) {
    return () => {
      const t = props.type;
      const pct = Math.min(1, Math.max(0, props.fillPct));
      const trackColor = 'rgba(168,216,255,0.18)';
      const fillColor  = props.filled ? '#a8d8ff' : `rgba(168,216,255,${0.18 + pct * 0.82})`;
      const w = 12;
      const nodes: any[] = [];

      if (t === 'EW' || t === 'CROSS') {
        nodes.push(
            h('rect', { x: 0, y: 14, width: 40, height: w, rx: 2, fill: trackColor }),
            h('rect', { x: 0, y: 14, width: 40 * pct, height: w, rx: 2, fill: fillColor }),
        );
      }
      if (t === 'NS' || t === 'CROSS') {
        nodes.push(
            h('rect', { x: 14, y: 0, width: w, height: 40, rx: 2, fill: trackColor }),
            h('rect', { x: 14, y: 0, width: w, height: 40 * pct, rx: 2, fill: fillColor }),
        );
      }
      const dash = 35;
      if (t === 'NE') {
        const d = 'M20 0 A20 20 0 0 0 40 20';
        nodes.push(
            h('path', { d, 'stroke-width': w, stroke: trackColor, fill: 'none', 'stroke-linecap': 'butt' }),
            h('path', { d, 'stroke-width': w, stroke: fillColor,  fill: 'none', 'stroke-linecap': 'butt', 'stroke-dasharray': dash, 'stroke-dashoffset': dash * (1 - pct) }),
        );
      }
      if (t === 'NW') {
        const d = 'M20 0 A20 20 0 0 1 0 20';
        nodes.push(
            h('path', { d, 'stroke-width': w, stroke: trackColor, fill: 'none', 'stroke-linecap': 'butt' }),
            h('path', { d, 'stroke-width': w, stroke: fillColor,  fill: 'none', 'stroke-linecap': 'butt', 'stroke-dasharray': dash, 'stroke-dashoffset': dash * (1 - pct) }),
        );
      }
      if (t === 'SE') {
        const d = 'M20 40 A20 20 0 0 1 40 20';
        nodes.push(
            h('path', { d, 'stroke-width': w, stroke: trackColor, fill: 'none', 'stroke-linecap': 'butt' }),
            h('path', { d, 'stroke-width': w, stroke: fillColor,  fill: 'none', 'stroke-linecap': 'butt', 'stroke-dasharray': dash, 'stroke-dashoffset': dash * (1 - pct) }),
        );
      }
      if (t === 'SW') {
        const d = 'M20 40 A20 20 0 0 0 0 20';
        nodes.push(
            h('path', { d, 'stroke-width': w, stroke: trackColor, fill: 'none', 'stroke-linecap': 'butt' }),
            h('path', { d, 'stroke-width': w, stroke: fillColor,  fill: 'none', 'stroke-linecap': 'butt', 'stroke-dasharray': dash, 'stroke-dashoffset': dash * (1 - pct) }),
        );
      }
      return h('g', nodes);
    };
  },
});

// ── Props / Emits ─────────────────────────────────────────────────────────────
const props = defineProps<{
  cells:       GridCell[];
  cols:        number;
  rows:        number;
  playable:    boolean;
  flowIdx:     number;
  /** Flat index of the exit/target cell */
  exitIdx:     number;
  /** True once flow has reached the exit */
  exitReached: boolean;
  /** URL/src for the warp core icon shown on the exit cell */
  warpCoreIcon: string;
}>();

const emit = defineEmits<{
  (e: 'place', idx: number): void;
}>();

// ── Cell sizing ───────────────────────────────────────────────────────────────
const cellPx = computed(() => {
  if (props.cols <= 7)  return 64;
  if (props.cols <= 9)  return 52;
  return 44;
});

// ── Flash feedback ─────────────────────────────────────────────────────────────
const flashSet = ref<Set<number>>(new Set());
let flashTimer: ReturnType<typeof setTimeout> | null = null;

function handleClick(idx: number) {
  if (!props.playable) return;
  const c = props.cells[idx].content;
  if (c.kind === 'wall' || c.kind === 'start') return;
  if (idx === props.exitIdx) return;

  if (flashTimer) clearTimeout(flashTimer);
  flashSet.value = new Set([idx]);
  flashTimer = setTimeout(() => { flashSet.value = new Set(); }, 220);

  emit('place', idx);
}

watch(() => props.cells, () => {
  if (flashTimer) clearTimeout(flashTimer);
  flashSet.value = new Set();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function startPipeType(openings: [Direction, Direction]): PipeType {
  return [...openings].sort().join('') as PipeType;
}

function cellClass(cell: GridCell, idx: number) {
  const c = cell.content;
  const isExit = idx === props.exitIdx;
  return {
    'cell-empty':      c.kind === 'empty' && !isExit,
    'cell-exit':       isExit,
    'cell-exit-reached': isExit && props.exitReached,
    'cell-pipe':       c.kind === 'pipe',
    'cell-start':      c.kind === 'start',
    'cell-wall':       c.kind === 'wall',
    'cell-filled':     (c.kind === 'pipe' || c.kind === 'start') && c.filled,
    'cell-flowing':    idx === props.flowIdx,
    'cell-pre-placed': c.kind === 'pipe' && !c.filled && idx !== props.flowIdx,
    'flash':           flashSet.value.has(idx),
  };
}

function ariaLabel(cell: GridCell, idx: number): string {
  if (idx === props.exitIdx) return `Exit cell ${idx}`;
  const c = cell.content;
  if (c.kind === 'start') return `Start cell ${idx}`;
  if (c.kind === 'empty') return `Empty cell ${idx}`;
  if (c.kind === 'wall')  return `Wall ${idx}`;
  if (c.kind === 'pipe')  return `Pipe ${c.type} at ${idx}${c.filled ? ', filled' : ''}`;
  return `Cell ${idx}`;
}
</script>

<style scoped>
.df-board-wrapper {
  padding: 1rem;
  background: rgba(8, 6, 0, 0.78);
  border-radius: 0.6rem;
  border: 0.125rem solid rgba(168, 216, 255, 0.18);
  box-shadow:
      inset 0 0 2rem rgba(0, 0, 0, 0.8),
      0 0 3rem rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(0.5rem);
}

.df-board {
  display: grid;
  gap: 0.3rem;
  user-select: none;
  -webkit-user-select: none;
}

.df-cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: 0.25rem;
  border: 0.0625rem solid rgba(168, 216, 255, 0.1);
  background: rgba(12, 10, 2, 0.85);
  cursor: pointer;
  overflow: hidden;
  transition: background 0.1s ease, border-color 0.1s ease, transform 0.07s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  padding: 0;
}

.df-cell:hover:not(:disabled):not(.cell-start):not(.cell-wall):not(.cell-exit) {
  background: rgba(168, 216, 255, 0.08);
  border-color: rgba(168, 216, 255, 0.3);
  transform: scale(1.05);
  z-index: 2;
}

.df-cell:active:not(:disabled) {
  transform: scale(0.94);
}

.df-cell:disabled,
.df-cell.cell-wall {
  cursor: default;
  pointer-events: none;
}

.df-cell.cell-start {
  background: rgba(0, 229, 255, 0.12);
  border-color: rgba(0, 229, 255, 0.5);
  cursor: default;
  pointer-events: none;
}

/* ── Exit cell ──────────────────────────────────────────────────────────────── */
.df-cell.cell-exit {
  background: rgba(255, 157, 0, 0.08);
  border: 0.125rem solid rgba(255, 157, 0, 0.55);
  cursor: default;
  pointer-events: none;
  animation: exit-pulse 2s ease-in-out infinite alternate;
}

@keyframes exit-pulse {
  from {
    box-shadow: 0 0 0.4rem rgba(255, 157, 0, 0.4),
    inset 0 0 0.6rem rgba(255, 157, 0, 0.1);
  }
  to {
    box-shadow: 0 0 1.2rem rgba(255, 157, 0, 0.8),
    0 0 2.5rem rgba(255, 157, 0, 0.3),
    inset 0 0 1rem rgba(255, 157, 0, 0.2);
  }
}

.df-cell.cell-exit-reached {
  background: rgba(0, 229, 255, 0.15);
  border-color: rgba(0, 229, 255, 0.8);
  animation: exit-reached-pulse 0.8s ease-in-out infinite alternate;
}

@keyframes exit-reached-pulse {
  from { box-shadow: 0 0 0.8rem rgba(0, 229, 255, 0.7); }
  to   { box-shadow: 0 0 2rem rgba(0, 229, 255, 1), 0 0 4rem rgba(0, 229, 255, 0.4); }
}

/* ── Existing styles ────────────────────────────────────────────────────────── */
.df-cell.cell-pre-placed {
  background: rgba(168, 216, 255, 0.05);
  border-color: rgba(168, 216, 255, 0.25);
  cursor: pointer;
}

.df-cell.cell-filled {
  background: rgba(168, 216, 255, 0.08);
  border-color: rgba(168, 216, 255, 0.4);
}

.df-cell.cell-flowing {
  animation: flow-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes flow-pulse {
  from { box-shadow: 0 0 0.4rem rgba(168, 216, 255, 0.6); }
  to   { box-shadow: 0 0 1.2rem rgba(168, 216, 255, 1), 0 0 2rem rgba(168, 216, 255, 0.4); }
}

.pipe-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.exit-icon {
  position: absolute;
  inset: 12%;
  width: 76%;
  height: 76%;
  object-fit: contain;
  pointer-events: none;
  opacity: 0.75;
  filter: drop-shadow(0 0 4px rgba(255, 157, 0, 0.8));
  animation: exit-icon-pulse 2s ease-in-out infinite alternate;
}

.exit-icon-reached {
  opacity: 1;
  filter: drop-shadow(0 0 8px rgba(0, 229, 255, 1)) drop-shadow(0 0 16px rgba(0, 229, 255, 0.6));
  animation: exit-icon-reached-pulse 0.8s ease-in-out infinite alternate;
}

@keyframes exit-icon-pulse {
  from { filter: drop-shadow(0 0 3px rgba(255, 157, 0, 0.6)); opacity: 0.65; }
  to   { filter: drop-shadow(0 0 8px rgba(255, 157, 0, 1)) drop-shadow(0 0 14px rgba(255, 157, 0, 0.4)); opacity: 0.9; }
}

@keyframes exit-icon-reached-pulse {
  from { filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.8)); }
  to   { filter: drop-shadow(0 0 14px rgba(0, 229, 255, 1)) drop-shadow(0 0 24px rgba(0, 229, 255, 0.5)); }
}

.cell-ripple {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  animation: cell-flash 0.22s ease-out forwards;
  pointer-events: none;
}

@keyframes cell-flash {
  0%   { background: rgba(168, 216, 255, 0.55); }
  100% { background: transparent; }
}

.df-cell.flash {
  animation: toggle-flash 0.22s ease-out forwards;
}

@keyframes toggle-flash {
  0%   { filter: brightness(2.5) saturate(1.5); }
  100% { filter: brightness(1)   saturate(1); }
}
</style>