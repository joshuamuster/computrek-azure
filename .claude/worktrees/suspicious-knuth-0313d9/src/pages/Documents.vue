<template>
  <div>

    <div class="lcars-text-bar"><span>Important Documents</span></div>

    <p>Click a document to view the PDF, then download or print!</p>
    <p class="italics">¡Haga clic en un documento para verlo en PDF y luego descárguelo o imprímalo!</p>

    <div class="team-docs-container">

      <!-- Mr. Jones Section -->
      <div class="doc-section">
        <div class="teacher-header">
          <img :src="teacherJones" alt="Photo of Mr. Jones" class="teacher-photo" />
          <h2>Mr. Jones's Docs</h2>
        </div>
        <div class="subsection-row">
          <div class="subsection">
            <h3 class="subsection-title">English</h3>
            <div class="docborder">
              <!-- Card: Jones CS Syllabus -->
              <div class="doccard">
                <div @click="openPdf(pdfJonesCS)" title="Open Syllabus PDF">
                  <img :src="thumbJonesCS" alt="Mr. Jones's CS Syllabus Thumbnail" style="width: 10rem; height: auto; cursor: pointer; border: 0.0625rem solid #ddd; border-radius: 0.25rem;" />
                </div>
                <div class="tag-name">Mr. Jones's Syllabus</div>
                <p class="tag-syllabus">Introduction to<br/> Computer Science</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mr. Muster Section -->
      <div class="doc-section">
        <div class="teacher-header">
          <img :src="teacherMuster" alt="Photo of Mr. Joshua Muster" class="teacher-photo" />
          <h2>Mr. Muster's Docs</h2>
        </div>

        <div class="subsection-row">
          <div class="subsection">
            <h3 class="subsection-title">English</h3>
            <div class="docborder">

              <div class="doccard">
                <div @click="openPdf(pdfCSeng)" title="Open Syllabus PDF">
                  <img :src="thumbCS" alt="Mr. Muster's CS Syllabus Thumbnail" style="width: 10rem; height: auto; cursor: pointer; border: 0.0625rem solid #ddd; border-radius: 0.25rem;" />
                </div>
                <div class="tag-name">Mr. Muster's Syllabus</div>
                <p class="tag-syllabus">Introduction to<br/> Computer Science</p>
              </div>

              <div class="doccard">
                <div @click="openPdf(pdfMM)" title="Open document">
                  <img :src="thumbMM" alt="Mr. Muster's Multimedia Syllabus Thumbnail" style="width: 10rem; height: auto; cursor: pointer; border: 0.0625rem solid #ddd; border-radius: 0.25rem;" />
                </div>
                <div class="tag-name">Mr. Muster's Syllabus</div>
                <p class="tag-syllabus">Introduction to<br/> Multimedia</p>
              </div>
            </div>
          </div>


          <div class="subsection">
            <h3 class="subsection-title">Español</h3>
            <div class="docborder">

              <div class="doccard">
                <div @click="openPdf(pdfCSspa)" title="Open Syllabus PDF">
                  <img :src="thumbCS" alt="Mr. Muster's CS Syllabus Thumbnail" style="width: 10rem; height: auto; cursor: pointer; border: 0.0625rem solid #ddd; border-radius: 0.25rem;" />
                </div>
                <div class="tag-name">Sr. Muster's programa de estudios</div>
                <p class="tag-syllabus">Introducción à la Cíencia de la Computación</p>
              </div>

  <!--            <div class="doccard">-->
  <!--              <div @click="openPdf(pdfMM)" title="Open document">-->
  <!--                <img :src="thumbMM" alt="Mr. Muster's Multimedia Syllabus Thumbnail" style="width: 10rem; height: auto; cursor: pointer; border: 0.0625rem solid #ddd; border-radius: 0.25rem;" />-->
  <!--              </div>-->
  <!--              <div class="tag-name">Mr. Muster's Syllabus</div>-->
  <!--              <p class="tag-syllabus">Introduction to<br/> Multimedia</p>-->
  <!--            </div>-->
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Component for PDFs -->
    <PdfModal :showModal="showPdfModal" :pdfUrl="currentPdfUrl" @close="showPdfModal = false" />
  </div>

</template>
<script setup lang="ts">
import thumbCS from '@/assets/images/Thumbnail-Syllabus-cs-min.jpg';
import thumbMM from '@/assets/images/Thumbnail-Syllabus-imm-min.jpg';
import thumbJonesCS from '@/assets/images/Thumbnail-Jones-Syllabus-cs-min.jpg';
import teacherMuster from '@/assets/images/staff/ct-teacher-tech-muster-min.jpg';
import teacherJones from '@/assets/images/staff/ct-teacher-tech-jones-min.jpg';
import PdfModal from '@/components/modals/PdfModal.vue';
import { ref } from 'vue';

import pdfCSeng from '@/assets/documents/Syllabus-2526-CS-v1-english.pdf';
import pdfCSspa from '@/assets/documents/Syllabus-2526-CS-v1-spanish.pdf';
import pdfMM from '@/assets/documents/Syllabus-2526-MM-v1.pdf';
import pdfJonesCS from '@/assets/documents/Jones-Syllabus-2526-v1.pdf';

const showPdfModal = ref(false);
const currentPdfUrl = ref<string>('');
const openPdf = (url: string) => {
  currentPdfUrl.value = url;
  showPdfModal.value = true;
};
</script>

<style scoped>

h2 {
  margin: 0;
}

.team-docs-container {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
}

.doc-section {
  display: inline-block;
  vertical-align: top;
  margin-top: 2rem;
}

@media (max-width: 56.25rem) {
  .doc-section {
    width: 100%;
    display: block;
  }
}

.teacher-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  width: 100%;
}

.teacher-photo {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  object-fit: cover;
  border: 0.125rem solid #ddd;
}

.docborder {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-top: 1rem;
}

.doccard {
  text-align: center;
  width: 7.5rem;
}

.doccard img {
  margin: 0 auto;
}

.tag-name {
  color: white;
  font-size: 1.15rem;
  margin: 0.5rem auto;
  text-align: center;
}
.tag-syllabus {
  font-size: 0.9rem;
  color: lightblue;
  margin: 0.5rem auto;
  text-align: center;
}

.subsection-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-top: 1rem;
}

.subsection-title {
  margin: 0.5rem 0 0.25rem 0;
  font-size: 1.5rem;
  color: var(--champsred);
}

</style>
