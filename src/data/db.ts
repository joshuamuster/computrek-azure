/**
 * db.ts — CompuTrek's database access layer (Phase 2+, Firebase removed in Phase 6).
 *
 * All composables, pages, and services import database functions from here.
 * With AZURE_AUTH_STANDALONE true and Firebase removed, this is a direct
 * re-export from cosmosBackend. The leading `db` argument that Firestore
 * required is accepted but ignored by all cosmosBackend functions, so the
 * 40+ callers that pass `db` from '@/firebase' continue to compile unchanged
 * (they get an empty stub object, which is silently discarded).
 */
export * from './cosmosBackend'

// DocumentData isn't in cosmosBackend — define it here for any code that
// types raw Firestore data. No consumers currently import it, but keep it
// in case the migration script or tests reference it later.
export type DocumentData = Record<string, unknown>
