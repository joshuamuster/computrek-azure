/**
 * firestoreBackend.ts — the Firestore side of the dual-backend data layer.
 *
 * Just re-exports the Firestore SDK surface the app uses. The facade
 * (src/data/db.ts) picks this module while FEATURE_FLAGS.AZURE_DATABASE is
 * false, so behavior is byte-for-byte identical to importing
 * 'firebase/firestore' directly.
 */
export {
  // refs + query builders
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  documentId,
  // reads
  getDoc,
  getDocs,
  onSnapshot,
  // writes
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  // field values
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  // network toggles (used by the version checker)
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore'
