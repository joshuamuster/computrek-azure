/**
 * firebase.ts — stub exports (Phase 6: Firebase SDK removed).
 *
 * The 40+ composables and pages that do `import { db } from '@/firebase'`
 * pass the `db` object as the first argument to collection()/doc() calls.
 * The Cosmos backend ignores that argument (_db: unknown), so an empty object
 * works as a drop-in placeholder. No Firebase SDK is needed.
 *
 * auth, storage, rtdb, and firebaseConfig had callers only in LandingPage,
 * useAuth, usePresence, storage.ts, and liveChannel.ts — all rewritten in
 * Phase 6. These stubs keep any remaining stray imports from failing the build.
 */

export const db           = {}
export const auth         = null
export const storage      = null
export const rtdb         = null
export const firebaseConfig = {}
