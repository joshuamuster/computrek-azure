<!--The main file after you click on a specific Unit-->

<template>
  <div v-if="unitOverview">
    <UnitHeaderBar
      :section="section"
      :unitId="unitOverview.unitId"
      :title="unitOverview.title"
    />
    <p>
      <span>{{ unitOverview.description }}</span>
    </p>

    <div v-if="unitLessons && unitLessons.chapters && unitLessons.chapters.length > 0" class="chapters-row">
      <div class="unit-chapter" v-for="chapter in sortedChapters" :key="chapter.chapter">
        <h3 class="">{{ chapter.chapter }}</h3>
        <p v-if="isStaff"></p>
        <p v-else>{{ chapter.description }}</p>
        <div class="lessons-grid">
          <router-link
            v-for="lesson in chapter.lessons"
            :key="lesson.longId"
            :to="`/courses/${section}/${unitKey}/${lesson.longId}`"
            class="lesson-card"
            @click="playLessonSelectSound"
          >
            <div class="lesson-id">
              {{ lesson.id }}
              <span class="lesson-title" :class="lesson.type === 'project' ? 'project' : 'lesson'">
                {{ lesson.title }}
              </span>
            </div>
          </router-link>
        </div>
      </div>
    </div>
    <div v-else class="coming-soon">
      <h3>Content Coming Soon</h3>
      <p>The lessons for this unit are currently being developed. Please check back later.</p>
    </div>
  </div>
  <div v-else>
    <p>Unit not found.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import UnitHeaderBar from '@/components/courses/UnitHeaderBar.vue'
import lessonsData from '@/assets/data/CourseData.json'
import unit01Data from '@/assets/data/Unit01Data.json'
import unit02Data from '@/assets/data/Unit02Data.json'
import unit03Data from '@/assets/data/Unit03Data.json'
import unit04Data from '@/assets/data/Unit04Data.json'
import unit05Data from '@/assets/data/Unit05Data.json'
import unit06Data from '@/assets/data/Unit06Data.json'
import unit07Data from '@/assets/data/Unit07Data.json'
import unitMMData from '@/assets/data/UnitMMData.json'
import soundFile from '@/assets/sounds/SFX-Computer/keyok1.wav'
import { useAuth } from '@/composables/useAuth.js'

const route = useRoute()
const section = computed(() => route.params.section)
const unitKey = computed(() => route.params.unitKey)

// Auth role flags
const { isStaff } = useAuth()

// Overview/title/description from CourseData.json (used for routing guard too)
const unitOverview = computed(() => {
  const data = lessonsData || {}
  return data?.[section.value]?.[unitKey.value] || null
})

// Detailed lessons for unit01, unit02 and unit03 from their respective data files
const unitLessons = computed(() => {
  if (section.value === 'CompSci') {
    if (unitKey.value === 'unit01') return unit01Data.unit01
    if (unitKey.value === 'unit02') return unit02Data.unit02
    if (unitKey.value === 'unit03') return unit03Data.unit03
    if (unitKey.value === 'unit04') return unit04Data.unit04
    if (unitKey.value === 'unit05') return unit05Data.unit05
    if (unitKey.value === 'unit06') return unit06Data.unit06
    if (unitKey.value === 'unit07') return unit07Data.unit07
  }
  // MultiMedia units sourced from consolidated UnitMMData.json
  if (section.value === 'MultiMedia') {
    return unitMMData?.[unitKey.value] || null
  }
  return null
})

// Sort chapters nicely (e.g., Chapter 00 before Chapter 01)
const sortedChapters = computed(() => {
  if (!unitLessons?.value?.chapters) return []
  const copy = [...unitLessons.value.chapters]
  return copy.sort((a, b) => String(a.chapter).localeCompare(String(b.chapter)))
})

// Play sound when clicking a lesson link
function playLessonSelectSound() {
  try {
    const audio = new Audio(String(soundFile))
    // Avoid unhandled promise rejections on some browsers
    audio.play().catch(() => {})
  } catch (_) {
    // noop
  }
}
</script>

<style scoped>

p {
  font-size: 1rem;
}

/* Chapters laid out side-by-side, each only as tall as its content */
.chapters-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0 2rem;
}

.unit-chapter {
  flex: 1 1 20rem;
  border-top: 0.0625rem solid orange;
  margin: 0.75rem 0 0;
  padding: 1rem 0 2rem;
  h3 {
    letter-spacing: 0.25rem;
    margin-top: 1rem;
  }
}

/* Lessons displayed as cards that wrap onto new rows */
.lessons-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.625rem;
}

.lesson-card {
  background: #222;
  border: 0.0625rem solid #333;
  border-radius: 0.625rem;
  color: inherit;
  display: flex;
  flex-direction: unset;
  max-width: 25rem;
  padding: 0.5rem 0.875rem;
  text-decoration: none;
  /* min-height: 6.875rem; */
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.lesson-card:hover {
  transform: translateY(-0.1875rem);
  border-color: #555;
  box-shadow: 0 0.375rem 1.125rem rgba(0,0,0,0.25);
}

.lesson-id {
  color: antiquewhite;
  font-weight: 400;
  letter-spacing: 0.05em;
  /* margin-bottom: 0.25rem; */
}

.lesson-title {
  color: aliceblue;
  font-size: 0.9rem;
  font-weight: 300;
  line-height: 1.3;
  margin: 0 0 0.5rem 0.75rem;
}

.lesson-title.project { color: var(--champsred); }

.coming-soon {
  color: #aaa; margin-top: 0.75rem;
}

@media (max-width: 43.75rem) {
  .lesson-card { width: calc(50% - 0.5rem); }
}
@media (max-width: 28.75rem) {
  .lesson-card { width: 100%; }
}
</style>
