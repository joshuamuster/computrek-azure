<template>
  <div class="crew-container">

    <div class="lcars-text-bar"><span>CompuTrek Academy Crew Index</span></div>

    <p class="subheader" v-if="isCadet">Meet your instructors and support crew! These are the dedicated professionals who will guide you through your Computer Science Discoveries journey this year.</p>
    <p class="subheader" v-else-if="isParent">Get to know the teaching staff and support team working with your child this academic year. Our experienced crew is committed to providing excellent education and support.</p>
    <p class="subheader" v-else-if="isStaff">Administrative staff directory for the 2025-2026 academic year. Review teaching assignments and staff roles for all crew members.</p>

    <!-- Technical Officers -->
    <h2 class="section-header gold">Department of Technology & Computer Science</h2>
    <div class="crew-grid">
      <div
          v-for="member in technical"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.gold }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.gold }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.gold }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Led by Science Officers Other-Muster and Jones, this course serves as the training ground
      for cadets to master the foundations of computer usage, from essential digital literacy to advanced problem-solving techniques. Here, cadets learn to design, build, and troubleshoot systems, program new solutions, and approach technology as a tool for creativity, communication, and exploration. Every lesson is a mission—preparing future officers not only to operate the technology of today, but to innovate for the technology of tomorrow.</p>

    <!-- Command Staff -->
    <h2 class="section-header red">Command Division – Bridge Staff</h2>
    <div class="crew-grid">
      <div
          v-for="member in admin"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.red }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.red }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.red }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Leads the starship’s missions and oversees coordination between all departments. Responsible for strategy, decision-making, and navigating the C.S.S. Curiosity safely through the galaxy.</p>

    <!-- History -->
    <h2 class="section-header gold">Cultural & Historical Studies</h2>
    <div class="crew-grid">
      <div
          v-for="member in history"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.gold }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.gold }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.gold }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Preserves and studies the histories and traditions of worlds across the Federation. Provides insight into cultural contexts that inform diplomacy and exploration.</p>

    <!-- ELA -->
    <h2 class="section-header gold">Linguistics & Communications</h2>
    <div class="crew-grid">
      <div
          v-for="member in ela"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.gold }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.gold }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.gold }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Specializes in communication systems, Federation Standard, and alien languages. Ensures the crew can transmit and interpret messages across diverse species and star systems.</p>

    <!-- Science -->
    <h2 class="section-header gold">Stellar & Life Sciences</h2>
    <div class="crew-grid">
      <div
          v-for="member in science"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.gold }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.gold }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.gold }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Explores natural phenomena and biological systems across the galaxy. Conducts research on alien worlds, life forms, and environmental conditions.</p>

    <!-- Mathematics -->
    <h2 class="section-header gold">Astrometrics & Computational Analysis</h2>
    <div class="crew-grid">
      <div
          v-for="member in mathematics"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.gold }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.gold }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.gold }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Maps star systems and analyzes astronomical data using advanced computer models. Provides critical navigation charts and scientific projections for missions.</p>

    <!-- Physical Education -->
    <h2 class="section-header gold">Physical Training & Recreation</h2>
    <div class="crew-grid">
      <div
          v-for="member in physicaled"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.gold }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.gold }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.gold }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Maintains crew fitness and readiness through exercise programs and competitive activities. Ensures every officer is prepared for the physical demands of any mission.</p>

    <!-- Languages Other Than English -->
    <h2 class="section-header gold">Linguistics &amp; Cultural Studies</h2>
    <div class="crew-grid">
      <div
          v-for="member in lote"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.gold }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.gold }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.gold }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Promotes cross-cultural understanding through the study and practice of non-English languages. Supports diplomacy and cultural exchange missions.</p>

    <!-- Engineering -->
    <h2 class="section-header gold">Engineering &amp; Applied Technologies</h2>
    <div class="crew-grid">
      <div
          v-for="member in engineering"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.gold }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.gold }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.gold }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Keeps the starship’s systems operating at peak efficiency. Repairs, upgrades, and innovates everything from propulsion systems to life support.</p>

    <!-- Visual and Performing Arts -->
    <h2 class="section-header gold">Cultural Arts &amp; Musical </h2>
    <div class="crew-grid">
      <div
          v-for="member in vapa"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.gold }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.gold }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.gold }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Designs holodeck simulations, performances, and artistic programs that enrich shipboard life. Supports crew morale through creativity and expression.</p>

    <!-- Specialized Learning Support & Leadership & Crew Morale -->
    <h2 class="section-header blue">Specialized Learning Support &amp; Leadership &amp; Crew Morale</h2>
    <div class="crew-grid">
      <div
          v-for="member in [...sped, ...climate]"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.blue }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.blue }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.blue }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
            <!-- <p>{{ member.bio }}</p> -->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">
      From personalized learning strategies to shipboard leadership development, these officers ensure cadets are both supported in their individual needs and challenged to grow as future leaders. They keep the crew’s morale high, teamwork strong, and training missions on course.
    </p>

    <!-- Library -->
    <h2 class="section-header blue">Information Services – LCARS Archives</h2>
    <div class="crew-grid">
      <div
          v-for="member in library"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.blue }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.blue }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.blue }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Manages the ship’s knowledge banks and historical archives. Provides research support for missions and maintains access to Federation data.</p>

    <!-- Counselors -->
    <h2 class="section-header blue">Counseling &amp; Ship’s Services</h2>
    <div class="crew-grid">
      <div
          v-for="member in counselors"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.blue }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.blue }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.blue }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Supports crew well-being through guidance, conflict resolution, and personal development. Ensures mental readiness for the challenges of deep-space duty.</p>

    <!-- Operations -->
    <h2 class="section-header blue">Command Operations &amp; Support</h2>
    <div class="crew-grid">
      <div
          v-for="member in operations"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.blue }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.blue }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.blue }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
