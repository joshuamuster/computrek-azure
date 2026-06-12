<template>
  <div>

    <div v-if="isCadet">
      <h4 class="">Instructional Approach:</h4>
      <p>You're not supposed to be here!</p>
    </div>


    <div v-if="isParent">
      <h4 class="">Course Purpose:</h4>
      <p>This isn't the page you're looking for. You can go about your business. Move along.</p>
    </div>


    <div v-if="isStaff">
      <div class="crew-grid">
        <div
            v-for="member in technical"
            :key="member.name"
            class="crew-card"
            :style="{ borderColor: divisionColors.gold }"
        >
          <div class="crew-content">
            <img
              :src="member.photo"
              :alt="member.name"
              class="crew-photo"
              :style="{ borderColor: divisionColors.gold, cursor: 'pointer' }"
              @click="openSlides(member)"
            />
          </div>
        </div>
      </div>

      <!-- Modal Overlay for Google Slides -->
      <div v-if="showModal" class="modal-overlay" role="dialog" aria-modal="true" @click="closeModal">
        <div class="modal-content">
          <button class="modal-close" @click="closeModal" aria-label="Close">×</button>
          <iframe
            v-if="currentSlideSrc"
            class="slides-frame"
            :src="currentSlideSrc"
            frameborder="0"
            allowfullscreen
            @click.stop
          ></iframe>
        </div>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useAuth } from '@/composables/useAuth.js';

interface CrewMember {
  name: string
  rank: string
  bio: string
  photo: string
}
import crewData from '@/assets/data/crew.json';
import teacherJones from '@/assets/images/staff/ct-teacher-tech-jones-min.jpg'
import teacherMuster2 from '@/assets/images/staff/ct-teacher-tech-muster-min.jpg'
import placeholder from '@/assets/images/CompuTrekLogo.svg'
const { isCadet, isParent, isStaff } = useAuth();

const imageMap: { [key: string]: string } = {
  '@/assets/images/staff/ct-teacher-tech-jones-min.jpg': teacherJones,
  '@/assets/images/staff/ct-teacher-tech-muster-min.jpg': teacherMuster2
}
const mapCrewPhotos = (crew: any[]): CrewMember[] => {
  return crew.map(member => ({
    ...member,
    photo: imageMap[member.photo] || placeholder
  }))
}

const technical: CrewMember[] = mapCrewPhotos(crewData.technical)
const divisionColors = crewData.divisionColors

// Modal state
const showModal = ref(false)
const currentSlideSrc = ref<string>('')

// Replace these with your actual Google Slides embed URLs
const slidesByName: Record<string, string> = {
  'Joshua Muster': 'https://docs.google.com/presentation/d/e/2PACX-1vT0NGOzMUlJy5TXZtKJz0Ct1Ngq3rrCRm8qe0V57yQN3QQrAPOgMxMossoUucfYxbcHqxFsdkLo5NQo/pubembed?start=false&loop=false&delayms=3000',
  'Antione Jones': 'https://docs.google.com/presentation/d/e/2PACX-EXAMPLE_JONES/embed?start=false&loop=false&delayms=3000'
}

function openSlides(member: CrewMember) {
  const url = slidesByName[member.name]
  if (!url) return
  currentSlideSrc.value = url
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  currentSlideSrc.value = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.subbed {
  color: #fff;
  font-size: 1.2em;
  font-style: italic;
  font-weight: 100;
  width: 100%;
}

h4 {
  margin-top: 1.5em;
}

/* Copied styles from Crew.vue to match look */
.crew-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-top: 1.25rem;
  justify-content: flex-start;
}

.crew-card {
  background: #1a1a1a;
  border-radius: 0.75rem;
  box-shadow: 0 0.125rem 0.375rem rgba(0,0,0,0.2);
  border-color: rgba(255, 255, 255, 0.3) !important;
  border-style: dotted;
  border-width: 0.125rem;
  width: 13.4375rem;
  padding: 0.9375rem;
}

.crew-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.9375rem;
}

.crew-photo {
  width: 11.25rem;
  object-fit: cover;
  border-radius: 0.5rem;
  border: 0.125rem solid #333;
  flex-shrink: 0;
}

.crew-text {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

/* Modal styles */
.modal-overlay {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 1.25rem;
  border-radius: 2.5rem 0 0 0;
  width: 100%;
  height: 100%;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 0.125rem;
  right: 0.3125rem;
  background-color: transparent;
  border: none;
  font-size: 3rem;
  cursor: pointer;
  color: #333;
  line-height: 0;
}

.slides-frame {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 1.5625rem 0 0 0;
}

</style>
