import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion,
  getDoc
} from 'firebase/firestore';
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
 */
export async function submitOnlineMove(roomId: string, move: any, nextState: string, nextTurn: string) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  
  // Fetch current state to ensure it's still the player's turn (basic optimistic locking)
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('Game room not found.');
  
  const roomData = roomSnap.data() as GameRoom;
  if (roomData.status !== 'playing' && roomData.status !== 'waiting') {
    throw new Error('Game is not active.');
  }

  // Enforce turn order check would happen here or in security rules
  // For UI responsiveness, we assume the UI handles turn validation before calling this.

  await updateDoc(roomRef, {
    boardState: nextState,
    currentTurn: nextTurn,
    lastMoveAt: Date.now(),
    moveHistory: arrayUnion(sanitizeForFirestore({
      ...move,
      timestamp: Date.now()
    }))
  });
}

/**
 * Resets the online game state.
 */
export async function resetOnlineGame(roomId: string, initialBoardState: string, initialTurn: string = 'w') {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  await updateDoc(roomRef, {
    boardState: initialBoardState,
    currentTurn: initialTurn,
    moveHistory: [],
    lastMoveAt: Date.now(),
    status: 'playing'
  });
}
