<template>
  <div class="games-container">
    <div class="lcars-text-bar"><span>CompuTrek Tactical Simulator</span></div>
    <p class="subheader">These simulations create a safe, holodeck‑style space where you can build discipline, sharpen your analytical thinking, and develop the calm, methodical approach expected of CompuTrek personnel.</p>

    <div class="games-columns">
      <!-- Single Player -->
      <div class="games-column">
        <div class="section-label">Single Player</div>
        <div class="games-grid">
          <div
              v-for="game in filteredGames.singleplayer"
              :key="game.path"
              class="game-card"
              @click="handleGameClick(game.path)"
          >
            <img :src="game.thumbnail" :alt="game.name" class="game-thumbnail" />
            <div class="game-overlay">
              <p class="overlay-description">{{ game.description }}</p>
              <p class="overlay-alt">20th Century Title: <span>{{ game.alternative }}</span></p>
            </div>
          </div>
        </div>
      </div>

      <!-- Multiplayer -->
      <div class="games-column">
        <div class="section-label">Multiplayer</div>
        <div class="games-grid">
          <div
              v-for="game in filteredGames.multiplayer"
              :key="game.path"
              class="game-card"
              @click="handleGameClick(game.path)"
          >
            <img :src="game.thumbnail" :alt="game.name" class="game-thumbnail" />
            <div class="game-overlay">
              <p class="overlay-description">{{ game.description }}</p>
              <p class="overlay-alt">20th Century Title: <span>{{ game.alternative }}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="standards">
      <div class="headers">Curriculum Extension</div>
      <p>The games curated in this collection were selected through a deliberate pedagogical framework, not for
        entertainment value, but for their collective capacity to operationalize computational thinking skills
        in a hands-on, low-barrier learning environment. Each title was evaluated for its alignment with CSTA K–12
        Computer Science Standards, California's K–12 Computer Science Framework, ISTE Standards for Students, and
        Common Core Mathematical Practices, and each meets multiple standards simultaneously across the domains of
        algorithmic thinking, decomposition, iterative design, and systems reasoning. Taken together, the collection provides a scaffolded progression of cognitive complexity — from accessible rule sets with visible state changes to abstract strategic environments requiring multi-step hypothesis evaluation — allowing for differentiated instruction across a range of learner readiness levels within a single classroom activity structure.</p>
      <p>The unifying thread across all titles is the design-test-debug cycle: students form a strategy, execute it,
        receive immediate feedback through game state changes, and revise their approach accordingly. This mirrors the software development process at a conceptual level, giving students a concrete experiential reference point for abstract programming concepts before those concepts are introduced formally. Game-based learning in this context is not a departure from rigorous CS instruction — it is rigorous CS instruction delivered through a medium that maximizes engagement, lowers affective barriers to participation, and surfaces student reasoning in ways that are observable and discussable in real time.</p>
      <ul>
        <li><span>CSTA 2-AP-10 —</span> All titles require students to design, trace, and refine multi-step strategies that function as algorithms, reinforcing the core practice of sequential logical reasoning and flowchart-style planning.</li>
        <li><span>CSTACSTA 2-AP-15 & 2-AP-16 —</span> Each game instantiates the iterative design cycle and problem decomposition practice: students break complex board states into manageable sub-problems, execute solutions, and revise based on observed outcomes.</li>
        <li><span>CSTA 1B-AP-08 & 1B-AP-10 —</span> Across titles, students compare and evaluate multiple solution
          approaches and develop an intuitive understanding of how variables and state change in response to discrete operations.</li>
        <li><span>ISTE 1c (Computational Thinker) —</span> The collection as a whole builds the four pillars of
          computational thinking — decomposition, pattern recognition, abstraction, and algorithm design — within an applied, iterative context that makes each pillar visible and discussable.</li>
        <li><span>CA CS Framework — Algorithms & Programming (Grades 6–8) —</span> The games collectively reinforce
          sequencing, conditionals, variables, and the concept that a system's behavior is determined by its rules and current state, directly supporting the Algorithms & Programming concept domain.</li>
        <li><span>CA CTE ICT Pathway — Problem Solving & Critical Thinking Anchor Standard —</span> All titles require
          students to apply systematic strategies to complex, multi-variable problems with no single correct solution path, directly satisfying the anchor standard's expectation of applied critical thinking in a technology-adjacent context.</li>
        <li><span>CCSS MP1 & MP7 —</span> Students persevere through ambiguous, multi-step problem spaces while identifying
          and exploiting structural patterns — skills that transfer directly to mathematical reasoning, algorithmic design, and software debugging.</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth.js';
import '@/assets/styles/gameLanding.css';

// Import game thumbnails
import jeopardyThumb from '@/assets/images/games/thumbnail-jeopardy.jpg';
import minesweeperThumb from '@/assets/images/games/thumbnail-minesweeper.jpg';
import chessThumb from '@/assets/images/games/thumbnail-chess.jpg';
import shuttlebayThumb from '@/assets/images/games/thumbnail-shuttlebay.jpg';
import picardManeuverThumb from '@/assets/images/games/thumbnail-picardmaneuver.jpg';
import mancalaThumb from '@/assets/images/games/thumbnail-rulesofacquisition.jpg';
import mutaranebulaThumb from '@/assets/images/games/thumbnail-mutaranebula.jpg';
import isolinearcascadeThumb from '@/assets/images/games/thumbnail-isolinearcascade.jpg';
import WarpCoreBreachThumb from '@/assets/images/games/thumbnail-warpcorebreach.jpg';

const { userRole } = useAuth();
const router = useRouter();

const handleGameClick = (path: string) => {
  router.push(path);
};

