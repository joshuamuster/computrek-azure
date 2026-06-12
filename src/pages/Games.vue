<template>
  <div class="games-container">
    <div class="lcars-text-bar"><span>CompuTrek Tactical Simulator</span></div>
    <p class="subheader">These simulations create a safe, holodeck‑style space where you can build discipline, sharpen your analytical thinking, and develop the calm, methodical approach expected of CompuTrek personnel.</p>

    <!-- ── Thumbnail navigation strip ──────────────────────────────────── -->
    <div class="game-strip">
      <template v-if="filteredGames.multiplayer.length">
        <span class="strip-label">Multiplayer</span>
        <div
          v-for="game in filteredGames.multiplayer"
          :key="game.path"
          class="strip-card"
          :title="game.name"
          @click="scrollToSection(game.sectionId)"
        >
          <img :src="game.thumbnail" :alt="game.name" class="strip-img" />
          <div class="strip-name">{{ game.name }}</div>
        </div>
      </template>
      <div
        v-if="filteredGames.multiplayer.length && filteredGames.singleplayer.length"
        class="strip-divider"
      ></div>
      <template v-if="filteredGames.singleplayer.length">
        <span class="strip-label">Single Player</span>
        <div
          v-for="game in filteredGames.singleplayer"
          :key="game.path"
          class="strip-card"
          :title="game.name"
          @click="scrollToSection(game.sectionId)"
        >
          <img :src="game.thumbnail" :alt="game.name" class="strip-img" />
          <div class="strip-name">{{ game.name }}</div>
        </div>
      </template>
    </div>

    <!-- ── Chess — featured ─────────────────────────────────────────────── -->
    <div v-if="filteredGames.chess" id="sec-chess" class="game-section">
      <div class="section-label">Chess — The Command-Level Strategy Simulation</div>
      <div class="chess-feature">
        <div class="game-card chess-card" @click="handleGameClick(filteredGames.chess.path)">
          <img :src="filteredGames.chess.thumbnail" :alt="filteredGames.chess.name" class="game-thumbnail" />
          <div class="game-overlay">
            <p class="overlay-alt">20th Century Title: <span>{{ filteredGames.chess.alternative }}</span></p>
            <button
              v-if="isCadet && challengesEnabled && isStudentEligible"
              class="challenge-card-btn"
              @click.stop="openChallengeModal('chess')"
            >⚔ Challenge</button>
          </div>
        </div>
        <div class="chess-copy">
          <p>Of every simulation in the CompuTrek catalog, chess stands alone. It is the closest analog we have to the experience of debugging a complex system under pressure — a finite set of rules producing nearly infinite emergent complexity, where every decision has cascading consequences and the path to failure is often invisible until you are already on it.</p>
          <p>The same mental discipline that makes a strong chess player makes a strong technologist. When a system breaks, engineers do not guess randomly — they isolate variables, form hypotheses, test the smallest possible change, and revise their model based on what they observe. Chess trains exactly this: you evaluate the board state, identify candidate moves, trace forward consequences, and update your strategy when reality doesn't match your prediction. Repeat, every turn, under time pressure, against an opponent actively trying to invalidate your assumptions.</p>
          <p>Playing different <strong>variants</strong> — King of the Hill, Horde, Three-Check, Atomic, Racing Kings — amplifies this even further. Each variant breaks the rules you thought were fixed and forces you to rebuild your understanding from scratch, which is precisely the cognitive experience of switching languages, frameworks, or operating systems. The underlying logic transfers; the surface details do not. Knowing the difference is a foundational skill in both chess and computer science.</p>
          <p>Playing against <strong>different opponent levels</strong> matters too. Weaker opponents teach pattern recognition and clean execution. Stronger opponents expose the gaps in your thinking you didn't know existed — the same value you get from code review, pair programming, or having a senior engineer look at your architecture. Losing instructively is one of the most efficient ways to learn in any technical field.</p>
          <p>The overlap extends into the sciences broadly. Physics, chemistry, biology, and mathematics all require the ability to hold a model of a system in your head, reason about how it will behave under new conditions, and revise that model when the experiment says you were wrong. Chess does not teach facts — it trains the underlying cognitive architecture that makes fact-learning faster and more durable. Every match is a controlled experiment. Every loss is data.</p>
          <p class="chess-cta">CompuTrek cadets have access to standard chess and five full variants, selectable before each match. Choose your opponent level, pick your variant, and report to the holodeck.</p>
        </div>
      </div>
    </div>

    <!-- ── Multiplayer grid (non-chess) ───────────────────────────────────── -->
    <div v-if="filteredGames.otherMultiplayer.length" class="group-block">
      <div class="group-header">Multiplayer Simulations</div>
      <div class="game-grid">
        <div
          v-for="game in filteredGames.otherMultiplayer"
          :key="game.path"
          :id="game.sectionId"
          class="game-section"
        >
          <div class="section-label grid-section-label">{{ game.name }}</div>
          <div class="game-card grid-thumb" @click="handleGameClick(game.path)">
            <img :src="game.thumbnail" :alt="game.name" class="game-thumbnail" />
            <div class="game-overlay">
              <p class="overlay-alt">20th Century Title: <span>{{ game.alternative }}</span></p>
              <button
                v-if="game.challengeId && isCadet && challengesEnabled && isStudentEligible"
                class="challenge-card-btn"
                @click.stop="openChallengeModal(game.challengeId)"
              >⚔ Challenge</button>
            </div>
          </div>
          <div class="mini-copy">
            <p v-for="(blurb, i) in game.blurbs" :key="i">{{ blurb }}</p>
            <button class="mini-launch-btn" @click="handleGameClick(game.path)">▶ Launch Simulation</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Single-player grid ───────────────────────────────────────────── -->
    <div v-if="filteredGames.singleplayer.length" class="group-block">
      <div class="group-header">Single Player Simulations</div>
      <div class="game-grid">
        <div
          v-for="game in filteredGames.singleplayer"
          :key="game.path"
          :id="game.sectionId"
          class="game-section"
        >
          <div class="section-label grid-section-label">{{ game.name }}</div>
          <div class="game-card grid-thumb" @click="handleGameClick(game.path)">
            <img :src="game.thumbnail" :alt="game.name" class="game-thumbnail" />
            <div class="game-overlay">
              <p class="overlay-alt">20th Century Title: <span>{{ game.alternative }}</span></p>
            </div>
          </div>
          <div class="mini-copy">
            <p v-for="(blurb, i) in game.blurbs" :key="i">{{ blurb }}</p>
            <button class="mini-launch-btn" @click="handleGameClick(game.path)">▶ Launch Simulation</button>
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

  <ChallengeModal
    :show="showChallengeModal"
    :game="challengeGame"
    @close="showChallengeModal = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth.js';
