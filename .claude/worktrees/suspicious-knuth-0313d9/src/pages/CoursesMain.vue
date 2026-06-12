<template>
  <div>
<!--    <h2>2025-2026 Academic Year</h2>-->

    <!-- Role- and section-aware intros -->
    <template v-if="activeSection === 'CompSci'">
      <p class="subheader" v-if="isCadet">
        Computer Science Discoveries is an introductory mission in the exploration of digital frontiers, where cadets learn and apply the foundations of computer usage alongside the principles of programming. This course empowers students to create authentic digital artifacts and engage with computer science as a medium for innovation, communication, problem-solving, and discovery—charting new territories where creativity meets technology.
      </p>
      <p class="subheader" v-else-if="isParent">
        Welcome to your child's Computer Science Discoveries journey! Here you can explore the course units your student will be working through this year. Each unit builds foundational skills in computer science while encouraging creativity and problem-solving. Feel free to browse the curriculum to stay informed about your child's learning progress.
      </p>
      <p class="subheader" v-else-if="isStaff">
        Administrative overview of Computer Science Discoveries curriculum for the 2025-2026 academic year. This comprehensive course structure provides students with foundational computer science skills through hands-on projects and collaborative learning. Monitor student progress and course completion through the various units below.
      </p>
    </template>

    <template v-else-if="activeSection === 'MultiMedia'">
      <p class="subheader" v-if="isCadet">
        Intro to Multimedia explores design, branding, layout, and motion graphics. You’ll create authentic visual artifacts while learning how typography, color, and composition communicate ideas—blending creativity with practical production skills.
      </p>
      <p class="subheader" v-else-if="isParent">
        Welcome to Intro to Multimedia. This course builds visual communication skills through hands-on projects in design and media. Browse the modules below to see what your student will be learning and creating this year.
      </p>
      <p class="subheader" v-else-if="isStaff">
        Administrative overview of Intro to Multimedia for the 2025–2026 academic year. Track module progression, design competencies, and project milestones across the units listed below.
      </p>
    </template>

    <template v-else-if="activeSection === 'Supports'">
      <p class="subheader" v-if="isCadet">
        These are the support platforms used alongside your coursework. Click a thumbnail to open its instruction slideshow, or the link below to launch the app.
      </p>
      <p class="subheader" v-else-if="isParent">
        These are the supplemental tools your student uses in class. Click a thumbnail to view setup and usage instructions for each platform.
      </p>
      <p class="subheader" v-else-if="isStaff">
        Support platforms deployed alongside course curriculum. Click a thumbnail to open its instruction slideshow, or the link to open the app directly.
      </p>
    </template>

    <template v-else-if="activeSection === 'Documents'">
      <p class="subheader">
        Click a document thumbnail to view the PDF, then download or print.
        &nbsp;|&nbsp; <em>¡Haga clic en un documento para verlo en PDF y luego descárguelo o imprímalo!</em>
      </p>
    </template>

    <!-- Section Tabs (mini navigation) -->
    <div v-if="isStaff || isAdmin" class="tabs">
      <router-link
          v-for="sectionName in orderedSections"
          :key="sectionName"
          :to="`/courses/${encodeURIComponent(sectionName)}`"
          :class="['tab', { active: activeSection === sectionName }]"
      >
        {{ displayLabel(sectionName) }}
      </router-link>
    </div>

    <!-- Units for active tab (CompSci / MultiMedia) -->
    <section v-if="activeSection !== 'Supports' && sections[activeSection]" class="section-block">
      <h3 class="lcars-text-bar"><span>{{ displayLabel(activeSection) }}</span></h3>

      <div class="unit-container">
        <router-link
            v-for="(unit, unitKey) in sections[activeSection]"
            :key="`${activeSection}-${unitKey}`"
            :to="`/courses/${encodeURIComponent(activeSection)}/${encodeURIComponent(unitKey)}`"
            class="unit-card"
            @click="playUnitSelectSound"
        >
          <h4><span>{{ unit.unitId }}</span> {{ unit.title }}</h4>
          <p>{{ unit.summary }}</p>
        </router-link>
      </div>

      <!-- Multimedia extras: Google Slides modal trigger -->
      <template v-if="activeSection === 'MultiMedia'">
        <div class="embed-actions">
          <button class="embed-btn" @click="showSlidesModal = true" aria-label="Open Google Slides for Multimedia course">
            Course Slides
          </button>
        </div>
        <PowerPointModal :showModal="showSlidesModal" :pptxUrl="slidesUrl" @close="showSlidesModal = false" />
      </template>
    </section>

    <!-- Supports tab content -->
    <section v-else-if="activeSection === 'Supports'" class="section-block">
      <h3 class="lcars-text-bar"><span>Support Systems</span></h3>
      <p class="supports-hint">Click a thumbnail to open its instruction slideshow. The link below opens the app.</p>

      <div class="thumbs-row">
        <div v-for="app in SUPPORT_APPS" :key="app.name" class="thumb-card">
          <div
              class="thumb-img-link"
              role="button"
              tabindex="0"
              :aria-label="`Open slideshow: ${app.name}`"
              @click="openSupportSlideshow(app.slideshowUrl)"
              @keydown.enter="openSupportSlideshow(app.slideshowUrl)"
              @keydown.space.prevent="openSupportSlideshow(app.slideshowUrl)"
          >
            <img :src="app.img" :alt="app.name" class="thumb-img" />
          </div>
          <div class="thumb-label">{{ app.name }}</div>
          <a :href="app.appUrl" target="_blank" rel="noopener" class="thumb-link">{{ app.name }}</a>
        </div>
      </div>

      <PowerPointModal :showModal="showSupportsModal" :pptxUrl="currentSupportUrl" @close="showSupportsModal = false" />
    </section>

    <!-- Documents tab content -->
    <section v-else-if="activeSection === 'Documents'" class="section-block">
      <h3 class="lcars-text-bar"><span>Documents</span></h3>

      <div class="team-docs-container">

        <!-- Mr. Jones -->
        <div class="doc-section">
          <div class="teacher-header">
            <img :src="teacherJones" alt="Photo of Mr. Jones" class="teacher-photo" />
            <h2>Mr. Jones's Docs</h2>
          </div>
          <div class="subsection-row">
            <div class="subsection">
              <h3 class="subsection-title">English</h3>
              <div class="docborder">
                <div class="doccard">
                  <div @click="openPdf(pdfJonesCS)" title="Open Syllabus PDF" class="doc-thumb-wrap">
                    <img :src="thumbJonesCS" alt="Mr. Jones's CS Syllabus" class="doc-thumb" />
                  </div>
                  <div class="tag-name">Mr. Jones's Syllabus</div>
                  <p class="tag-syllabus">Introduction to<br />Computer Science</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mr. Muster -->
        <div class="doc-section">
          <div class="teacher-header">
            <img :src="teacherMuster" alt="Photo of Mr. Muster" class="teacher-photo" />
            <h2>Mr. Muster's Docs</h2>
          </div>
          <div class="subsection-row">
            <div class="subsection">
              <h3 class="subsection-title">English</h3>
              <div class="docborder">
                <div class="doccard">
                  <div @click="openPdf(pdfCSeng)" title="Open Syllabus PDF" class="doc-thumb-wrap">
                    <img :src="thumbCS" alt="Mr. Muster's CS Syllabus" class="doc-thumb" />
                  </div>
                  <div class="tag-name">Mr. Muster's Syllabus</div>
                  <p class="tag-syllabus">Introduction to<br />Computer Science</p>
                </div>
                <div class="doccard">
                  <div @click="openPdf(pdfMM)" title="Open Syllabus PDF" class="doc-thumb-wrap">
                    <img :src="thumbMM" alt="Mr. Muster's Multimedia Syllabus" class="doc-thumb" />
                  </div>
                  <div class="tag-name">Mr. Muster's Syllabus</div>
                  <p class="tag-syllabus">Introduction to<br />Multimedia</p>
                </div>
              </div>
            </div>
            <div class="subsection">
              <h3 class="subsection-title">Español</h3>
              <div class="docborder">
                <div class="doccard">
                  <div @click="openPdf(pdfCSspa)" title="Open Syllabus PDF" class="doc-thumb-wrap">
                    <img :src="thumbCS" alt="Sr. Muster's CS Syllabus (Spanish)" class="doc-thumb" />
                  </div>
                  <div class="tag-name">Sr. Muster's programa</div>
                  <p class="tag-syllabus">Introducción à la<br />Ciencia de la Computación</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      <PdfModal :showModal="showPdfModal" :pdfUrl="currentPdfUrl" @close="showPdfModal = false" />
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import lessonsData from '@/assets/data/CourseData.json'
import { useAuth } from '@/composables/useAuth.js'
import PowerPointModal from '@/components/modals/PowerPointModal.vue'
import thumbTyping from '@/assets/images/support-typingClub-min.jpg'
import thumbIready from '@/assets/images/support-iready-min.jpg'
import thumbImago  from '@/assets/images/support-imago-min.jpg'
import PdfModal    from '@/components/modals/PdfModal.vue'
import thumbCS     from '@/assets/images/Thumbnail-Syllabus-cs-min.jpg'
import thumbMM     from '@/assets/images/Thumbnail-Syllabus-imm-min.jpg'
import thumbJonesCS from '@/assets/images/Thumbnail-Jones-Syllabus-cs-min.jpg'
import teacherMuster from '@/assets/images/staff/ct-teacher-tech-muster-min.jpg'
import teacherJones  from '@/assets/images/staff/ct-teacher-tech-jones-min.jpg'
import pdfCSeng from '@/assets/documents/Syllabus-2526-CS-v1-english.pdf'
import pdfCSspa from '@/assets/documents/Syllabus-2526-CS-v1-spanish.pdf'
import pdfMM    from '@/assets/documents/Syllabus-2526-MM-v1.pdf'
import pdfJonesCS from '@/assets/documents/Jones-Syllabus-2526-v1.pdf'
const { isCadet, isParent, isStaff, isAdmin } = useAuth()

