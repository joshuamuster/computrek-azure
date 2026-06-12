import { ref, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  createOnlineGame as createGame,
  joinOnlineGame as joinGame,
  GameRoom
} from '../multiplayer/gameRoomService';
import {
  listenForRemoteUpdates,
  submitOnlineMove,
  resetOnlineGame
} from '../multiplayer/moveSyncService';
import {
  tryReconnect as reconnect,
  restorePlayerColor
} from '../multiplayer/reconnectService';

// ─── Safe localStorage wrapper ────────────────────────────────────────────────
// School browsers often block or clear localStorage. All reads/writes go
// through these helpers so a failure never throws or breaks the game flow.

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); }
  catch { /* silently ignore — URL params are the primary session carrier */ }
}

function lsRemove(key: string): void {
  try { localStorage.removeItem(key); }
  catch { /* silently ignore */ }
}

// ─── Global singleton state ───────────────────────────────────────────────────
// Declared outside the composable so state survives Vue router navigations.

const roomId = ref<string | null>(null);
const joinCode = ref<string | null>(null);
const playerColor = ref<'white' | 'black' | null>(null);
const isMultiplayer = ref(false);
const remoteRoom = ref<GameRoom | null>(null);
const error = ref<string | null>(null);
const isLoading = ref(false);
let unsubscribe: (() => void) | null = null;

export function useMultiplayer() {
  const router = useRouter();
  const route = useRoute();
  
  // ─── Create room ────────────────────────────────────────────────────────────
  // gameRoomService.createOnlineGame returns only the joinCode but also writes
  // current_room_id to localStorage internally. We read it back immediately
  // after the call while we're still in the same JS context (so localStorage
  // hasn't been cleared yet), and we ALSO push the roomId into the URL so the
  // session survives even when localStorage is unavailable.
  
  const createOnlineGame = async (
    gameType: string,
    initialBoardState: string,
    initialTurn: string = 'w'
  ) => {
    isLoading.value = true;
    error.value = null;
    try {
      const code = await createGame(gameType, initialBoardState, initialTurn);
      
      // gameRoomService writes the roomId to localStorage synchronously before
      // returning, so this read will succeed in the same tick.
      const storedId = lsGet('current_room_id');
      if (!storedId) {
        // Extremely unlikely, but handle it gracefully.
        throw new Error('Room was created but the room ID could not be retrieved.');
      }
      
      roomId.value = storedId;
      joinCode.value = code;
      playerColor.value = 'white';
      isMultiplayer.value = true;
      
      startListening(storedId);
      
      // Push roomId + role into the URL so the session can be restored without
      // localStorage (e.g. after a hard refresh on a school browser).
      await router.replace({
        query: {
          ...route.query,
          room: storedId,
          role: 'host',
        },
      });
    } catch (err: any) {
      console.error('Create Online Game Error:', err);
      error.value = err.message;
    } finally {
      isLoading.value = false;
    }
  };
  
  // ─── Join room ──────────────────────────────────────────────────────────────
  
  const joinOnlineGame = async (gameType: string, code: string) => {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await joinGame(gameType, code);
      
      roomId.value = result.roomId;
      playerColor.value = result.color;
      isMultiplayer.value = true;
      joinCode.value = code.toUpperCase();
      
      startListening(result.roomId);
      
      // Same URL-param strategy for the joining player.
      await router.replace({
        query: {
          ...route.query,
          room: result.roomId,
          role: 'guest',
        },
      });
    } catch (err: any) {
      console.error('Join Online Game Error:', err);
      error.value = err.message;
    } finally {
      isLoading.value = false;
    }
  };
  
  // ─── Listen for remote updates ──────────────────────────────────────────────
  
  const startListening = (id: string) => {
    if (unsubscribe) unsubscribe();
    try {
      unsubscribe = listenForRemoteUpdates(id, (room) => {
        remoteRoom.value = room;
        if (!roomId.value) roomId.value = room.id;
        if (!joinCode.value) joinCode.value = room.joinCode;
      });
    } catch (err: any) {
      console.error('Start Listening Error:', err);
      error.value = 'Connection lost: ' + err.message;
    }
  };
  
  const stopListening = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
  
  // ─── Submit move ────────────────────────────────────────────────────────────
  // If the move fails to sync we surface the error AND set isMultiplayer to
  // false so the game doesn't silently desync — both players will see the
  // banner and know the session is broken.
  
  const submitMove = async (move: any, nextState: string, nextTurn: string) => {
    if (!roomId.value || !isMultiplayer.value) return;
    try {
      await submitOnlineMove(roomId.value, move, nextState, nextTurn);
    } catch (err: any) {
      console.error('Submit Move Error:', err);
      error.value = 'Move failed to sync — connection lost. Please reset and rejoin.';
      isMultiplayer.value = false; // prevent further silent desyncs
    }
  };
  
  // ─── Reset game ─────────────────────────────────────────────────────────────
  
  const resetGame = async (initialBoardState: string, initialTurn: string = 'w') => {
    if (!roomId.value || !isMultiplayer.value) return;
    try {
      await resetOnlineGame(roomId.value, initialBoardState, initialTurn);
    } catch (err: any) {
      console.error('Reset Game Error:', err);
      error.value = 'Failed to reset remote game: ' + err.message;
    }
  };
  
  // ─── Reconnect ──────────────────────────────────────────────────────────────
  // Priority order for session restoration:
  //   1. URL query params (?room=...&role=...) — survives localStorage being cleared
  //   2. localStorage via reconnectService — works in normal browsers
  //   3. Give up and reset to local mode
  
  const tryReconnect = async (gameType: string) => {
    error.value = null;
    try {
      // 1. Try URL params first (most reliable in school environments).
      const urlRoomId = route.query.room as string | undefined;
      const urlRole   = route.query.role as string | undefined;
      
      if (urlRoomId && urlRole) {
        const color: 'white' | 'black' = urlRole === 'host' ? 'white' : 'black';
        roomId.value = urlRoomId;
        playerColor.value = color;
        isMultiplayer.value = true;
        startListening(urlRoomId);
        return true;
      }
      
      // 2. Fall back to localStorage via reconnectService.
      const result = await reconnect(gameType);
      if (result) {
        roomId.value = result.roomId;
        playerColor.value = result.color;
        isMultiplayer.value = true;
        startListening(result.roomId);
        return true;
      }
    } catch (err: any) {
      console.error('Reconnect Error:', err);
      error.value = 'Session expired or connection failed.';
    }
    
    // 3. No session found — silently fall back to local mode.
    resetState();
    return false;
  };
  
  // ─── Reset state ────────────────────────────────────────────────────────────
  
  const resetState = () => {
    roomId.value = null;
    joinCode.value = null;
    playerColor.value = null;
    isMultiplayer.value = false;
    remoteRoom.value = null;
    error.value = null;
    stopListening();
    
    // Clean up localStorage entries if they exist.
    lsRemove('current_room_id');
    lsRemove('player_color');
    
    // Remove room params from URL if present.
    if (route.query.room || route.query.role) {
      const { room, role, ...rest } = route.query;
      router.replace({ query: rest });
    }
  };
  
  return {
    roomId,
    joinCode,
    playerColor,
    isMultiplayer,
    remoteRoom,
    error,
    isLoading,
    createOnlineGame,
    joinOnlineGame,
    submitMove,
    resetGame,
    tryReconnect,
    stopListening,
    restorePlayerColor,
    resetState,
  };
}