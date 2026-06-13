# CompuTrek Azure Migration

This repo is the Microsoft/Azure migration of [computrekcs-vue](https://github.com/joshuamuster/computrekcs-vue).

## Why

Fresno Unified School District (FUSD) has a district-wide Microsoft contract and does not approve Google products for official student data. The goal is to move all student PII out of Google/Firebase infrastructure and into Microsoft-controlled services, while keeping the existing Vue 3 frontend and all game/typing/composable logic intact.

## Architecture Target

| Layer | Firebase (current) | Azure (target) |
|---|---|---|
| Auth (students) | Google OAuth | Code + PIN via Firebase Auth (Phase 1) → Azure Functions custom token (Phase 6) |
| Auth (staff) | Google OAuth | Microsoft Entra ID (MSAL) |
| Database | Firestore | Azure Cosmos DB for NoSQL |
| Real-time | Firestore `onSnapshot` | Azure SignalR Service |
| File uploads | Firebase Storage | Azure Blob Storage |
| Presence | Firebase RTDB | Azure SignalR connection lifecycle |
| Hosting | Firebase Hosting | Azure Static Web Apps |
| Student roster/PII | `approvedUsers` Firestore collection | SharePoint List (district-controlled, never touches Azure DB) |

## Pseudonymization Strategy

Student PII (real names, district emails) never enters the Azure database. Each student is assigned a random CompuTrek code (e.g., `XK7P2M`). The code→student mapping lives exclusively in a SharePoint/Excel file on district-controlled OneDrive.

- Firebase/Cosmos DB stores: code, periodId, cadetAlias, teacherCode, behavioral data
- Firebase Auth "email" field: `{code}@computrek.app` (synthetic, never emailed)
- SharePoint stores: real name, district email, period, code, PIN

## Migration Phases

### Phase 1 — Auth ✅ (current)
- [x] Microsoft Entra ID is primary staff auth (ungated, `MICROSOFT_AUTH: true`)
- [x] Cadet login uses access code + PIN (no real student identity in Firebase)
- [x] Google OAuth kept as staff fallback only
- [x] `src/azure.ts` skeleton created with phase-by-phase SDK stubs
- [ ] Register the app in Azure AD (IT provides Client ID + Tenant ID)
- [ ] Set `VITE_AZURE_TENANT_ID` and `VITE_AZURE_CLIENT_ID` in `.env`
- [ ] In Firebase Console → Authentication → Sign-in providers → add Microsoft with the Client ID/Secret

### Phase 2 — Database (largest lift) ✅ (live on Cosmos DB as of June 12, 2026)

Implemented as a **dual-backend data access layer** instead of rewriting composable
logic: every composable/page/service now imports its database functions from
`src/data/db.ts`, which presents the exact Firestore API surface the app uses
(`query/where/orderBy/limit`, doc CRUD, `onSnapshot`, `writeBatch`,
`runTransaction`, `serverTimestamp`/`Timestamp`, `increment`,
`arrayUnion`/`arrayRemove`) and routes to one of two backends:

- `src/data/firestoreBackend.ts` — re-exports the Firestore SDK (active while `AZURE_DATABASE: false`)
- `src/data/cosmosBackend.ts` — the same API on `@azure/cosmos` (lazy-loaded; zero bundle cost until activated)

Cosmos backend notes: timestamps are stored as `{ "__ts": <epoch ms> }` and revived
to `Timestamp` instances on read; `orderBy`/`limit` are applied client-side
(classroom-scale data); `onSnapshot` polls every 4 s until Phase 3's SignalR;
`writeBatch` is sequential (all existing batches are re-runnable fan-outs);
`runTransaction` uses etag optimistic concurrency with retry.

- [x] All 50 Firestore-importing files migrated to `src/data/db.ts` (one-line import change each)
- [x] Cosmos backend implemented with full container/partition-key registry (25 collections)
- [x] `@azure/cosmos` installed (dynamically imported — bundle-neutral while flag is off)
- [x] Data migration script: `scripts/migrate-firestore-to-cosmos.mjs` (dry-run verified against live Firestore: 18,027 docs / 25 collections)
- [x] Provision Azure Cosmos DB account (**Serverless** capacity mode — a provisioned account would cost ~$580/mo for 25 containers at the 400 RU/s default); set `VITE_COSMOS_ENDPOINT` + `VITE_COSMOS_KEY` in `.env`; enable CORS for the app origin — account: `computrek-fusd`, West US
- [x] Run the migration script — 18,027 docs / 25 collections migrated June 12, 2026
- [x] Smoke-test with `AZURE_DATABASE: true` against live Cosmos (demo login, dashboard, CHAMPS, HUD all verified) — flag is now ON

> **Before deploying to students:** the deployed production app still runs on
> Firestore, so any data written there after June 12 is not in Cosmos. Re-run
> `node scripts/migrate-firestore-to-cosmos.mjs` (it's an idempotent upsert)
> right before the real cutover deploy — per the summer-break plan below.

### Phase 3 — Real-time ✅ (live as of June 12, 2026)

No composable changes were needed: `onSnapshot` in the data layer
(`src/data/cosmosBackend.ts`) gained a realtime mode behind the
`AZURE_REALTIME` flag. With the flag on, each subscription does one initial
query, then keeps its result set updated from SignalR broadcasts — the
Functions app (`azure-functions/`) watches the Cosmos change feed and pushes
every changed doc to a hub target named after its container; the client
matches docs against active where-constraints locally (zero RU per change).
If SignalR is unreachable it degrades to the Phase 2 polling automatically,
and refetches after reconnects. Deletes are handled with `__deleted`
tombstones (the change feed can't emit hard deletes); queries filter them and
the Functions app cleans them up.

Covered live surfaces: grading queue, ship status, CHAMPS, timers, challenge
system, game rooms, live roster, test sessions, challenge settings.

- [x] Client realtime layer (`src/data/realtime.ts`) + realtime `onSnapshot` with polling fallback
- [x] Azure Functions app (`azure-functions/`): `/api/negotiate` + 9 change-feed triggers + tombstone cleanup
- [x] `@microsoft/signalr` installed (dynamically imported — bundle-neutral while flag is off)
- [x] Provision Azure SignalR Service — `computrek-signalr`, Serverless mode, **currently Free F1** (⚠ upgrade to **S1** on the Scale blade before student rollout — F1 caps at 20 concurrent connections / 20k messages per day)
- [x] Create + deploy the Function App — `computrek-fusd` (Windows Consumption, West US 2)
- [x] Set `VITE_SIGNALR_URL` in `.env`, flip `AZURE_REALTIME: true` — live push verified end-to-end June 12, 2026

Provisioning gotchas hit (recorded for posterity):
- The SignalR JS client needs `withCredentials: false` for cross-origin negotiate (fixed in `realtime.ts`); the Function App's CORS stays non-credentialed.
- The Cosmos account firewall ("selected networks") blocked the Function App —
  fixed by adding the `0.0.0.0` IP rule ("accept Azure datacenter traffic").
  After fixing firewall issues, **restart the Function App**: failed trigger
  listeners don't retry on their own.
- The original migration script used an invalid `partitionKeyPaths` property,
  so containers were silently created with a default `/_partitionKey` —
  containers were deleted and re-migrated June 12, 2026 with correct keys.

### Phase 4 — Multiplayer ✅ (live as of June 12, 2026)

The three multiplayer services needed **no rewrite** — they already ride the
Phase 2/3 data layer (`@/data/db`), and the `gameRooms` change-feed trigger
covers room sync. Phase 4 instead hardened the data layer for gameplay:

- [x] `updateDoc` is now etag-guarded with retry-on-conflict (Firestore's
  updateDoc was atomic server-side; plain read-modify-replace could drop a
  write when both players update a room simultaneously — e.g. Battleship
  fleet placement, or one student with two tabs)
- [x] Low-latency broadcast path: after writing to `gameRooms` / `challenges`
  / `timerState` / `champsState`, the client POSTs the doc to the Functions
  app's `/api/broadcast`, which pushes it over SignalR immediately. The change
  feed re-broadcasts shortly after as the consistency backstop (subscriptions
  upsert by id, so duplicates are harmless)
- [x] Change-feed poll lowered for gameplay containers (`gameRooms` 1s,
  `challenges` 2s; others stay at the 5s default)
- [x] Game engines untouched (pure TypeScript), `AZURE_MULTIPLAYER: true`

Measured move-delivery latency (write → opponent's client): **~0.9s** via the
broadcast fast path, ~1.3s via the change-feed backstop (was up to ~6s before).

### Phase 5 — Storage + Presence ✅ (live as of June 12, 2026)

- [x] File uploads → Azure Blob Storage via `src/data/storage.ts` (dual-backend
  behind `AZURE_STORAGE`). The client requests SAS URLs from `/api/uploadSas`:
  a 15-minute write SAS for the exact blob plus a 2-year read SAS stored on
  the submission (same unguessable-URL trust model as Firebase download URLs).
  Blobs live in the `uploads` container of the Function App's own storage
  account (`computrekrga6cc`) — account stays private, CORS allows the app
  origins. Verified round-trip; path traversal rejected.
- [x] Presence → Cosmos DB heartbeat (`presence` container, TTL-enabled so
  stale docs self-delete). `usePresence.ts` keeps its exact API; the Azure
  path upserts a heartbeat every 25s and subscribers poll every 20s, counting
  a cadet online only if the heartbeat is < 70s old (replaces RTDB
  `onDisconnect`). Polling is deliberate here — broadcasting heartbeats over
  SignalR would burn the message budget for 30-second-freshness data.
- [x] (Unplanned discovery) FracturedFrontier's live opponent streaming used
  RTDB directly. Now `src/multiplayer/liveChannel.ts`: a SignalR virtual
  target (`liveGameState`) scoped to hub group `live-{joinCode}` so per-frame
  aim updates reach only the two players, with sender-side throttling (~10/s).
  New `/api/group` function manages membership (rejoined after reconnects).
  Measured delivery: **~110ms**, with confirmed group isolation.
- [x] `AZURE_STORAGE: true` — Firebase Storage and RTDB now have zero callers
  in the live code paths (only the flag-off fallbacks reference them).

### Phase 6 — Standalone MSAL + Remove Firebase
- [ ] Replace Firebase Auth entirely with standalone MSAL for staff
- [ ] Replace Firebase Auth email/password for cadets with Azure Functions custom token
- [ ] Remove Firebase SDK from package.json
- [ ] Set `AZURE_AUTH_STANDALONE: true` in featureFlags.ts when complete

## Collection Inventory (Firestore → Cosmos DB)

Every Firestore collection maps 1:1 to a Cosmos DB container.

| Collection | Cosmos Container | Partition Key |
|---|---|---|
| `approvedUsers` | `approvedUsers` | `/periodId` |
| `missions` | `missions` | `/teacherEmail` |
| `assignments` | `assignments` | `/periodId` |
| `submissions` | `submissions` | `/studentId` |
| `typingResults` | `typingResults` | `/uid` |
| `typingLessons` | `typingLessons` | `/section` |
| `typingCustomTexts` | `typingCustomTexts` | `/teacherEmail` |
| `gameScores` | `gameScores` | `/periodId` |
| `game_rooms` | `gameRooms` | `/gameType` |
| `challenges` | `challenges` | `/periodId` |
| `conductEntries` | `conductEntries` | `/studentId` |
| `conductRatings` | `conductRatings` | `/studentId` |
| `activityLogs` | `activityLogs` | `/uid` |
| `shipStatus` | `shipStatus` | `/id` |
| `periods` | `periods` | `/schoolYearId` |
| `seatingCharts` | `seatingCharts` | `/periodId` |
| `challengeSettings` | `challengeSettings` | `/id` |
| `timerState` | `timerState` | `/id` |
| `champsState` | `champsState` | `/id` |
| `periodStats` | `periodStats` | `/id` |
| `missionCards` | `missionCards` | `/id` |
| `gradebookSnapshots` | `gradebookSnapshots` | `/id` |
| `gradebookOrder` | `gradebookOrder` | `/id` |
| `activeTestSessions` | `activeTestSessions` | `/id` |
| `demo` | `demo` | `/id` |

The canonical registry lives in `CONTAINER_REGISTRY` in `src/data/cosmosBackend.ts`
(mirrored in `scripts/migrate-firestore-to-cosmos.mjs`). Collections not listed
default to partition key `/id`, which is always safe.

## What Does NOT Change

- Vue 3 frontend framework, all components, all pages
- All game engines (chess, mancala, battleship, picard maneuver, fractured frontier, minesweeper, etc.)
- Typing engine (`useTypingEngine.ts`) — pure TypeScript, zero Firebase dependency
- LCARS styling (`classic.css`, all component styles)
- Vue Router structure and route guards
- School year config, quarter definitions, ship system mappings
- Course data JSON, academic calendar JSON, bell schedule JSON
- All curriculum content (unit data, lesson data, deck pages, ambience tracks)

## Key Files to Change

| File | Change |
|---|---|
| `src/firebase.ts` | Keep through Phase 5; replaced by `src/azure.ts` in Phase 6 |
| `src/azure.ts` | New file — Azure SDK stubs, activated phase by phase |
| `src/config/featureFlags.ts` | Phase gates; `MICROSOFT_AUTH` always true in this repo |
| `src/composables/useAuth.js` | Auth provider swap in Phase 6 |
| All `src/composables/use*.ts` | Import from `@/data/db` instead of `firebase/firestore` ✅ |
| `src/data/db.ts` + backends | New — dual-backend data access layer (Phase 2) ✅ |
| `src/multiplayer/gameRoomService.ts` | Cosmos DB + SignalR (Phase 4) |
| `src/multiplayer/moveSyncService.ts` | SignalR (Phase 4) |
| `src/multiplayer/reconnectService.ts` | SignalR (Phase 4) |
| `src/pages/LandingPage.vue` | Microsoft primary for staff, code+PIN for cadets ✅ |
| `package.json` | Add `@azure/cosmos`, `@microsoft/signalr`, `@azure/storage-blob`, `@azure/msal-browser` per phase |
| `.env` | Add `VITE_AZURE_TENANT_ID`, `VITE_AZURE_CLIENT_ID`, `VITE_COSMOS_ENDPOINT`, etc. |

## Data Migration (when cutting over)

Run `node scripts/migrate-firestore-to-cosmos.mjs` during summer break (use `--dry-run` first). It reads every Firestore collection via firebase-admin and upserts into the corresponding Cosmos DB container, creating the database and containers with correct partition keys automatically. Re-runnable — writes are upserts keyed by the original doc IDs. Student codes and PINs stay unchanged — cadets log in the same way, just backed by a different database.
