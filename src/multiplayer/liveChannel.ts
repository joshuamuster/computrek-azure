/**
 * liveChannel.ts — ephemeral high-frequency game state (Phase 5).
 *
 * FracturedFrontier streams live opponent state (tank position while moving,
 * ghost aim arc while aiming) that is deliberately NOT part of the
 * authoritative game_rooms document: it changes many times per second and
 * has no value after the turn commits.
 *
 * Two backends behind FEATURE_FLAGS.AZURE_STORAGE (the Phase 5 gate):
 *
 *   false → Firebase RTDB `live/{channelId}` nodes (original behavior)
 *   true  → SignalR hub target 'liveGameState', scoped to hub group
 *           `live-{joinCode}` so per-frame updates reach only the two
 *           players in the room — never the whole school. Sends are
 *           throttled to ~10/s per channel (RTDB absorbed unthrottled
 *           writes; an HTTP hop should not).
 *
 * Semantics preserved from RTDB:
 *   - updateLive() merges fields (RTDB `update`) — the Azure sender keeps a
 *     local merged copy per channel and always transmits the full object.
 *   - clearLive() (RTDB `set(null)`) delivers `null` to the subscriber.
 *   - subscribeLive() invokes the callback with the merged object or null.
 *
 * Channel IDs follow the RTDB path shape: `${joinCode}/${role}`.
 */
import { AZURE_STORAGE } from '../config/featureFlags'
import { pushDocBroadcast, subscribeContainer, joinGroup } from '../data/realtime'

const LIVE_TARGET = 'liveGameState'
const THROTTLE_MS = 100

function groupOf(channelId: string): string {
  return `live-${channelId.split('/')[0]}` // live-{joinCode}
}

// ── Azure (SignalR) backend ────────────────────────────────────────────────────

const sentState = new Map<string, Record<string, unknown>>()
const throttles = new Map<string, { timer: number | null; pending: boolean }>()

function azureSend(channelId: string, body: Record<string, unknown>): void {
  pushDocBroadcast(LIVE_TARGET, { id: channelId, ...body }, groupOf(channelId))
}

function azureUpdate(channelId: string, partial: Record<string, unknown>): void {
  const merged = { ...(sentState.get(channelId) ?? {}), ...partial }
  sentState.set(channelId, merged)

  // Leading + trailing throttle: send now if idle, else mark pending and
  // flush the latest merged state when the window closes.
  let t = throttles.get(channelId)
  if (!t) { t = { timer: null, pending: false }; throttles.set(channelId, t) }
  if (t.timer !== null) { t.pending = true; return }
  azureSend(channelId, merged)
  t.timer = window.setTimeout(() => {
    t!.timer = null
    if (t!.pending) {
      t!.pending = false
      const latest = sentState.get(channelId)
      if (latest) azureUpdate(channelId, {}) // re-enter to send + restart window
    }
  }, THROTTLE_MS)
}

function azureClear(channelId: string): void {
  sentState.delete(channelId)
  const t = throttles.get(channelId)
  if (t?.timer !== null && t !== undefined) { clearTimeout(t.timer!); t.timer = null; t.pending = false }
  azureSend(channelId, { __cleared: true })
}

// ── Firebase (RTDB) backend ────────────────────────────────────────────────────

async function rtdbApi() {
  const { rtdb } = await import('../firebase')
  const fb = await import('firebase/database')
  return { rtdb, fb }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Merge fields into the channel's live state (opponent sees them ~instantly). */
export function updateLive(channelId: string, partial: Record<string, unknown>): void {
  if (AZURE_STORAGE) {
    azureUpdate(channelId, partial)
    return
  }
  rtdbApi().then(({ rtdb, fb }) =>
    fb.update(fb.ref(rtdb, `live/${channelId}`), partial)
  ).catch(() => {})
}

/** Clear the channel (subscriber receives null) — e.g. after the turn commits. */
export function clearLive(channelId: string): void {
  if (AZURE_STORAGE) {
    azureClear(channelId)
    return
  }
  rtdbApi().then(({ rtdb, fb }) =>
    fb.set(fb.ref(rtdb, `live/${channelId}`), null)
  ).catch(() => {})
}

/**
 * Subscribe to a channel's live state. The callback receives the current
 * merged object, or null when the channel is cleared. Returns unsubscribe.
 */
export function subscribeLive(
  channelId: string,
  cb: (data: Record<string, unknown> | null) => void,
): () => void {
  if (AZURE_STORAGE) {
    const leave = joinGroup(groupOf(channelId))
    const unsub = subscribeContainer(LIVE_TARGET, raw => {
      if (raw.id !== channelId) return
      if (raw.__cleared === true) { cb(null); return }
      const { id, ...data } = raw
      cb(data)
    })
    return () => { unsub(); leave() }
  }

  let fbUnsub: (() => void) | null = null
  let cancelled = false
  rtdbApi().then(({ rtdb, fb }) => {
    if (cancelled) return
    fbUnsub = fb.onValue(fb.ref(rtdb, `live/${channelId}`), snap => cb(snap.val()))
  }).catch(() => {})
  return () => { cancelled = true; fbUnsub?.() }
}
