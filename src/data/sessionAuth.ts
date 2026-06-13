/**
 * sessionAuth.ts — token storage for cadet and demo sessions (Phase 6).
 *
 * After a cadet (or demo user) authenticates via /api/auth, the server issues
 * a short-lived JWT. This module stores it in sessionStorage (cleared when the
 * tab closes) and provides helpers for adding it to fetch calls.
 *
 * Staff use MSAL session cache directly (see msalAuth.ts). For endpoints that
 * accept either token type (negotiate, broadcast, etc.), call getAnyAuthToken()
 * which tries the cadet JWT first, then falls back to the MSAL id_token.
 */

const TOKEN_KEY = 'ct:authToken'

export function setAuthToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function getAuthToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function clearAuthToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

/** Returns Authorization header for fetch calls to the Functions API. */
export function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const token = getAuthToken()
  return {
    'content-type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

/**
 * Returns whichever auth token is available for the current session:
 * cadet/demo JWT from sessionStorage, or MSAL id_token for staff.
 * Used by realtime.ts's accessTokenFactory.
 */
export async function getAnyAuthToken(): Promise<string | null> {
  const cadetToken = getAuthToken()
  if (cadetToken) return cadetToken
  const { msalGetIdToken } = await import('./msalAuth')
  return msalGetIdToken()
}
