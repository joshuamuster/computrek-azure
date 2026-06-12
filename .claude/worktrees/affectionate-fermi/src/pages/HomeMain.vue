<template>
  <div>
    <h1>Salutations and Welcome!</h1>
    <p class="subbed">From the Desk of Mr. OtherMuster, Chief Science Officer, C.S.S. Curiosity</p>
<!--    <h2>Welcome to CompuTrek!</h2>-->

    <div v-if="isCadet">

      <p>This course is rigorous by design, but it is also collaborative, creative, and fun. There will be moments when you feel like you’ve hit a dead end. <strong>That’s good.</strong> It means you’re pushing into new territory. And with each obstacle, you’ll gain the knowledge and confidence to chart a new course.</p>

      <h4 class="">Course Purpose:</h4>

      <p>Computer Science is an introductory exploration of the digital frontier, designed to build a strong foundation in computer usage skills while introducing students to the principles of computer science. This course frames computing not just as a tool but as a medium for creativity, communication, and problem‑solving.</p>

      <h4 class="">Core Focus:</h4>

      <p>Our Cadets will investigate how information is captured, processed, stored, and transformed into meaningful solutions—essential concepts that underlie everything from everyday software to the advanced systems powering starships. These foundations equip students to design, create, and critically engage with technology rather than simply consume it.</p>

      <h4 class="">Learning Objectives:</h4>

      <p>These objectives outline the key competencies students will develop as they progress through their training:</p>

      <ul>
        <li>Build foundational computer usage and digital literacy skills.</li>
        <li>Develop structured approaches to problem‑solving and computational thinking.</li>
        <li>Create authentic digital artifacts using a variety of tools and platforms.</li>
        <li>Practice effective collaboration, communication, and iterative design strategies.</li>
      </ul>

      <h4 class="">Instructional Approach:</h4>

      <p>This is a hands‑on, project‑based course where students actively apply their learning to real‑world challenges. Cadets will work collaboratively, reflecting Starfleet’s values of teamwork and resilience, to develop solutions, debug programs, and explore human‑computer interaction.</p>

      <h4 class="">Why It Matters:</h4>

      <p>By the end of the course, students will possess the essential skills to navigate and contribute to a rapidly evolving digital world—skills critical for future study in computer science and for innovation across any field in the Federation.</p>

    </div>


    <div v-if="isParent">

      <h4 class="">Course Purpose:</h4>

      <p>We teach your kids real good. Trust. 👍</p>

    </div>

    <!-- Crew card — visible to everyone -->
    <div class="crew-card" @click="$router.push('/crew')">
      <span class="crew-card-icon">🖖</span>
      <div class="crew-card-text">
        <div class="crew-card-title">Meet the Crew</div>
        <div class="crew-card-sub">Personnel manifest — cadets, officers, and staff aboard the C.S.S. Curiosity.</div>
      </div>
      <span class="crew-card-arrow">→</span>
    </div>


    <div v-if="isStaff">

      <h2>UI Overview</h2>

      <h4>Top Timers</h4>
      <ul class="walkthrough">
        <li><span>Universal Ship's Time</span>: Current time at Computech.</li>
        <li><span>Mission Clock</span>: Interactive countdown to the end of the period, pulling from a .json listing day types for the year. Same color as "SUCCESS" in the CHAMPS to visually tie into to the current period.</li>
        <li><span>Objective Timer</span>: Interactive countdown to the end of the current activity. Same color as "ACTIVITY" in CHAMPS to visually tie into what they should be working on at that moment.</li>
      </ul>

      <h4>LEFT - CHAMPS</h4>
      <ul class="walkthrough">
        <li><span>Function</span>: You can click on any of the individual settings to change it.</li>
        <li><span>Resetting</span>: Clicking on "CHAMPS" at the top of the column will reset them all.</li>
      </ul>

      <hr />
      <hr />

      <h2 class="">Still To Do:</h2>
      <p>A list of the things I have yet to complete.</p>

      <ul class="to-do-list">
        <li>Opening:</li>
        <ol>
          <li>Add overlay that's dynamic based off currently selected lesson</li>
        </ol>

        <li>Courses:</li>
        <ol>
          <li>Add content for Units 2-6</li>
        </ol>

        <li>Lessons:</li>
        <ol>
          <li>Have CHAMPS pull values from each individual lesson</li>
        </ol>
      </ul>

      <hr />

      <h2 class="">Coming Spring 2026</h2>
      <p>A list of the things I had to deprioritize for... life.</p>

      <ul class="to-do-list">

        <li>Grades:</li>
        <ol>
          <li>Add interface to filter/breakout grades by lesson and class.</li>
        </ol>

        <li>Crew:</li>
        <ol>
          <li style="text-decoration: line-through;">Convert and organize remaining crew members.</li>
          <li>Add contact info links for teachers and staff</li>
        </ol>

        <li>Decks:</li>
        <ol>
          <li>Add template layout for science stations (tables).</li>
          <li>Make page inaccessible to "Student" and "Guardian" accounts.</li>
        </ol>

        <li>Systems:</li>
        <ol>
          <li>Add "high score" scoreboard for Typing.com.</li>
        </ol>
      </ul>

    </div>

  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth.js';
const { isCadet, isParent, isStaff } = useAuth();
const $router = useRouter()
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

ul.walkthrough > li > span{
  font-weight: 900;
}

ul, ol {
  font-family: 'Roboto', sans-serif;
  font-size: 1.2rem !important;
  margin-left: 2.5rem;
}
ul.to-do-list > li {
  font-weight: 900;
}

.crew-card {
  display: flex; align-items: center; gap: 1rem;
  margin-top: 2.5rem;
  background: rgba(0,30,60,0.45);
  border: 0.125rem solid rgba(153,204,255,0.15);
  border-radius: 0.6rem; padding: 1rem 1.25rem;
  cursor: pointer; transition: border-color 0.2s, background 0.2s;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}
.crew-card:hover {
  border-color: rgba(255,153,0,0.4);
  background: rgba(0,40,80,0.5);
}
.crew-card-icon  { font-size: 1.75rem; flex-shrink: 0; }
.crew-card-text  { flex: 1; }
.crew-card-title { font-size: 1.1rem; font-weight: bold; color: #ff9900; letter-spacing: 0.05em; }
.crew-card-sub   { font-size: 0.82rem; color: #99ccff; margin-top: 0.15rem; line-height: 1.4; }
.crew-card-arrow { color: #556; font-size: 1.2rem; flex-shrink: 0; transition: color 0.2s; }
.crew-card:hover .crew-card-arrow { color: #ff9900; }
</style>
