# CompuTrek CS — Comprehensive Application Description

> A Star Trek–themed, 7th-grade Computer Science learning management system built with Vue 3, TypeScript, and Firebase. Students are "Cadets" aboard the C.S.S. Curiosity. Teachers are officers. Assignments are missions. The whole experience lives inside an LCARS-inspired shell complete with ambient starfield backgrounds, Star Trek sound effects, and ship-status metaphors for academic health.

---

## Part I — The Cadet Experience

### 1. Authentication and Onboarding

When a Cadet navigates to CompuTrek for the first time they land on the **Landing Page** (`LandingPage.vue`), which serves as both the authentication portal and the visual first impression. The page presents three sign-in pathways depending on who is logging in.

**Google OAuth** is the standard path for students. Clicking "Sign in with Google" opens a popup (falling back to a full-page redirect on iOS Safari, where popups are unreliable). Firebase Authentication handles the OAuth handshake; the returned Google UID is then cross-referenced against the `approvedUsers` Firestore collection to verify the account is enrolled. If a match is found, the student's `displayName`, `uid`, `periodId`, and `teacherEmail` are loaded into the global auth state and persisted in `localStorage` — but notably the student's email is deliberately **not** persisted to localStorage, to avoid storing PII on shared school computers across sessions.

**Email/password login** is available for staff, and includes a first-time password-change flow gated by Firebase Auth. Staff accounts can also set a new password inline within the landing page UI.

