/**
 * liveChannel.ts — ephemeral high-frequency game state (Phase 5+).
 *
 * FracturedFrontier streams live opponent state (tank position while moving,
 * ghost aim arc while aiming) that is deliberately NOT part of the
 * authoritative game_rooms document: it changes many times per second and
 * has no value after the turn commits.
 *
 * Sends are routed to a SignalR hub target ('liveGameState') scoped to hub
 * group `live-{joinCode}` so per-frame updates reach only the two players in
 * the room — never the whole school. Sends are throttled to ~10/s per channel.
 *
 * updateLive() merges fields (like RTDB's `update`): the sender keeps a local
 * merged copy per channel and always transmits the full current object.
 * clearLive() delivers null to the subscriber (like RTDB's `set(null)`).
 * subscribeLive() invokes the callback with the merged object or null.
 *
 * Channel IDs follow the RTDB path shape: `${joinCode}/${role}`.
 */
import { pushDocBroadcast, subscribeContainer, joinGroup } from '../data/realtime'

const LIVE_TARGET = 'liveGameState'
const THROTTLE_MS = 100

function groupOf(channelId: string): string {
  return `live-${channelId.split('/')[0]}` // live-{joinCode}
}

const sentState = new Map<string, Record<string, unknown>>()
const throttles = new Map<string, { timer: number | null; pending: boolean }>()

function sendNow(channelId: string, body: Record<string, unknown>): void {
  pushDocBroadcast(LIVE_TARGET, { id: channelId, ...body }, groupOf(channelId))
}

function throttledUpdate(channelId: string, partial: Record<string, unknown>): void {
  const merged = { ...(sentState.get(channelId) ?? {}), ...partial }
  sentState.set(channelId, merged)

  let t = throttles.get(channelId)
  if (!t) { t = { timer: null, pending: false }; throttles.set(channelId, t) }
  if (t.timer !== null) { t.pending = true; return }
  sendNow(channelId, merged)
  t.timer = window.setTimeout(() => {
    t!.timer = null
    if (t!.pending) {
      t!.pending = false
      const latest = sentState.get(channelId)
      if (latest) throttledUpdate(channelId, {})
    }
  }, THROTTLE_MS)
}

/** Merge fields into the channel's live state (opponent sees them ~instantly). */
export function updateLive(channelId: string, partial: Record<string, unknown>): void {
  throttledUpdate(channelId, partial)
}

/** Clear the channel (subscriber receives null) — e.g. after the turn commits. */
export function clearLive(channelId: string): void {
  sentState.delete(channelId)
  const t = throttles.get(channelId)
  if (t?.timer !== null && t !== undefined) { clearTimeout(t.timer!); t.timer = null; t.pending = false }
  sendNow(channelId, { __cleared: true })
}

/**
 * Subscribe to a channel's live state. The callback receives the current
 * merged object, or null when the channel is cleared. Returns unsubscribe.
 */
export function subscribeLive(
  channelId: string,
  cb: (data: Record<string, unknown> | null) => void,
): () => void {
  const leave = joinGroup(groupOf(channelId))
  const unsub = subscribeContainer(LIVE_TARGET, raw => {
    if (raw.id !== channelId) return
    if (raw.__cleared === true) { cb(null); return }
    const { id, ...data } = raw
    cb(data)
  })
  return () => { unsub(); leave() }
}
