<template>
  <div class="board-wrapper">
    <div 
      class="game-board" 
      ref="boardRef"
      :style="boardStyle"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <!-- Grid Cells -->
      <div class="grid-overlay">
        <div v-for="i in 36" :key="i" class="grid-cell"></div>
      </div>

      <!-- Exit Indicator -->
      <div class="exit-indicator" :style="exitStyle">
        <div class="exit-arrow">▶</div>
      </div>

      <!-- Pieces -->
      <ShuttleBayPiece
        v-for="piece in pieces"
        :key="piece.id"
        :piece="piece"
        :cell-size="cellSize"
        @drag-start="handleDragStart"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { PieceData } from './puzzles';
import { GRID_SIZE, getValidMoveRange, checkWin } from './engine';
import ShuttleBayPiece from './ShuttleBayPiece.vue';

const props = defineProps<{
  initialPieces: PieceData[];
  cellSize: number;
}>();

const emit = defineEmits<{
  (e: 'win'): void;
  (e: 'move'): void;
}>();

const pieces = ref<PieceData[]>(JSON.parse(JSON.stringify(props.initialPieces)));
const boardRef = ref<HTMLElement | null>(null);

const activePieceId = ref<string | null>(null);
const dragOffset = ref(0);
const moveRange = ref({ min: 0, max: 0 });

const boardStyle = computed(() => ({
  width: `${GRID_SIZE * props.cellSize}px`,
  height: `${GRID_SIZE * props.cellSize}px`,
  backgroundSize: `${props.cellSize}px ${props.cellSize}px`,
  touchAction: 'none'
}));

const exitStyle = computed(() => ({
  top: `${2 * props.cellSize}px`,
  height: `${props.cellSize}px`,
  width: `${props.cellSize / 2}px`,
  right: `-${props.cellSize / 2}px`,
}));

function handleDragStart(id: string, event: PointerEvent) {
  const piece = pieces.value.find(p => p.id === id);
  if (!piece) return;

  activePieceId.value = id;
  const rect = boardRef.value?.getBoundingClientRect();
  if (!rect) return;

  if (boardRef.value) {
    boardRef.value.setPointerCapture(event.pointerId);
  }

  if (piece.orientation === 'horizontal') {
    dragOffset.value = event.clientX - rect.left - piece.x * props.cellSize;
  } else {
    dragOffset.value = event.clientY - rect.top - piece.y * props.cellSize;
  }

  moveRange.value = getValidMoveRange(piece, pieces.value);
}

function onPointerMove(event: PointerEvent) {
  if (!activePieceId.value) return;

  const piece = pieces.value.find(p => p.id === activePieceId.value);
  if (!piece) return;

  const rect = boardRef.value?.getBoundingClientRect();
  if (!rect) return;

  if (piece.orientation === 'horizontal') {
    const mouseX = event.clientX - rect.left;
    let newX = Math.round((mouseX - dragOffset.value) / props.cellSize);
    newX = Math.max(moveRange.value.min, Math.min(moveRange.value.max, newX));
    if (newX !== piece.x) {
      piece.x = newX;
      emit('move');
    }
  } else {
    const mouseY = event.clientY - rect.top;
    let newY = Math.round((mouseY - dragOffset.value) / props.cellSize);
    newY = Math.max(moveRange.value.min, Math.min(moveRange.value.max, newY));
    if (newY !== piece.y) {
      piece.y = newY;
      emit('move');
    }
  }
}

function onPointerUp() {
  if (activePieceId.value) {
    if (checkWin(pieces.value)) {
      emit('win');
    }
    activePieceId.value = null;
  }
}

watch(() => props.initialPieces, (newPieces) => {
  pieces.value = JSON.parse(JSON.stringify(newPieces));
}, { deep: true });
</script>

<style scoped>
.board-wrapper {
  padding: 0.625rem;
  background: #333;
  border-radius: 0.5rem;
  border: 0.25rem solid #555;
  box-shadow: inset 0 0 1.25rem rgba(0,0,0,1);
}

.game-board {
  position: relative;
  background: #111;
  background-image: 
    linear-gradient(rgba(255,255,255,0.05) 0.0625rem, transparent 0.0625rem),
    linear-gradient(90deg, rgba(255,255,255,0.05) 0.0625rem, transparent 0.0625rem);
}

.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: repeat(6, 1fr);
  pointer-events: none;
}

.grid-cell {
  border: 0.0625rem solid rgba(255, 255, 255, 0.05);
}

.exit-indicator {
  position: absolute;
  background: rgba(255, 157, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff9d00;
  font-weight: bold;
  border: 0.0625rem solid #ff9d00;
  border-left: none;
  border-radius: 0 0.25rem 0.25rem 0;
  z-index: 1;
}

.exit-arrow {
  animation: blink 1.5s infinite;
}

@keyframes blink {
  0% { opacity: 0.2; }
  50% { opacity: 1; }
  100% { opacity: 0.2; }
}
</style>