**Demo/Civilian mode** provides a PIN-based quick-login for visitors or demo sessions. Entering the civilian PIN causes the app to atomically read a `demo/state` document in Firestore, take the next slot from a 10-slot rotating list of pre-provisioned demo accounts (named after TNG crew: Picard, Riker, Data, Troi, La Forge, Worf, Beverly Crusher, Wesley Crusher, Tasha Yar, Miles O'Brien), sign into Firebase Auth as that account, and increment the slot counter. A Cloud Function resets the demo accounts nightly.

A **Microsoft OAuth** flow is fully implemented and gated behind a `FEATURE_FLAGS.MICROSOFT_AUTH` boolean. When `true` (pending district Azure AD approval), a "Sign in with Microsoft" button appears and authenticates via the school district's specific Azure AD tenant, ensuring only district-issued accounts can use that button.

The login page plays Star Trek-style LCARS sound effects on keystrokes and successful/failed authentication events, setting the tone immediately.

**Roles** assigned at login gate everything downstream:
- `cadet` — a student, scoped to a specific teacher and period
- `staff` — a teacher, can see only their own periods and data
- `admin` — super-user (the teacher with admin access), sees all data across all periods with full edit rights
- `audit` — read-only admin; sees all data but cannot edit, grade, or modify anything
- `civilian` — any other visitor, view-only access via PIN

---

### 2. The Main Frame and Persistent Shell

Once authenticated, Cadets enter the **MainFrame** (`MainFrame.vue`) — the persistent shell that wraps every page in the app. This shell has several always-visible components.

**TopNav** (`TopNav.vue`) runs across the top of the screen. For Cadets it provides links to the core navigation destinations and displays the current user's name and period. For staff in normal mode it shows the admin nav toggle. The nav adapts to role.

**ChampsPanel** sits on the left side of the screen. CHAMPS is a classroom management acronym (Conversation, Help Signal, Activity, Movement, Participation, Success) that teachers use to communicate expectations to students in real time. Each of the six CHAMPS categories can be clicked by the teacher to cycle through preset values. Clicking the "CHAMPS" header resets all six to their defaults. The panel state is broadcast from the teacher's session so all Cadets in the active period see the same values simultaneously via Firestore real-time listeners. In Broadcast Mode (described later) the ChampsPanel remains interactive even for the teacher.

**The HUD** — the right-side panel trio — is composed of three stacked components:

**Timers panel** (`Timers.vue` with three sub-timers) shows:
- **Chrono1 / Ship's Time**: A live clock showing current local time, styled to match the Starfleet aesthetic. The label above it changes dynamically based on the current day type pulled from the academic calendar — "Normal Day," "Early Dismissal," "Rally Day," "Testing Day," "Minimum Day," "Interstellar Gas Day," etc.
- **Chrono2 / Mission Clock**: An interactive countdown to the end of the current class period. It pulls from a full-year bell schedule JSON that encodes every school day's start/end times and schedule type. The same color as the CHAMPS "SUCCESS" cell visually ties it to what the student should be completing right now.
- **Chrono3 / Objective Timer**: A teacher-controlled countdown to the end of the current classroom activity. Same color as the CHAMPS "ACTIVITY" cell. Teachers can set, pause, and reset it; students see changes in real time.

**TypingReport panel** (`TypingReport.vue`) shows the Cadet's personal typing statistics versus class averages. It has two metric groups: WPM (My Best WPM vs. Class Best WPM) and Accuracy (My Avg WPM vs. Class Avg WPM), displayed as segmented LCARS-style bar graphs with a numerical readout. A target WPM line is baked in so the bars fill toward a meaningful goal.

**MissionReports panel** (`MissionReports.vue`) shows the Cadet's mission submission health. It has two metric groups: Turn-In Rate (personal vs. class average) and Acceptance Rate (of what was submitted, how much was accepted by the teacher). Again displayed as segmented bars with numeric readout.

**HudShip panel** (`HudShip.vue`) sits in the center of the HUD. For Cadets it shows a vector-art SVG illustration of the C.S.S. Curiosity and acts as a link to the Systems page. For teachers/admins it becomes an interactive period selector — clicking opens a dropdown that lets the teacher switch the "active" period for CHAMPS broadcasting and timer sync.

**Background / Ambience**: The app renders an animated starfield behind all content. Three graphics modes are selectable:
- `high` — a full CSS 3D perspective-transform starfield where stars radiate outward as if flying through space, generated by JavaScript at runtime with randomized position and brightness
- `medium` — a Keith Clark–style 2D scrolling starfield where three layers of stars (small, medium, large) translateX continuously for a parallax warp effect
- `low` — minimal, for slower hardware

Optionally, the `/ambience` page provides a curated library of authentic Star Trek ambient soundscapes (Holodeck, Enterprise-D bridge, Bird of Prey bridge, shuttlepod, quarters, Ten Forward casino, etc.) that Cadets can play in a background tab while working. Multiple tracks are available from several different ships and locations.

The shell also contains an **IdleWarning** component that detects 45 minutes of inactivity (no mouse, keyboard, pointer, touch, or scroll events) and silently reloads the page to clear accumulated memory on shared school hardware. The timer resets on any user interaction and is suppressed while a Broadcast session is active.

---

### 3. Home Page

After logging in, Cadets see the **Home** page (`HomeMain.vue`). The content is role-conditional:

For **Cadets**, it presents a polished written overview of the course — its purpose, core focus, learning objectives, and instructional philosophy — written from the perspective of the teacher as "Chief Science Officer of the C.S.S. Curiosity." The language is intentionally Star Trek-flavored: students are described as Cadets preparing to navigate the digital frontier, with computing fundamentals framed as the technology powering starships.

For **Staff**, the home page doubles as an internal wiki — a UI walkthrough explaining each component of the interface (the HUD panels, CHAMPS interaction, timers, etc.) and an evolving "Still To Do" list of planned features.

Both role views end with a **"Meet the Crew"** card that links to the Crew page.

---

### 4. Courses

The **Courses** section (`CoursesMain.vue`, `CoursesUnitMain.vue`, `CoursesLessonMain.vue`) is the curriculum hub. The app supports two parallel course tracks based on a `CourseData.json` file:

**CompSci track** covers five units:
- Unit 1: Problem Solving and Computing — introductory CS, problem-solving processes, computational thinking, design and build a simple app
- Unit 2: Web Development and Digital Citizenship — HTML/CSS, multi-page websites, digital safety, critical media consumption
- Unit 3: Programming with Music Lab — coding fundamentals through music composition and remixing, sequencing, loops, functions, culminating in a genre mash-up project
- Unit 5: Data and Society — data representation, data collection, automation, and a final data-driven solution project
- Unit 7: AI and Machine Learning — how computers learn from data, building machine learning models, designing a machine learning app around a real-world problem

**MultiMedia track** covers three units:
- Unit 1: Design History and Foundations — illuminated manuscripts to digital design, core design vocabulary
- Unit 2: Branding, Heraldry, and Identity — heraldry, logo systems, personal crest and logo design
- Unit 3: Visual Storytelling and Multimedia Production — storyboarding, motion graphics, short promotional video

Each unit is divided into **Chapters**, each containing multiple **Lessons**. Every lesson carries: a lesson ID, title, overview paragraph, big-picture question, content description, up to five learning objectives, and a list of resources (activity guide, slides, etc.). Lessons link to Google Slides presentations (with a full-year URL registry maintained in `Unit07Data.json` for the AI unit), PDFs, and in some units, interactive in-app lesson activities.

The **Data and Society** unit (Unit 5) has seven fully interactive in-app activities built as Vue components:
- `L01CrewMealSort.vue` — sorting activity about data organization
- `L02EncodingBuilder.vue` — encoding/decoding exercise
- `L03SubspaceDecoder.vue` — pattern recognition and decoding
- `L04HolodeckImager.vue` — image representation / pixel data
- `L05WarpCorePower.vue` — warp core energy data visualization
- `L06PersonnelRecord.vue` — structured data / records
- `L07KlingonDecrypt.vue` — encryption and decryption activity

Lessons open inside a `LessonLayout.vue` wrapper that provides a consistent framing shell around both interactive activities and slide embeds. A `UnitHeaderBar.vue` component shows progress within the current unit.

---

### 5. Typing Lab

The **Typing Lab** (`Typing.vue`, and the three sub-pages) is one of the most technically sophisticated areas of the app. It is a full custom typing engine — not a wrapper around any third-party service.

#### 5.1 The Typing Engine

The core is `useTypingEngine.ts`, a composable that processes every keystroke in real time. Key design decisions:

- **Forgiving mode**: Errors advance the cursor rather than blocking it. This is intentional for 7th graders — forcing them to backspace on every error often causes more frustration than learning.
- **Error attribution**: When an error occurs, it is recorded against the *expected* key (not the wrong key typed). This means the `keyErrors` map tells you "the student struggles with the letter F" rather than "the student pressed G a lot."
- **Active time tracking**: The engine distinguishes between total elapsed time and *active* typing time. Gaps longer than 4 seconds between keystrokes are excluded from the active time calculation, so pausing to think doesn't inflate the session duration.
- **Live WPM**: A 1-second interval ticker updates `liveWpm` and `liveAccuracy` throughout the session using the standard 5-characters-per-word gross WPM formula.
- **Result object**: On completion, `buildResult()` returns a typed `TypingResult` object containing: wpm, accuracy, duration (total seconds), activeSeconds, charsTyped, and a `keyErrors` record of missed counts per expected key.
- **Force complete**: A `forceComplete()` method allows the speed test timer to end a session early and still generate a result.

#### 5.2 Typing Hub and Lesson Progression

The **Typing Hub** (`Typing.vue`) organizes lessons into two progressions visible in tabs:

**Lessons tab**: Lessons are divided into sections:
- **Foundations** — home-row, basic finger placement, introductory keys
- **Core Skills** — unlocked after passing a Section 1 checkpoint test
- Further advanced sections unlock progressively as earlier ones are passed

Each lesson row shows the lesson title, focus keys (e.g., "F · J · D · K"), character count, and a completion indicator (✓ for passed, 🔒 for locked, › for accessible-but-not-yet-done). Some lessons are marked as **Checkpoints** (🎯), which are timed tests only openable during class hours (controlled by the admin's test-open window).

**Custom Text tab**: Teachers can post custom text passages to their class. Cadets see these as an additional typing mode. The tab is disabled and shows "None posted" when no custom texts exist for the period.

**Weakness Drill tab** (Phase 3, currently disabled): Planned future feature that will generate targeted drill passages based on the student's worst-performing keys from their `keyErrors` history.

#### 5.3 Speed Test

`TypingSpeedTest.vue` is a standalone 60-second timed test. The engine counts down, force-completes at zero, and saves the result. A personal-best banner appears if the session beats the student's all-time record for speed tests.

#### 5.4 Lesson Pages

`TypingLesson.vue` delivers a single lesson. It uses `useTypingContent.ts` to fetch the lesson passage from Firestore (`typingLessons` collection, created by teachers). The lesson page shows the target text with each character color-coded as the student types: green for correct, red for error, gray for untyped, with a blinking cursor at the current position. The on-screen `TypingKeyboard.vue` displays a full QWERTY keyboard that highlights which keys are in the current lesson's focus set and which keys have recent error history.

After completion, `TypingResultsCard.vue` shows the session summary: WPM, accuracy, a per-key error breakdown for the focus keys of that lesson, and the personal best for this specific lesson if a previous attempt exists.

`TypingCustomText.vue` delivers the same experience but for teacher-posted custom passages rather than structured lessons.

---

### 6. Games

CompuTrek contains over a dozen fully custom games, all built from scratch in Vue 3 with TypeScript engines, styled with the LCARS aesthetic, and integrated with the game scoring and multiplayer systems.

Each game has two route components: a **landing/lobby page** (e.g., `ShuttleBay.vue`) that explains the game, shows the player's high score and a period leaderboard, and provides options to play solo, start an online match, or join by code — and a **game page** (e.g., `ShuttleBayGame.vue`) that renders the actual gameplay.

The full list of games:

**IsolinearCascade** — A puzzle/match game themed around rearranging isolinear chips. Includes hand-authored puzzle sets (`IsolinearCascadePuzzles.ts`) with escalating difficulty.

**WarpCoreBreach** — A logic/deduction puzzle. Premade puzzle sets (`WarpCoreBreachPuzzles.ts`) encode the configuration and solution for each level.

**ShuttleBay** — A sliding puzzle game where the player rearranges a shuttlecraft image by sliding tiles. Puzzle configurations in `puzzles.ts` define different layouts and difficulty levels. Two Vue components: the board container and `ShuttleBayPiece.vue` for individual tiles.

**PicardManeuver** — A two-player board game (Othello/Reversi-style mechanics). Fully multiplayer capable. The engine (`PicardManeuver/engine.ts`) handles board state, legal moves, and win detection. Initial board state is serialized to a string for Firestore sync.

**RulesOfAcquisition** — A two-player mancala game. The engine tracks the pit-and-store mechanics of Mancala/Kalah. Board state is serialized as a string for multiplayer sync.

**BattleOfTheMutaraNebula** — A two-player Battleship-style game. The engine (`BattleMutaraNebula/engine.ts`) manages fleet placement, shot history, and hit detection. Full game state is JSON-serialized for multiplayer.

**FracturedFrontier** — A two-player orbital bombardment/strategy game. Engine builds an initial state that is JSON-serialized for Firestore room sync.

**Chess** — Full chess implementation with three variants: Standard, Chess960 (Fischer Random, with randomized starting positions generated by `chess960.ts`), Crazyhouse (drop captured pieces, with pocket state tracked), and Racing Kings and Horde (additional variants from `chess-variants.ts`). Crazyhouse maintains per-player piece pockets in the Firestore `game_rooms` document.

**Jeopardy** — A teacher-run class Jeopardy game (staff/admin only). Runs in a projector/broadcast context.

**Minesweeper** — Classic Minesweeper with three difficulty levels: Cadet (easy), Standard, and Red Alert (hard). Scores are time-based (lower = better), tracked with `lowerIsBetter: true` in `useGameScores`.

**BattleMutaraNebula** (see above)

#### 6.1 Game Scoring

`useGameScores.js` is the unified scoring composable used by all games. A game score document in the `gameScores` Firestore collection has the path `{uid}_{gameId}` and stores: uid, displayName, periodId, schoolYearId, gameId, lowerIsBetter flag, highScore, and lastUpdated timestamp.

Three scoring patterns are supported:
- `submitScore(newScore)` — write if better (high score games)
- `submitScore` with `lowerIsBetter: true` — write if lower (time-based games like Minesweeper)
- `incrementScore(amount)` — add to a running total (Chess win counter, orbital bombardment cumulative damage)

The `autoLogCompletion()` method runs after every game outcome (win, loss, or draw) and does double duty: it fires an `activityLogs` entry, then queries `submissions` for any of the student's assignments that are in `assigned` or `started` status and match this `gameId`. If found, it auto-advances the submission to `submitted` status — completing the mission automatically when the game is played. For multi-play missions (where `repeatCount > 1`), it uses a Firestore transaction to atomically increment `gamesCompleted` and only submits when the count reaches `repeatCount`.

Period leaderboards (`fetchPeriodLeaderboard`) query `gameScores` filtered by `gameId` and `periodId`, ordered by `highScore` with the direction controlled by `lowerIsBetter`.

#### 6.2 Multiplayer Challenge System

The challenge system (`useChallenges.ts`) allows any Cadet to challenge a classmate to a real-time multiplayer game. The system works as follows:

A Cadet opens the **ChallengeBadge** component (rendered in the TopNav), which on mount calls `initBadge(uid)` to set up three concurrent Firestore `onSnapshot` listeners:
- **Incoming challenges**: watches `challenges` where `challengedId == uid` and `status == 'pending'`
- **Outgoing challenges**: watches `challenges` where `challengerId == uid` and `status == 'pending'`
- **Accepted outgoing**: watches `challenges` where `challengerId == uid` and `status == 'accepted'`

When a Cadet wants to challenge someone, the **ChallengeModal** (`ChallengeModal.vue`) opens with a roster of their period's online classmates, filtered by the presence system. Selecting a game (Chess, Picard Maneuver, Rules of Acquisition, Battle of the Mutara Nebula, or Fractured Frontier) and a variant (for Chess: Standard, 960, Horde, Racing Kings, Crazyhouse) sends a `challenges` document with a 5-minute expiry timestamp.

The challenged Cadet sees the **IncomingChallengeModal** pop up. Accepting it calls `acceptChallenge()`, which: generates the game's initial board state from the appropriate engine, calls `createOnlineGame()` to write a `game_rooms` document in Firestore with a randomly generated join code, updates the challenge document to `accepted` with the new room ID and join code, and routes the accepter directly into the game page with `mode=online&room=...&role=host`.

The acceptedOutgoing listener on the challenger's side detects the status change, calls `joinOnlineGame()` with the join code, and routes the challenger into the same game room as guest.

Challenges expire after 5 minutes. A declined challenge sets status to `declined`. An in-progress game can be terminated (both players get routed out, the room is marked terminated).

The `game_rooms` Firestore documents are synchronized in real time during gameplay by `moveSyncService.ts` (which subscribes to the document and broadcasts board state changes) and `reconnectService.ts` (which handles page refreshes by restoring room/color from localStorage and URL params — with graceful fallback when localStorage is cleared by the browser).

#### 6.3 Presence System

`usePresence.ts` tracks whether each Cadet is currently online using Firebase **Realtime Database** (not Firestore). On login, `goOnline(uid)` writes `{ online: true, lastChanged: serverTimestamp }` to `presence/{uid}` and registers an `onDisconnect` handler so Firebase's servers automatically flip `online` to `false` if the tab closes or the network drops. On logout or page hide, `goOffline(uid)` cancels the disconnect handler and explicitly writes `online: false`.

The RTDB is used exclusively for presence to take advantage of its `onDisconnect` capability, which Firestore does not offer. Only opaque UIDs are stored — no names, emails, or period information ever touch RTDB. The ChallengeModal calls `subscribeToPresence(uids)` with a list of UIDs already verified to belong to the student's own class (sourced from `loadRoster()` which queries Firestore), attaching individual `onValue` listeners that update a reactive `presenceMap: Record<uid, boolean>`. This map drives the online/offline indicators in the challenge roster.

---

### 7. Student Dashboard (Missions)

The **Student Dashboard** (`StudentDashboard.vue`) and **Student Missions** page (`StudentMissions.vue`) are where Cadets track and submit their assigned work.

Missions (the admin's reusable templates) are deployed to students as **Assignments**. When a teacher deploys a mission to a period, a fan-out process creates one `submissions` document per enrolled student. Each submission document tracks the state of that individual student's work through a lifecycle:

`assigned` → `started` → `submitted` → `graded` or `returned`

From `returned`, a student can `acceptGrade` (finalizing as `graded`) or re-submit revised work.

The Student Dashboard fetches all submissions for the current student filtered by the current quarter and school year ID. It groups them by status to give the student a clear picture: what's due, what's been turned in, what's been graded, and what has been returned for revision.

**Submission types** vary by mission delivery item:
- `file-upload` — the student uploads a file (Google Drive link, image, etc.) directly in the app. The file URL is stored in the submission's `data.url` field.
- `manual` — each delivery item has a checkbox (componentCheck). When all manual items are checked by the teacher, the submission auto-advances to `submitted`. Un-checking a box reverts to `assigned`.
- `auto` — game completion auto-submits via `autoLogCompletion()` in `useGameScores`.

**Due dates and extensions**: Each submission has a `dueDateOverride` field that teachers can set to grant an individual extension. The override date takes precedence over the assignment's shared `dueDate` when calculating lateness. An extension log (`extensionLog` array) records each extension with type (sick/sports), granted-by email, from-date, and to-date.

**Late penalties**: If an assignment has `penaltyPctPerDay` set, `useLatePenalty.ts` calculates the deduction: `min(daysLate × penaltyPctPerDay, maxPenaltyPct)` applied to the mission's `pointsPossible`. The effective due date used respects `dueDateOverride`.

---

### 8. Seating Chart (Cadet View)

The **Seating Chart** (`SeatingChart.vue`) shows the Cadet a read-only view of their classroom's current seat layout. It fetches the chart document from Firestore scoped to their `periodId` and `teacherEmail`. In **Broadcast Mode**, the seating chart automatically updates to whichever period the teacher has active, so a projector display always shows the correct room layout without the teacher having to navigate.

The layout is a configurable grid of seats (5×6, 4×9, 5×9, or 6×6 group tables with optional row/column gaps for aisles). Each occupied seat shows the student's name. Empty seats are blank. The teacher's name appears as a header.

---

### 9. Crew Page

The **Crew** page (`Crew.vue`) renders a personnel manifest — a roster of students, officers, and staff aboard the C.S.S. Curiosity. Student data is sourced from `crew.json` and rendered in a Star Trek PADD–style layout. This is a static showcase page rather than a live Firestore query, giving the teacher full control over how the "crew" is presented.

---

### 10. Documents

The **Documents** page (`Documents.vue`) provides a navigable library of course resources: activity guides, handouts, reference sheets, and other PDFs or external links. Materials are organized by unit and lesson. Clicking a document opens it in an in-app modal (`PdfModal.vue` for PDFs, `PowerPointModal.vue` for Google Slides embeds) rather than navigating away.

---

### 11. Decks

The **Decks** section (`Decks.vue` and `pages/decks/Deck00.vue` through `Deck08.vue`) provides a set of nine purpose-built interactive reference pages — think of them as interactive handouts or lab stations. Each Deck is a standalone Vue page with its own content and layout. Route definitions are in `deckRoutes.js`. These can be used by teachers as station activities or reference materials projected on screen.

---

### 12. Ship's Systems

The **Systems** page (`Systems.vue`) renders an interactive SVG diagram of the C.S.S. Curiosity (`ShipDiagram.vue`). The ship is divided into clickable sectors, each mapped to a class period. Clicking a sector opens a **SystemModal** (`SystemModal.vue`) that describes the ship system (Power Core, Propulsion, Navigation, Weapons, Communications, Life Support, Port Thruster Assembly, Starboard Thruster Assembly, Cockpit) along with:

- **Live health bar** derived from that period's `shipStatus` document (explained fully in the Admin section)
- **System bonus** — a flavor description of what happens to the whole ship when that period is performing well (e.g., the Power Core period's high health "Powers up all other systems — the whole ship gets a small XP boost")
- **System status** derived from health thresholds: Full Signal (≥90%), Commendation (≥70%), Battle Ready (≥50%), Off-Duty (<50%)

The `shipStatus` collection is subscribed to via a single shared `onSnapshot` listener (singleton pattern — opened once for the entire app session regardless of how many components call `useShipStatus()`), so all period health values update in real time across every component that displays them.

---

### 13. Stellar Cartography

The **Stellar Cartography** page (`StellarCartography.vue`) is a visual explorer of the Fresno Unified School District's K–12 feeder structure. It has two view modes:

**By Region** shows each of the FUSD regions as a card, with each region's elementary, middle, and high schools listed with their school type color-coded (elementary, middle, high, districtwide). A search bar filters schools across all regions in real time.

**Pipeline** shows the vertical feeder pathway — how elementary schools feed into middle schools which feed into high schools — as a flow visualization.

The underlying data comes from `fusd-regions-2526.json`. This page serves as a supplementary resource for teachers to understand the district context of their students.

---

### 14. Conduct Log (Cadet View)

Cadets can navigate to `/conduct` to see their own **Conduct Log** — a personal feed of all behavioral entries logged by their teacher throughout the year. Each entry shows: date, reason category (Participation, Respect, On Task, Effort), type (positive/negative/neutral), the score delta (+1/−1/0), note from the teacher, and whether it was teacher-authored or automatically generated at period close.

The feed is ordered reverse-chronologically, pulling from the `conductEntries` Firestore collection filtered to the student's UID. Automatic "no change" entries (generated by the Close Period function) are labeled with the system message "All systems nominal. Conduct holding steady."

---

### 15. Adventure (D&D Club)

The **Adventure** page (`Adventure.vue`) is a supplementary resource page for an after-school D&D club. It shows thumbnails for world maps (full-size Drenwal world map, the Vale region map), a slideshow, and a Google Slides embed — all openable in in-app modals. This is a fully self-contained section with no Firestore dependency, existing alongside the main CS curriculum.

---

### 16. Opening Sequence

The `/opening` route (`Opening.vue`) plays the app's intro animation — a cinematic sequence with the starfield warp effect and the CompuTrek animated logo (`CompuTrekAnimated.vue`), accompanied by the Main Title and LCARS bridge warmup audio. Teachers can navigate to this from the admin panel to display on a projector at the start of class.

---

### 17. Settings

Cadets can access a personal **Settings** page where they can adjust their display preferences (graphics quality: High / Medium / Low — controlling which starfield tier renders), toggle sound effects, and update their account.

---

## Part II — The Admin Experience

### 1. Authentication and Role Elevation

Admins and Staff log in via the same Landing Page as Cadets, using Google OAuth or email/password. The `approvedUsers` Firestore document for a staff member carries `role: 'staff'` and a `periodIds: string[]` array listing which periods they teach. The admin account has `role: 'admin'`.

**Admin Emulation**: The admin can "emulate" any teacher's perspective. Calling `startEmulation(teacherEmail)` sets a session-only `emulatingEmail` ref that causes all Firestore read queries to scope to the emulated teacher's data — so the admin sees exactly what that teacher sees. Writes always use the real admin's email. Emulation is never persisted to localStorage and is cleared on logout.

**Route Guards**: Three guard functions protect admin routes:
- `staffAdminGuard` — allows `staff` or `admin`
- `adminGuard` — allows `admin` only
- `staffAdminAuditGuard` — allows `staff`, `admin`, or `audit`

---

### 2. Admin Hub

The **Admin Hub** (`AdminHub.vue`) is the command center — a grid of cards linking to every major admin tool. It is gated by `staffAdminAuditGuard`. Cards: Dashboard, Mission Library, Grading, Reports, Stellar Cartography, Users (admin-only), Typing Lab, Seating Chart, Demo Seeder (admin-only), and Year-End (admin-only).

---

### 3. Admin Dashboard

The **Admin Dashboard** (`AdminDashboard.vue`) is the primary operational view for managing a live class day. It has two modes toggled by a period switcher at the top.

**ALL view** shows:

**Period Health panel** — a 2×3 cascade chain visualization. Periods 1, 3, 5 form the "Odd Shift" cascade; Periods 2, 4, 6 form the "Even Shift" cascade. Each period is shown as a circular node color-coded by health tier. If all periods in a chain are ≥70% health, a "⚡ ALL PERIODS NOMINAL" badge appears. Below the cascade, individual period cards each show a health percentage bar, a color-coded tier badge (Full Signal / Commendation / Battle Ready / Off-Duty), pending submission count, and overdue count. Clicking "View at-risk →" navigates to the Reports page filtered to that period's at-risk students.

**Grading Queue panel** — a real-time list of how many submissions are in `submitted` status per period, using `onSnapshot` on the `submissions` collection filtered by `status: 'submitted'` and `schoolYearId`. Staff see only their assigned periods' queue; admins see all. Clicking any row navigates to the Grading page pre-filtered to that period.

**Active Challenges panel** (`ActiveChallengesPanel.vue`) — shows all currently pending and in-progress challenges across all periods (or filtered to one period in single-period view), so teachers can monitor student-to-student game activity in real time.

**Warp Core Status** — a grid of `WarpCorePanel` components, one per active period.

**SINGLE-PERIOD view** (selected via the period pills) adds:

**Live Roster panel** (`LiveRosterPanel.vue`) — a real-time list of which students in the selected period are currently online, derived by combining the period's `approvedUsers` roster with the presence system's `presenceMap`.

**At-Risk panel** (`AtRiskPanel.vue`) — flags students whose `submissions` data shows overdue or missing work, surfacing intervention targets.

#### 3.1 Warp Core Energy System

`useWarpCore.ts` computes a live energy percentage for a single class period, displayed in `WarpCorePanel.vue`. The system works as follows:

Every 60 seconds (configurable via `POLL_INTERVAL_MS`), the composable queries Firestore for:
1. All assignments due **today** for the period that have a `category` field (`warmUp`, `lesson`, or `extension`)
2. All submissions for those assignments, filtering for those with status in `{submitted, graded, returned}`

It counts unique students who have completed work in each category and divides by total enrollment to produce a `progress` fraction (0.0–1.0) for each of the three phases. These three fractions are then weighted: warm-up contributes up to 20% of total Warp Core Energy, lesson up to 60%, extension up to 20%. The resulting display is a set of segmented bars showing how much of the class period's energy is "online."

If today has no categorized assignments, `noSession: true` is set and the panel shows a "no active session" state rather than empty bars. Student count is fetched once at mount and cached for the lifetime of the composable instance since rosters don't change mid-class.

---

### 4. Mission Library

The **Mission Library** (`MissionLibrary.vue`) is the teacher's mission template editor. It connects to `useMissions.ts` for Firestore CRUD.

A **Mission** is a reusable template that describes what students need to do. It has:
- `title` and optional `summary` (a short description shown in listings)
- `description` (rich text, the full assignment instructions, rendered via `RichTextEditor.vue`)
- `deliveryItems` — an array of `DeliveryItem` objects that describe how the assignment reaches students and how completion is tracked
- `pointsPossible` and `rubric` (an array of `{label, points}` criteria)
- `teacherEmail` (stamped at creation, never changed)
- `unitId` (optional tag to organize missions by curriculum unit)
- `archived` flag (soft delete)
- `createdAt` timestamp

**Delivery Items** are the heart of the mission system. Each item has:
- `kind`: `pdf` | `link` | `paper` | `game`
- `submissionMethod`: `file-upload` | `manual` | `auto`
- Kind-specific fields: `name`/`url` for PDFs, `label`/`url` for links, `gameId`/`variant`/`repeatCount` for games

A mission's legacy `type` field (`'file'`, `'game'`, `'manual'`) is automatically derived from its `deliveryItems` by `deriveMissionType()` for backward compatibility.

**The library is shared across all teachers** — any teacher can see and deploy any mission. `teacherEmail` on the mission is attribution, not access control. Access control lives on `assignments`.

From the library, teachers can: create new missions, edit existing ones, archive (soft-delete) missions. The UI has a search/filter by unit, and an inline editor for the rubric.

---

### 5. Mission Deployment (Assign to Period)

From the Mission Library, a teacher "deploys" a mission to a period. `deployMission()` in `useAssignments.ts` performs this four-step operation:

1. **Creates an `assignments` document** with: `missionId`, `periodId`, `dueDate` (YYYY-MM-DD or null), `quarterId` (derived from dueDate via `getQuarterIdForDate()`), `schoolYearId`, `teacherEmail`, `assignedAt`, optional `category` (WarpPhase), optional late-penalty config (`penaltyPctPerDay`, `maxPenaltyPct`), and optional game override (`deployGameId`, `deployGameVariant`).

2. **Queries `approvedUsers`** for all cadets in the target period (`role == 'cadet' && periodId == targetPeriod`).

3. **Batch-writes one `submissions` document per student** (Firestore batched writes up to 500 ops, safe for class sizes). Each submission is initialized with `status: 'assigned'`, empty `data: {}`, null `submittedAt`, empty `feedbackNote`, and null `dueDateOverride`. Manual delivery items get `componentChecks` initialized with `{done: false, doneAt: null}` per item index. Game delivery items get `gameId` and optionally `gameVariant` and `repeatCount`/`gamesCompleted` stamped on the submission.

4. **Calls `onAssigned()`** from `useMissionStatsWriter.ts` (fire-and-forget) to increment the period's stats counter.

Transfer students who joined after the original fan-out can be added individually via `addStudentToAssignment()`, which is idempotent (guards against creating duplicate submissions).

Deleting an assignment cascades-deletes all its submissions (batched in 499-doc chunks to respect Firestore batch limits).

---

### 6. Grading

The **Grading View** (`GradingView.vue`) has four tabs:

**Overview** — a quick grid of all periods, each showing how many submissions are pending review (status `submitted` or `returned`). Color-coded urgency: clear (0), has-work (1–4), urgent (5+). Clicking any cell navigates to By Assignment filtered to that period.

**By Assignment** — the primary grading workflow. The teacher selects a period, then an assignment. The view loads all submissions for that assignment/period combination via `fetchByAssignment()`. For each student, it shows their name, submission status, uploaded file link or game score, and a grade input with points field and feedback note. The teacher can: grade (set `pointsEarned`, move to `graded`), return (set `pointsEarned` with partial credit, move to `returned` for the student to see and accept), ungrade (revert to `submitted`), or delete a submission. Manual missions show each delivery item's checkbox state. The teacher can check/uncheck component items, which auto-advances to `submitted` when all are checked.

**By Student** — loads a full student roster, lets the teacher click any student to see all their submissions across the entire school year in one view. A search bar filters the roster. An "At-risk only" toggle filters to students who have overdue or returned work.

**Gradebook** — a `GradebookTab.vue` spreadsheet-style view showing all students as rows and all assignments as columns, with grades in the cells. Provides an at-a-glance class health view.

Every grading action calls `onGraded()` from `useMissionStatsWriter.ts` (fire-and-forget) to keep the period stats counter in sync, and calls `recalculateShipHealth(periodId)` from `useShipStatus.ts` to recompute and write the period's health score immediately.

---

### 7. Ship Health Calculation

`recalculateShipHealth(periodId)` is called after every grade or return. It:

1. Fetches **all submissions** for the period/school year
2. Fetches **all assignments** for the period/school year to get due dates
3. Fetches **all referenced missions** to get `pointsPossible` for each
4. Walks every submission applying inclusion rules:
   - `graded` or `returned`: count actual `pointsEarned / pointsPossible`
   - `assigned` + past effective due date: count as `0 / pointsPossible` (overdue zero)
   - `assigned` + not yet due: **exclude** (no penalty for future work)
   - `submitted` (awaiting grading): **exclude** (benefit of the doubt)
5. Computes `health = totalEarned / totalPossible × 100` (one decimal place), or 100 if no countable work yet
6. Writes the result to `shipStatus/{periodId}` with `health`, `gradedCount`, `overdueCount`, `totalEarned`, `totalPossible`, `lastUpdated`

This document is then immediately visible everywhere via the shared singleton `onSnapshot` listener.

---

### 8. Reports

The **Reports** page (`AdminReports.vue`) is the analytics console. It has five tabs:

**EOP (End of Period)** — the most operationally useful tab. `useEndOfPeriodReport.ts` computes an end-of-period health snapshot for the selected period. It shows: typing session summary, mission completion summary, conduct log entry summary for today. Teachers use this at the end of each class to quickly review what happened.

**By Student** — a roster of all students in the selected period with health indicators. Clicking a student navigates to `AdminCadetDetail.vue` — the individual student drill-down.

**Trends** — longitudinal views of class performance over quarters.

**Gradebook** — same as in GradingView, accessible here for analytics context.

**Typing** — three sub-tabs powered by `useTypingDashboard.ts`:
- *Overview*: class-wide stats (total sessions, average WPM, best WPM, average accuracy)
- *By Period*: a per-period breakdown table showing sessions, students active, avg WPM, best WPM, avg accuracy
- *All Cadets*: a sortable table of every student with their session count, avg WPM, best WPM, avg accuracy, and last active timestamp. A search bar filters by name. A top-10 "hall of fame" shows the fastest typists. A "Most Missed Keys" chart shows which keys are causing the most errors class-wide.

---

### 9. Admin Cadet Detail

`AdminCadetDetail.vue` (route `/admin/cadet/:uid`) is the per-student deep-dive. It is organized into panels:

**Conduct panel**: Shows the student's current conduct score (0–4 scale, color-coded), with the full `conductEntries` feed filterable by quarter. Shows `conductRatings` end-of-period structured scores with four categories (Participation, Respect, On Task, Effort, each 1–5) and computed averages. The teacher can log new conduct entries directly from this panel — positive, negative, or neutral — selecting from the four reason categories and writing an optional note.

**Submissions panel**: Shows all the student's submissions for the current school year with their statuses, due dates, scores earned, and feedback notes.

**Typing panel**: Shows the student's typing history — recent sessions with WPM, accuracy, mode, and completion date. Best WPM and best accuracy are highlighted.

**Game Scores panel**: Shows the student's high scores across all games.

**CadetSlideOver** (`CadetSlideOver.vue`): A slide-in panel (accessible from the seating chart) providing quick access to conduct logging for a specific student without leaving the seating view.

---

### 10. Conduct System

The conduct system has two data structures: **ConductEntries** and **ConductRatings**.

**ConductEntries** (`conductEntries` collection) are anecdotal mid-class notes. Each entry has: `studentId`, `studentName`, `teacherEmail`, `periodId`, `schoolYearId`, `quarterId`, `type` (positive/negative/neutral), `source` (teacher/auto), `reason` (participation/respect/onTask/effort/auto), `scoreDelta` (+1/−1/0), `scoreAfter` (the student's score after this entry), `note`, `date` (YYYY-MM-DD), and `loggedAt` timestamp.

The conduct score on `approvedUsers` is a 0–4 integer clamped by `clampScore()` in `useConductScore.ts`. Each positive entry adds 1; each negative deducts 1.

**Bulk conduct entries** (`logEntryBulk()`) can log conduct for an entire class at once in a single batched Firestore write — useful for "whole class was excellent today" moments.

**Close Period** (`closePeriod()`) queries all existing conduct entries for today/period, identifies which students have no entry yet, and batch-writes neutral auto entries ("All systems nominal. Conduct holding steady.") for them. This ensures every student has a daily record even if no behavioral events occurred. Returns `{created, skipped}` counts.

**ConductRatings** (`conductRatings` collection) are structured end-of-period assessments with four numeric scores (1–5 each): participation, respect, onTask, effort. `computeAverages()` derives per-category and overall averages from a set of ratings.

---

### 11. Typing Lab (Admin)

`TypingLessonAdmin.vue` has two sections: **Structured Lessons** and **Custom Texts**.

**Structured Lessons** section: The teacher sees the full lesson progression (Foundations, Core Skills, etc.) with admin-specific row actions. Each row shows lesson title, focus keys, character count, and archive status. The teacher can:
- **Edit** a lesson: modify title, passage text, focus keys, lesson type (keys/review/practice/play/drill/lesson/test/placement-test), WPM target, accuracy target, order within section, and whether it's a checkpoint
- **Archive/Restore** a lesson (soft delete — students with passing records retain them)
- **Create new lessons** with the full editor

**Custom Texts** section: The teacher posts arbitrary text passages for students to type. Each custom text has a title, the passage, an optional associated period (to scope it to one class), and active/archived state. Students see the Custom Text tab populated with whatever the teacher has posted for their period.

Lesson data is stored in `typingLessons` Firestore collection. Custom texts in `typingCustomTexts`.

---

### 12. Seating Chart (Admin)

`AdminSeatingChart.vue` provides a drag-and-drop seating arrangement tool. The teacher selects a period, chooses a layout preset (5×6, 4×9, 5×9, or 6×6 group tables), and drags students from an unplaced roster into specific grid positions. The resulting `SeatsMap` (keyed by `r{row}c{col}`) is written to `seatingCharts/{periodId}_{sanitizedTeacherEmail}` in Firestore.

The admin seating chart also supports **bulk conduct actions** directly from the seat grid — clicking a student's seat shows a quick-action card for logging positive/negative conduct, or opening the `CadetSlideOver` for the full detail panel.

---

### 13. User Management (Settings/Users)

The **Users** page (`Settings.vue`, accessed at `/admin/users`) allows admin to manage the `approvedUsers` collection:
- Add new cadet accounts (by email, display name, period, teacher assignment)
- Edit cadet period assignments
- Add/remove staff accounts
- Assign periods to teachers (writing to their `periodIds` array)
- Manage the `periods` collection via `useAdminPeriods.ts`

**Period Management** (`useAdminPeriods.ts`): The `periods` Firestore collection stores metadata for each period's lifecycle. Document IDs follow the pattern `{schoolYearId}__{periodId}`. Each period doc has: `periodId`, `label`, `schoolYearId`, `type` (standard/openAccess), `adminOnly`, `archived`, `teacherEmail`, and timestamps.

Period operations:
- `archivePeriod()` — marks archived and removes from teacher's `periodIds`
- `createOpenAccess()` — creates an admin-only open access period
- `moveCadet()` — moves a student to a new period and teacher
- `prepareNextYear()` — creates blank period docs for the upcoming school year

---

### 14. Demo Seeder

`AdminSeed.vue` (admin-only) is a dev/test utility for populating fake data across all periods. It can create demo student accounts, submissions, typing results, and game scores with realistic-looking data distributions. It also provides a "clear all test data" function. The seeder is gated by `adminGuard` and visually marked with a teal tint in the hub grid to signal it's a test tool.

---

### 15. Year-End Management

`AdminYearEnd.vue` (admin-only) handles the school-year transition:
- Archive all active periods for the current year
- Create the Open Access period for summer use
- Prepare period documents for the next school year
- Optionally migrate student accounts to the next year's `schoolYearId`

This page does **not** delete any data — it archives and migrates. Historical submissions, typing results, game scores, and conduct entries are preserved indefinitely, scoped to their `schoolYearId` and `quarterId`.

---

### 16. Admin Games

`AdminGames.vue` provides admin oversight of the game system: viewing current game room activity, managing active challenges, and configuring which games are available. The Jeopardy game (`/games/jeopardy`) is staff/admin only by route guard and is designed for teacher-run class-wide sessions rather than student-initiated play.

---

### 17. Broadcast Mode and the Simulator

**Broadcast Mode** (`useBroadcast.ts`) is a specialized teacher mode for classroom projection. Calling `startBroadcast(periodId)` does two things: sets `selectedPeriodId` to the specified period and flips `isBroadcasting` to true. When broadcasting:

- The shell renders the student-facing layout (left nav + LCARS panels) rather than the admin layout
- The CHAMPS panel is still interactive (so the teacher can update it live)
- The timer system writes to Firestore under the teacher's email (so students see the countdown)
- The Seating Chart auto-displays the active period's layout
- The HudShip period selector becomes a shortcut to the Systems page rather than opening the period picker

`isBroadcasting` is persisted to `localStorage` so a page refresh doesn't drop out of broadcast mode mid-class. `stopBroadcast()` clears both the ref and localStorage.

The **Simulator Modal** (`SimulatorModal.vue`) allows a teacher to preview any period's student experience without entering full broadcast mode — useful for testing changes before class.

---

## Part III — Firebase and Firestore Architecture

### 1. Firebase Services Used

**Firestore** is the primary database. It is initialized with `persistentLocalCache` and `persistentMultipleTabManager`, enabling offline capability and multi-tab consistency. The persistent cache means the app works on spotty school Wi-Fi — previously loaded data is served from the local cache while Firestore reconnects in the background. Long polling (`experimentalForceLongPolling: true`) is enabled for compatibility with school network proxies that block WebSocket connections.

**Firebase Authentication** handles all user sessions. Google OAuth is the primary method. Email/password is available for staff. Microsoft OAuth is built and gated pending district Azure AD approval.

**Firebase Storage** is used for student file uploads (submission attachments).

**Firebase Realtime Database** is used exclusively for the presence system. Only `presence/{uid}: { online: boolean, lastChanged: serverTimestamp }` is stored here — no PII, no names, no class information. The RTDB was chosen specifically for its `onDisconnect` capability.

---

### 2. Firestore Collections

A complete inventory of every collection:

**`approvedUsers`** — one document per user, keyed by email address (treated as an opaque key, never displayed to students). Fields:
- `uid` — Firebase Auth UID
- `displayName` — shown in the UI
- `role` — cadet / staff / admin / audit / civilian
- `periodId` (cadets) — the period they're enrolled in
- `periodIds` (staff) — array of periods they teach
- `teacherEmail` (cadets) — their teacher's email, used to scope all queries
- `schoolYearId`
- `conductScore` — integer 0–4, updated in-place by conduct log entries

**`missions`** — reusable assignment templates. Shared library across all teachers.
- `title`, `summary`, `description` (rich text)
- `deliveryItems` — array of DeliveryItem objects
- `type` — derived field ('file' | 'game' | 'manual')
- `pointsPossible`, `rubric`
- `attachments` — legacy array of {name, url}
- `teacherEmail` — creator attribution
- `unitId` — optional curriculum unit tag
- `archived` — soft delete flag
- `createdAt`

**`assignments`** — deployments of missions to periods.
- `missionId`, `periodId`, `teacherEmail`, `schoolYearId`
- `dueDate` (YYYY-MM-DD or null), `quarterId` (derived)
- `assignedAt`
- `category` — optional WarpPhase ('warmUp' | 'lesson' | 'extension')
- `penaltyPctPerDay`, `maxPenaltyPct` — optional late penalty config

**`submissions`** — one per student per assignment, fan-out at deploy time.
- `studentId` — Firebase Auth UID
- `assignmentId`, `missionId`, `periodId`, `quarterId`, `schoolYearId`
- `type` — 'file' | 'game' | 'manual'
- `status` — 'assigned' | 'started' | 'submitted' | 'graded' | 'returned'
- `data` — `{url?, fileName?, score?, gameName?, link?}`
- `submittedAt`, `feedbackNote`, `pointsEarned`, `gradedAt`
- `dueDateOverride` — per-student extension date
- `componentChecks` — `Record<string, {done: boolean, doneAt: Timestamp|null}>` for manual items
- `gameId`, `gameVariant` — for auto-submit game missions
- `repeatCount`, `gamesCompleted` — for multi-play game missions

**`typingResults`** — one document per completed typing session, never overwritten (always `addDoc`).
- `uid`, `displayName`, `periodId`, `schoolYearId`, `teacherEmail`
- `mode` — 'speed-test' | 'lesson' | 'custom' | 'weakness-drill'
- `lessonId`, `lessonType`, `textId` — mode-specific metadata
- `wpm` — 0 if accuracy < 80% (prevents low-accuracy high-speed gaming)
- `accuracy`, `duration`, `activeSeconds`, `charsTyped`
- `keyErrors` — `Record<char, count>`
- `passed`, `score` — grading fields for lesson tests
- `completedAt`

**`typingLessons`** — teacher-created structured lesson configurations.
- `title`, `passage`, `focusKeys`, `lessonType`, `order`
- `targetWpm`, `targetAccuracy`
- `isCheckpoint`, `section`
- `archived`

**`typingCustomTexts`** — teacher-posted custom passages.
- `title`, `passage`
- `periodId` — optional scope to one period
- `teacherEmail`, `active`

**`gameScores`** — one document per `{uid}_{gameId}` pair, overwritten on new high score.
- `uid`, `displayName`, `periodId`, `schoolYearId`
- `gameId`, `lowerIsBetter`, `highScore`, `lastUpdated`

**`game_rooms`** — live multiplayer game rooms, created by the challenge system.
- `gameType` — 'chess' | 'battleship' | 'picard-maneuver' | 'mancala' | 'fractured-frontier'
- `joinCode` — random 6-character alphanumeric
- `status` — 'waiting' | 'playing' | 'finished' | 'expired'
- `players` — `{white: playerId | null, black: playerId | null}`
- `boardState` — serialized current game state (FEN for chess, JSON for others)
- `startFen` — initial position (for Chess960 variant detection)
- `variant` — chess variant if applicable
- `pocket` — Crazyhouse pocket state `{white: {p,n,b,r,q}, black: {p,n,b,r,q}}`
- `currentTurn`, `moveHistory`, `createdAt`, `lastMoveAt`

**`challenges`** — peer challenge requests.
- `teacherEmail`, `periodId`
- `challengerId`, `challengerName`, `challengedId`, `challengedName`
- `game` — ChallengeGame type
- `variant` — game variant
- `status` — 'pending' | 'accepted' | 'declined' | 'expired' | 'terminated'
- `createdAt`, `expiresAt` (5-minute TTL)
- `gameRoomId`, `joinCode` — set when accepted
- `startFen` — for Chess960 FEN pre-generation

**`conductEntries`** — anecdotal behavioral log entries.
- `studentId`, `studentName`, `teacherEmail`, `periodId`, `schoolYearId`, `quarterId`
- `type` — 'positive' | 'negative' | 'neutral'
- `source` — 'teacher' | 'auto'
- `reason` — participation/respect/onTask/effort/auto
- `scoreDelta` (+1/−1/0), `scoreAfter`
- `note`, `date` (YYYY-MM-DD), `loggedAt`

**`conductRatings`** — structured end-of-period ratings.
- `studentId`, `studentName`, `teacherEmail`, `periodId`, `schoolYearId`, `quarterId`
- `date`, `ratings: {participation, respect, onTask, effort}` (each 1–5)
- `ratedAt`

**`activityLogs`** — event tracking, cadets only. One document per event.
- `uid`, `displayName`, `teacherEmail`, `periodId`, `schoolYearId`
- `event` — 'sign_in' | 'game_complete' | 'typing_complete'
- `detail` — event-specific payload (gameId, score, result, mode, lessonId, wpm, accuracy, etc.)
- `timestamp`

**`shipStatus`** — computed academic health per period. Written by `recalculateShipHealth()`.
- Document ID is `periodId`
- `health` (0–100, one decimal), `gradedCount`, `overdueCount`, `totalEarned`, `totalPossible`, `lastUpdated`

**`periods`** — period lifecycle metadata.
- Document ID pattern: `{schoolYearId}__{periodId}`
- `periodId`, `label`, `schoolYearId`, `type` (standard/openAccess)
- `adminOnly`, `archived`, `teacherEmail`
- `archivedAt`, `createdAt`

**`seatingCharts`** — classroom seat layouts.
- Document ID: `{periodId}_{sanitizedTeacherEmail}`
- `seats` — `Record<"r{row}c{col}", {uid, displayName} | null>`
- `layout` — `{rows, cols, label, rowGaps?, colGaps?}`
- `schoolYearId`

**`timerState`** — shared timer broadcasts (Firestore-synced so students see teacher's countdown).

**`missionStats`** / **`periodStats`** — aggregated counter documents maintained by `useMissionStatsWriter.ts`. Updated via `onAssigned()` and `onGraded()` (fire-and-forget, non-blocking). Used by the Reports dashboard to show assignment and grading activity summaries.

**`demo/state`** — single document tracking the rotating demo slot counter (`nextSlot: 0–9`).

---

### 3. Query Patterns and Performance

**Teacher scoping**: Every cadet-facing query includes `where('teacherEmail', '==', ...)` to ensure data isolation. Staff see only their periods' data; admin passes no `teacherEmail` constraint to see all. The `effectiveTeacherEmail` computed property in `useAuth` handles this automatically: staff → their own email, admin emulating → the emulated email, admin not emulating → `undefined` (no filter).

**School year scoping**: Nearly every query includes `where('schoolYearId', '==', SCHOOL_YEAR_ID)` where `SCHOOL_YEAR_ID = '2025-2026'`. This allows historical data from prior years to coexist without collision.

**Quarter scoping**: Submissions and conduct entries include `quarterId` for sub-year filtering. Quarters are defined in `schoolYear.ts` as four ranges with IDs like `'2025-Q1'`, `'2026-Q3'`, etc. `getQuarterIdForDate()` maps any YYYY-MM-DD string to a quarter ID.

**Chunked 'in' queries**: Several batch-fetch operations (e.g., `fetchMissionsByIds`, `fetchAssignmentsByIds`, `fetchPointsPossible`) chunk their ID arrays into groups of 30 before issuing Firestore `where(documentId(), 'in', chunk)` queries, respecting Firestore's limit of 30 values per `in` clause.

**Client-side aggregation**: The typing dashboard (`useTypingDashboard.ts`) fetches all `typingResults` for a teacher/year (estimated max ~3,600 docs for a full year of 6 periods × 30 students × 20 sessions) and performs all grouping, averaging, and ranking in JavaScript. This avoids needing Firestore aggregation queries or Cloud Functions for what is a very manageable data volume.

**Singleton subscriptions**: `useShipStatus` uses a module-level initialized flag to ensure only one `onSnapshot` listener is ever opened on the `shipStatus` collection, regardless of how many components call the composable. Same pattern in `useChallenges` for the three challenge listeners.

---

### 4. Academic Calendar and Bell Schedule

`useAcademicCalendar.ts` loads the full academic year calendar from `2526-AcademicCalendar.json`. This JSON encodes every calendar day with:
- Day of School number (null on non-school days)
- Month, Date (ISO datetime string)
- Schedule Type (integer key mapping to named schedule types)
- Parity — 'odd' | 'even' | 'neutral'
- Day (weekday name)

The **block schedule** is a rolling odd/even parity system where each class period meets every other school day. `getNextClassDay(fromDate, parity)` walks forward from a date and finds the next school day with matching parity — this is the "one extension" calculation: the next time a teacher will see students in a particular period.

`useScheduleManager.js` combines the calendar with the bell schedule JSON (`Computech_Full_Bell_Schedule.json`) to determine the current day's schedule type and the active period's start/end times for the Mission Clock.

The bell schedule encodes different time tables for each named schedule type (Normal Day, Early Dismissal, Rally Day, Testing Day, Minimum Day, 8-Period Day, etc.). The Mission Clock countdown timer uses this to show exactly how many minutes and seconds remain in the current class period.

---

### 5. Routing and Code Splitting

All routes are lazy-loaded via dynamic imports (`() => import('./pages/...')`). Vue Router handles code splitting automatically — page components only download when first navigated to, keeping initial bundle size small.

Route guards are plain functions that read `localStorage.getItem('userRole')` and call `next()` or `next('/')`. Three guard levels: `staffAdminGuard`, `adminGuard`, `staffAdminAuditGuard`.

The `/admin` route uses a **nested layout** pattern: `AdminLayout.vue` wraps all admin sub-routes, rendering `AdminNav.vue` on the left with links to all admin tools, and a content area on the right for the active child route.

---

### 6. Technical Stack Summary

- **Framework**: Vue 3 with Composition API (`<script setup>` syntax), TypeScript throughout
- **Build**: Vite
- **State management**: No external store (Pinia/Vuex) — all state managed via composable singleton pattern (module-level refs shared across components that import the same composable module)
- **Database**: Firebase Firestore (multi-tab persistent cache)
- **Auth**: Firebase Authentication (Google, email/password, Microsoft planned)
- **Storage**: Firebase Storage
- **Presence**: Firebase Realtime Database
- **Routing**: Vue Router 4 with lazy-loaded routes and role-based guards
- **Styling**: Scoped CSS per component, LCARS-inspired design system in `classic.css`
- **Fonts**: Antonio and Roboto (LCARS aesthetic)
- **Colors**: Dark blue/black space background, gold (#ff9900) accents, blue (#99ccff, #4d99ee) text, performance scale (excellent → critical)
- **Sounds**: 60+ authentic Star Trek SFX organized into Computer, Technology, Background, and Ship Systems categories
- **Video**: Looping starfield videos (StarfieldLoop1a/b, 2a/b, 3, WarpSeq1) for background

---

*Document generated June 2026. Reflects the 2025–2026 school year build of CompuTrek CS.*
