<template>
  <div class="mancala-board-wrapper">
    <div class="player-title title-2">Player 2</div>
    <div class="mancala-board">
      <!-- Player 2 Store (Left) -->
      <div class="store p2-store">
        <div class="pit-label">P2</div>
        <div class="latinum-container">
          <div v-for="i in Math.min(pits[13], 15)" :key="'p2-store-'+i" class="latinum-piece">
            <img :src="latinumImg" alt="latinum" />
          </div>
          <div v-if="pits[13] > 15" class="more-latinum">+{{ pits[13] - 15 }}</div>
        </div>
        <div class="pit-count">{{ pits[13] }}</div>
      </div>

      <!-- Main Pits Area -->
      <div class="pits-container">
        <!-- Player 2 Pits (Top Row, 12 down to 7) -->
        <div class="pit-row top-row">
          <div class="pit-wrapper" v-for="i in [12, 11, 10, 9, 8, 7]" :key="'pit-'+i">
            <div class="pit-count">{{ pits[i] }}</div>
            <div class="pit p2-pit" :class="{ 'playable': canPlay(i) }" @click="handlePitClick(i)">
              <div class="latinum-container">
                <div v-for="n in Math.min(pits[i], 8)" :key="'pit-'+i+'-'+n" class="latinum-piece small">
                  <img :src="latinumImg" alt="latinum" />
                </div>
                <div v-if="pits[i] > 8" class="more-latinum small">+{{ pits[i] - 8 }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Player 1 Pits (Bottom Row, 0 up to 5) -->
        <div class="pit-row bottom-row">
          <div class="pit-wrapper" v-for="i in [0, 1, 2, 3, 4, 5]" :key="'pit-'+i">
            <div class="pit p1-pit" :class="{ 'playable': canPlay(i) }" @click="handlePitClick(i)">
              <div class="latinum-container">
                <div v-for="n in Math.min(pits[i], 8)" :key="'pit-'+i+'-'+n" class="latinum-piece small">
                  <img :src="latinumImg" alt="latinum" />
                </div>
                <div v-if="pits[i] > 8" class="more-latinum small">+{{ pits[i] - 8 }}</div>
              </div>
            </div>
            <div class="pit-count">{{ pits[i] }}</div>
          </div>
        </div>
      </div>

      <!-- Player 1 Store (Right) -->
      <div class="store p1-store">
        <div class="pit-label">P1</div>
        <div class="latinum-container">
          <div v-for="i in Math.min(pits[6], 15)" :key="'p1-store-'+i" class="latinum-piece">
            <img :src="latinumImg" alt="latinum" />
          </div>
          <div v-if="pits[6] > 15" class="more-latinum">+{{ pits[6] - 15 }}</div>
        </div>
        <div class="pit-count">{{ pits[6] }}</div>
      </div>
    </div>
    <div class="player-title title-1">Player 1</div>
  </div>
</template>

<script setup lang="ts">
import { Player } from './engine';
import latinumImg from '@/assets/images/games/latinum.png';

const props = defineProps<{
  pits: number[];
  turn: Player;
  playable: boolean;
  myColor?: Player;
}>();

const emit = defineEmits<{
  (e: 'move', pitIndex: number): void;
}>();

function canPlay(index: number) {
  if (!props.playable) return false;
  if (props.myColor !== undefined && props.turn !== props.myColor) return false;

  if (props.turn === Player.P1) {
    return index >= 0 && index <= 5 && props.pits[index] > 0;
  } else {
    return index >= 7 && index <= 12 && props.pits[index] > 0;
  }
}

function handlePitClick(index: number) {
  if (canPlay(index)) {
    emit('move', index);
  }
}
</script>

<style scoped>
.mancala-board-wrapper {
  background: #222;
  padding: 1.25rem;
  border-radius: 1rem;
  border: 0.25rem solid #444;
  box-shadow: inset 0 0 1.875rem rgba(0,0,0,1);
  width: 100%;
  max-width: 50rem;
}

.player-title {
  color: #ffc400;
  font-family: 'Antonio', sans-serif;
  font-size: 2rem;
  padding: 0.625rem 0.9375rem;
  text-align: center;
  text-transform: uppercase;
}

.mancala-board {
  display: flex;
  gap: 0.9375rem;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  padding: 0.9375rem;
  border: 0.0625rem solid #333;
  border-radius: 0.5rem;
}

.store {
  width: 5rem;
  height: 15rem;
  border-radius: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 0.9375rem 0;
  position: relative;
}

.title-1 {
  color: var(--champsblue);
}
.title-2 {
  color: var(--champsred);
}

.p1-store, .p1-pit {
  background: #000;
  border: 0.125rem solid var(--champsblue) !important;
}
.p2-store, .p2-pit {
  background: #000;
  border: 0.125rem solid var(--champsred) !important;
}

.pits-container {
  display: flex;
  flex-direction: column;
  gap: 0.9375rem;
}

.pit-row {
  display: flex;
  gap: 0.625rem;
}

.pit-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.pit {
  width: 4.375rem;
  height: 4.375rem;
  background: #000;
  border: 0.125rem solid #555;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: default;
  position: relative;
  transition: all 0.2s ease;
}

.pit.playable {
  cursor: pointer;
  border-color: #ffc400;
  box-shadow: 0 0 0.625rem rgba(255, 196, 0, 0.2);
}

.pit.playable:hover {
  background: #111;
  transform: scale(1.05);
  box-shadow: 0 0 0.9375rem rgba(255, 196, 0, 0.4);
}

.pit-label {
  font-family: 'Antonio', sans-serif;
  color: #ffc400;
  font-size: 0.8rem;
  margin-bottom: 0.3125rem;
}

.pit-count {
  font-family: 'Antonio', sans-serif;
  color: #fff;
  font-size: 1.35rem;
  font-weight: bold;
}

.latinum-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  padding: 0.3125rem;
  pointer-events: none;
  overflow: hidden;
}

.latinum-piece {
  width: 1.25rem;
  height: 1.25rem;
  margin: -0.125rem;
}

.latinum-piece.small {
  width: 0.9375rem;
  height: 0.9375rem;
}

.latinum-piece img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 0.125rem rgba(255, 255, 255, 0.5));
}

.more-latinum {
  color: #aaa;
  font-size: 0.6rem;
  font-weight: bold;
}

.more-latinum.small {
  font-size: 0.5rem;
}

@media (max-width: 43.75rem) {
  .mancala-board-wrapper {
    padding: 0.625rem;
  }
  .mancala-board {
    gap: 0.3125rem;
    padding: 0.3125rem;
  }
  .store {
    width: 3.125rem;
    height: 10rem;
  }
  .pit {
    width: 3.125rem;
    height: 3.125rem;
  }
  .pit-count {
    font-size: 0.9rem;
  }
}
</style>
