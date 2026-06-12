<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>D&D Club</span></div>
    <h1>Welcome to Drenwal!</h1>
    <p class="intro">Explore resources. Click a thumbnail to view it in a modal.</p>

    <div class="thumb-grid">
      <!-- Image modal thumbnails -->
      <button class="thumb" @click="openImage(fullWorldMap)" aria-label="Open Activity Guide image">
        <img :src="thumbWorldMap" alt="Activity Guide thumbnail" />
        <span class="thumb-label">Activity Guide</span>
      </button>

      <button class="thumb" @click="openImage(fullTheVale)" aria-label="Open Preview image">
        <img :src="thumbTheVale" alt="Syllabus thumbnail" />
        <span class="thumb-label">Preview</span>
      </button>

      <!-- Google Slides in modal -->
      <button class="thumb" @click="openSlides()" aria-label="Open Google Slides in modal">
        <img :src="thumbSlideshow" alt="Slideshow thumbnail" />
        <span class="thumb-label">Slides</span>
      </button>
    </div>

    <!-- Image Lightbox Modal with bounded zoom/pan -->
    <div v-if="showImageModal" class="modal-overlay" @click="closeImage">
      <div class="modal-content" @click.stop>
        <button class="close-button" @click="closeImage" aria-label="Close">&times;</button>

        <!-- Bounded viewport -->
        <div class="image-viewport">
          <img v-if="activeImage" :src="activeImage" class="modal-image" alt="Full view" />
        </div>
      </div>
    </div>

    <!-- Google Slides Modal (existing component) -->
    <PowerPointModal :showModal="showSlidesModal" :pptxUrl="slidesUrl" @close="showSlidesModal = false" />
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import PowerPointModal from '@/components/modals/PowerPointModal.vue';

// Thumbnails
import thumbWorldMap from '@/assets/images/adventure/MapThumb-World-v10-2-min.jpg';
import thumbTheVale from '@/assets/images/adventure/MapThumb-TheVale-min.jpg';
import thumbSlideshow from '@/assets/images/adventure/MapThumb-CAGSign-Season01-min.jpg';

// Full-size images
import fullWorldMap from '@/assets/images/adventure/Map-World-v10-2-min.jpg';
import fullTheVale from '@/assets/images/adventure/Map-TheVale-min.jpg';

// Google Slides URL
const slidesUrl = 'https://docs.google.com/presentation/d/1KVaimCA0t3d0z9-_R71f_XuOZ-3VULHcOXt2R3fxSr8/edit?usp=sharing';

// Simple image modal state
const showImageModal = ref(false);
const activeImage = ref('');

const openImage = (src) => {
  activeImage.value = src;
  showImageModal.value = true;
};

const closeImage = () => {
  showImageModal.value = false;
  activeImage.value = '';
};

// Keyboard: ESC to close modals
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    if (showImageModal.value) closeImage();
    if (showSlidesModal.value) showSlidesModal.value = false;
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

// Slides modal
const showSlidesModal = ref(false);
const openSlides = () => { showSlidesModal.value = true; };
</script>

<style scoped>
@import '../assets/styles/classic.css';

.adventure-page {
  padding: 1rem;
}

.intro { margin-bottom: 0.75rem; }

.thumb-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: darkgreen;
  border: 0.0625rem solid #ccc;
  border-radius: 0;
  cursor: pointer;
  padding: 0.5rem;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.thumb:hover { transform: translateY(-0.0625rem); box-shadow: 0 0.125rem 0.375rem rgba(0,0,0,0.15); }

.thumb img {
  width: 100%;
  height: 8.75rem;
  object-fit: cover;
  border-radius: 0.5rem 0 0 0;
}

.thumb-label {
  color: lightgreen;
  font-size: 0.95rem;
  margin-top: 0.375rem;
}

/* Modal overlay/content */
.modal-overlay {
  position: absolute;              /* cover entire screen */
  top: 1.25rem;
  left: 1.25rem;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.25rem;                /* gutter around content */
  border-radius: 3.75rem 0 0 0;
}

.modal-content {
  position: relative;
  background: #fff;
  border-radius: 1.5rem 0 0 0;
  padding: 0.625rem;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
}

.image-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;             /* clip to box */
  background: #111;
  border-radius: 1rem 0 0 0;
  display: grid;
  place-items: center;
}


/* Modal image */
.modal-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

/* Close button */
.close-button {
  position: absolute;
  top: 0.25rem;
  right: 0.5rem;
  background: transparent;
  border: 0;
  font-size: 2.5rem;
  line-height: 1;
  cursor: pointer;
}

@media (max-width: 50rem) {
  .thumb-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 31.25rem) {
  .thumb-grid { grid-template-columns: 1fr; }
}
</style>
