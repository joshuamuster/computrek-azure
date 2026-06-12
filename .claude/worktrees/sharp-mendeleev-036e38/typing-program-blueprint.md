# CompuTrek Typing Program — Implementation Blueprint

> **Audience:** Joshua (developer/teacher)
> **Goal:** A fully custom typing program built in Vue, integrated with Firebase Auth and Firestore, supporting four modes: structured lessons, speed tests, custom text practice, and key-weakness drills — with per-student and per-class progress tracking.

---

## Overview

The typing module lives at `/typing` and is visible only to staff/admin users in the MainNav (already gated in `mainRoutes.js` and `MainFrame.vue`). Students access it directly via the URL — or you can later surface a link on their Dashboard.

The system has four layers:

1. **The typing engine** — pure Vue logic that handles keystroke-by-keystroke input, calculates live WPM and accuracy, and emits a completed result
2. **Four practice modes** — each mode feeds the same engine, just with different content sources
3. **Firestore persistence** — every session result is saved and tied to a student's `uid`, `periodId`, and `schoolYearId`
4. **Teacher views** — an admin tab showing per-student history and class-wide aggregate stats

---

## File Structure

All new files to create, organized by role:

```
src/
├── pages/
│   ├── Typing.vue                      ← Hub page (mode selector + student history)
│   └── typing/
│       ├── TypingLesson.vue            ← Structured lesson mode
│       ├── TypingSpeedTest.vue         ← Timed speed test mode
│       ├── TypingCustom.vue            ← Custom text practice mode
│       └── TypingWeaknessDrill.vue     ← Auto-generated weakness drill mode
│
├── components/
│   └── typing/
│       ├── TypingEngine.vue            ← Core reusable typing widget (shared by all modes)
│       ├── TypingKeyboard.vue          ← Visual on-screen keyboard with key highlighting
│       ├── TypingResultsCard.vue       ← Post-session results display (WPM, accuracy, errors)
│       └── TypingProgressChart.vue     ← Line chart: WPM/accuracy over time
│
└── composables/
    ├── useTypingEngine.ts              ← All keystroke logic, WPM calc, accuracy, timing
    ├── useTypingResults.ts             ← Firestore reads/writes for session results
    ├── useTypingContent.ts             ← Fetch lessons and custom texts from Firestore
    └── useWeakKeyAnalysis.ts           ← Analyze error history, identify weak keys
```

Additionally, two new Firestore collections and one expanded admin view:

```
Firestore:
  typingResults/        ← one doc per completed session (all modes)
  typingLessons/        ← teacher-authored structured lessons
  typingCustomTexts/    ← teacher-created custom practice passages

AdminHub.vue            ← add a "Typing" tab to the existing admin area
```

Router additions in `mainRoutes.js`:
```js
{ path: '/typing/lesson/:lessonId',   component: TypingLesson },
{ path: '/typing/speed-test',         component: TypingSpeedTest },
{ path: '/typing/custom/:textId',     component: TypingCustom },
{ path: '/typing/weakness-drill',     component: TypingWeaknessDrill },
```

---

## Firestore Schema

### `typingResults` — one document per completed session

This is the central collection. Every time a student finishes any typing session, a new doc is created here. This is what powers both individual history and class-wide reporting.

```
typingResults/{auto-id}
  uid:           string        ← Firebase Auth uid (from useAuth userInfo.uid)
  displayName:   string        ← from userInfo.displayName
  periodId:      string        ← from userInfo.periodId ("period-1" etc.)
  schoolYearId:  string        ← from userInfo.schoolYearId ("2025-2026")
  teacherEmail:  string        ← from userInfo.teacherEmail
  mode:          string        ← "lesson" | "speed-test" | "custom" | "weakness-drill"
  lessonId:      string|null   ← set when mode is "lesson"
  textId:        string|null   ← set when mode is "custom"
  wpm:           number        ← gross WPM at session end
  accuracy:      number        ← percentage 0–100
  duration:      number        ← seconds elapsed
  charsTyped:    number        ← total characters attempted
  keyErrors:     object        ← { "f": 3, "j": 1, "k": 5 } — per-key miss counts
  completedAt:   timestamp
```

