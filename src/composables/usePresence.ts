/**
 * usePresence.ts
 *
 * Tracks cadet online/offline status. Two backends behind
 * FEATURE_FLAGS.AZURE_STORAGE (the Phase 5 migration gate):
 *
 *   false → Firebase Realtime Database (original implementation), chosen for
 *           its server-side `onDisconnect` cleanup.
 *   true  → Cosmos DB heartbeat. The client upserts presence/{uid} every 25s
 *           with a TTL, and readers consider a cadet online only if the
 *           heartbeat is fresh (< 70s old) — so crashed tabs and dropped
 *           Wi-Fi age out on their own, replacing onDisconnect. Subscribers
 *           poll every 20s: presence is the one live surface where polling
 *           beats push — heartbeats churn constantly, and broadcasting them
 *           school-wide over SignalR would burn the message budget for data
 *           whose freshness requirement is "within half a minute."
 *
 * Privacy design (unchanged): only `{ online, lastSeen }` keyed by opaque
 * UID — no names, emails, periods, or teacher info. Classroom scoping is
 * enforced by loadRoster(); this composable only resolves UIDs already
 * cleared by that query.
 *
 * Usage (API identical across backends):
 *   const { goOnline, goOffline } = usePresence()
 *   goOnline(uid); goOffline(uid)
 *   const { presenceMap, unsubscribe } = subscribeToPresence(uids)
 */

import { ref, type Ref } from 'vue'
import { AZURE_STORAGE } from '@/config/featureFlags'
import { db } from '@/firebase'
import { collection, doc, setDoc, getDocs, query, where, documentId, Timestamp } from '@/data/db'

const HEARTBEAT_MS = 25_000
const STALE_MS     = 70_000
const POLL_MS      = 20_000
/** Cosmos TTL (seconds) — stale presence docs delete themselves. */
const DOC_TTL_S    = 90

// ── Azure backend (Cosmos heartbeat) ───────────────────────────────────────────

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

function beat(uid: string, online: boolean): Promise<void> {
  return setDoc(doc(db, 'presence', uid), {
    online,
    lastSeen: Timestamp.now(),
    ttl: online ? DOC_TTL_S : 600,
  }).catch(() => { /* presence is best-effort */ }) as Promise<void>
}

function azureGoOnline(uid: string): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  beat(uid, true)
  heartbeatTimer = setInterval(() => beat(uid, true), HEARTBEAT_MS)
}

async function azureGoOffline(uid: string): Promise<void> {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  await beat(uid, false)
}

function azureSubscribe(uids: string[]): {
  presenceMap: Ref<Record<string, boolean>>
  unsubscribe: () => void
} {
  const presenceMap = ref<Record<string, boolean>>(
    Object.fromEntries(uids.map(u => [u, false])),
  )

  const poll = async () => {
    try {
      const snap = await getDocs(query(
        collection(db, 'presence'),
        where(documentId(), 'in', uids),
      ))
      const now = Date.now()
      const next: Record<string, boolean> = Object.fromEntries(uids.map(u => [u, false]))
      snap.docs.forEach(d => {
        const data = d.data() as { online?: boolean; lastSeen?: Timestamp }
        next[d.id] = data.online === true &&
          (data.lastSeen?.toMillis?.() ?? 0) > now - STALE_MS
      })
      presenceMap.value = next
    } catch { /* keep last known state on a failed poll */ }
  }

  poll()
  const timer = setInterval(poll, POLL_MS)
  return { presenceMap, unsubscribe: () => clearInterval(timer) }
}

// ── Firebase backend (RTDB, original) ──────────────────────────────────────────

async function rtdbApi() {
  const { rtdb } = await import('@/firebase')
  const fb = await import('firebase/database')
  return { rtdb, fb }
}

function rtdbGoOnline(uid: string): void {
  rtdbApi().then(({ rtdb, fb }) => {
    const node = fb.ref(rtdb, `presence/${uid}`)
    fb.set(node, { online: true, lastChanged: fb.serverTimestamp() })
    fb.onDisconnect(node).set({ online: false, lastChanged: fb.serverTimestamp() })
  }).catch(() => {})
}

async function rtdbGoOffline(uid: string): Promise<void> {
  const { rtdb, fb } = await rtdbApi()
  const node = fb.ref(rtdb, `presence/${uid}`)
  await fb.onDisconnect(node).cancel()
  await fb.set(node, { online: false, lastChanged: fb.serverTimestamp() })
}

function rtdbSubscribe(uids: string[]): {
  presenceMap: Ref<Record<string, boolean>>
  unsubscribe: () => void
} {
  const presenceMap = ref<Record<string, boolean>>({})
  const unsubscribers: (() => void)[] = []
  let cancelled = false

  rtdbApi().then(({ rtdb, fb }) => {
    if (cancelled) return
    for (const uid of uids) {
      const node = fb.ref(rtdb, `presence/${uid}/online`)
      unsubscribers.push(fb.onValue(node, (snap) => {
        presenceMap.value = { ...presenceMap.value, [uid]: snap.val() === true }
      }))
    }
  }).catch(() => {})

  return {
    presenceMap,
    unsubscribe: () => { cancelled = true; unsubscribers.forEach(fn => fn()) },
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function usePresence() {
  function goOnline(uid: string): void {
    AZURE_STORAGE ? azureGoOnline(uid) : rtdbGoOnline(uid)
  }

  async function goOffline(uid: string): Promise<void> {
    return AZURE_STORAGE ? azureGoOffline(uid) : rtdbGoOffline(uid)
  }

  function subscribeToPresence(uids: string[]) {
    return AZURE_STORAGE ? azureSubscribe(uids) : rtdbSubscribe(uids)
  }

  return { goOnline, goOffline, subscribeToPresence }
}