<!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Oversees the essential administrative, logistical, and behind-the-scenes functions that keep the C.S.S. Curiosity running smoothly. This department includes the dedicated crew members you may not often see, but whose work is vital to every mission — from managing schedules and communications to ensuring supplies, resources, and information flow seamlessly between departments. Without their quiet efficiency, the ship could not operate at peak performance.
    </p>

    <!-- Visual and Performing Arts -->
    <h2 class="section-header gold">Security &amp; Student Safety Division</h2>
    <div class="crew-grid">
      <div
          v-for="member in security"
          :key="member.name"
          class="crew-card"
          :style="{ borderColor: divisionColors.gold }"
      >
        <div class="crew-content">
          <img :src="member.photo" :alt="member.name" class="crew-photo" :style="{ borderColor: divisionColors.gold }" />
          <div class="crew-text">
            <h3 :style="{ color: divisionColors.gold }">{{ member.rank }}</h3>
            <h3 :style="{ color: divisionColors.white }">{{ member.name }}</h3>
            <!--            <p>{{ member.bio }}</p>-->
          </div>
        </div>
      </div>
    </div>
    <p class="subheader">Protects the ship and its crew from threats both internal and external. Maintains order aboard and safeguards cadet safety during all missions.</p>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '@/composables/useAuth.js'
import crewData from '@/assets/data/crew.json'
import admin1 from '@/assets/images/staff/ct-admin-1-brookins-min.jpg'
import admin2 from '@/assets/images/staff/ct-admin-2-dolier-min.jpg'
import admin3 from '@/assets/images/staff/ct-admin-3-hawkins-min.jpg'
import staffHer2 from '@/assets/images/staff/ct-staff-counselor-her-min.jpg'
import staffSulcer from '@/assets/images/staff/ct-staff-counselor-sulcer-min.jpg'
import staffVillalobos from '@/assets/images/staff/ct-staff-counselor-villalobos-min.jpg'
import staffClimateVargas from '@/assets/images/staff/ct-staff-climate-vargas-min.jpg'
import staffLibraryWard from '@/assets/images/staff/ct-staff-library-ward-min.jpg'
import staffLibraryCameron from '@/assets/images/staff/ct-staff-library-cameron-min.jpg'
import staffServicesRios from '@/assets/images/staff/ct-staff-services-rios-min.jpg'
import staffServicesSandhu from '@/assets/images/staff/ct-staff-services-sandhu-min.jpg'
import staffServicesSwift from '@/assets/images/staff/ct-staff-services-swift-min.jpg'
import staffServicesVang from '@/assets/images/staff/ct-staff-services-vang-min.jpg'
import staffServicesRuiz from '@/assets/images/staff/ct-staff-services-ruiz-min.jpg'
import staffServicesDuranRios from '@/assets/images/staff/ct-staff-services-duran-rios-min.jpg'
import staffServicesSanchez from '@/assets/images/staff/ct-staff-services-sanchez-min.jpg'
import staffServicesCruz from '@/assets/images/staff/ct-staff-services-cruz-min.jpg'

