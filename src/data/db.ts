/**
 * db.ts — CompuTrek's database access layer (Phase 2 of the Azure migration).
 *
 * Every composable, page, and service imports its database functions from
 * here instead of 'firebase/firestore'. The actual backend is selected once,
 * at module load, by FEATURE_FLAGS.AZURE_DATABASE:
 *
 *   false → firestoreBackend.ts  (re-exports the Firestore SDK — current)
 *   true  → cosmosBackend.ts     (same API implemented on Azure Cosmos DB)
 *
 * Call signatures are unchanged from Firestore, including the leading `db`
 * argument (the Cosmos backend simply ignores it). This means cutting over
 * to Cosmos is a one-line flag flip once the data has been migrated — no
 * composable changes required.
 *
 * The Cosmos SDK is dynamically imported inside cosmosBackend, so it adds
 * nothing to the bundle while the flag is off.
 */
import type {
  Timestamp as FirestoreTimestamp,
  QueryConstraint as FirestoreQueryConstraint,
  DocumentData as FirestoreDocumentData,
} from 'firebase/firestore'

import { AZURE_DATABASE } from '../config/featureFlags'
import * as firestoreBackend from './firestoreBackend'
import * as cosmosBackend from './cosmosBackend'

// The Cosmos backend is structurally compatible with the Firestore surface the
// app uses; the cast keeps consumers typed against the canonical Firestore API.
const impl = AZURE_DATABASE
  ? (cosmosBackend as unknown as typeof firestoreBackend)
  : firestoreBackend

// refs + query builders
export const collection = impl.collection
export const doc        = impl.doc
export const query      = impl.query
export const where      = impl.where
export const orderBy    = impl.orderBy
export const limit      = impl.limit
export const documentId = impl.documentId

// reads
export const getDoc     = impl.getDoc
export const getDocs    = impl.getDocs
export const onSnapshot = impl.onSnapshot

// writes
export const addDoc         = impl.addDoc
export const setDoc         = impl.setDoc
export const updateDoc      = impl.updateDoc
export const deleteDoc      = impl.deleteDoc
export const writeBatch     = impl.writeBatch
export const runTransaction = impl.runTransaction

// field values
export const serverTimestamp = impl.serverTimestamp
export const increment       = impl.increment
export const arrayUnion      = impl.arrayUnion
export const arrayRemove     = impl.arrayRemove
export const Timestamp       = impl.Timestamp

// network toggles
export const enableNetwork  = impl.enableNetwork
export const disableNetwork = impl.disableNetwork

// Types — consumers keep using the Firestore-named types regardless of backend.
export type Timestamp       = FirestoreTimestamp
export type QueryConstraint = FirestoreQueryConstraint
export type DocumentData    = FirestoreDocumentData
