export enum Player {
  P1 = 0, // Bottom (current player's side usually)
  P2 = 1  // Top
}

export type BoardState = {
  pits: number[]; // 0-5 for P1 houses, 6 for P1 Mancala, 7-12 for P2 houses, 13 for P2 Mancala
  turn: Player;
  gameOver: boolean;
  winner: Player | 'tie' | null;
};

export const INITIAL_PIECES = 4;
export const P1_MANCALA_INDEX = 6;
export const P2_MANCALA_INDEX = 13;

export function getInitialBoard(): BoardState {
  const pits = new Array(14).fill(INITIAL_PIECES);
  pits[P1_MANCALA_INDEX] = 0;
  pits[P2_MANCALA_INDEX] = 0;
  
  return {
    pits,
    turn: Player.P1,
    gameOver: false,
    winner: null
  };
}

export function makeMove(state: BoardState, pitIndex: number): { state: BoardState, extraTurn: boolean } {
  if (state.gameOver) return { state, extraTurn: false };
  
  // Check if it's a valid pit for the current player
  if (state.turn === Player.P1 && (pitIndex < 0 || pitIndex > 5)) return { state, extraTurn: false };
  if (state.turn === Player.P2 && (pitIndex < 7 || pitIndex > 12)) return { state, extraTurn: false };
  
  // Check if pit has pieces
  if (state.pits[pitIndex] === 0) return { state, extraTurn: false };
  
  const pits = [...state.pits];
  let pieces = pits[pitIndex];
  pits[pitIndex] = 0;
  
  let currentIndex = pitIndex;
  let extraTurn = false;
  
  while (pieces > 0) {
    currentIndex = (currentIndex + 1) % 14;
    
    // Skip opponent's Mancala
    if (state.turn === Player.P1 && currentIndex === P2_MANCALA_INDEX) continue;
    if (state.turn === Player.P2 && currentIndex === P1_MANCALA_INDEX) continue;
    
    pits[currentIndex]++;
    pieces--;
  }
  
  // Last piece rules
  // 1. Extra turn if last piece ends in own Mancala
  if (state.turn === Player.P1 && currentIndex === P1_MANCALA_INDEX) {
    extraTurn = true;
  } else if (state.turn === Player.P2 && currentIndex === P2_MANCALA_INDEX) {
    extraTurn = true;
  } 
  // 2. Capture if last piece ends in empty house on own side
  else {
    const isP1Side = currentIndex >= 0 && currentIndex <= 5;
    const isP2Side = currentIndex >= 7 && currentIndex <= 12;
    
    if (state.turn === Player.P1 && isP1Side && pits[currentIndex] === 1) {
      const oppositeIndex = 12 - currentIndex;
      if (pits[oppositeIndex] > 0) {
        pits[P1_MANCALA_INDEX] += pits[currentIndex] + pits[oppositeIndex];
        pits[currentIndex] = 0;
        pits[oppositeIndex] = 0;
      }
    } else if (state.turn === Player.P2 && isP2Side && pits[currentIndex] === 1) {
      const oppositeIndex = 12 - currentIndex;
      if (pits[oppositeIndex] > 0) {
        pits[P2_MANCALA_INDEX] += pits[currentIndex] + pits[oppositeIndex];
        pits[currentIndex] = 0;
        pits[oppositeIndex] = 0;
      }
    }
  }
  
  // Check for game over
  const p1Empty = pits.slice(0, 6).every(p => p === 0);
  const p2Empty = pits.slice(7, 13).every(p => p === 0);
  
  let newState: BoardState = {
    pits,
    turn: extraTurn ? state.turn : (state.turn === Player.P1 ? Player.P2 : Player.P1),
    gameOver: p1Empty || p2Empty,
    winner: null
  };
  
  if (newState.gameOver) {
    // Add remaining pieces to Mancalas
    if (p1Empty) {
      for (let i = 7; i <= 12; i++) {
        newState.pits[P2_MANCALA_INDEX] += newState.pits[i];
        newState.pits[i] = 0;
      }
    } else {
      for (let i = 0; i <= 5; i++) {
        newState.pits[P1_MANCALA_INDEX] += newState.pits[i];
        newState.pits[i] = 0;
      }
    }
    
    // Determine winner
    if (newState.pits[P1_MANCALA_INDEX] > newState.pits[P2_MANCALA_INDEX]) {
      newState.winner = Player.P1;
    } else if (newState.pits[P2_MANCALA_INDEX] > newState.pits[P1_MANCALA_INDEX]) {
      newState.winner = Player.P2;
    } else {
      newState.winner = 'tie';
    }
  }
  
  return { state: newState, extraTurn };
}

export function boardToString(pits: number[]): string {
  return pits.join(',');
}

export function stringToBoard(str: string): number[] {
  return str.split(',').map(Number);
}
