<template>
  <div class="ds-widget">
    <div class="widget-header">
      <span class="widget-label">INTERACTIVE — HOLODECK IMAGING ARRAY</span>
      <h3>Holodeck Imaging Array</h3>
      <p class="widget-prompt">
        Every image on a holodeck begins as a grid of pixels — tiny squares that are either ON or OFF.
        Your mission: use this imaging array to draw ship schematics in binary. Each row of the grid
        is encoded as a sequence of 1s (ON) and 0s (OFF).
      </p>
    </div>

    <!-- Controls -->
    <div class="controls">
      <div class="control-group">
        <label>Grid size</label>
        <select v-model="gridSize" @change="resetGrid" class="ctrl-select">
          <option :value="8">8 × 8</option>
          <option :value="12">12 × 12</option>
          <option :value="16">16 × 16</option>
        </select>
      </div>
      <button class="ctrl-btn" @click="clearGrid">CLEAR</button>
      <button class="ctrl-btn" @click="invertGrid">INVERT</button>
      <button class="ctrl-btn" @click="randomGrid">RANDOM</button>
      <div class="control-group">
        <label>Draw mode</label>
        <select v-model="drawMode" class="ctrl-select">
          <option value="on">ON (1)</option>
          <option value="off">OFF (0)</option>
          <option value="toggle">Toggle</option>
        </select>
      </div>
    </div>

    <!-- Grid -->
    <div class="grid-area">
      <div
        class="pixel-grid"
        :style="{ gridTemplateColumns: `repeat(${gridSize}, 1fr)`, width: `${gridSize * 28}px` }"
        @mouseleave="isDragging = false"
        @mouseup="isDragging = false"
      >
        <div
          v-for="idx in gridSize * gridSize"
          :key="idx"
          class="pixel"
          :class="{ on: flatGrid[idx - 1] }"
          @mousedown="startDrawFlat(idx - 1)"
          @mouseenter="continueDrawFlat(idx - 1)"
        />
      </div>

      <!-- Row binary output -->
      <div class="binary-rows" :style="{ width: `${gridSize * 28}px` }">
        <div v-for="(row, r) in grid" :key="r" class="binary-row">
          <span class="row-num">{{ r }}</span>
          <span class="row-bits">{{ row.map(v => v ? '1' : '0').join('') }}</span>
        </div>
      </div>
    </div>

    <!-- Info -->
    <div class="pixel-info">
      <span>Total pixels: <strong>{{ gridSize * gridSize }}</strong></span>
      <span>ON: <strong>{{ onCount }}</strong></span>
      <span>OFF: <strong>{{ offCount }}</strong></span>
      <span>Bits to store: <strong>{{ gridSize * gridSize }}</strong></span>
    </div>

    <div class="reflection">
      <p class="b">Discussion:</p>
      <p>Try drawing a simple shape (triangle, letter, or Starfleet delta) using an 8×8 grid.
        How many bits are required to store your image? Now try 16×16 — how much more storage
        does doubling the resolution require? What are the trade-offs between resolution and
        storage size?</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const gridSize = ref(8);
const drawMode = ref('toggle');
const isDragging = ref(false);

const flatGrid = ref(Array(64).fill(false));

function resetGrid() {
  flatGrid.value = Array(gridSize.value * gridSize.value).fill(false);
}

function applyIdx(idx) {
  const g = [...flatGrid.value];
  if (drawMode.value === 'on') g[idx] = true;
  else if (drawMode.value === 'off') g[idx] = false;
  else g[idx] = !g[idx];
  flatGrid.value = g;
}

function startDrawFlat(idx) { isDragging.value = true; applyIdx(idx); }
function continueDrawFlat(idx) { if (isDragging.value) applyIdx(idx); }

function clearGrid() { flatGrid.value = Array(gridSize.value * gridSize.value).fill(false); }
function invertGrid() { flatGrid.value = flatGrid.value.map(v => !v); }
function randomGrid() {
  flatGrid.value = Array.from({ length: gridSize.value * gridSize.value }, () => Math.random() > 0.7);
}

// Rows for binary display
const grid = computed(() => {
  const rows = [];
  const n = gridSize.value;
  for (let r = 0; r < n; r++) {
    rows.push(flatGrid.value.slice(r * n, (r + 1) * n));
  }
  return rows;
});

const onCount = computed(() => flatGrid.value.filter(Boolean).length);
const offCount = computed(() => flatGrid.value.length - onCount.value);
</script>

<style scoped>
.ds-widget {
  border-top: 1px solid #444;
  margin-top: 2rem;
  padding-top: 1.5rem;
  user-select: none;
}
.widget-header { margin-bottom: 1.25rem; }
.widget-label { font-size: 0.65rem; letter-spacing: 0.15rem; color: skyblue; opacity: 0.7; }
.widget-header h3 { margin: 0.4rem 0 0.6rem; font-size: 1.1rem; color: antiquewhite; }
.widget-prompt { font-size: 0.9rem; color: #ccc; line-height: 1.5; }

.controls {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
  margin-bottom: 1rem;
}
.control-group { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: #aaa; }
.ctrl-select {
  background: #1a1a1a; border: 1px solid #333; color: #ccc;
  border-radius: 0.25rem; padding: 0.2rem 0.4rem; font-size: 0.75rem;
}
.ctrl-btn {
  background: transparent; border: 1px solid #444; color: #888;
  border-radius: 0.25rem; padding: 0.25rem 0.7rem;
  font-size: 0.7rem; letter-spacing: 0.08rem; cursor: pointer; transition: all 0.2s;
}
.ctrl-btn:hover { border-color: #888; color: #ccc; }

.grid-area { overflow-x: auto; margin-bottom: 1rem; }

.pixel-grid {
  display: grid;
  gap: 1px;
  background: #111;
  border: 1px solid #2a2a2a;
  border-radius: 0.25rem;
  padding: 1px;
  cursor: crosshair;
  margin-bottom: 0.5rem;
}

.pixel {
  width: 26px; height: 26px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 1px;
  transition: background 0.05s;
}
.pixel.on { background: skyblue; border-color: #5bc8e8; }

.binary-rows { font-family: monospace; }
.binary-row {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.05rem 0;
  font-size: 0.72rem;
}
.row-num { width: 1.2rem; color: #444; text-align: right; }
.row-bits { color: #555; letter-spacing: 0.05rem; }
.row-bits .bit-on { color: skyblue; }

.pixel-info {
  display: flex; gap: 1.5rem; font-size: 0.78rem; color: #888; margin-bottom: 1rem;
}
.pixel-info strong { color: antiquewhite; }

.reflection {
  background: #111; border-left: 3px solid orange;
  padding: 0.75rem 1rem; border-radius: 0 0.25rem 0.25rem 0;
  font-size: 0.85rem; color: #bbb; line-height: 1.5;
}
.reflection .b { color: orange; font-weight: 600; margin-bottom: 0.4rem; }
</style>