import { useBroadcast } from '@/composables/useBroadcast';
import { useChallengeSettings } from '@/composables/useChallengeSettings';
import ChallengeModal from '@/components/modals/ChallengeModal.vue';
import type { ChallengeGame } from '@/composables/useChallenges';
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
import orbitalBombardmentThumb from '@/assets/images/games/thumbnail-fracturedfrontier.jpg';

const { userRole, isCadet, userInfo } = useAuth();
const { isBroadcasting } = useBroadcast();
const { challengesEnabled, mode, caughtUpUids, init: initChallengeSettings } = useChallengeSettings();

const isStudentEligible = computed(() =>
  mode.value === 'all' || caughtUpUids.value.includes(userInfo.value?.uid ?? '')
);
const router = useRouter();

const showChallengeModal = ref(false);
const challengeGame = ref<ChallengeGame>('chess');

watch(() => userInfo.value?.teacherEmail, (email) => {
  if (email) initChallengeSettings(email as string);
}, { immediate: true });

function openChallengeModal(game: string) {
  challengeGame.value = game as ChallengeGame;
  showChallengeModal.value = true;
}

function handleGameClick(path: string) {
  router.push(path);
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}

interface Game {
  name:        string;
  path:        string;
  thumbnail:   string;
  description: string;
  alternative: string;
  roles:       string[];
  multiplayer: boolean;
  sectionId:   string;
  tagline:     string;
  blurbs:      string[];
  challengeId?: string;
}

