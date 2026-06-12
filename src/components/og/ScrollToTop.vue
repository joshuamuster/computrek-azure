<template>
  <!-- This component provides scroll-to-top functionality -->
</template>

<script setup>
import { onMounted } from 'vue';

// Define props to allow customization
const props = defineProps({
  // Whether to automatically scroll to top when component mounts
  autoScrollOnMount: {
    type: Boolean,
    default: false
  }
});

// Scroll to top function with smooth behavior
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};

// Auto scroll on mount if enabled
onMounted(() => {
  if (props.autoScrollOnMount) {
    scrollToTop();
  }
});

// Expose the scrollToTop function so parent components can call it
defineExpose({
  scrollToTop
});
</script>

<style scoped>
/* No styles needed for this utility component */
</style>
