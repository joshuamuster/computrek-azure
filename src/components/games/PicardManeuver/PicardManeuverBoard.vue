<template>
  <div class="picard-maneuver-board-wrapper">
    <div class="picard-maneuver-board">
      <div 
        v-for="(row, y) in board" 
        :key="y" 
        class="board-row"
      >
        <div 
          v-for="(cell, x) in row" 
          :key="x" 
          class="board-cell"
          :class="{ 'can-move': canMove(x, y) }"
          @click="handleCellClick(x, y)"
        >
          <img v-if="cell !== 0" :src="cell === 1 ? ringWhite : ringBlack" class="piece" :class="cell === 1 ? 'white' : 'black'" />
          <div v-else-if="canMove(x, y)" class="move-indicator"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PieceColor, BOARD_SIZE, isValidMove } from './engine';
import ringWhite from '@/assets/images/games/ring-white.svg';
import ringBlack from '@/assets/images/games/ring-black.svg';

const props = defineProps<{
  board: PieceColor[][];
  turn: PieceColor;
  playable: boolean;
}>();

const emit = defineEmits<{
  (e: 'move', x: number, y: number): void;
}>();

function canMove(x: number, y: number) {
  if (!props.playable) return false;
  return isValidMove(props.board, x, y, props.turn);
}

function handleCellClick(x: number, y: number) {
  if (canMove(x, y)) {
    emit('move', x, y);
  }
}
</script>

<style scoped>
.picard-maneuver-board-wrapper {
  background: #222;
  padding: 0.625rem;
  border-radius: 0.25rem;
  border: 0.25rem solid #444;
  box-shadow: inset 0 0 1.25rem rgba(0,0,0,1);
}

.picard-maneuver-board {
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  border: 0.0625rem solid #333;
}

.board-row {
  display: flex;
}

.board-cell {
  width: 3.125rem;
  height: 3.125rem;
  border: 0.0625rem solid #333;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  position: relative;
  transition: background-color 0.2s ease;
}

.board-cell.can-move {
  cursor: pointer;
}

.board-cell.can-move:hover {
  background-color: rgba(153, 204, 255, 0.1);
}

.piece {
  width: 90%;
  height: 90%;
  transition: all 0.3s ease;
  pointer-events: none;
}

.piece.white {
  filter: drop-shadow(0 0 0.3125rem #FFFFFF);
}

.piece.black {
  filter: drop-shadow(0 0 0.3125rem #00E1FF);
}

.move-indicator {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  background-color: rgba(153, 204, 255, 0.3);
}

@media (max-width: 31.25rem) {
  .board-cell {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