const games: Game[] = [
  {
    name:        'Jeopardy',
    path:        '/games/jeopardy',
    thumbnail:   jeopardyThumb,
    description: 'Prove your knowledge of CompuTrek protocols at the Academy podium.',
    alternative: 'Jeopardy',
    roles:       ['staff', 'admin'],
    multiplayer: true,
    sectionId:   'sec-jeopardy',
    tagline:     'Staff-Run Academy Knowledge Challenge',
    blurbs: [
      'Jeopardy is a teacher-operated broadcast event, not a student-accessible simulation. Staff can build custom category boards from any curriculum content, launch a live session from the landing page, and run class-wide trivia as a review activity or formative assessment. Categories and questions are fully configurable.',
      'During a live session, students join through their dashboard and respond in real time. Full session management controls are available on the landing page. This title does not appear in the cadet simulation catalog — it runs when you choose to run it.',
    ],
  },
  {
    name:        'Battle of the Mutara Nebula',
    path:        '/games/battle-of-the-mutara-nebula',
    thumbnail:   mutaranebulaThumb,
    description: 'Hide your fleet in the nebula and hunt the enemy before they find you first.',
    alternative: 'Battleship',
    roles:       [],
    multiplayer: true,
    sectionId:   'sec-mutara',
    tagline:     'Sensor Blackout and Spatial Deduction',
    challengeId: 'battle-of-the-mutara-nebula',
    blurbs: [
      'The nebula scrambles sensors on both sides, reducing each engagement to a problem of inference from incomplete information. Every shot is a probe into an unknown state space, and every result is a constraint that narrows the remaining possibilities. Strong commanders learn to work the board systematically — scanning high-probability zones first, using hits to triangulate fleet orientation, and never wasting a turn on a cell that logic has already ruled out.',
      'This is divide-and-conquer applied to a spatial search problem, and the skill it builds transfers directly to binary search, log analysis, and black-box debugging. Students who learn to read a partially revealed grid and reason about what configurations remain possible are practicing the same inferential discipline they will need when a system fails and the only available data is its error output.',
    ],
  },
  {
    name:        'Chess',
    path:        '/games/chess',
    thumbnail:   chessThumb,
    description: 'Command your pieces on the holodeck. Outmaneuver the enemy and claim the sector.',
    alternative: 'Chess',
    roles:       [],
    multiplayer: true,
    sectionId:   'sec-chess',
    tagline:     'The Command-Level Strategy Simulation',
    challengeId: 'chess',
    blurbs:      [], // chess copy is hard-coded in its featured section
  },
  {
    name:        'Picard Maneuver',
    path:        '/games/picard-maneuver',
    thumbnail:   picardManeuverThumb,
    description: 'Execute the legendary tactical flip and vanish before your opponent can track you.',
    alternative: 'Othello',
    roles:       [],
    multiplayer: true,
    sectionId:   'sec-picard',
    tagline:     'Positional Dominance and Cascading State',
    challengeId: 'picard-maneuver',
    blurbs: [
      'One well-placed move can flip a dozen of your opponent\'s pieces in a single turn — meaning positional advantage is volatile, and students who play reactively often find themselves winning on piece count until the final exchanges, when a single flip costs them the board. The simulation rewards forward-thinking: evaluating where a position will be in several moves, and recognizing that the move capturing the most pieces now is frequently the one that surrenders the most valuable ground later.',
      'This tension between local and global optimization recurs throughout algorithm design and systems architecture. Edge control, corner capture, and parity management — the advanced mechanics — all require reasoning about the entire state space rather than the immediate return. Students who internalize that distinction play more structured chess, write more maintainable code, and approach multi-step problems with significantly more patience.',
    ],
  },
  {
    name:        'Rules of Acquisition',
    path:        '/games/rules-of-acquisition',
    thumbnail:   mancalaThumb,
    description: 'Outplay your rival in the classic Ferengi game of resource and strategy.',
    alternative: 'Mancala',
    roles:       [],
    multiplayer: true,
    sectionId:   'sec-roa',
    tagline:     'Resource Cycles and Chain Reaction Planning',
    challengeId: 'rules-of-acquisition',
    blurbs: [
      'The rules are deceptively simple: distribute stones, capture more than your opponent. The strategy is not. Each move redistributes stones across the board for both players simultaneously, and when the last stone lands in an occupied pit, the chain continues — producing free moves that can swing the position dramatically if anticipated. Students who count pits before moving and trace redistribution chains two steps ahead develop a natural intuition for how sequential operations produce non-obvious cumulative effects.',
      'Mancala is one of the oldest games in recorded history, and it remains one of the most efficient at teaching the distinction between a tactic and a strategy. Reactive play produces marginal improvement and eventual stagnation. Students who simulate the redistribution mentally — essentially running a loop in their heads before executing — improve steadily and begin to recognize the same pattern of thinking that makes iteration and recursion intuitive when those concepts appear in a programming context.',
    ],
  },
  {
    name:        'Fractured Frontier',
    path:        '/games/fractured-frontier',
    thumbnail:   orbitalBombardmentThumb,
    description: 'Dial in your angle and power, account for gravity and solar wind, and bombard the enemy vessel into submission.',
    alternative: 'Scorched Earth',
    roles:       [],
    multiplayer: true,
    sectionId:   'sec-frontier',
    tagline:     'Trajectory, Terrain, and Iterative Calibration',
    challengeId: 'fractured-frontier',
    blurbs: [
      'The battlefield is a procedurally generated landscape. Your vehicle is a ground-based weapons platform with limited fuel. Each turn, you set an angle, choose your fire power, account for the terrain between you and the target — then watch where the shell lands. The gap between your prediction and the actual impact is the data you use to correct your next shot. Uphill movement costs more fuel. Missed shots cost turns. Precision compounds over time.',
      'This is the iterative debugging cycle made tactile: form a hypothesis, test it, measure the error, adjust. That loop — test, observe, correct, repeat — is the core rhythm of the scientific method, every A/B test, and every session spent tracing an unexpected program output back to its source. Students who can\'t commit to a systematic calibration approach will run out of fuel and lose; students who can will start to feel what disciplined iterative reasoning looks like before they need to apply it abstractly.',
    ],
  },
  {
    name:        'Minesweeper',
    path:        '/games/minesweeper',
    thumbnail:   minesweeperThumb,
    description: 'Sweep a cloaked minefield with your sensors. One wrong move and the fleet pays the price.',
    alternative: 'Minesweeper',
    roles:       [],
    multiplayer: false,
    sectionId:   'sec-minesweeper',
    tagline:     'Constraint Logic and Safe Cell Deduction',
    blurbs: [
      'Every number on the board is a constraint: it tells you exactly how many mines border that cell. The challenge is working multiple constraints simultaneously — a single cell is adjacent to several numbers, each independently narrowing what that cell and its neighbors can contain. Students who approach Minesweeper as a guessing game get stuck. Students who read the board as a constraint satisfaction problem — systematically eliminating impossible configurations — unlock clear solutions on boards that appeared genuinely ambiguous.',
      'The logical patterns here transfer directly to Boolean reasoning, formal proof, and compiler type inference. Identifying a cell that must contain a mine so that an adjacent cell can be safely opened is the same inference structure used in unit testing and constraint propagation. The grid itself also gives students an early visual reference for two-dimensional arrays and coordinate-indexed data structures before those abstractions appear in any programming context.',
    ],
  },
  {
    name:        'Isolinear Cascade',
    path:        '/games/isolinear-cascade',
    thumbnail:   isolinearcascadeThumb,
    description: 'A power surge has disrupted the isolinear chip array — fix it before critical systems are affected.',
    alternative: 'Lights Out',
    roles:       [],
    multiplayer: false,
    sectionId:   'sec-isolinear',
    tagline:     'Toggle Propagation and Interdependent State',
    blurbs: [
      'Each cell you activate toggles itself and all immediately adjacent cells. That propagation means no move is purely local — every action ripples outward, and the board state is always the cumulative product of every move made so far. Students who treat cells as independent quickly discover that random clicking makes the puzzle harder, not easier. Progress requires modeling the board as an interconnected system and reasoning about side effects before committing to a move.',
      'Lights Out puzzles are formally solvable using linear algebra over the binary field — the same Boolean arithmetic underlying XOR operations, parity checks, and checksums in real systems. Students don\'t need the algebraic formalism to benefit from the intuition it builds: that applying the same toggle twice cancels out, and that local decisions reliably produce global consequences. That last lesson generalizes to almost everything in engineering.',
    ],
  },
  {
    name:        'Warp Core Breach',
    path:        '/games/warp-core-breach',
    thumbnail:   WarpCoreBreachThumb,
    description: 'The warp core is overheating! Reroute the deuterium before it tears the ship apart.',
    alternative: 'Pipe Dream',
    roles:       [],
    multiplayer: false,
    sectionId:   'sec-warpcore',
    tagline:     'Path Construction Under Advancing Pressure',
    blurbs: [
      'Coolant is flowing. You must lay pipe sections ahead of it using whatever pieces the system provides, building a continuous path to the exit before the flow reaches a dead end and the breach becomes critical. Pieces cannot be repositioned once placed. Students who optimize locally — placing the best-looking piece in the best spot each turn — frequently build themselves into corners. Students who think several moves ahead and hold an incomplete path in working memory extend the run substantially.',
      'The structure here is path planning in a constrained, time-pressured graph: a start node, a target node, and a randomized sequence of available edges you must commit to before knowing what comes next. This connects to routing algorithms, network topology, and the broader concept that building toward a goal under uncertainty requires committing to an incomplete plan rather than waiting for certainty that never arrives.',
    ],
  },
  {
    name:        'Shuttle Bay',
    path:        '/games/shuttle-bay',
    thumbnail:   shuttlebayThumb,
    description: 'The bay is gridlocked. Maneuver the shuttle through the chaos and reach the exit.',
    alternative: 'Rush Hour',
    roles:       [],
    multiplayer: false,
    sectionId:   'sec-shuttlebay',
    tagline:     'Sequential Unblocking and State-Space Search',
    blurbs: [
      'The bay is gridlocked. Every shuttle can only move in the direction it faces, and yours cannot reach the exit until the right sequence of others has been cleared first. Harder puzzles require discovering that moving your shuttle first — the natural instinct — makes the puzzle unsolvable, because it closes off the only viable clearing sequence. Students who read the dependency chain backwards, from the exit inward, consistently outperform students who work forward from their current position.',
      'This is a constrained state-space search problem in puzzle form. The mechanics mirror depth-first search: try a sequence, reach a dead end, backtrack mentally, and try another path. Recognizing that move ordering matters — and that the obvious first move is sometimes the catastrophic one — trains students to think about branching, dependency graphs, and the difference between a plan that works locally and one that remains viable end-to-end.',
    ],
  },
];