import staffSecurityLucio from '@/assets/images/staff/ct-staff-security-lucio-min.jpg'
import staffSecurityHuerta from '@/assets/images/staff/ct-staff-security-huerta-min.jpg'
import staffSecuritySolis from '@/assets/images/staff/ct-staff-security-solis-min.jpg'

import teacherHistoryXiong from '@/assets/images/staff/ct-teacher-history-xiong-min.jpg'
import teacherHistoryBryan from '@/assets/images/staff/ct-teacher-history-bryan-min.jpg'
import teacherHistoryWeemes from '@/assets/images/staff/ct-teacher-history-weemes-min.jpg'
import teacherHistoryPayne from '@/assets/images/staff/ct-teacher-history-payne-min.jpg'
import teacherElaAdams from '@/assets/images/staff/ct-teacher-ela-adams-min.jpg'
import teacherElaMcneely from '@/assets/images/staff/ct-teacher-ela-mcneely-min.jpg'
import teacherElaThornton from '@/assets/images/staff/ct-teacher-ela-thornton-min.jpg'
import teacherElaGarza from '@/assets/images/staff/ct-teacher-ela-garza-min.jpg'
import teacherScienceRamos from '@/assets/images/staff/ct-teacher-science-ramos-min.jpg'
import teacherScienceVang from '@/assets/images/staff/ct-teacher-science-vang-min.jpg'
import teacherBassill from '@/assets/images/staff/ct-teacher-science-bassill-min.jpg'
import teacherKoshiba from '@/assets/images/staff/ct-teacher-science-koshiba-min.jpg'
import teacherScienceHarris from '@/assets/images/staff/ct-teacher-science-harris-min.jpg'
import teacherMathTejada from '@/assets/images/staff/ct-teacher-math-tejada-min.jpg'
import teacherMathRiojas from '@/assets/images/staff/ct-teacher-math-riojas-min.jpg'
import teacherMathBaumheckel from '@/assets/images/staff/ct-teacher-math-baumheckel-min.jpg'
import teacherMathMelchor from '@/assets/images/staff/ct-teacher-math-melchor-min.jpg'
import teacherPeBernyk from '@/assets/images/staff/ct-teacher-pe-bernyk-min.jpg'
import teacherPeGonzales from '@/assets/images/staff/ct-teacher-pe-gonzales-min.jpg'
import teacherPeFlores from '@/assets/images/staff/ct-teacher-pe-flores-min.jpg'
import teacherPeNolan from '@/assets/images/staff/ct-teacher-pe-nolan-min.jpg'
import teacherLoteBolanos from '@/assets/images/staff/ct-teacher-lote-bolanos-min.jpg'
import teacherLoteValencia from '@/assets/images/staff/ct-teacher-lote-valencia-min.jpg'
import teacherLoteVang from '@/assets/images/staff/ct-teacher-lote-vang-min.jpg'
import teacherCtePiffero from '@/assets/images/staff/ct-teacher-cte-piffero-min.jpg'
import teacherCteVizthum from '@/assets/images/staff/ct-teacher-cte-vizthum-min.jpg'
import teacherCteReal from '@/assets/images/staff/ct-teacher-cte-real-min.jpg'
import teacherCteBernyk from '@/assets/images/staff/ct-teacher-cte-bernyk-min.jpg'
import teacherCteHarris from '@/assets/images/staff/ct-teacher-cte-harris-min.jpg'
import teacherCteSmith from '@/assets/images/staff/ct-teacher-cte-smith-min.jpg'
import teacherVapaSmith from '@/assets/images/staff/ct-teacher-vapa-smith-min.jpg'
import teacherVapaSalanitro from '@/assets/images/staff/ct-teacher-vapa-salanitro-min.jpg'
import teacherVapaAdams from '@/assets/images/staff/ct-teacher-vapa-adams-min.jpg'
import teacherVapaShubbin from '@/assets/images/staff/ct-teacher-vapa-shubbin-min.jpg'
import teacherSpedBriar from '@/assets/images/staff/ct-staff-sped-briar-min.jpg'
import teacherJones from '@/assets/images/staff/ct-teacher-tech-jones-min.jpg'
import teacherMuster1 from '@/assets/images/staff/ct-teacher-math-muster-min.jpg'
import teacherMuster2 from '@/assets/images/staff/ct-teacher-tech-muster-min.jpg'
import placeholder from '@/assets/images/CompuTrekLogo.svg'

const { isCadet, isParent, isStaff } = useAuth()

interface CrewMember {
  name: string
  rank: string
  bio: string
  photo: string
}

