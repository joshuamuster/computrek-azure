<template>
  <router-link :to="`/courses/${section}`" class="lcars-text-bar-link">
    <div class="lcars-text-bar">
      <span>
        <span class="thin">{{ unitId }} -</span> {{ title }}
      </span>
    </div>
  </router-link>
</template>

<script setup>
defineProps({
  section: { type: String, required: true },
  unitId: { type: String, required: true },
  title: { type: String, required: true }
});
</script>

<style scoped>
.lcars-text-bar-link {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.lcars-text-bar span {
  font-weight: 900;
  position: static;
  margin-top: -0.4375rem;
}

.lcars-text-bar .thin {
  font-weight: 100;
  opacity: 0.65;
}

.lcars-text-bar-link:hover .lcars-text-bar {
  opacity: 0.8;
}
</style>