// Map internal keys to friendly labels
const sectionLabels = {
  CompSci:    'Intro to Computer Science',
  MultiMedia: 'Intro to Multimedia',
  Supports:   'Supports',
  Documents:  'Documents',
}

// Expect grouped JSON: { CompSci: {...}, MultiMedia: {...} }
const sections = computed(() => ({
  CompSci:    lessonsData.CompSci    || {},
  MultiMedia: lessonsData.MultiMedia || {},
}))

// Stable tab order and valid section names
const orderedSections = ['CompSci', 'MultiMedia', 'Supports', 'Documents']

// Active section is driven by the route param, defaulting to CompSci
const route = useRoute()
const activeSection = computed(() => {
  const param = String(route.params.section || '')
  return orderedSections.includes(param) ? param : 'CompSci'
})

// Label helper
const displayLabel = (sectionName) => sectionLabels[sectionName] || sectionName

const playUnitSelectSound = () => {
  try {
    const audio = new Audio('/src/assets/sounds/SFX-Computer/keyok1.wav')
    audio.play().catch((error) => console.warn('Could not play sound:', error))
  } catch (error) {
    console.warn('Error creating audio:', error)
  }
}

// Google Slides modal for Multimedia section
const showSlidesModal = ref(false)
const slidesUrl = 'https://docs.google.com/presentation/d/11ervYyOZcU98di2ADf6Oq9pg-QxjdtJsS-ei0PnePmk/edit?usp=sharing'