**Key design decision:** Store `keyErrors` as a map on every result. This lets `useWeakKeyAnalysis.ts` aggregate across all a student's sessions and identify their worst keys without a separate collection.

---

### `typingLessons` — the structured curriculum

Teacher-managed. These are the "home row keys," "top row keys," etc. lessons that form a progression. You manage them from the admin panel; students see them as a sequence.

```
typingLessons/{lessonId}
  title:        string         ← e.g. "Lesson 1 — Home Row: ASDF JKL;"
  description:  string         ← shown to student before they start
  order:        number         ← determines sequence (1, 2, 3...)
  content:      string         ← the full text the student types
  focusKeys:    string[]       ← keys being drilled, e.g. ["a","s","d","f","j","k","l",";"]
  teacherEmail: string
  active:       boolean        ← false = hidden from students
  createdAt:    timestamp
```

---

### `typingCustomTexts` — teacher-created free passages

This is where you paste in Star Trek quotes, vocab words, or anything else for students to practice with. Available in the "Custom" mode.

```
typingCustomTexts/{textId}
  title:        string         ← e.g. "Picard Quotes Vol. 1"
  content:      string         ← the passage to type
  teacherEmail: string
  active:       boolean
  createdAt:    timestamp
```

---

## The Core Typing Engine (`useTypingEngine.ts`)

This is the most important piece. Everything else is plumbing around it. Here is the full logic spec:

### State

```ts
const targetText   = ref<string>('')      // the passage being typed
const typedChars   = ref<string[]>([])    // what the student has typed so far
const cursorPos    = ref<number>(0)       // current index in targetText
const errorSet     = ref<Set<number>>(new Set()) // indices where errors occurred
const keyErrors    = ref<Record<string, number>>({}) // per-key error counts
const startTime    = ref<number | null>(null)
const endTime      = ref<number | null>(null)
const isComplete   = ref<boolean>(false)
const liveWpm      = ref<number>(0)
const liveAccuracy = ref<number>(100)
```

### Keystroke Handler

The engine should use a `keydown` listener (not `input` events) so it captures every individual keystroke including backspace. Here is the decision tree for each keypress:

1. **Backspace** → if `cursorPos > 0`, decrement `cursorPos`, remove last entry from `typedChars`, remove from `errorSet` if it was there
2. **Printable character** → compare to `targetText[cursorPos]`:
   - **Match** → push to `typedChars`, advance `cursorPos`, start timer if not started
   - **Mismatch** → push to `typedChars`, add index to `errorSet`, increment `keyErrors[expectedChar]`, advance `cursorPos`
     - Note: errors are recorded against the *expected* key, not what was typed — this is how you know which keys the student can't hit reliably
3. **Cursor reaches `targetText.length`** → session is complete, record `endTime`, emit result

**Why allow advancing on errors:** Forcing students to correct before advancing (the strict approach) is better for adult learners but frustrating for 7th graders. The forgiving approach lets them keep going and shows errors in red afterward. Recommend starting forgiving, with a setting to toggle.

### WPM Calculation

Standard formula: one "word" = 5 characters. Gross WPM ignores errors; net WPM penalizes them.

```ts
// Gross WPM (simpler, better for beginners)
const grossWpm = (charsTyped / 5) / (elapsedSeconds / 60)

// Net WPM (what keybr and most serious tools use)
const netWpm = grossWpm - (errorCount / (elapsedSeconds / 60))
```

Recommend displaying **gross WPM** to students and **net WPM** in teacher reports. Calculate live WPM on a 1-second interval using `setInterval`.

### Accuracy Calculation

```ts
const accuracy = ((cursorPos - errorSet.size) / cursorPos) * 100
```

Update live on each keystroke.

### What the Engine Emits

When `isComplete` fires, emit a result object — this is what gets written to Firestore:

```ts
emit('complete', {
  wpm: Math.round(grossWpm),
  accuracy: Math.round(accuracy),
  duration: Math.round((endTime - startTime) / 1000),
  charsTyped: cursorPos,
  keyErrors: { ...keyErrors.value },
})
```

---

## Component Responsibilities

### `TypingEngine.vue`

This is the reusable display component. It accepts `targetText` as a prop and handles the keystroke listener and rendering. It emits `complete` when done.

