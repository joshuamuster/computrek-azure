<template>
    <div class="hud-panel">
      <div class="panel-title">Stellar Chronology</div>
      <Chrono1Timer />
      <Chrono2Timer />
      <Chrono3Timer />
    </div>
</template>

<script setup>
import Chrono1Timer   from '@/components/timers/Chrono1Timer.vue'
import Chrono2Timer   from '@/components/timers/Chrono2Timer.vue'
import Chrono3Timer   from '@/components/timers/Chrono3Timer.vue'
</script>

<style scoped>
@import '@/assets/styles/classic.css';
@import '@/assets/styles/hud.css';

.hud-panel {
  flex: initial !important;
  padding-left: 1.5rem !important;
  padding-right: 1.5rem !important;
}
</style>
