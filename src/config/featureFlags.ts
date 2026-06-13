/**
 * featureFlags.ts — feature gates for the CompuTrek Azure migration.
 *
 * This is the Azure repo. Microsoft auth is ON by default — it is the
 * primary authentication method for staff in this version of the app.
 *
 * The AZURE_* flags gate each migration phase. Flip them to true one at a
 * time as each phase's composable rewrites are completed and tested.
 */

// ── Auth ───────────────────────────────────────────────────────────────────────

/**
 * Always true in this repo. Microsoft Entra ID is the primary staff
 * authentication method. The "Sign in with Microsoft" button on the
 * landing page is ungated — no feature flag check needed.
 *
 * To activate district SSO:
 *   1. District IT registers the app in Azure AD and provides a Client ID.
 *   2. Set VITE_AZURE_TENANT_ID in .env to the district's tenant GUID.
 *   3. Set VITE_AZURE_CLIENT_ID in .env to the registered app's Client ID.
 *   4. In Firebase Console → Authentication → Sign-in providers → Microsoft:
 *      paste the Client ID and Client Secret IT provides.
 *   5. Done — Microsoft sign-in is now locked to district accounts only.
 */
export const MICROSOFT_AUTH = true

/**
 * Azure AD tenant ID for the school district.
 * Read from environment variable — falls back to 'common' (any Microsoft
 * account) for local dev before IT provides the real tenant GUID.
 */
export const MICROSOFT_TENANT = import.meta.env.VITE_AZURE_TENANT_ID || 'common'


// ── Migration phase gates ──────────────────────────────────────────────────────

/**
 * Phase 2: Route all composable reads/writes to Azure Cosmos DB instead of
 * Firestore. Flip to true once every composable has been rewritten and
 * tested against a live Cosmos DB instance.
 */
export const AZURE_DATABASE = true

/**
 * Phase 3: Use Azure SignalR Service for real-time updates instead of
 * Firestore onSnapshot listeners. Requires the Azure Functions backend
 * (Cosmos DB change feed → SignalR push) to be deployed first.
 * Depends on AZURE_DATABASE being true.
 */
export const AZURE_REALTIME = true

/**
 * Phase 4: Multiplayer game rooms backed by Cosmos DB + SignalR.
 * Depends on AZURE_DATABASE and AZURE_REALTIME both being true.
 */
export const AZURE_MULTIPLAYER = true

/**
 * Phase 5: Azure Blob Storage for submission file uploads.
 * Flip to true once the Blob Storage container and SAS token endpoint
 * (Azure Function) are configured and tested.
 */
export const AZURE_STORAGE = true

/**
 * Phase 6: Standalone MSAL replaces Firebase Auth entirely.
 * Firebase SDK is removed from package.json when this is true.
 * Only flip this after ALL other AZURE_* flags are true and tested.
 */
export const AZURE_AUTH_STANDALONE = false


export const FEATURE_FLAGS = {
  MICROSOFT_AUTH,
  AZURE_DATABASE,
  AZURE_REALTIME,
  AZURE_MULTIPLAYER,
  AZURE_STORAGE,
  AZURE_AUTH_STANDALONE,
} as const