**Rendering the text:** Display each character of `targetText` as an individual `<span>`. Color them:
- Not yet typed → dim/gray
- Correctly typed → white or green
- Error → red with a slight background highlight
- Current cursor position → blinking cursor character or underline

**Handling focus:** The engine needs keyboard focus to capture input. Use a hidden `<input>` or a `<div tabindex="0">` that auto-focuses on mount. Clicking anywhere in the typing area should re-focus it.

### `TypingKeyboard.vue`

A visual QWERTY keyboard rendered in SVG or plain `<div>` grid. Accepts a `highlightKeys` prop (array of key characters) and a `errorKeys` prop (map of key → error count) to color keys differently. Used in lesson mode to show which keys are in focus, and in the weakness drill to show which keys need work.

Not required for Phase 1 — build it in Phase 2 or 3.

### `TypingResultsCard.vue`

Shown after a session completes. Displays:
- WPM (large, prominent)
- Accuracy percentage
- Time elapsed
- Top 3 most-missed keys
- Personal best comparison (fetched from previous `typingResults`)
- A "Try Again" and "Back to Menu" button

### `TypingProgressChart.vue`

A line chart (use your existing chart library or Recharts) showing a student's WPM and accuracy across their last N sessions. Accepts an array of `typingResults` docs as a prop. Used on the hub page for students and in the admin panel for teachers.

---

## The Four Mode Pages

### `TypingSpeedTest.vue` ← Build This First

The simplest mode. A timed test (60 seconds or 1 minute of a word list). Uses a built-in word list — no Firestore needed for the content. This is your Phase 1 deliverable.

**Built-in word lists to include:**
- Common English words (200 most frequent)
- Star Trek vocabulary ("federation," "stardate," "holodeck," "photon," "warp," etc.)
- CS vocabulary ("variable," "function," "boolean," "algorithm," "syntax," etc.)

On completion → write result to `typingResults` with `mode: "speed-test"`.

### `TypingLesson.vue`

Reads from `typingLessons` collection. Displays the lesson title and description, then loads the lesson content into `TypingEngine`. Shows `TypingKeyboard` with the `focusKeys` highlighted.

On completion → write result with `mode: "lesson"` and `lessonId`.

Lesson list on the hub page: show checkmarks next to lessons a student has already completed (query their past results for matching `lessonId`).

### `TypingCustom.vue`

Reads from `typingCustomTexts`. Student picks a passage, types it. On completion → write with `mode: "custom"` and `textId`.

### `TypingWeaknessDrill.vue`

Uses `useWeakKeyAnalysis.ts` to identify the student's 3–5 worst keys from their `typingResults` history, then generates a passage heavily weighted toward those keys (e.g., if "f" and "j" are weakest, generate text like "fjfj jfjf jeff jiff").

The text generator algorithm: pull from a curated word list filtered to words that contain the target keys, shuffle, repeat until 200+ characters.

On completion → write with `mode: "weakness-drill"`.

---

## `useTypingResults.ts`

Follows the same pattern as `useGameScores.js`. Key functions:

```ts
// Write a completed session
const saveResult = async (resultData: TypingResult) => { ... }

// Fetch a student's own history (ordered by completedAt desc)
const fetchMyHistory = async (limitN = 20) => { ... }

// Admin: fetch all results for a period
const fetchPeriodResults = async (periodId: string) => { ... }

// Admin: fetch aggregate stats per period (avg WPM, avg accuracy)
const fetchPeriodSummary = async (periodIds: string[]) => { ... }
```

`saveResult` should use `addDoc` (not `setDoc`) since every session is a new unique document. All queries should filter by `schoolYearId` so data from previous years doesn't bleed in.

---

## `useWeakKeyAnalysis.ts`

```ts
// Returns the student's top N weakest keys sorted by error count
const getWeakKeys = async (uid: string, topN = 5): Promise<string[]> => {
  // 1. Fetch last 50 typingResults for this uid
  // 2. Merge all keyErrors maps together, summing counts
  // 3. Sort by count descending
  // 4. Return top N key characters
}

// Returns a generated practice passage heavy on the given keys
const generateDrillText = (weakKeys: string[], targetLength = 250): string => {
  // Filter a word bank to words containing the weak keys
  // Shuffle and concatenate until targetLength reached
}
```

