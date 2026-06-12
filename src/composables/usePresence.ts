/**
 * usePresence.ts
 *
 * Tracks cadet online/offline status via Firebase Realtime Database.
 *
 * Privacy design:
 *   - Only `{ online: boolean, lastChanged: serverTimestamp }` is stored in RTDB.
 *   - Keys are opaque UIDs — no names, emails, periods, or teacher info ever
 *     touch RTDB.
 *   - Classroom scoping (teacherEmail + periodId) is enforced in Firestore
 *     (loadRoster). This composable only resolves UIDs already cleared by that
 *     query, so opening presence to "any authenticated reader" in the RTDB rules
 *     does not create a new PII or enumeration surface.
 *
 * Usage:
 *   // In App.vue — called once when a cadet logs in / out:
 *   const { goOnline, goOffline } = usePresence()
 *   goOnline(uid)   // marks online; registers server-side onDisconnect cleanup
 *   goOffline(uid)  // explicit offline (logout, visibility hidden, etc.)
 *
 *   // In ChallengeModal — called with a list of classmate UIDs from loadRoster:
 *   const { subscribeToPresence } = usePresence()
 *   const { presenceMap, unsubscribe } = subscribeToPresence(uids)
 *   // presenceMap.value is a reactive Record<uid, boolean>
 */

import { ref, type Ref } from 'vue'
import { rtdb } from '@/firebase'
import {
  ref as dbRef,
  set,
  onDisconnect,
  serverTimestamp,
  onValue,
} from 'firebase/database'

export function usePresence() {
  /**
   * Mark a cadet as online and register an `onDisconnect` handler that
   * Firebase's servers will execute automatically if the connection drops
   * (tab closed, browser crash, network loss, etc.).
   */
  function goOnline(uid: string): void {
    const node = dbRef(rtdb, `presence/${uid}`)
    set(node, { online: true,  lastChanged: serverTimestamp() })
    onDisconnect(node).set({ online: false, lastChanged: serverTimestamp() })
  }

  /**
   * Explicitly mark a cadet as offline (call on logout or page hide).
   * This also cancels any pending onDisconnect handler for this uid.
   */
  async function goOffline(uid: string): Promise<void> {
    const node = dbRef(rtdb, `presence/${uid}`)
    await onDisconnect(node).cancel()
    await set(node, { online: false, lastChanged: serverTimestamp() })
  }

  /**
   * Subscribe to the online status of a specific list of UIDs.
   * Returns a reactive map (uid → boolean) and an unsubscribe function.
   *
   * Only call this with UIDs sourced from loadRoster() — i.e., UIDs that
   * Firestore has already confirmed belong to the cadet's own class period.
   */
  function subscribeToPresence(uids: string[]): {
    presenceMap: Ref<Record<string, boolean>>
    unsubscribe:  () => void
  } {
    const presenceMap = ref<Record<string, boolean>>({})
    const unsubscribers: (() => void)[] = []

    for (const uid of uids) {
      const node = dbRef(rtdb, `presence/${uid}/online`)
      // onValue returns an unsubscribe function in the v9 modular SDK
      const unsub = onValue(node, (snap) => {
        presenceMap.value = { ...presenceMap.value, [uid]: snap.val() === true }
      })
      unsubscribers.push(unsub)
    }

    function unsubscribe() {
      unsubscribers.forEach(fn => fn())
    }

    return { presenceMap, unsubscribe }
  }

  return { goOnline, goOffline, subscribeToPresence }
}