const games = [
  {
    name: 'Jeopardy',
    path: '/games/jeopardy',
    thumbnail: jeopardyThumb,
    description: 'Prove your knowledge of CompuTrek protocols at the Academy podium.',
    alternative: 'Jeopardy',
    roles: ['staff', 'admin'],
    multiplayer: true
  },
  {
    name: 'Battle of the Mutara Nebula',
    path: '/games/battle-of-the-mutara-nebula',
    thumbnail: mutaranebulaThumb,
    description: 'Hide your fleet in the nebula and hunt the enemy before they find you first.',
    alternative: 'Battleship',
    roles: [],
    multiplayer: true
  },
  {
    name: 'Chess',
    path: '/games/chess',
    thumbnail: chessThumb,
    description: 'Command your pieces on the holodeck. Outmaneuver the enemy and claim the sector.',
    alternative: 'Chess',
    roles: [],
    multiplayer: true
  },
  {
    name: 'Picard Maneuver',
    path: '/games/picard-maneuver',
    thumbnail: picardManeuverThumb,
    description: 'Execute the legendary tactical flip and vanish before your opponent can track you.',
    alternative: 'Othello',
    roles: [],
    multiplayer: true
  },
  {
    name: 'Rules of Acquisition',
    path: '/games/rules-of-acquisition',
    thumbnail: mancalaThumb,
    description: 'Outplay your rival in the classic Ferengi game of resource and strategy.',
    alternative: 'Mancala',
    roles: [],
    multiplayer: true
  },
  {
    name: 'Minesweeper',
    path: '/games/minesweeper',
    thumbnail: minesweeperThumb,
    description: 'Sweep a cloaked minefield with your sensors. One wrong move and the fleet pays the price.',
    alternative: 'Minesweeper',
    roles: [],
    multiplayer: false
  },
  {
    name: 'Isolinear Cascade',
    path: '/games/isolinear-cascade',
    thumbnail: isolinearcascadeThumb,
    description: 'A power surge has disrupted the isolinear chip array, fix it before critical systems are affected!',
    alternative: 'Lights Out',
    roles: [],
    multiplayer: false
  },
  {
    name: 'Warp Core Breach',
    path: '/games/warp-core-breach',
    thumbnail: WarpCoreBreachThumb,
    description:
        'The warp core is overheating! Reroute the deuterium before it tears the ship apart.',
    alternative: 'Pipe Dream',
    roles: [],
    multiplayer: false
  },
  {
    name: 'Shuttle Bay',
    path: '/games/shuttle-bay',
    thumbnail: shuttlebayThumb,
    description: 'The bay is gridlocked. Maneuver the shuttle through the chaos and reach the exit.',
    alternative: 'Rush Hour',
    roles: [],
    multiplayer: false
  }
];

const filteredGames = computed(() => {
  const role = (userRole.value || '').toLowerCase();
  const visible = games.filter(game => {
    if (!game.roles || game.roles.length === 0) return true;
    return game.roles.includes(role);
  });
  return {
    multiplayer:  visible.filter(g => g.multiplayer),
    singleplayer: visible.filter(g => !g.multiplayer),
  };
});
</script>

<style scoped>
.games-container {
  margin: 0 auto;
  width: 100%;
}

.subheader {
  color: #cacaca;
  font-size: 1.2rem;
  font-weight: 900;
  margin-top: 0.5rem;
  margin-bottom: 1rem;
}

/* ── Two-column layout ───────────────────────────────────────────────────── */
.games-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: start;
}

.games-column {
  display: flex;
  flex-direction: column;
}

.section-label {
  font-family: 'Antonio', sans-serif;
  font-size: 2rem;
  text-transform: uppercase;
  color: var(--champsyellow);
  margin-bottom: 0.75rem;
  margin-top: 0;
  border-left: 0.25rem solid var(--sunflower, #ffc400);
  padding-left: 0.75rem;
}

/* ── Thumbnail grid: 2×2 per section ────────────────────────────────────── */
.games-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.625rem;
  background: rgba(255, 255, 255, 0.1);
  border: 0.125rem solid #9999ff;
  border-radius: 0.75rem;
  padding: 0.75rem;
}

/* ── Card: thumbnail fills, overlay slides up on hover ───────────────────── */
.game-card {
  position: relative;
  //aspect-ratio: 16 / 9;
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  border: 0.125rem solid #444;
  transition: border-color 0.25s ease, transform 0.25s ease;
}

.game-card:hover {
  border-color: #89f;
  transform: scale(1.03);
}

.game-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: filter 0.3s ease;
}

.game-card:hover .game-thumbnail {
  filter: brightness(0.45);
}

/* ── Overlay: hidden below card, slides up on hover ─────────────────────── */
.game-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.6rem 0.75rem 0.5rem;
  background: linear-gradient(to top, rgba(10, 10, 30, 0.97) 0%, rgba(10, 10, 30, 0.8) 70%, transparent 100%);
  transform: translateY(100%);
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.game-card:hover .game-overlay {
  transform: translateY(0);
}

.overlay-description {
  color: #e0e8ff;
  font-family: 'Roboto', sans-serif;
  font-size: 0.78rem;
  font-weight: 300;
  line-height: 1.35;
  margin: 0;
}

.overlay-alt {
  color: var(--champsred, #ff4444);
  font-family: 'Roboto', sans-serif;
  font-size: 0.72rem;
  font-style: italic;
  margin: 0;
  opacity: 0.85;
  span {
    font-weight: 900;
    margin-left: 0.25rem;
  }
}

@media (max-width: 50rem) {
  .games-columns {
    grid-template-columns: 1fr;
  }
}
</style>