const filteredGames = computed(() => {
  const role    = (userRole.value || '').toLowerCase();
  const visible = games.filter(game => {
    if (!game.roles || game.roles.length === 0) return true;
    if (isBroadcasting.value) return false;
    return game.roles.includes(role);
  });
  const chess = visible.find(g => g.name === 'Chess') ?? null;
  return {
    chess,
    multiplayer:      visible.filter(g => g.multiplayer),
    singleplayer:     visible.filter(g => !g.multiplayer),
    otherMultiplayer: visible.filter(g => g.multiplayer && g.name !== 'Chess'),
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
  margin-bottom: 1.25rem;
}

/* ── Section wrapper ─────────────────────────────────────────────────────── */
.game-section {
  margin-bottom: 2.5rem;
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

/* ── Navigation filmstrip ───────────────────────────────────────────────── */
/* All labels, cards, and divider are direct flex children.
   Cards get flex:1 so they share all remaining space equally;
   labels and divider are rigid (flex: 0 0 auto). */
.game-strip {
  display: flex;
  align-items: stretch;
  gap: 0.3rem;
  padding: 0.45rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(153, 153, 255, 0.2);
  border-radius: 0.625rem;
  margin-bottom: 2.5rem;
}

.strip-label {
  flex: 0 0 auto;
  align-self: center;
  font-family: 'Antonio', sans-serif;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #556688;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  user-select: none;
}

.strip-divider {
  flex: 0 0 1px;
  align-self: stretch;
  background: rgba(153, 153, 255, 0.2);
  margin: 0 0.25rem;
}

.strip-card {
  flex: 1;
  min-width: 0;
  position: relative;
  height: 3.5rem;
  border-radius: 0.3rem;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid rgba(90, 90, 160, 0.35);
  transition: border-color 0.2s, transform 0.2s;
}

.strip-card:hover {
  border-color: #9999ff;
  transform: scale(1.06);
  z-index: 1;
}

.strip-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: filter 0.2s;
}

.strip-card:hover .strip-img {
  filter: brightness(0.38);
}

.strip-name {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #ddeeff;
  font-family: 'Antonio', sans-serif;
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.25rem;
  line-height: 1.3;
  opacity: 0;
  transition: opacity 0.2s;
}

.strip-card:hover .strip-name {
  opacity: 1;
}

/* ── Chess featured card ─────────────────────────────────────────────────── */
.chess-feature {
  display: block;
  overflow: hidden;
}

.chess-card {
  float: left;
  width: 22rem;
  aspect-ratio: 4 / 3;
  margin: 0 1.75rem 1rem 0;
}

.chess-copy p {
  color: #aabbd4;
  font-size: 0.875rem;
  line-height: 1.7;
  margin: 0 0 0.85rem;
}

.chess-copy strong {
  color: #c8d8f8;
  font-weight: 700;
}

.chess-copy .chess-cta {
  color: var(--champsyellow);
  font-style: italic;
  margin-top: 1.25rem;
  margin-bottom: 0;
  font-size: 0.85rem;
}

/* ── Multiplayer / singleplayer game grids ───────────────────────────────── */
.group-block {
  margin-bottom: 2.5rem;
}

.group-header {
  font-family: 'Antonio', sans-serif;
  font-size: 1rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #556688;
  border-bottom: 1px solid rgba(153, 153, 255, 0.15);
  padding-bottom: 0.35rem;
  margin-bottom: 1.5rem;
}

.game-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem 2.5rem;
  align-items: start;
}

.game-grid .game-section {
  margin-bottom: 0;
}

.grid-section-label {
  font-size: 1.4rem;
  margin-bottom: 0.5rem;
}

.grid-thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  margin-bottom: 0.65rem;
}

