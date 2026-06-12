<template>

  <div class="hud-wrap">
    <img class="brace-thin brace-l" :src="BraceThin1L" alt="" />
    <Timers />
    <img class="brace-thin brace-r" :src="BraceThin1R" alt="" />

    <img class="brace-thin brace-l" :src="BraceThin1L" alt="" />
    <TypingReport />
    <img class="brace-thin brace-r" :src="BraceThin1R" alt="" />

    <img class="brace-thin brace-l" :src="BraceThin1L" alt="" />
    <HudShip />
    <img class="brace-thin brace-r" :src="BraceThin1R" alt="" />

    <img class="brace-thin brace-l" :src="BraceThin1L" alt="" />
    <MissionReports />
    <img class="brace-thin brace-r" :src="BraceThin1R" alt="" />
  </div>

<!--  <BathroomTimer />-->
</template>

<script setup>
import Timers   from './hud/Timers.vue'
import BathroomTimer  from './timers/Bathroom-Timer.vue'
import TypingReport   from './hud/TypingReport.vue'
import HudShip        from './hud/HudShip.vue'
import MissionReports from './hud/MissionReports.vue'
import BraceThin1L    from '../assets/images/hud/BraceThin-1L.svg'
import BraceThin1R    from '../assets/images/hud/BraceThin-1R.svg'
import { useCountdownTimer } from '@/composables/useCountdownTimer'

const { toggleCountdownPopup } = useCountdownTimer()
</script>

<style scoped>
@import '../assets/styles/classic.css';
@import '../assets/styles/hud.css';

/* ── HUD wrapper ─────────────────────────────────────────────────────────── */
.hud-wrap {
  display:     flex;
  align-items: center;
  flex:        3;
  gap:         0;
  /* overflow:    hidden; */
  height:      stretch;
  font-family: 'Press Start 2P', monospace;
}

/* ── Brace images ────────────────────────────────────────────────────────── */
.brace-thin {
  height: 100%;
}

.brace-r {
  margin-left:  -1.65rem;
  //margin-right: 0.5rem;
}

.brace-l {
  margin-left:  0.5rem;
  margin-right: -1.65rem;
}
</style>
