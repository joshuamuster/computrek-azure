/**
 * azure.ts — Azure SDK initialization for CompuTrek Azure migration.
 *
 * This file is the Azure equivalent of firebase.ts. Services are activated
 * phase by phase as the migration progresses. Each section is clearly marked
 * with its target phase so the diff between phases stays readable.
 *
 * Phase 1 (current): Auth config only.
 *   - Staff sign in via Firebase Auth's Microsoft OAuth provider (OAuthProvider).
 *     This uses the Azure AD tenant but keeps Firebase Auth managing the session
 *     token, so existing Firestore Security Rules still work throughout Phase 5.
 *   - True standalone MSAL (no Firebase dependency) lands in Phase 6.
 *   - Cadets use Firebase Auth email/password with synthetic {code}@computrek.app
 *     addresses. No real student PII ever enters Firebase.
 *
 * Phase 2: Cosmos DB client replaces Firestore in all composables.
 * Phase 3: SignalR service replaces Firestore onSnapshot listeners.
 * Phase 4: Multiplayer game rooms rewritten for Cosmos DB + SignalR.
 * Phase 5: Azure Blob Storage replaces Firebase Storage.
 * Phase 6: Standalone MSAL replaces Firebase Auth entirely; Firebase removed.
 */

// ── Phase 1: Auth constants ────────────────────────────────────────────────────
// Used by LandingPage.vue when constructing the OAuthProvider for Microsoft
// sign-in. Set VITE_AZURE_TENANT_ID to the district's Azure AD tenant GUID
// once IT provides it. Falls back to 'common' (any Microsoft account) for
// local dev / pre-launch testing with your own Microsoft account.
export const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || 'common'
export const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || ''


// ── Phase 2: Cosmos DB ── ✅ implemented in src/data/ ──────────────────────────
// The database layer now lives in src/data/:
//
//   src/data/db.ts              — facade every composable/page imports from;
//                                 selects the backend via FEATURE_FLAGS.AZURE_DATABASE
//   src/data/firestoreBackend.ts — re-exports the Firestore SDK (current backend)
//   src/data/cosmosBackend.ts    — same API implemented on @azure/cosmos,
//                                  including the full container/partition-key
//                                  registry (CONTAINER_REGISTRY)
//
// The Cosmos client is created lazily inside cosmosBackend via dynamic import,
// so it costs nothing in the bundle until AZURE_DATABASE is flipped to true.
//
// Cutover procedure:
//   1. Provision a Cosmos DB account; set VITE_COSMOS_ENDPOINT and
//      VITE_COSMOS_KEY in .env. Enable CORS for the app's origin on the account.
//   2. node scripts/migrate-firestore-to-cosmos.mjs --dry-run   (sanity check)
//   3. node scripts/migrate-firestore-to-cosmos.mjs             (copy the data)
//   4. Set AZURE_DATABASE = true in src/config/featureFlags.ts.


// ── Phase 3: Azure SignalR ────────────────────────────────────────────────────
// Uncomment when Phase 3 real-time layer work begins. Requires Azure Functions
// backend that watches the Cosmos DB change feed and pushes via SignalR hubs.
// Run `npm install @microsoft/signalr` before activating.
//
// import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
//
// export const signalrConnection = new HubConnectionBuilder()
//   .withUrl('/api/hub', {
//     accessTokenFactory: () => getSignalRToken(),
//   })
//   .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
//   .configureLogging(LogLevel.Warning)
//   .build()
//
// async function getSignalRToken(): Promise<string> {
//   const res = await fetch('/api/signalr/negotiate')
//   const { accessToken } = await res.json()
//   return accessToken
// }


// ── Phase 5: Azure Blob Storage ───────────────────────────────────────────────
// Uncomment when replacing Firebase Storage for submission file uploads.
// Run `npm install @azure/storage-blob` before activating.
//
// import { BlobServiceClient } from '@azure/storage-blob'
//
// export const blobClient = BlobServiceClient.fromConnectionString(
//   import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING
// )
// export const submissionsBlobContainer =
//   blobClient.getContainerClient('submissions')


// ── Phase 6: Standalone MSAL ──────────────────────────────────────────────────
// Replaces Firebase Auth entirely. Staff and cadet sessions are both managed
// by Azure AD. Firebase SDK is removed from package.json in this phase.
// Run `npm install @azure/msal-browser` before activating.
//
// import { PublicClientApplication } from '@azure/msal-browser'
//
// export const msalInstance = new PublicClientApplication({
//   auth: {
//     clientId:    AZURE_CLIENT_ID,
//     authority:   `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
//     redirectUri: window.location.origin,
//   },
//   cache: {
//     cacheLocation:          'sessionStorage',
//     storeAuthStateInCookie: false,
//   },
// })
// await msalInstance.initialize()
