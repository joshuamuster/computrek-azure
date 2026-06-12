<template>
  <div class="admin-layout">
    <div class="admin-layout-content">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  width: 100%;
}

.admin-layout-content {
  flex: 1;
  min-width: 0; /* prevent flex children from overflowing */
  overflow-y: auto;
}
</style>