.mini-copy p {
  color: #aabbd4;
  font-size: 0.82rem;
  line-height: 1.7;
  margin: 0 0 0.65rem;
}

.mini-launch-btn {
  background: rgba(100, 100, 220, 0.13);
  border: 1px solid rgba(153, 153, 255, 0.38);
  border-radius: 999px;
  color: #9999ff;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  padding: 0.35rem 1rem;
  text-transform: uppercase;
  transition: background 0.15s, border-color 0.15s;
  display: inline-block;
  margin-top: 0.15rem;
}

.mini-launch-btn:hover {
  background: rgba(100, 100, 220, 0.26);
  border-color: #9999ff;
}

/* ── Card: thumbnail fills, overlay slides up on hover ───────────────────── */
.game-card {
  position: relative;
  aspect-ratio: 16 / 9;
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

.challenge-card-btn {
  background: rgba(255, 153, 0, 0.18);
  border: 1px solid rgba(255, 153, 0, 0.5);
  border-radius: 999px;
  color: #ff9900;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0.25rem 0.6rem;
  transition: background 0.15s, border-color 0.15s;
  align-self: flex-start;
}

.challenge-card-btn:hover {
  background: rgba(255, 153, 0, 0.32);
  border-color: #ff9900;
}

@media (max-width: 50rem) {
  .chess-card {
    float: none;
    width: 100%;
    margin: 0 0 1rem;
  }

  .game-grid {
    grid-template-columns: 1fr;
  }

  .section-label {
    font-size: 1.4rem;
  }
}
</style>
