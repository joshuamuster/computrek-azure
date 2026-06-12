<template>
  <div>

    <div class="lcars-text-bar"><span>Decks on the C.S.S. Curiosity</span></div>

    <div class="coming-soon-hero">
      <img src="@/assets/images/Coming-Soon-Spring-min.jpg" alt="Coming Soon Spring" class="hero-image" />
    </div>
    <h2>Deck Rosters</h2>
    <p>This will subdivide by class/period, and students will only have access to their class/period. Students will
      be grouped by Tables/Science Stations.</p>
    <p>Live long and prosper.</p>

    <!-- Render child deck pages when a nested route (e.g., /decks/deck01) is active -->
    <router-view></router-view>
  </div>
</template>

<script setup lang="ts">
// Add any necessary script logic here
</script>

<style scoped>
.grades-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0 auto;
  min-height: 100%; /* optional if you want it to stretch */
}

.coming-soon-hero {
  flex: none;
  width: 100%;
  height: auto;
  position: relative;
  overflow: hidden;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
