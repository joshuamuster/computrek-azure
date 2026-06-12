import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GameRoom } from './gameRoomService';
import { isRoomExpired } from './utils';

const ROOMS_COLLECTION = 'game_rooms';

/**
 * Attempts to reconnect to a previously active game session.
 */
export async function tryReconnect(expectedGameType: string): Promise<{ roomId: string; color: 'white' | 'black' } | null> {
  const roomId = localStorage.getItem('current_room_id');
  const color = localStorage.getItem('player_color') as 'white' | 'black' | null;

  if (!roomId || !color) return null;

  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    clearMultiplayerSession();
    return null;
  }

  const roomData = roomSnap.data() as GameRoom;
  
  // Verify gameType matches for safety
  if (roomData.gameType !== expectedGameType) {
    return null;
  }

  if (roomData.status === 'expired' || isRoomExpired(roomData.lastMoveAt)) {
    clearMultiplayerSession();
    return null;
  }

  return { roomId, color };
}

/**
 * Restores the player's color from local storage.
 */
export function restorePlayerColor(): 'white' | 'black' | null {
  return localStorage.getItem('player_color') as 'white' | 'black' | null;
}

/**
 * Clears multiplayer session data from local storage.
 */
export function clearMultiplayerSession() {
  localStorage.removeItem('current_room_id');
  localStorage.removeItem('player_color');
}