// Image mapping object
const imageMap: { [key: string]: string } = {
  '@/assets/images/staff/ct-admin-1-brookins-min.jpg': admin1,
  '@/assets/images/staff/ct-admin-2-dolier-min.jpg': admin2,
  '@/assets/images/staff/ct-admin-3-hawkins-min.jpg': admin3,
  '@/assets/images/staff/ct-staff-counselor-her-min.jpg': staffHer2,
  '@/assets/images/staff/ct-staff-counselor-sulcer-min.jpg': staffSulcer,
  '@/assets/images/staff/ct-staff-counselor-villalobos-min.jpg': staffVillalobos,
  '@/assets/images/staff/ct-staff-climate-vargas-min.jpg': staffClimateVargas,
  '@/assets/images/staff/ct-staff-library-ward-min.jpg': staffLibraryWard,
  '@/assets/images/staff/ct-staff-library-cameron-min.jpg': staffLibraryCameron,
  '@/assets/images/staff/ct-staff-services-rios-min.jpg': staffServicesRios,
  '@/assets/images/staff/ct-staff-services-sandhu-min.jpg': staffServicesSandhu,
  '@/assets/images/staff/ct-staff-services-swift-min.jpg': staffServicesSwift,
  '@/assets/images/staff/ct-staff-services-vang-min.jpg': staffServicesVang,
  '@/assets/images/staff/ct-staff-services-ruiz-min.jpg': staffServicesRuiz,
  '@/assets/images/staff/ct-staff-services-duran-rios-min.jpg': staffServicesDuranRios,
  '@/assets/images/staff/ct-staff-services-sanchez-min.jpg': staffServicesSanchez,
  '@/assets/images/staff/ct-staff-services-cruz-min.jpg': staffServicesCruz,

  '@/assets/images/staff/ct-staff-security-lucio-min.jpg': staffSecurityLucio,
  '@/assets/images/staff/ct-staff-security-huerta-min.jpg': staffSecurityHuerta,
  '@/assets/images/staff/ct-staff-security-solis-min.jpg': staffSecuritySolis,

  '@/assets/images/staff/ct-teacher-history-xiong-min.jpg': teacherHistoryXiong,
  '@/assets/images/staff/ct-teacher-history-bryan-min.jpg': teacherHistoryBryan,
  '@/assets/images/staff/ct-teacher-history-weemes-min.jpg': teacherHistoryWeemes,
  '@/assets/images/staff/ct-teacher-history-payne-min.jpg': teacherHistoryPayne,
  '@/assets/images/staff/ct-teacher-ela-adams-min.jpg': teacherElaAdams,
  '@/assets/images/staff/ct-teacher-ela-mcneely-min.jpg': teacherElaMcneely,
  '@/assets/images/staff/ct-teacher-ela-thornton-min.jpg': teacherElaThornton,
  '@/assets/images/staff/ct-teacher-ela-garza-min.jpg': teacherElaGarza,
  '@/assets/images/staff/ct-teacher-science-ramos-min.jpg': teacherScienceRamos,
  '@/assets/images/staff/ct-teacher-science-vang-min.jpg': teacherScienceVang,
  '@/assets/images/staff/ct-teacher-science-bassill-min.jpg': teacherBassill,
  '@/assets/images/staff/ct-teacher-science-koshiba-min.jpg': teacherKoshiba,
  '@/assets/images/staff/ct-teacher-science-harris-min.jpg': teacherScienceHarris,
  '@/assets/images/staff/ct-teacher-math-muster-min.jpg': teacherMuster1,
  '@/assets/images/staff/ct-teacher-math-tejada-min.jpg': teacherMathTejada,
  '@/assets/images/staff/ct-teacher-math-riojas-min.jpg': teacherMathRiojas,
  '@/assets/images/staff/ct-teacher-math-baumheckel-min.jpg': teacherMathBaumheckel,
  '@/assets/images/staff/ct-teacher-math-melchor-min.jpg': teacherMathMelchor,
  '@/assets/images/staff/ct-teacher-pe-bernyk-min.jpg': teacherPeBernyk,
  '@/assets/images/staff/ct-teacher-pe-gonzales-min.jpg': teacherPeGonzales,
  '@/assets/images/staff/ct-teacher-pe-flores-min.jpg': teacherPeFlores,
  '@/assets/images/staff/ct-teacher-pe-nolan-min.jpg': teacherPeNolan,
  '@/assets/images/staff/ct-teacher-lote-bolanos-min.jpg': teacherLoteBolanos,
  '@/assets/images/staff/ct-teacher-lote-valencia-min.jpg': teacherLoteValencia,
  '@/assets/images/staff/ct-teacher-lote-vang-min.jpg': teacherLoteVang,
  '@/assets/images/staff/ct-teacher-engineering-piffero-min.jpg': teacherCtePiffero,
  '@/assets/images/staff/ct-teacher-engineering-vizthum-min.jpg': teacherCteVizthum,
  '@/assets/images/staff/ct-teacher-engineering-real-min.jpg': teacherCteReal,
  '@/assets/images/staff/ct-teacher-engineering-bernyk-min.jpg': teacherCteBernyk,
  '@/assets/images/staff/ct-teacher-engineering-harris-min.jpg': teacherCteHarris,
  '@/assets/images/staff/ct-teacher-engineering-smith-min.jpg': teacherCteSmith,
  '@/assets/images/staff/ct-teacher-vapa-smith-min.jpg': teacherVapaSmith,
  '@/assets/images/staff/ct-teacher-vapa-salanitro-min.jpg': teacherVapaSalanitro,
  '@/assets/images/staff/ct-teacher-vapa-adams-min.jpg': teacherVapaAdams,
  '@/assets/images/staff/ct-teacher-vapa-shubbin-min.jpg': teacherVapaShubbin,
  '@/assets/images/staff/ct-teacher-sped-briar-min.jpg': teacherSpedBriar,
  '@/assets/images/staff/ct-teacher-tech-jones-min.jpg': teacherJones,
  '@/assets/images/staff/ct-teacher-tech-muster-min.jpg': teacherMuster2,
  '@/assets/images/CompuTrekLogo.svg': placeholder
}