// ── Supports tab ──────────────────────────────────────────────────────────────

const SUPPORT_APPS = [
  {
    name: 'TypingClub',
    img: thumbTyping,
    slideshowUrl: 'https://docs.google.com/presentation/d/1MNjNCyqPlLMc4SaUSZBxk8hCgzoWssRixj5skmUYv30/edit?usp=sharing/view',
    appUrl: 'https://clever.com/in/fresnounified/teacher/collections/fa469cf6-16fb-4045-b3c6-396d040a6991',
  },
  {
    name: 'i-Ready',
    img: thumbIready,
    slideshowUrl: 'https://docs.google.com/presentation/d/1fFl58Jddbqm210uWWUYrIDj9omVpqzUukw2Vyx1u-cs/edit?usp=sharing/view',
    appUrl: 'https://clever.com/in/fresnounified/teacher/collections/fa469cf6-16fb-4045-b3c6-396d040a6991',
  },
  {
    name: 'Imago',
    img: thumbImago,
    slideshowUrl: 'https://docs.google.com/presentation/d/1xbaYrBmpXAqipsseN7SMrzmBMNZsC9jqnlRfHHxGEgY/edit?usp=sharing/view',
    appUrl: 'https://clever.com/in/fresnounified/teacher/collections/fa469cf6-16fb-4045-b3c6-396d040a6991',
  },
]

const showSupportsModal  = ref(false)
const currentSupportUrl  = ref('')
const openSupportSlideshow = (url) => {
  currentSupportUrl.value  = url
  showSupportsModal.value  = true
}

// ── Documents tab ─────────────────────────────────────────────────────────────

const showPdfModal   = ref(false)
const currentPdfUrl  = ref('')
const openPdf = (url) => {
  currentPdfUrl.value  = url
  showPdfModal.value   = true
}
</script>

