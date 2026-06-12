import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  collection, doc, addDoc, updateDoc, query, where,
  onSnapshot, serverTimestamp, Timestamp, getDocs,
} from '@/data/db'
import { db } from '@/firebase'
import { createOnlineGame, joinOnlineGame } from '@/multiplayer/gameRoomService'
import { getInitialBoard as picardInit, boardToString as picardStr } from '@/components/games/PicardManeuver/engine'
import { getInitialBoard as mancalaInit, boardToString as mancalaStr } from '@/components/games/RulesOfAcquisition/engine'
import { createInitialBattleshipState } from '@/components/games/BattleMutaraNebula/engine'
import { createInitialState as createInitialOrbitalState } from '@/components/games/FracturedFrontier/engine'
import { STANDARD_FEN } from '@/utils/chess960'
import { HORDE_FEN } from '@/utils/chess-variants'

export type ChallengeGame =
  | 'chess'
  | 'battle-of-the-mutara-nebula'
  | 'picard-maneuver'
  | 'rules-of-acquisition'
  | 'fractured-frontier'

export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'terminated'

export interface Challenge {
  id: string
  teacherEmail: string
  periodId: string
  challengerId: string
  challengerName: string
  challengedId: string
  challengedName: string
  game: ChallengeGame
  variant: string
  status: ChallengeStatus
  createdAt: any
  expiresAt: any
  gameRoomId: string | null
  joinCode: string | null
  startFen?: string
}

const GAME_PATHS: Record<ChallengeGame, string> = {
  'chess':                      '/games/chess/play',
  'battle-of-the-mutara-nebula': '/games/battle-of-the-mutara-nebula/play',
  'picard-maneuver':             '/games/picard-maneuver/play',
  'rules-of-acquisition':        '/games/rules-of-acquisition/play',
  'fractured-frontier':          '/games/fractured-frontier/play',
}

const GAME_TYPES: Record<ChallengeGame, string> = {
  'chess':                      'chess',
  'battle-of-the-mutara-nebula': 'battleship',
  'picard-maneuver':             'picard-maneuver',
  'rules-of-acquisition':        'mancala',
  'fractured-frontier':          'fractured-frontier',
}

const RACING_KINGS_FEN = '8/8/8/8/8/8/krbnNBRK/qrbnNBRQ w - - 0 1'

function chessStartFen(variant: string, stored960Fen?: string): string {
  if (variant === '960') return stored960Fen ?? STANDARD_FEN
  if (variant === 'horde') return HORDE_FEN
  if (variant === 'racingkings') return RACING_KINGS_FEN
  return STANDARD_FEN
}

function gameInitState(game: ChallengeGame, variant: string, startFen?: string) {
  switch (game) {
    case 'chess':
      return {
        boardState:  startFen ?? chessStartFen(variant),
        gameType:    'chess',
        initialTurn: 'w',
        variant:     variant !== 'standard' ? variant : undefined,
      }
    case 'picard-maneuver':
      return { boardState: picardStr(picardInit()), gameType: 'picard-maneuver', initialTurn: 'black', variant: undefined }
    case 'rules-of-acquisition':
      return { boardState: mancalaStr(mancalaInit().pits), gameType: 'mancala', initialTurn: 'white', variant: undefined }
    case 'battle-of-the-mutara-nebula':
      return { boardState: JSON.stringify(createInitialBattleshipState()), gameType: 'battleship', initialTurn: 'w', variant: undefined }
    case 'fractured-frontier':
      return { boardState: JSON.stringify(createInitialOrbitalState()), gameType: 'fractured-frontier', initialTurn: 'host', variant: undefined }
  }
}

// ── Singleton listener state ───────────────────────────────────────────────────

const incoming = ref<Challenge[]>([])
const outgoing = ref<Challenge | null>(null)
const acceptedOutgoing = ref<Challenge | null>(null)

let incomingUnsub:  (() => void) | null = null
let outgoingUnsub:  (() => void) | null = null
let acceptedUnsub:  (() => void) | null = null
const routedIds = new Set<string>()

