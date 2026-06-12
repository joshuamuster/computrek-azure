import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion,
  getDoc
} from '@/data/db';
import { db } from '../firebase';
import { GameRoom } from './gameRoomService';
import { isRoomExpired, sanitizeForFirestore } from './utils';

const ROOMS_COLLECTION = 'game_rooms';

/**
 * Listens for remote updates to the game room.
 */
export function listenForRemoteUpdates(roomId: string, onUpdate: (room: GameRoom) => void) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  
  return onSnapshot(roomRef, async (snapshot) => {
    try {
      if (snapshot.exists()) {
        const data = snapshot.data() as GameRoom;
        
        // Auto-expire check
        if (data.status !== 'expired' && isRoomExpired(data.lastMoveAt)) {
          await updateDoc(roomRef, { status: 'expired' });
          return;
        }
        
        onUpdate({ ...data, id: snapshot.id });
      }
    } catch (err) {
      console.error("Error in onSnapshot callback:", err);
    }
  }, (error) => {
    console.error("Firestore Snapshot Listener Error:", error);
  });
}

/**
 * Submits a move to Firestore.
 * Pass `pocket` when playing Crazyhouse so both players see the updated
 * piece counts immediately.
 */
export async function submitOnlineMove(
  roomId: string,
  move: any,
  nextState: string,
  nextTurn: string,
  pocket?: { white: Record<string, number>; black: Record<string, number> }
) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);

  // Fetch current state to ensure it's still the player's turn (basic optimistic locking)
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('Game room not found.');

  const roomData = roomSnap.data() as GameRoom;
  if (roomData.status !== 'playing' && roomData.status !== 'waiting') {
    throw new Error('Game is not active.');
  }

  const update: Record<string, any> = {
    boardState: nextState,
    currentTurn: nextTurn,
    lastMoveAt: Date.now(),
    moveHistory: arrayUnion(sanitizeForFirestore({
      ...move,
      timestamp: Date.now()
    }))
  };
  if (pocket !== undefined) update.pocket = pocket;

  await updateDoc(roomRef, update);
}

/**
 * Resets the online game state.
 * Pass `startFen` to also update the stored starting position (e.g. when
 * resetting a Chess 960 game to a fresh random position).
 * Pass `resetPocket: true` to clear the Crazyhouse pocket back to empty.
 */
export async function resetOnlineGame(
  roomId: string,
  initialBoardState: string,
  initialTurn: string = 'w',
  startFen?: string,
  resetPocket?: boolean
) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const EMPTY = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const update: Record<string, any> = {
    boardState: initialBoardState,
    currentTurn: initialTurn,
    moveHistory: [],
    lastMoveAt: Date.now(),
    status: 'playing'
  };
  if (startFen !== undefined) update.startFen = startFen;
  if (resetPocket) update.pocket = { white: { ...EMPTY }, black: { ...EMPTY } };
  await updateDoc(roomRef, update);
}