---

## Admin Typing View (add to AdminHub)

Add a "Typing" tab to the existing `AdminHub.vue`. It needs two sub-views:

**Class Summary view** (default): A table showing each period's average WPM and accuracy, updated for the current school year. One row per period. Clicking a row drills into that period.

**Period Detail view**: All students in the period with their session count, best WPM, average WPM, average accuracy, and last active date. Clicking a student row shows their full history (the `TypingProgressChart`).

All queries should be filtered by `teacherEmail` from `useAuth` — the same multi-teacher scoping already used elsewhere in the app.

---

## Build Order (Recommended Phases)

### Phase 1 — Playable speed test (start here)
1. `useTypingEngine.ts` — core keystroke logic, WPM, accuracy
2. `TypingEngine.vue` — the typing display widget
3. `TypingResultsCard.vue` — post-session results
4. `useTypingResults.ts` — Firestore write only (`saveResult`)
5. `TypingSpeedTest.vue` — the first playable mode
6. Update `Typing.vue` hub to show mode choices and link to speed test

**Deliverable:** Students can take a 60-second speed test and results are saved to Firestore.

### Phase 2 — Structured lessons
1. `typingLessons` Firestore collection + seed a few starter lessons
2. `useTypingContent.ts` — fetch lessons
3. `TypingLesson.vue`
4. `TypingKeyboard.vue` — visual keyboard with key highlighting
5. Admin lesson management UI (create/edit/reorder lessons)

**Deliverable:** Students can work through a proper lesson sequence. Teachers can author lessons from the admin panel.

### Phase 3 — Custom text + weakness drill
1. `typingCustomTexts` Firestore collection
2. `TypingCustom.vue`
3. `useTypingResults.ts` — add `fetchMyHistory` read
4. `useWeakKeyAnalysis.ts`
5. `TypingWeaknessDrill.vue`

**Deliverable:** All four modes working.

### Phase 4 — Teacher dashboard
1. `useTypingResults.ts` — add `fetchPeriodResults` and `fetchPeriodSummary`
2. `TypingProgressChart.vue`
3. Admin Typing tab in `AdminHub.vue`

**Deliverable:** Full class visibility — see how each period is doing, drill into individual students.

---

## Firestore Rules to Add

```
match /typingResults/{resultId} {
  // Students write their own results; staff/admin read all
  allow create: if request.auth != null
                && request.resource.data.uid == request.auth.uid;
  allow read:   if request.auth != null;
}

match /typingLessons/{lessonId} {
  allow read:  if request.auth != null;
  allow write: if request.auth.token.email in ['your-staff-emails'];
}

match /typingCustomTexts/{textId} {
  allow read:  if request.auth != null;
  allow write: if request.auth.token.email in ['your-staff-emails'];
}
```

---

## Firestore Indexes to Create

Compound indexes needed (add in Firebase Console → Firestore → Indexes):

| Collection | Fields | Order |
|---|---|---|
| `typingResults` | `uid`, `completedAt` | asc, desc |
| `typingResults` | `periodId`, `schoolYearId`, `completedAt` | asc, asc, desc |
| `typingResults` | `periodId`, `schoolYearId`, `teacherEmail`, `completedAt` | asc, asc, asc, desc |
| `typingLessons` | `teacherEmail`, `active`, `order` | asc, asc, asc |
| `typingCustomTexts` | `teacherEmail`, `active`, `createdAt` | asc, asc, desc |

---

## Notes on 7th Grader UX

A few things worth building into the engine from the start that will make a real difference with this age group:

- **Show live WPM** updating every second — kids love watching the number go up
- **Don't show accuracy as a fraction** during the session — it discourages them. Show it only on the results card.
- **Celebrate improvement** — on the results card, detect if this WPM beats their previous best and show a "New personal record!" message
- **Keep sessions short** — 60 seconds for speed tests, 2–3 minute max for lessons. 7th graders lose focus fast.
- **Star Trek theming** — use themed word lists (Starfleet vocabulary, ship names, Trek quotes) to make it feel connected to the rest of the app
