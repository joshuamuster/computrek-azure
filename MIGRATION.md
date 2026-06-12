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

### Phase 2 — Database (largest lift)
- [ ] Provision Azure Cosmos DB account + `computrek` database
- [ ] Create containers mirroring current Firestore collections (see inventory below)
- [ ] Replace `src/firebase.ts` imports with `src/azure.ts` Cosmos client across all composables
- [ ] Rewrite all ~50 composables to use `@azure/cosmos` SDK instead of Firestore SDK
- [ ] Set `AZURE_DATABASE: true` in featureFlags.ts when complete

### Phase 3 — Real-time
- [ ] Provision Azure SignalR Service
- [ ] Deploy Azure Functions that watch Cosmos DB change feed and push via SignalR
- [ ] Replace all `onSnapshot` calls with SignalR hub subscriptions in composables
- Key surfaces: grading queue, ship status, CHAMPS, timers, challenge system, game rooms, warp core, live roster
- [ ] Set `AZURE_REALTIME: true` in featureFlags.ts when complete

### Phase 4 — Multiplayer
- [ ] Rewrite `gameRoomService.ts`, `moveSyncService.ts`, `reconnectService.ts` for Cosmos DB + SignalR
- [ ] Game engines themselves (chess, mancala, battleship, etc.) are pure TypeScript — no changes needed
- [ ] Set `AZURE_MULTIPLAYER: true` in featureFlags.ts when complete

### Phase 5 — Storage + Presence
- [ ] Replace Firebase Storage upload calls with Azure Blob Storage SDK
- [ ] Replace `usePresence.ts` RTDB logic with Azure SignalR connection tracking
- [ ] Set `AZURE_STORAGE: true` in featureFlags.ts when complete

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
| All `src/composables/use*.ts` | SDK calls only — business logic unchanged (Phase 2) |
| `src/multiplayer/gameRoomService.ts` | Cosmos DB + SignalR (Phase 4) |
| `src/multiplayer/moveSyncService.ts` | SignalR (Phase 4) |
| `src/multiplayer/reconnectService.ts` | SignalR (Phase 4) |
| `src/pages/LandingPage.vue` | Microsoft primary for staff, code+PIN for cadets ✅ |
| `package.json` | Add `@azure/cosmos`, `@microsoft/signalr`, `@azure/storage-blob`, `@azure/msal-browser` per phase |
| `.env` | Add `VITE_AZURE_TENANT_ID`, `VITE_AZURE_CLIENT_ID`, `VITE_COSMOS_ENDPOINT`, etc. |

## Data Migration (when cutting over)

Run a migration script during summer break. Script reads every Firestore collection and writes to the corresponding Cosmos DB container. Student codes and PINs stay unchanged — cadets log in the same way, just backed by a different database.
