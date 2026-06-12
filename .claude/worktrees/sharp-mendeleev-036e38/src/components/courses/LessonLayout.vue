
<template>
  <div class="FittedTitle">
    <router-link :to="unitLinkPath" class="lesson-title-link">
      <h2><span class="thin">Lesson {{ id }} //</span> {{ title }}</h2>
    </router-link>

    <div class="title-fill">
      <span
          class="fill-box"
          v-for="(w, i) in fillWidths"
          :key="i"
          :style="{ flex: `${w} 1 0` }"
      />
    </div>
  </div>

  <div class="LessonContent">
    <div class="LessonText">
      <p>{{ overview }}</p>

      <p class="b">Students should be able to:</p>
      <ul class="objectives-list">
        <li v-for="(obj, index) in objectives" :key="index">{{ obj }}</li>
      </ul>
    </div>

    <!-- ========================================= -->
    <!--   NEW Resource Grid                       -->
    <!-- ========================================= -->
    <div class="thumbnail-container">
      <div
          v-for="(res, index) in visibleResources"
          :key="res.type + index"
          class="resource-wrapper"
      >
        <img
          :src="res.thumb"
          :alt="res.label"
          :class="res.url ? 'thumbnail-clickable' : 'thumbnail-no-link'"
          @click="res.url ? openResource(res) : null"
        />
      </div>
    </div>

    <!-- Modals -->
    <PdfModal
        :showModal="showPdfModal"
        :pdfUrl="selectedPdfUrl"
        @close="showPdfModal = false"
    />

    <PowerPointModal
        :showModal="showPowerPointModal"
        :pptxUrl="pptxUrlForModal"
        @close="showPowerPointModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useAuth } from "@/composables/useAuth.js";
import PdfModal from "@/components/modals/PdfModal.vue";
import PowerPointModal from "@/components/modals/PowerPointModal.vue";
import type { ResolvedResource } from "@/types/resources";

// -----------------------------
// Props
// -----------------------------
const props = defineProps<{
  id: string;
  title: string;
  overview: string;
  objectives: string[];
  unitLinkPath: string;

  // NEW
  resources?: ResolvedResource[];
}>();

// -----------------------------
// Admin / Staff gating
// -----------------------------
const { isAdmin, isStaff } = useAuth();
const canSeeRestricted = computed(() => isAdmin.value || isStaff.value);

// -----------------------------
// Modal state
// -----------------------------
const showPdfModal = ref(false);
const showPowerPointModal = ref(false);

const selectedPdfUrl = ref("");
const pptxUrlForModal = ref("");

// -----------------------------
// Helpers for opening files
// -----------------------------
function openPdf(url: string) {
  selectedPdfUrl.value = url;
  showPdfModal.value = true;
}

function openPptx(url: string) {
  pptxUrlForModal.value = url;
  showPowerPointModal.value = true;
}

function openLink(url: string) {
  window.open(url, "_blank", "noopener");
}

function openResource(res: ResolvedResource) {
  if (res.format === "pdf") return openPdf(res.url);
  if (res.format === "pptx") return openPptx(res.url);
  return openLink(res.url);
}

// -----------------------------
// Use the new resources[] array
// but keep legacy props around.
// -----------------------------
const allResources = computed(() => props.resources ?? []);

// Filter based on staff-only visibility
const visibleResources = computed(() => {
  return allResources.value.filter(
      (r) => r.visibility === "all" || canSeeRestricted.value
  );
});

// -----------------------------
// LCARS bar fill widths
// -----------------------------
const fillWidths = [10, 12, 20, 24, 30, 36];
</script>

<style scoped>
@import "@/assets/styles/lessonStyles.css";

/* Preserve your existing styling */

.lesson-title-link {
  text-decoration: none;
}

.thin {
  font-weight: 100;
  opacity: 0.65;
}

.resource-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 8.125rem;
}


.thumbnail-container {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin: 1.875rem 1.25rem 0;
}

.thumbnail-clickable {
  cursor: pointer;
  max-width: 7.5rem;
  height: auto;
  border-radius: 3.75rem;
  border: solid 0.125rem skyblue;
  transition: transform 0.2s, box-shadow 0.2s;
}

.thumbnail-clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.2);
}

.thumbnail-no-link {
  max-width: 7.5rem;
  height: auto;
  border-radius: 3.75rem;
  border: solid 0.125rem #333;
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
