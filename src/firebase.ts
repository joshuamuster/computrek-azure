import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getDatabase } from 'firebase/database'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'computrekcs'

export const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_GOOGLE_SHEETS_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  // Realtime Database URL — used for presence tracking only (no PII stored there).
  // Falls back to the standard default-database URL derived from the project ID.
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL
                     || `https://${projectId}-default-rtdb.firebaseio.com`,
}

const app = initializeApp(firebaseConfig)

export const auth    = getAuth(app)
export const storage = getStorage(app)

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
})

// Realtime Database — used exclusively for cadet online-presence tracking.
// Stores only { online: boolean, lastChanged: serverTimestamp } keyed by UID.
// No PII (names, emails, periods) is written here.
export const rtdb = getDatabase(app)