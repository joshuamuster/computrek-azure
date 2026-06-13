/**
 * usePresence.ts — cadet online/offline status via Cosmos DB heartbeat (Phase 5+).
 *
 * The client upserts presence/{uid} every 25s with a TTL. Readers consider a
 * cadet online only if the heartbeat is fresh (< 70s old) — so crashed tabs
 * and dropped Wi-Fi age out on their own, replacing RTDB's onDisconnect.
 * Subscribers poll every 20s: presence is the one live surface where polling
 * beats push, because heartbeats churn constantly and broadcasting them
 * school-wide over SignalR would burn the message budget for data whose
 * freshness requirement is "within half a minute."
 *
 * Privacy: only { online, lastSeen } keyed by opaque UID — no names, emails,
 * periods, or teacher info. Classroom scoping is enforced by loadRoster().
 *
 * Usage:
 *   const { goOnline, goOffline, subscribeToPresence } = usePresence()
 *   goOnline(uid); goOffline(uid)
 *   const { presenceMap, unsubscribe } = subscribeToPresence(uids)
 */

import { ref, type Ref } from 'vue'
import { collection, doc, setDoc, getDocs, query, where, documentId, Timestamp } from '@/data/db'

const HEARTBEAT_MS = 25_000
const STALE_MS     = 70_000
const POLL_MS      = 20_000
const DOC_TTL_S    = 90

// ── Heartbeat ─────────────────────────────────────────────────────────────────

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

function beat(uid: string, online: boolean): Promise<void> {
  return setDoc(doc({}, 'presence', uid), {
    online,
    lastSeen: Timestamp.now(),
    ttl: online ? DOC_TTL_S : 600,
  }).catch(() => {}) as Promise<void>
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function usePresence() {
  function goOnline(uid: string): void {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    beat(uid, true)
    heartbeatTimer = setInterval(() => beat(uid, true), HEARTBEAT_MS)
  }

  async function goOffline(uid: string): Promise<void> {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
    await beat(uid, false)
  }

  function subscribeToPresence(uids: string[]): {
    presenceMap: Ref<Record<string, boolean>>
    unsubscribe: () => void
  } {
    const presenceMap = ref<Record<string, boolean>>(
      Object.fromEntries(uids.map(u => [u, false])),
    )

    const poll = async () => {
      try {
        const snap = await getDocs(query(
          collection({}, 'presence'),
          where(documentId(), 'in', uids),
        ))
        const now  = Date.now()
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

  return { goOnline, goOffline, subscribeToPresence }
}
