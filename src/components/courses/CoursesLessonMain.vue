
<template>
  <div v-if="unit">
    <UnitHeaderBar
      :section="section"
      :unitId="unit.unitId"
      :title="unit.title"
    />

    <div v-if="lesson">
      <LessonLayout
        :id="lesson.id"
        :title="lesson.title"
        :overview="lesson.overview"
        :objectives="objectives"
        :resources="resources"
        :unitLinkPath="`/courses/${section}/${unitKey}`"
        />
      <component v-if="lessonWidget" :is="lessonWidget" />
    </div>

    <div v-else class="fallback">
      <p>Lesson data not found for {{ unitKey }}/{{ lessonId }}.</p>
      <p>Content coming soon.</p>
    </div>
  </div>

  <div v-else>
    <p>Lesson not found.</p>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useDriveFiles } from "@/composables/useDriveFiles";

import lessonsData from "@/assets/data/CourseData.json";
import unit01Data from "@/assets/data/Unit01Data.json";
import unit02Data from "@/assets/data/Unit02Data.json";
import unit03Data from "@/assets/data/Unit03Data.json";
import unit04Data from "@/assets/data/Unit04Data.json";
import unit05Data from "@/assets/data/Unit05Data.json";
import unit06Data from "@/assets/data/Unit06Data.json";
import unit07Data from "@/assets/data/Unit07Data.json";
import unitMMData from "@/assets/data/UnitMMData.json";

import UnitHeaderBar from "@/components/courses/UnitHeaderBar.vue";
import LessonLayout from "@/components/courses/LessonLayout.vue";
import { resolveResources } from "@/utils/resourceResolver";

// ── Unit 05 interactive widgets (static imports) ──────────────────────────
import L01 from "@/components/courses/data-society/L01CrewMealSort.vue";
import L02 from "@/components/courses/data-society/L02EncodingBuilder.vue";
import L03 from "@/components/courses/data-society/L03SubspaceDecoder.vue";
import L04 from "@/components/courses/data-society/L04HolodeckImager.vue";
import L05 from "@/components/courses/data-society/L05WarpCorePower.vue";
import L06 from "@/components/courses/data-society/L06PersonnelRecord.vue";
import L07 from "@/components/courses/data-society/L07KlingonDecrypt.vue";

const unit05Widgets = {
  Lesson01: L01, Lesson02: L02, Lesson03: L03, Lesson04: L04,
  Lesson05: L05, Lesson06: L06, Lesson07: L07,
};

const route = useRoute();

// ── Google Drive file map ──────────────────────────────────────────────────
const { driveFileMap, loadDriveFiles } = useDriveFiles();
onMounted(() => loadDriveFiles());

const section = computed(() => route.params.section);
const unitKey = computed(() => route.params.unitKey);
const lessonId = computed(() => route.params.lessonId);

const unit = computed(() => {
  const data = lessonsData || {};
  return data?.[section.value]?.[unitKey.value] || null;
});

// -----------------------------
// Load lessons for this unit
// -----------------------------
const unitLessons = computed(() => {
  if (section.value === "CompSci") {
    if (unitKey.value === "unit01") return unit01Data.unit01;
    if (unitKey.value === "unit02") return unit02Data.unit02;
    if (unitKey.value === "unit03") return unit03Data.unit03;
    if (unitKey.value === "unit04") return unit04Data.unit04;
    if (unitKey.value === "unit05") return unit05Data.unit05;
    if (unitKey.value === "unit06") return unit06Data.unit06;
    if (unitKey.value === "unit07") return unit07Data.unit07;
  }
  if (section.value === "MultiMedia") return unitMMData?.[unitKey.value] || null;
  return null;
});

// -----------------------------
// Select the lesson from chapters
// -----------------------------
const lesson = computed(() => {
  const ul = unitLessons.value;
  if (!ul?.chapters) return null;
  for (const ch of ul.chapters) {
    const found = ch.lessons?.find(
        (l) => String(l.longId) === String(lessonId.value)
    );
    if (found) return found;
  }
  return null;
});

// -----------------------------
// Objectives
// -----------------------------
const objectives = computed(() => {
  if (!lesson.value) return [];
  const keys = ["objective1", "objective2", "objective3", "objective4", "objective5"];
  return keys.map((k) => lesson.value[k]).filter(Boolean);
});

// ── Dynamic widget for the current lesson ────────────────────────────────
const lessonWidget = computed(() => {
  if (unitKey.value !== "unit05") return null;
  return unit05Widgets[lessonId.value] ?? null;
});

// -----------------------------
// NEW: Data-driven resources list
// -----------------------------
const resources = computed(() => {
  if (!lesson.value) return [];
  const input = lesson.value.resources; // from JSON (optional)
  return resolveResources(
      String(section.value),
      String(unitKey.value),
      String(lessonId.value),
      lesson.value,
      input,
      driveFileMap.value
  );
});
</script>

<style scoped>
.fallback {
  color: #aaa;
  margin-top: 0.75rem;
}
</style>
