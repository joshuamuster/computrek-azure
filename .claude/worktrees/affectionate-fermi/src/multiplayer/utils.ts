/**
 * Generates a random alphanumeric join code.
 */
export function generateJoinCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking characters
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Returns a unique player ID for the current session.
 * Simple implementation using localStorage.
 */
export function getPersistentPlayerId(): string {
  let id = localStorage.getItem('multiplayer_player_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('multiplayer_player_id', id);
  }
  return id;
}

/**
 * Checks if a room should be considered expired based on last activity.
 * @param lastMoveAt Timestamp of the last move.
 * @param expirationHours Hours until expiration.
 */
export function isRoomExpired(lastMoveAt: number, expirationHours: number = 2): boolean {
  const now = Date.now();
  const diff = now - lastMoveAt;
  return diff > expirationHours * 60 * 60 * 1000;
}

/**
 * Removes undefined fields from an object to make it compatible with Firestore.
 */
export function sanitizeForFirestore(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  
  const sanitized: any = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== undefined) {
        sanitized[key] = (typeof value === 'object') ? sanitizeForFirestore(value) : value;
      }
    }
  }
  
  return sanitized;
}
