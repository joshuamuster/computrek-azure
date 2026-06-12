import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  type DocumentData
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateJoinCode, getPersistentPlayerId, isRoomExpired } from './utils';

export interface GameRoom {
  id: string;
  gameType: string; // New field for identifying the game
  joinCode: string;
  createdAt: any;
  lastMoveAt: number;
  status: 'waiting' | 'playing' | 'finished' | 'expired';
  players: {
    white: string | null;
    black: string | null;
  };
  boardState: string; // FEN or other game-specific state
  currentTurn: string; // Generalize from 'w' | 'b' to allow any string
  moveHistory: any[];
}

const ROOMS_COLLECTION = 'game_rooms';

/**
 * Creates a new game room.
 */
export async function createOnlineGame(gameType: string, initialBoardState: string, initialTurn: string = 'w'): Promise<string> {
  const playerId = getPersistentPlayerId();
  const joinCode = generateJoinCode();
  
  const roomData: DocumentData = {
    gameType,
    joinCode,
    createdAt: serverTimestamp(),
    lastMoveAt: Date.now(),
    status: 'waiting',
    players: {
      white: playerId, // Creator is white by default
      black: null
    },
    boardState: initialBoardState,
    currentTurn: initialTurn,
    moveHistory: []
  };

  const roomRef = doc(collection(db, ROOMS_COLLECTION));
  await setDoc(roomRef, roomData);
  
  // Store room ID in local storage for reconnection
  localStorage.setItem('current_room_id', roomRef.id);
  localStorage.setItem('player_color', 'white');

  return joinCode;
}

/**
 * Joins an existing game room by code.
 */
export async function joinOnlineGame(gameType: string, joinCode: string): Promise<{ roomId: string; color: 'white' | 'black' }> {
  const playerId = getPersistentPlayerId();
  
  // Find room by joinCode and gameType
  const q = query(
    collection(db, ROOMS_COLLECTION), 
    where('joinCode', '==', joinCode.toUpperCase()),
    where('gameType', '==', gameType)
  );
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    throw new Error('Invalid join code.');
  }

  const roomDoc = querySnapshot.docs[0];
  const roomData = roomDoc.data() as GameRoom;

  if (roomData.status === 'expired' || isRoomExpired(roomData.lastMoveAt)) {
    await updateDoc(roomDoc.ref, { status: 'expired' });
    throw new Error('This room has expired.');
  }

  if (roomData.players.white && roomData.players.black) {
    // If player is already in the room, allow rejoin
    if (roomData.players.white === playerId) return { roomId: roomDoc.id, color: 'white' };
    if (roomData.players.black === playerId) return { roomId: roomDoc.id, color: 'black' };
    throw new Error('Room is full.');
  }

  const color = roomData.players.white ? 'black' : 'white';
  const playerUpdate = color === 'white' ? { 'players.white': playerId } : { 'players.black': playerId };

  await updateDoc(roomDoc.ref, {
    ...playerUpdate,
    status: 'playing',
    lastMoveAt: Date.now()
  });

  localStorage.setItem('current_room_id', roomDoc.id);
  localStorage.setItem('player_color', color);

  return { roomId: roomDoc.id, color };
}

/**
 * Marks a room as expired.
 */
export async function expireRoom(roomId: string) {
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  await updateDoc(roomRef, { status: 'expired' });
}
