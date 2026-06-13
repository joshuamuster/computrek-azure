/**
 * msalAuth.ts — standalone MSAL authentication for staff (Phase 6).
 *
 * Replaces Firebase Auth's OAuthProvider('microsoft.com') with a direct
 * @azure/msal-browser PublicClientApplication. The library is dynamically
 * imported so it adds zero bundle weight until the first staff login attempt.
 *
 * Staff log in with their district Microsoft account. The id_token they
 * receive is sent as a Bearer token to the Azure Functions endpoints, which
 * decode it (trusting HTTPS + Azure AD issuance) to verify identity.
 *
 * The AZURE_CLIENT_ID must be set in .env (VITE_AZURE_CLIENT_ID). The App
 * Registration in Azure AD needs a Single-Page Application redirect URI
 * pointing at the app's origin (http://localhost:5173 for dev, production
 * URL for prod), and the openid/profile/email delegated permissions.
 */

import { AZURE_TENANT_ID, AZURE_CLIENT_ID } from '@/azure'

let _msal: any = null

async function getMsal(): Promise<any> {
  if (_msal) return _msal
  if (!AZURE_CLIENT_ID) {
    throw new Error(
      'VITE_AZURE_CLIENT_ID is not set in .env. ' +
      'Register the app in Azure AD and set the Client ID before using Microsoft sign-in.'
    )
  }
  const { PublicClientApplication, BrowserCacheLocation } = await import('@azure/msal-browser')
  const instance = new PublicClientApplication({
    auth: {
      clientId:    AZURE_CLIENT_ID,
      authority:   `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation:          BrowserCacheLocation.SessionStorage,
      storeAuthStateInCookie: false,
    },
  })
  await instance.initialize()
  _msal = instance
  return instance
}

const LOGIN_REQUEST = { scopes: ['openid', 'profile', 'email'] }
const IOS_REDIRECT_KEY = 'ct:msalRedirect'

export const isIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export interface MsalUser {
  email:       string
  displayName: string
  idToken:     string
}

/** Opens a Microsoft login popup (or redirect on iOS). Returns null on iOS (page navigates away). */
export async function msalLogin(): Promise<MsalUser | null> {
  const msal = await getMsal()
  if (isIOS()) {
    sessionStorage.setItem(IOS_REDIRECT_KEY, '1')
    await msal.loginRedirect(LOGIN_REQUEST)
    return null
  }
  const result = await msal.loginPopup(LOGIN_REQUEST)
  return _toMsalUser(result)
}

/**
 * Call in onMounted to handle the return from an iOS loginRedirect.
 * Returns null if this page load is not a redirect callback.
 */
export async function msalHandleRedirect(): Promise<MsalUser | null> {
  if (!sessionStorage.getItem(IOS_REDIRECT_KEY)) return null
  sessionStorage.removeItem(IOS_REDIRECT_KEY)
  const msal = await getMsal()
  const result = await msal.handleRedirectPromise()
  return result ? _toMsalUser(result) : null
}

/** Returns a fresh id_token for the signed-in staff account (for API Bearer auth). */
export async function msalGetIdToken(): Promise<string | null> {
  try {
    const msal = await getMsal()
    const accounts = msal.getAllAccounts()
    if (!accounts.length) return null
    const result = await msal.acquireTokenSilent({ account: accounts[0], ...LOGIN_REQUEST })
    return result.idToken ?? null
  } catch {
    return null
  }
}

/** Signs the staff user out of MSAL (popup, or redirect on iOS). */
export async function msalSignOut(): Promise<void> {
  try {
    const msal = await getMsal()
    const accounts = msal.getAllAccounts()
    if (!accounts.length) return
    if (isIOS()) {
      await msal.logoutRedirect({ account: accounts[0] })
    } else {
      await msal.logoutPopup({ account: accounts[0] }).catch(() => msal.clearCache?.())
    }
  } catch {
    // Best-effort: local state is cleared by the caller regardless.
  }
}

function _toMsalUser(result: any): MsalUser {
  return {
    email:       (result.account?.username ?? '').toLowerCase(),
    displayName: result.account?.name ?? result.account?.username ?? '',
    idToken:     result.idToken ?? '',
  }
}
