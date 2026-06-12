<template>
  <div
    class="game-piece"
    :class="[piece.type, piece.orientation]"
    :style="pieceStyle"
    @pointerdown="onPointerDown"
  >
    <div class="piece-inner">
      <div v-if="piece.type === 'shuttle'" class="shuttle-design">
        <div class="shuttle-nose"></div>
        <div class="shuttle-body">
          <div class="shuttle-stripe"></div>
        </div>
      </div>
      <div v-else class="cargo-design">
        <div class="cargo-slat" v-for="n in 3" :key="n"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PieceData } from './puzzles';

const props = defineProps<{
  piece: PieceData;
  cellSize: number;
}>();

const emit = defineEmits<{
  (e: 'drag-start', id: string, event: PointerEvent): void;
}>();

const pieceStyle = computed(() => {
  return {
    width: `${(props.piece.orientation === 'horizontal' ? props.piece.length : 1) * props.cellSize}px`,
    height: `${(props.piece.orientation === 'vertical' ? props.piece.length : 1) * props.cellSize}px`,
    left: `${props.piece.x * props.cellSize}px`,
    top: `${props.piece.y * props.cellSize}px`,
    transition: 'transform 0.05s linear'
  };
});

function onPointerDown(e: PointerEvent) {
  e.preventDefault();
  emit('drag-start', props.piece.id, e);
}
</script>

<style scoped>
.game-piece {
  position: absolute;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  box-sizing: border-box;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.game-piece:active {
  cursor: grabbing;
}

.piece-inner {
  width: 100%;
  height: 100%;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: inset 0 0 0.625rem rgba(0, 0, 0, 0.5);
}

/* Shuttle Styles */
.shuttle .piece-inner {
  background: linear-gradient(135deg, #ff9d00 0%, #ff5e00 100%);
  border: 0.125rem solid #ffcc00;
  z-index: 10;
}

.shuttle-design {
  display: flex;
  align-items: center;
  width: 80%;
  height: 60%;
}

.shuttle-nose {
  width: 20%;
  height: 100%;
  background: #eee;
  border-radius: 50% 0 0 50%;
}

.shuttle-body {
  flex: 1;
  height: 100%;
  background: #ccc;
  display: flex;
  align-items: center;
  padding: 0 0.25rem;
}

.shuttle-stripe {
  width: 100%;
  height: 20%;
  background: #ff9d00;
}

/* Cargo Styles */
.cargo .piece-inner {
  background: linear-gradient(135deg, #444 0%, #222 100%);
  border: 0.125rem solid #666;
  flex-direction: column;
}

.cargo-design {
  width: 80%;
  height: 80%;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
}

.cargo-slat {
  height: 0.25rem;
  background: #555;
  border-radius: 0.125rem;
}

.vertical .cargo-design {
  flex-direction: row;
}

.vertical .cargo-slat {
  width: 0.25rem;
  height: 100%;
}
</style>