<style scoped>
.subheader {
  color: #999;
  font-size: 1em;
  font-style: italic;
  font-weight: 100;
  margin-bottom: 1rem;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.tab {
  background: #333;
  border: 0.0625rem solid #444;
  border-radius: 0.375rem 0.375rem 0 0;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: 500;
  color: #ccc;
  transition: background 0.2s ease, color 0.2s ease;
}
.tab.active {
  background: #222;
  border-bottom: 0.0625rem solid #222;
  color: #ffd27a;
}
.tab:hover {
  background: #2a2a2a;
  color: #fff;
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 0;
}

.section-title {
  margin: 0 0 0.75rem 0;
  font-size: 1.4rem;
  letter-spacing: 0.02em;
  color: #ffd27a;
}

.unit-container {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fill, minmax(18.75rem, 1fr));
  /* grid-template-columns: repeat(2, minmax(0, 1fr)); */
}

.unit-card {
  background-color: #222;
  border: 0.0625rem solid #333;
  border-radius: 0.75rem;
  color: inherit;
  cursor: pointer;
  display: block;
  padding: 1.125rem 1.25rem;
  text-decoration: none;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}
.unit-card h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
}
.unit-card h4 span {
  color: #ff9800;
}
.unit-card p {
  color: #cfcfcf;
  font-size: 0.8rem;
  margin-bottom: 0;
}
.unit-card:hover {
  transform: translateY(-0.3125rem);
  border-color: #555;
  box-shadow: 0 0.375rem 1.125rem rgba(0, 0, 0, 0.25);
}

/* ── Supports tab ── */
.supports-hint {
  color: #888; font-size: 0.9rem; margin: 0 0 1rem;
}

.thumbs-row {
  display: flex; gap: 1.25rem; flex-wrap: wrap; margin-top: 0.5rem;
}

.thumb-card {
  display: inline-flex; flex-direction: column;
  align-items: center; width: 11.25rem;
}

.thumb-img-link {
  display: inline-block; cursor: pointer;
}

.thumb-img {
  width: 10rem; height: auto;
  border: 0.0625rem solid #444; border-radius: 0.375rem;
  transition: border-color 0.2s, transform 0.2s;
}
.thumb-img-link:hover .thumb-img {
  border-color: #ffd27a; transform: translateY(-0.15rem);
}

.thumb-label {
  margin-top: 0.4rem; color: #eee;
  font-size: 0.95rem; text-align: center;
}

.thumb-link {
  margin-top: 0.25rem; font-size: 0.8rem;
  color: #99ccff; text-align: center;
  text-decoration: none; border-bottom: 0.0625rem solid rgba(153,204,255,0.3);
  transition: color 0.15s;
}
.thumb-link:hover { color: #ffd27a; }

/* ── Documents tab ── */
.team-docs-container {
  display: flex; flex-wrap: wrap; gap: 2rem;
}
.doc-section {
  display: inline-block; vertical-align: top; margin-top: 1rem;
}
.teacher-header {
  display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;
}
.teacher-header h2 { margin: 0; font-size: 1.2rem; color: #e6f0ff; }
.teacher-photo {
  width: 2.75rem; height: 2.75rem; border-radius: 50%;
  object-fit: cover; border: 0.125rem solid #556;
}
.subsection-row { display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 0.5rem; }
.subsection-title { margin: 0.25rem 0; font-size: 1.1rem; color: #ff9900; }
.docborder { display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 0.75rem; }
.doccard { text-align: center; width: 7.5rem; }
.doc-thumb-wrap { display: inline-block; cursor: pointer; }
.doc-thumb {
  width: 7.5rem; height: auto;
  border: 0.0625rem solid #444; border-radius: 0.25rem;
  transition: border-color 0.2s, transform 0.2s;
}
.doc-thumb-wrap:hover .doc-thumb { border-color: #ffd27a; transform: translateY(-0.15rem); }
.tag-name { color: #e6f0ff; font-size: 0.9rem; margin: 0.4rem auto 0; }
.tag-syllabus { font-size: 0.78rem; color: #99ccff; margin: 0.2rem auto 0; }

/* Embed button area for Multimedia */
.embed-actions {
  margin-top: 0.5rem;
}
.embed-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #333;
  color: #ffd27a;
  border: 0.0625rem solid #444;
  border-radius: 0.5rem;
  padding: 0.625rem 0.875rem;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}
.embed-btn:hover {
  background: #2a2a2a;
  color: #fff;
  transform: translateY(-0.0625rem);
}
</style>