export function useChallenges() {
  const router = useRouter()

  function initIncoming(uid: string) {
    if (incomingUnsub) return
    const q = query(
      collection(db, 'challenges'),
      where('challengedId', '==', uid),
      where('status', '==', 'pending'),
    )
    incomingUnsub = onSnapshot(q, snap => {
      const now = Date.now()
      incoming.value = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Challenge))
        .filter(c => {
          const exp = c.expiresAt?.toMillis?.() ?? (c.expiresAt?.seconds ?? 0) * 1000
          return exp > now
        })
    })
  }

  function initOutgoing(uid: string) {
    if (outgoingUnsub) return
    const q = query(
      collection(db, 'challenges'),
      where('challengerId', '==', uid),
      where('status', '==', 'pending'),
    )
    outgoingUnsub = onSnapshot(q, snap => {
      outgoing.value = snap.docs[0]
        ? ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Challenge)
        : null
    })
  }

  function initAcceptedWatch(uid: string) {
    if (acceptedUnsub) return
    const q = query(
      collection(db, 'challenges'),
      where('challengerId', '==', uid),
      where('status', '==', 'accepted'),
    )
    acceptedUnsub = onSnapshot(q, async snap => {
      const ch = snap.docs[0]
      if (!ch) return
      const data = { id: ch.id, ...ch.data() } as Challenge
      if (!data.gameRoomId || !data.joinCode) return
      if (routedIds.has(data.id)) return
      routedIds.add(data.id)
      acceptedOutgoing.value = data
      try {
        const { roomId: joinedRoomId } = await joinOnlineGame(GAME_TYPES[data.game], data.joinCode)
        const params: Record<string, string> = { mode: 'online', room: joinedRoomId, role: 'guest' }
        if (data.game === 'chess' && data.variant && data.variant !== 'standard') {
          params.variant = data.variant
        }
        router.push({ path: GAME_PATHS[data.game], query: params })
      } catch (e) {
        routedIds.delete(data.id)
        acceptedOutgoing.value = null
        console.error('Challenge join failed:', e)
      }
    })
  }

  // Call from ChallengeBadge onMounted — sets up all cadet-side listeners
  function initBadge(uid: string) {
    initIncoming(uid)
    initOutgoing(uid)
    initAcceptedWatch(uid)
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async function sendChallenge(params: {
    uid: string
    displayName: string
    teacherEmail: string
    periodId: string
    challengedId: string
    challengedName: string
    game: ChallengeGame
    variant: string
    startFen?: string
  }) {
    const now = Timestamp.now()
    const expiresAt = new Timestamp(now.seconds + 5 * 60, now.nanoseconds)
    await addDoc(collection(db, 'challenges'), {
      teacherEmail:   params.teacherEmail,
      periodId:       params.periodId,
      challengerId:   params.uid,
      challengerName: params.displayName,
      challengedId:   params.challengedId,
      challengedName: params.challengedName,
      game:           params.game,
      variant:        params.variant,
      status:         'pending',
      createdAt:      serverTimestamp(),
      expiresAt,
      gameRoomId:     null,
      joinCode:       null,
      ...(params.startFen ? { startFen: params.startFen } : {}),
    })
  }

  async function acceptChallenge(challenge: Challenge) {
    const { boardState, gameType, initialTurn, variant } = gameInitState(
      challenge.game, challenge.variant, challenge.startFen
    )
    const { joinCode: roomJoinCode, roomId } = await createOnlineGame(
      gameType, boardState, initialTurn, variant
    )
    await updateDoc(doc(db, 'challenges', challenge.id), {
      status:    'accepted',
      gameRoomId: roomId,
      joinCode:   roomJoinCode,
    })
    const params: Record<string, string> = { mode: 'online', room: roomId, role: 'host' }
    if (challenge.game === 'chess' && challenge.variant && challenge.variant !== 'standard') {
      params.variant = challenge.variant
    }
    router.push({ path: GAME_PATHS[challenge.game], query: params })
  }

  async function declineChallenge(challengeId: string) {
    await updateDoc(doc(db, 'challenges', challengeId), { status: 'declined' })
  }

  async function expireChallenge(challengeId: string) {
    await updateDoc(doc(db, 'challenges', challengeId), { status: 'expired' })
  }

  async function terminateChallenge(challenge: Challenge) {
    await updateDoc(doc(db, 'challenges', challenge.id), { status: 'terminated' })
    if (challenge.gameRoomId) {
      await updateDoc(doc(db, 'game_rooms', challenge.gameRoomId), { terminated: true })
    }
  }

  async function loadRoster(teacherEmail: string, periodId: string, myUid: string) {
    const q = query(
      collection(db, 'approvedUsers'),
      where('teacherEmail', '==', teacherEmail),
      where('periodId', '==', periodId),
      where('role', '==', 'cadet'),
    )
    const snap = await getDocs(q)
    return snap.docs
      .map(d => ({ uid: d.data().uid as string, displayName: d.data().displayName as string }))
      .filter(u => u.uid && u.uid !== myUid)
  }

  function destroy() {
    if (incomingUnsub) { incomingUnsub(); incomingUnsub = null }
    if (outgoingUnsub) { outgoingUnsub(); outgoingUnsub = null }
    if (acceptedUnsub) { acceptedUnsub(); acceptedUnsub = null }
    incoming.value = []
    outgoing.value = null
    acceptedOutgoing.value = null
    routedIds.clear()
  }

  return {
    incoming,
    outgoing,
    acceptedOutgoing,
    initBadge,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    expireChallenge,
    terminateChallenge,
    loadRoster,
    destroy,
  }
}