// Function to map photo paths to actual imports
const mapCrewPhotos = (crew: any[]): CrewMember[] => {
  return crew.map(member => ({
    ...member,
    photo: imageMap[member.photo] || placeholder
  }))
}

const technical: CrewMember[] = mapCrewPhotos(crewData.technical)
const admin: CrewMember[] = mapCrewPhotos(crewData.admin)
const history: CrewMember[] = mapCrewPhotos(crewData.history)
const ela: CrewMember[] = mapCrewPhotos(crewData.ela)
const science: CrewMember[] = mapCrewPhotos(crewData.science)
const mathematics: CrewMember[] = mapCrewPhotos(crewData.mathematics)
const physicaled: CrewMember[] = mapCrewPhotos(crewData.physicaled)
const lote: CrewMember[] = mapCrewPhotos(crewData.lote)
const engineering: CrewMember[] = mapCrewPhotos(crewData.engineering)
const vapa: CrewMember[] = mapCrewPhotos(crewData.vapa)
const sped: CrewMember[] = mapCrewPhotos(crewData.sped)
const climate: CrewMember[] = mapCrewPhotos(crewData.climate)
const library: CrewMember[] = mapCrewPhotos(crewData.library)
const counselors: CrewMember[] = mapCrewPhotos(crewData.counselors)
const operations: CrewMember[] = mapCrewPhotos(crewData.operations)
const security: CrewMember[] = mapCrewPhotos(crewData.security)
const divisionColors = crewData.divisionColors
</script>

<style scoped>
.crew-container {
  margin: 0 auto;
  /* padding: 1.25rem; */
  width: 100%;
}

h2 {
  font-size: 2rem;
}

.subheader {
  color: #cacaca;
  font-size: 1.2em;
  font-style: italic;
  font-weight: 100;
  margin-top: 0.5rem;
}

/* Section headers */
.section-header {
  margin-top: 3.125rem;
  margin-bottom: 0.9375rem;
  font-size: 1.5rem;
  border-bottom: 0.125rem solid;
  padding-bottom: 0.3125rem;
}
.section-header.gold { color: #F59D08; border-color: #F59D08; }
.section-header.red { color: #E35E5E; border-color: #E35E5E; }
.section-header.blue { color: #3279BE; border-color: #3279BE; }

.crew-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-top: 1.25rem;
  justify-content: flex-start; /* ensures everything hugs the left */
}

  .crew-card {
  /* background: #1a1a1a; */
  /* border-radius: 0.75rem; */
  /* box-shadow: 0 0.125rem 0.375rem rgba(0,0,0,0.2); */
  /* border-color: rgba(255, 255, 255, 0.3) !important; */
  /* border-style: dotted; */
  /* border-width: 0.125rem; */
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
  flex: 1;
}

.crew-text h3 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
}

.crew-card p {
  font-size: 0.9rem;
  color: #e0e0e0;
  line-height: 1.4;
}
</style>
