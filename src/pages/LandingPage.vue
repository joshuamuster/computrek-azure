<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { signInWithPopup, signInWithRedirect, onAuthStateChanged, GoogleAuthProvider, OAuthProvider, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth'
import { doc, getDoc, updateDoc, setDoc, disableNetwork, enableNetwork } from '@/data/db'
import { auth, db } from '@/firebase'
import { AZURE_TENANT_ID } from '@/azure'

import soundUserType from '@/assets/sounds/SFX-Computer/keyok2.wav'
import soundKeypad   from '@/assets/sounds/SFX-Computer/keyok3.wav'
import soundError    from '@/assets/sounds/SFX-Computer/inputfailed1.wav'
import soundSuccess  from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav'

const emit = defineEmits(['authenticate'])

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// ── Microsoft provider (built; gated by FEATURE_FLAGS.MICROSOFT_AUTH) ────────
// The tenant parameter locks sign-in to the school district's Azure AD tenant
// so only district accounts are accepted. Falls back to 'common' (any Microsoft
// account) when MICROSOFT_TENANT is empty — useful for pre-launch testing.
const microsoftProvider = new OAuthProvider('microsoft.com')
microsoftProvider.setCustomParameters({
  prompt: 'select_account',
  tenant: AZURE_TENANT_ID,
})

// signInWithPopup opens a NEW TAB on iOS Safari (not a true popup), so
// window.opener is null and the handshake never completes. Detect iOS and
// fall back to the redirect flow, which does a full-page navigation instead.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const playSound = (path: string, volume = 0.75) => {
  try {
    const audio = new Audio(path)
    audio.volume = volume
    audio.play().catch(e => console.warn('Could not play sound:', e))
  } catch (e) {
    console.warn('Error creating audio:', e)
  }
}

const selectedRole  = ref('civilian')
const password      = ref('')
const username      = ref('')
const errorMessage  = ref('')
const isSigningIn   = ref(false)
const showStaffEmailLogin = ref(false)

// ── Demo mode (civilian PIN → auto-assigned TNG demo cadet) ──────────────────
// Each PIN entry picks the next slot (0–9, cycling) from demo/state in
// Firestore, then signs into Firebase Auth as that pre-provisioned account.
// The accounts reset nightly via the resetDemoStudents Cloud Function.

const DEMO_ACCOUNTS = [
  { slot: 0, username: 'picard',  displayName: 'Jean-Luc Picard'  },
  { slot: 1, username: 'riker',   displayName: 'William Riker'    },
  { slot: 2, username: 'data',    displayName: 'Data'              },
  { slot: 3, username: 'troi',    displayName: 'Deanna Troi'      },
  { slot: 4, username: 'laforge', displayName: 'Geordi La Forge'  },
  { slot: 5, username: 'worf',    displayName: 'Worf'             },
  { slot: 6, username: 'crusher', displayName: 'Beverly Crusher'  },
  { slot: 7, username: 'wesley',  displayName: 'Wesley Crusher'   },
  { slot: 8, username: 'yar',     displayName: 'Tasha Yar'        },
  { slot: 9, username: 'obrien',  displayName: "Miles O'Brien"    },
] as const

/** Read + advance the demo slot counter (non-atomic, acceptable for a demo). */
const getDemoSlot = async (): Promise<number> => {
  const stateRef = doc(db, 'demo', 'state')
  const snap     = await getDoc(stateRef)
  const slot     = snap.exists() ? ((snap.data().nextSlot ?? 0) as number) : 0
  await setDoc(stateRef, { nextSlot: (slot + 1) % 10 }, { merge: true })
  return slot
}

// Password change flow
const needsPasswordChange = ref(false)
const pendingAuthUser = ref<any>(null)
const pendingRole = ref('')
const pendingInfo = ref<any>(null)
const newPassword = ref('')
const confirmNewPassword = ref('')
const isChangingPassword = ref(false)

// PIN codes for non-student, non-staff roles only
const rolePasswords: Record<string, string> = {
  parent:   '1138',
  civilian: '1701',
}

const selectRole = (role: 'cadet' | 'parent' | 'staff' | 'civilian') => {
  selectedRole.value = role
  errorMessage.value = ''
  password.value     = ''
  username.value     = ''
  showStaffEmailLogin.value = false
  playSound(soundUserType, 0.75)
}

// ── PIN flow (parent / civilian) ────────────────────────────────────────────
const authenticate = async () => {
  if (!selectedRole.value) {
    errorMessage.value = 'Please select a role first'
    return
  }

  const expected = rolePasswords[selectedRole.value]
  if (!expected) return // not a PIN role

  if ((password.value || '').toLowerCase() !== expected.toLowerCase()) {
    playSound(soundError, 0.6)
    errorMessage.value = 'Incorrect access code'
    password.value     = ''
    return
  }

  // ── Civilian = Demo mode: pick a slot, sign in as a demo cadet ────────────
  if (selectedRole.value === 'civilian') {
    isSigningIn.value  = true
    errorMessage.value = ''
    try {
      const slot    = await getDemoSlot()
      const acct    = DEMO_ACCOUNTS[slot]
      const email   = `demo.${acct.username}@computrek.local`
      const result  = await signInWithEmailAndPassword(auth, email, 'demo1701')
      await disableNetwork(db)
      await enableNetwork(db)
      playSound(soundSuccess, 0.6)
      emit('authenticate', 'cadet', {
        displayName:  acct.displayName,
        email,
        uid:          result.user.uid,
        periodId:     'demo-period',
        teacherEmail: 'demo@computrekcs.demo',
        isDemo:       true,
      })
    } catch (err: any) {
      console.error('[demo login]', err)
      playSound(soundError, 0.6)
      // Friendly fallback in case demo accounts haven't been seeded yet
      errorMessage.value = 'Demo unavailable. Ask your teacher to run the demo setup script.'
      isSigningIn.value  = false
    }
    return
  }

  // Non-demo PIN roles (parent, etc.)
  playSound(soundSuccess, 0.6)
  emit('authenticate', selectedRole.value, null)
}

// ── Cadet sign-in (individual username + password via Firebase Auth) ──────
const signInAsCadet = async () => {
  if (!username.value.trim()) {
    errorMessage.value = 'Please enter your username'
    return
  }
  if (!password.value.trim()) {
    errorMessage.value = 'Please enter your password'
    return
  }

  isSigningIn.value  = true
  errorMessage.value = ''

  const email = `${username.value.trim().toLowerCase()}@computrek.local`

  try {
    const result = await signInWithEmailAndPassword(auth, email, password.value)
    const snap   = await getDoc(doc(db, 'approvedUsers', email))

    if (snap.exists() && snap.data().role === 'cadet') {
      const data = snap.data()
      const uid  = result.user.uid
      const info = {
        displayName:  data.displayName  ?? username.value,
        email,
        uid,
        periodId:     data.periodId     ?? '',
        teacherEmail: data.teacherEmail ?? '',
      }

      // Write uid back to Firestore if it isn't stored yet.
      // The fan-out (useAssignments) uses sData.uid to create submission docs,
      // so real cadets need their Firebase Auth uid persisted here.
      if (!data.uid) {
        updateDoc(doc(db, 'approvedUsers', email), { uid })
          .catch(e => console.warn('[login] uid backfill failed:', e))
      }

      if (data.requiresPasswordChange) {
        needsPasswordChange.value = true
        pendingAuthUser.value     = result.user
        pendingRole.value         = 'cadet'
        pendingInfo.value         = info
        playSound(soundKeypad, 0.6)
        return
      }

      playSound(soundSuccess, 0.6)
      emit('authenticate', 'cadet', info)
    } else {
      // Account exists in Auth but not properly provisioned — sign them back out
      await signOut(auth)
      playSound(soundError, 0.6)
      errorMessage.value = 'Account not found. Ask your teacher for help.'
    }
  } catch (err: any) {
    playSound(soundError, 0.6)
    // Translate Firebase error codes into student-friendly messages
    const code = err.code ?? ''
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      errorMessage.value = 'Incorrect username or password'
    } else if (code === 'auth/too-many-requests') {
      errorMessage.value = 'Too many attempts. Please wait a moment.'
    } else {
      errorMessage.value = 'Sign-in failed. Ask your teacher for help.'
      console.error(err)
    }
  } finally {
    isSigningIn.value = false
  }
}

// ── Google Sign-In flow (staff only) ────────────────────────────────────────

// Shared logic: check the signed-in user against approvedUsers and emit or deny.
const handleAuthResult = async (user: import('firebase/auth').User) => {
  const email = (user.email ?? '').toLowerCase()
  const snap  = await getDoc(doc(db, 'approvedUsers', email))

  if (snap.exists()) {
    const data        = snap.data()
    const role        = data.role ?? 'staff'
    const displayName = data.displayName ?? email
    const info        = { displayName, email, uid: user.uid, periodIds: data.periodIds ?? [] }

    if (data.requiresPasswordChange) {
      needsPasswordChange.value = true
      pendingAuthUser.value     = user
      pendingRole.value         = role
      pendingInfo.value         = info
      playSound(soundKeypad, 0.6)
      return
    }

    playSound(soundSuccess, 0.6)
    emit('authenticate', role, info)
  } else {
    await signOut(auth)
    playSound(soundError, 0.6)
    errorMessage.value = 'Access denied. Contact your administrator.'
    isSigningIn.value = false
  }
}

// Keys used to signal that an iOS redirect sign-in is in flight.
// sessionStorage survives a same-tab redirect chain and is cleared on tab close.
const IOS_REDIRECT_FLAG          = 'ctcs:pendingGoogleRedirect'
const IOS_MS_STAFF_REDIRECT_FLAG = 'ctcs:pendingMsStaffRedirect'

// ── Microsoft sign-in for staff (primary auth in Azure repo) ─────────────────
// Uses Firebase Auth's OAuthProvider('microsoft.com') so existing Firestore
// Security Rules (which check Firebase Auth tokens) continue to work through
// Phase 5, when standalone MSAL takes over and Firebase Auth is removed.
// Calls handleAuthResult — the same staff lookup used by Google sign-in.
const signInAsStaffWithMicrosoft = async () => {
  isSigningIn.value  = true
  errorMessage.value = ''
  try {
    if (isIOS) {
      sessionStorage.setItem(IOS_MS_STAFF_REDIRECT_FLAG, '1')
      await signInWithRedirect(auth, microsoftProvider)
      return
    }
    const { user } = await signInWithPopup(auth, microsoftProvider)
    // Force Firestore to reconnect with the new auth token before the getDoc.
    await disableNetwork(db)
    await enableNetwork(db)
    await handleAuthResult(user)
  } catch (err: any) {
    console.error(err)
    const code = err?.code ?? ''
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      errorMessage.value = 'Sign-in cancelled. Please try again.'
    } else if (code === 'auth/popup-blocked') {
      errorMessage.value = 'Popup blocked by browser. Allow pop-ups for this site and try again.'
    } else if (code === 'auth/unauthorized-domain') {
      errorMessage.value = 'This domain is not authorized for sign-in. Contact your administrator.'
    } else {
      errorMessage.value = `Sign-in failed (${code || 'unknown error'}). Please try again.`
    }
    isSigningIn.value = false
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleEnterKey)

  // After signInWithRedirect, the page reloads in the same tab.
  // getRedirectResult can return null in some iOS edge cases, so instead
  // we rely on onAuthStateChanged — Firebase guarantees it fires with the
  // user once the redirect result is processed.
  // Both Google and Microsoft staff redirects resolve via handleAuthResult.
  // IOS_MS_STAFF_REDIRECT_FLAG is set by signInAsStaffWithMicrosoft before the
  // iOS Safari full-page redirect so onMounted knows to wait for auth state.
  const pendingGoogle  = sessionStorage.getItem(IOS_REDIRECT_FLAG)
  const pendingMsStaff = sessionStorage.getItem(IOS_MS_STAFF_REDIRECT_FLAG)

  if (pendingGoogle || pendingMsStaff) {
    sessionStorage.removeItem(IOS_REDIRECT_FLAG)
    sessionStorage.removeItem(IOS_MS_STAFF_REDIRECT_FLAG)
    isSigningIn.value = true

    try {
      const user = await new Promise<any>((resolve, reject) => {
        // Give Firebase up to 15 s to process the redirect and fire auth state.
        const timeout = setTimeout(() => {
          unsubscribe()
          reject(new Error('auth-timeout'))
        }, 15_000)

        const unsubscribe = onAuthStateChanged(auth, (u) => {
          if (u) {
            clearTimeout(timeout)
            unsubscribe()
            resolve(u)
          }
          // u === null is the initial "no user yet" state — keep waiting.
        })
      })

      // Both Google and Microsoft staff redirects use the same approvedUsers lookup.
      // Redirect is a full page reload — Firestore reconnects automatically.
      await handleAuthResult(user)
    } catch (err: any) {
      errorMessage.value = 'Sign-in failed. Please try again.'
      isSigningIn.value = false
    }
  }
})

const signInWithGoogle = async () => {
  isSigningIn.value  = true
  errorMessage.value = ''
  try {
    if (isIOS) {
      // Full-page redirect — avoids the broken new-tab popup on iOS Safari.
      // Set a sessionStorage flag so onMounted knows to wait for onAuthStateChanged
      // when the page reloads after Google sends the user back.
      sessionStorage.setItem(IOS_REDIRECT_FLAG, '1')
      await signInWithRedirect(auth, googleProvider)
      return // page will navigate away; nothing below runs
    }
    const { user } = await signInWithPopup(auth, googleProvider)
    // The popup flow changes auth mid-session, so Firestore's existing
    // connection has no credentials. Force a reconnect before the getDoc.
    await disableNetwork(db)
    await enableNetwork(db)
    await handleAuthResult(user)
  } catch (err: any) {
    console.error(err)
    const code = err?.code ?? ''
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      errorMessage.value = 'Sign-in cancelled. Please try again.'
    } else if (code === 'auth/popup-blocked') {
      errorMessage.value = 'Popup blocked by browser. Allow pop-ups for this site and try again.'
    } else if (code === 'auth/unauthorized-domain') {
      errorMessage.value = 'This domain is not authorized for sign-in. Contact your administrator.'
    } else if (code === 'auth/admin-restricted-operation') {
      errorMessage.value = 'New sign-ins are currently restricted. An administrator must enable sign-ups in the Firebase Console (Authentication → Settings → User actions).'
    } else if (code === 'permission-denied' || code === 'auth/insufficient-permission') {
      errorMessage.value = 'Access check failed. Contact your administrator.'
    } else {
      errorMessage.value = `Sign-in failed (${code || 'unknown error'}). Please try again.`
    }
    isSigningIn.value  = false
  }
}

const signInAsStaffWithEmail = async () => {
  if (!username.value.trim() || !password.value.trim()) {
    errorMessage.value = 'Please enter your email and password'
    return
  }
  isSigningIn.value  = true
  errorMessage.value = ''
  try {
    const { user } = await signInWithEmailAndPassword(auth, username.value.trim(), password.value)
    // For email/password login, we check for password change requirement.
    // handleAuthResult will handle it.
    await handleAuthResult(user)
  } catch (err: any) {
    playSound(soundError, 0.6)
    const code = err.code ?? ''
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      errorMessage.value = 'Incorrect email or password'
    } else {
      errorMessage.value = 'Sign-in failed. Please try again.'
      console.error(err)
    }
    isSigningIn.value = false
  }
}

// ── Keyboard support (PIN roles only) ───────────────────────────────────────
const submitPasswordChange = async () => {
  if (!newPassword.value || newPassword.value.length < 6) {
    errorMessage.value = 'New password must be at least 6 characters'
    playSound(soundError, 0.6)
    return
  }
  if (newPassword.value !== confirmNewPassword.value) {
    errorMessage.value = 'Passwords do not match'
    playSound(soundError, 0.6)
    return
  }

  isChangingPassword.value = true
  errorMessage.value = ''

  try {
    // 1. Update password in Firebase Auth
    await updatePassword(pendingAuthUser.value, newPassword.value)

    // 2. Update Firestore flag
    await updateDoc(doc(db, 'approvedUsers', pendingInfo.value.email), {
      requiresPasswordChange: false
    })

    // 3. Complete authentication
    playSound(soundSuccess, 0.6)
    emit('authenticate', pendingRole.value, pendingInfo.value)

    // Reset state
    needsPasswordChange.value = false
    pendingAuthUser.value     = null
    pendingRole.value         = ''
    pendingInfo.value         = null
    newPassword.value         = ''
    confirmNewPassword.value  = ''
  } catch (err: any) {
    console.error('Password change error:', err)
    if (err.code === 'auth/requires-recent-login') {
      errorMessage.value = 'Session expired. Please sign in again.'
      cancelPasswordChange()
    } else {
      errorMessage.value = 'Failed to update password. Please try again.'
    }
    playSound(soundError, 0.6)
  } finally {
    isChangingPassword.value = false
  }
}

const cancelPasswordChange = async () => {
  await signOut(auth)
  needsPasswordChange.value = false
  pendingAuthUser.value     = null
  pendingRole.value         = ''
  pendingInfo.value         = null
  newPassword.value         = ''
  confirmNewPassword.value  = ''
  isSigningIn.value         = false
  errorMessage.value        = 'Password change cancelled.'
}
const handleEnterKey = (event: KeyboardEvent) => {
  // Cadets use text inputs — let them handle their own keyboard events
  if (selectedRole.value === 'staff' || selectedRole.value === 'cadet' || needsPasswordChange.value) return

  const target      = event.target as HTMLElement | null
  const isTextInput = !!target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      (target as any)?.isContentEditable
  )
  if (isTextInput) return

  if (event.key === 'Enter')     { event.preventDefault(); authenticate(); return }
  if (event.key === 'Backspace') { event.preventDefault(); backspace();    return }

  const isDigit = /^\d$/.test(event.key) ||
      ((event.code || '').startsWith('Numpad') && /^\d$/.test(event.key))
  if (isDigit) { event.preventDefault(); appendDigit(event.key) }
}

onBeforeUnmount(() => window.removeEventListener('keydown', handleEnterKey))

const appendDigit = (digit: number | string) => {
  if (/^\d$/.test(String(digit))) {
    password.value += String(digit)
    playSound(soundKeypad, 0.5)
  }
}
const backspace     = () => { password.value = password.value.slice(0, -1) }
const clearPassword = () => { password.value = '' }
</script>

<template>
  <div class="landing-container">
    <!-- Video Background -->
    <div class="video-background-container">
      <video autoplay muted loop class="background-video">
        <source src="/assets/videos/StarfieldLoop1b.mp4" type="video/mp4" />
      </video>
      <div class="video-overlay"></div>
    </div>

    <!-- Landing Content -->
    <div class="landing-content">
      <div class="login-frame">
        <div class="header-section">
          <div class="lcars-title">CompuTrek CS</div>
          <div class="lcars-subtitle">ACADEMY ACCESS TERMINAL</div>
          <!--          <p class="italic">This app is still in Beta.</p>-->
        </div>

        <div v-if="!needsPasswordChange" class="role-selection">
          <div class="section-title">
            Select your User Type, then authenticate below.
          </div>

          <div class="content-section">
            <!-- Left column: roles -->
            <div class="left-column role-buttons">
              <div class="step1">General Use Demo</div>
              <button
                  class="role-button"
                  :class="{ active: selectedRole === 'civilian' }"
                  @click="selectRole('civilian')"
              >
                <span class="role-number">01</span>
                <span class="role-label">DEMO</span>
                <span class="">PIN = 1701</span>
              </button>
              <div class="step1">Authorized Users</div>
              <button
                  class="role-button"
                  :class="{ active: selectedRole === 'cadet' }"
                  @click="selectRole('cadet')"
              >
                <span class="role-number">02</span>
                <span class="role-label">CADET</span>
              </button>
              <!--              <button-->
              <!--                  class="role-button"-->
              <!--                  :class="{ active: selectedRole === 'parent' }"-->
              <!--                  @click="selectRole('parent')"-->
              <!--              >-->
              <!--                <span class="role-number">02</span>-->
              <!--                <span class="role-label">PARENT</span>-->
              <!--                <span class="role-password">(Temporary Code: 1138)</span>-->
              <!--              </button>-->
              <button
                  class="role-button"
                  :class="{ active: selectedRole === 'staff' }"
                  @click="selectRole('staff')"
              >
                <span class="role-number">03</span>
                <span class="role-label">STAFF</span>
              </button>
            </div>

            <!-- Right column: auth UI -->
            <div class="right-column">

              <!-- Cadet: access code + PIN -->
              <!-- Real student identities must not enter Firebase — cadets use   -->
              <!-- teacher-assigned access codes and PINs only. No Microsoft SSO. -->
              <template v-if="selectedRole === 'cadet'">
                <div class="lcars-subtitle">STEP 02</div>

                <div class="student-signin-area">
                  <div class="field-group">
                    <label class="field-label">ACCESS CODE</label>
                    <input
                        v-model="username"
                        class="lcars-text-input"
                        type="text"
                        placeholder="e.g. XK7P2M"
                        autocomplete="username"
                        autocapitalize="characters"
                        :disabled="isSigningIn"
                        @keyup.enter="signInAsCadet"
                    />
                  </div>
                  <div class="field-group">
                    <label class="field-label">PIN</label>
                    <input
                        v-model="password"
                        class="lcars-text-input"
                        type="password"
                        placeholder="••••••"
                        autocomplete="current-password"
                        :disabled="isSigningIn"
                        @keyup.enter="signInAsCadet"
                    />
                  </div>
                  <button
                      class="key-btn enter student-enter"
                      :class="{ ready: username.trim() && password.trim() && !isSigningIn }"
                      :disabled="isSigningIn"
                      @click="signInAsCadet"
                  >
                    {{ isSigningIn ? 'CONTACTING STARFLEET...' : 'MAKE IT SO' }}
                  </button>
                </div>
              </template>

              <!-- Parent / Civilian: numeric PIN keypad (unchanged) -->
              <template v-else-if="selectedRole === 'parent' || selectedRole === 'civilian'">
                <div class="pin-display">
                  <span
                      v-for="i in 4"
                      :key="i"
                      class="pin-digit"
                      :class="{ filled: password.length >= i }"
                  >{{ password[i - 1] ?? '–' }}</span>
                </div>
                <div class="numeric-keypad" aria-label="Numeric keypad for access code">
                  <button class="key-btn" @click="appendDigit(1)">1</button>
                  <button class="key-btn" @click="appendDigit(2)">2</button>
                  <button class="key-btn" @click="appendDigit(3)">3</button>
                  <button class="key-btn" @click="appendDigit(4)">4</button>
                  <button class="key-btn" @click="appendDigit(5)">5</button>
                  <button class="key-btn" @click="appendDigit(6)">6</button>
                  <button class="key-btn" @click="appendDigit(7)">7</button>
                  <button class="key-btn" @click="appendDigit(8)">8</button>
                  <button class="key-btn" @click="appendDigit(9)">9</button>
                  <button class="key-btn alt" @click="backspace"     aria-label="Backspace">⌫</button>
                  <button class="key-btn"     @click="appendDigit(0)">0</button>
                  <button class="key-btn alt" @click="clearPassword" aria-label="Clear">CLR</button>
                  <button
                    class="key-btn enter"
                    :class="{ ready: password.length === 4 && !isSigningIn }"
                    :disabled="isSigningIn"
                    @click="authenticate"
                    aria-label="Enter"
                  >{{ isSigningIn ? 'CONTACTING STARFLEET...' : 'MAKE IT SO' }}</button>
                </div>
              </template>

              <!-- Staff: Microsoft Sign-In (primary) or Email fallback -->
              <template v-else-if="selectedRole === 'staff'">
                <div class="lcars-subtitle">STEP 02</div>

                <!-- Microsoft Auth (Primary) -->
                <div v-if="!showStaffEmailLogin" class="ms-signin-area">
                  <p class="google-hint">Sign in with your school Microsoft account.</p>
                  <button
                      class="ms-btn"
                      :disabled="isSigningIn"
                      @click="signInAsStaffWithMicrosoft"
                  >
                    <svg class="ms-icon" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
                      <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
                      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                    </svg>
                    <span>{{ isSigningIn ? 'CONTACTING STARFLEET...' : 'SIGN IN WITH MICROSOFT' }}</span>
                  </button>
                  <button class="auth-toggle-link" @click="showStaffEmailLogin = true">
                    Alternative: Use Email & Password
                  </button>
                </div>

                <!-- Email/Password Auth (Fallback) -->
                <div v-else class="student-signin-area">
                  <div class="field-group">
                    <label class="field-label">EMAIL ADDRESS</label>
                    <input
                        v-model="username"
                        class="lcars-text-input"
                        type="email"
                        placeholder="e.g. j.picard@fusd.us"
                        :disabled="isSigningIn"
                        @keyup.enter="signInAsStaffWithEmail"
                    />
                  </div>
                  <div class="field-group">
                    <label class="field-label">PASSWORD</label>
                    <input
                        v-model="password"
                        class="lcars-text-input"
                        type="password"
                        placeholder="••••••••"
                        :disabled="isSigningIn"
                        @keyup.enter="signInAsStaffWithEmail"
                    />
                  </div>
                  <button
                      class="key-btn enter student-enter"
                      :class="{ ready: username.trim() && password.trim() && !isSigningIn }"
                      :disabled="isSigningIn"
                      @click="signInAsStaffWithEmail"
                  >
                    {{ isSigningIn ? 'CONTACTING STARFLEET...' : 'MAKE IT SO' }}
                  </button>
                  <button class="auth-toggle-link" @click="showStaffEmailLogin = false">
                    Back to Microsoft Sign-In
                  </button>
                </div>
              </template>

              <!-- Nothing selected yet -->
              <template v-else>
                <div class="no-selection-hint">← Select your user type</div>
              </template>

            </div>
          </div>
        </div>

        <!-- Password Change Flow -->
        <div v-else class="password-change-section">
<!--          <div class="lcars-subtitle">FORCE PASSWORD CHANGE</div>-->
          <p class="password-change-hint">
            Welcome, <strong>{{ pendingInfo?.displayName }}</strong>.
            This is your first login. You must set a new secure password before you can proceed.
          </p>

          <div class="password-change-form">
            <div class="field-group">
              <label class="field-label">NEW PASSWORD</label>
              <input
                  v-model="newPassword"
                  class="lcars-text-input"
                  type="password"
                  placeholder="min 6 chars"
                  :disabled="isChangingPassword"
                  @keyup.enter="submitPasswordChange"
              />
            </div>
            <div class="field-group">
              <label class="field-label">CONFIRM NEW PASSWORD</label>
              <input
                  v-model="confirmNewPassword"
                  class="lcars-text-input"
                  type="password"
                  placeholder="re-enter password"
                  :disabled="isChangingPassword"
                  @keyup.enter="submitPasswordChange"
              />
            </div>

            <div class="password-change-actions">
              <button
                  class="key-btn pw-cancel-btn"
                  :disabled="isChangingPassword"
                  @click="cancelPasswordChange"
              >
                CANCEL
              </button>
              <button
                  class="key-btn pw-update-btn"
                  :disabled="isChangingPassword"
                  @click="submitPasswordChange"
              >
                {{ isChangingPassword ? 'PROCESSING...' : 'UPDATE PASSWORD' }}
              </button>
            </div>
          </div>
        </div>

        <div class="footer-section">
          <div class="verification-footer">AUTHORIZED PERSONNEL ONLY</div>
          <div v-if="errorMessage" class="error-message glow-text">{{ errorMessage }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.landing-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
}

.video-background-container {
  position: absolute;
  inset: 0;
  z-index: -2;
}

.background-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  z-index: -1;
}

.landing-content {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-family: 'Antonio', 'Arial Narrow', 'Avenir Next Condensed', sans-serif;
}

.login-frame {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border: 0.125rem solid #ff9900;
  border-radius: 1.25rem;
  box-shadow: 0 0 1.875rem rgba(255, 153, 0, 0.3);
  height: 43.75rem;
  padding: 2.5rem;
  width: 37.5rem;
}

.italic {
  font-size: 0.9rem;
  font-style: italic;
  margin-bottom: 0;
}

.header-section {
  text-align: center;
  margin-bottom: 1.875rem;
}

.lcars-title {
  font-size: 4rem;
  font-weight: bold;
  color: #ff9900;
  margin-bottom: 0;
  text-shadow: 0 0 0.625rem rgba(255, 153, 0, 0.5);
}

.lcars-subtitle {
  font-size: 1.75rem;
  color: #99ccff;
  margin-bottom: 1.25rem;
  text-align: center;
}

.step1 {
  font-size: 1.1rem;
  color: #99ccff;
  margin-top: 0.8rem;
  text-align: center;
  text-transform: uppercase;
}

.section-title {
  color: #99ccff;
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 1.25rem;
  text-align: center;
}

.role-selection {
  margin-bottom: 1.875rem;
}

.content-section {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
}
.left-column {
  flex: 1 1 auto;
  min-width: 0;
}
.right-column {
  flex: 0 0 auto;
  width: 14rem;
  justify-items: center;
}

.role-buttons {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.role-button {
  display: flex;
  align-items: center;
  background: linear-gradient(90deg, #cc6600 0%, #ff9900 100%);
  border: none;
  border-radius: 6.25rem 0.3125rem 0.3125rem 6.25rem;
  padding: 0.4375rem 1.25rem 0.4375rem 0.625rem;
  color: black;
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.role-button:hover {
  background: linear-gradient(90deg, #ff9900 0%, #ffaa00 100%);
  box-shadow: 0 0 0.9375rem rgba(255, 153, 0, 0.4);
}

.role-button.active {
  background: linear-gradient(90deg, #ffaa00 0%, #ffcc00 100%);
  box-shadow: 0 0 1.25rem rgba(255, 153, 0, 0.6);
}

.role-number {
  background: black;
  color: #ff9900;
  padding: 0.3125rem 0.625rem;
  border-radius: 1.5625rem;
  margin-right: 0.9375rem;
  min-width: 1.875rem;
  text-align: center;
}

.role-label {
  flex: 1;
}

.role-password {
  color: #333;
  font-size: 0.8rem;
  font-style: italic;
  font-weight: 100;
}

/* ── Cadet sign-in form ────────────────────────────────────────────────────── */
.student-signin-area {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: stretch;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-label {
  color: #99ccff;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
}

.lcars-text-input {
  background: rgba(0, 0, 0, 0.4);
  border: 0.125rem solid #99ccff;
  border-radius: 0.4rem;
  color: #e6f0ff;
  font-family: inherit;
  font-size: 1rem;
  padding: 0.5rem 0.75rem;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.lcars-text-input:focus {
  outline: none;
  border-color: #ff9900;
}

.lcars-text-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lcars-text-input::placeholder {
  color: rgba(153, 204, 255, 0.35);
  font-size: 0.85rem;
}

.student-enter {
  width: 100%;
  margin-top: 0.25rem;
}

/* ── Force Password Change actions ─────────────────────────────────────────── */
.password-change-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.pw-cancel-btn {
  background: linear-gradient(90deg, #2a1010 0%, #3d1515 100%);
  border-color: #663333;
  color: #775555;
  flex: 1;
  padding: 1rem;
}

.pw-cancel-btn:hover:not(:disabled) {
  background: linear-gradient(90deg, #3d1515 0%, #551515 100%);
  border-color: #994444;
  box-shadow: 0 0 0.625rem rgba(180, 60, 60, 0.25);
  color: #aa7777;
}

.pw-update-btn {
  background: linear-gradient(90deg, #1a6632 0%, #22aa44 50%, #1a6632 100%);
  border: none;
  box-shadow: 0 0 1rem rgba(34, 200, 80, 0.6), 0 0 2rem rgba(34, 200, 80, 0.3);
  color: #ccffcc;
  flex: 2;
  overflow: hidden;
  padding: 1rem;
  position: relative;
  text-shadow: 0 0 0.5rem rgba(180, 255, 180, 0.8);
  transition: all 0.4s ease;
}

.pw-update-btn:hover:not(:disabled) {
  background: linear-gradient(90deg, #22aa44 0%, #33cc55 50%, #22aa44 100%);
  box-shadow: 0 0 1.5rem rgba(34, 200, 80, 0.8), 0 0 3rem rgba(34, 200, 80, 0.4);
}

.pw-update-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: -75%;
  width: 50%;
  height: 100%;
  background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.25) 50%, transparent 100%);
  animation: shineSwipe 2s ease-in-out infinite;
}

/* ── PIN digit display ─────────────────────────────────────────────────────── */
.pin-display {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.pin-digit {
  //background: rgba(0, 0, 0, 0.4);
  border-bottom: 0.125rem solid #335;
  border-top: 0.125rem solid #335;
  border-radius: 0.4rem;
  color: rgba(153, 204, 255, 0.3);
  font-size: 1.75rem;
  font-weight: bold;
  line-height: 1;
  min-width: 2.75rem;
  padding: 0.4rem 0;
  text-align: center;
  transition: border-color 0.15s, color 0.15s;
}

.pin-digit.filled {
  border-color: #ff9900;
  color: #ff9900;
  text-shadow: 0 0 1.25rem rgba(255, 153, 0, 1), 0 0 1.25rem rgba(255, 153, 0, 1);
}

/* ── Numeric keypad (unchanged) ────────────────────────────────────────────── */
.numeric-keypad {
  display: grid;
  grid-template-columns: repeat(3, 3.75rem);
  grid-auto-rows: 2.25rem;
  gap: 1rem 0.5rem;
}

.key-btn {
  background: linear-gradient(90deg, #223 0%, #335 100%);
  color: #99ccff;
  border: 0.125rem solid #99ccff;
  border-radius: 0.5rem;
  font-family: inherit;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.key-btn:hover:not(:disabled) {
  background: linear-gradient(90deg, #335 0%, #446 100%);
  box-shadow: 0 0 0.625rem rgba(153, 204, 255, 0.3);
}

.key-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.key-btn.alt {
  border-color: #ff9900;
  color: #ffcc99;
}

.key-btn.enter {
  background: linear-gradient(90deg, #1a3320 0%, #2a4a30 100%);
  border: none;
  box-shadow: none;
  color: #4a7a55;
  grid-column: span 3;
  line-height: 0;
  overflow: hidden;
  padding: 1.5rem;
  position: relative;
  transition: all 0.4s ease;
  width: 100%;
}

.key-btn.enter.ready {
  background: linear-gradient(90deg, #1a6632 0%, #22aa44 50%, #1a6632 100%);
  box-shadow: 0 0 1rem rgba(34, 200, 80, 0.6), 0 0 2rem rgba(34, 200, 80, 0.3);
  color: #ccffcc;
  text-shadow: 0 0 0.5rem rgba(180, 255, 180, 0.8);
}

.key-btn.enter.ready:hover {
  background: linear-gradient(90deg, #22aa44 0%, #33cc55 50%, #22aa44 100%);
  box-shadow: 0 0 1.5rem rgba(34, 200, 80, 0.8), 0 0 3rem rgba(34, 200, 80, 0.4);
}

.key-btn.enter.ready::after {
  content: '';
  position: absolute;
  top: 0;
  left: -75%;
  width: 50%;
  height: 100%;
  background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.25) 50%, transparent 100%);
  animation: shineSwipe 2s ease-in-out infinite;
}

@keyframes shineSwipe {
  0%   { left: -75%; }
  60%  { left: 125%; }
  100% { left: 125%; }
}

/* ── Google Sign-In (unchanged) ────────────────────────────────────────────── */
.google-signin-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding-top: 0.5rem;
  width: 100%;
}

.auth-toggle-link {
  background: none;
  border: none;
  color: #99ccff;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.8rem;
  opacity: 0.6;
  text-decoration: underline;
  transition: opacity 0.2s;
}

.auth-toggle-link:hover {
  opacity: 1;
}

.google-hint {
  color: #99ccff;
  font-size: 0.85rem;
  text-align: center;
  margin: 0;
  line-height: 1.4;
}

.google-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: linear-gradient(90deg, #223 0%, #335 100%);
  border: 0.125rem solid #99ccff;
  border-radius: 0.5rem;
  color: #99ccff;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: bold;
  padding: 0.75rem 1rem;
  transition: all 0.2s ease;
  width: 100%;
}

.google-btn:hover:not(:disabled) {
  background: linear-gradient(90deg, #335 0%, #446 100%);
  box-shadow: 0 0 0.625rem rgba(153, 204, 255, 0.3);
}

.google-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.google-icon {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
}

/* ── No selection hint ─────────────────────────────────────────────────────── */
.no-selection-hint {
  color: rgba(153, 204, 255, 0.4);
  font-size: 0.9rem;
  padding-top: 2rem;
  width: 12.5rem;
  text-align: center;
}

/* ── Responsive ────────────────────────────────────────────────────────────── */
@media (max-width: 43.75rem) {
  .content-section {
    flex-direction: column;
    align-items: stretch;
  }
  .right-column {
    align-self: center;
  }
  .numeric-keypad {
    grid-template-columns: repeat(3, 1fr);
  }
}

.error-message {
  color: #ff6666;
  margin-top: 0.625rem;
  font-size: 1.5rem;
  text-align: center;
}

.glow-text {
  animation: pulseGlow 2s ease-in-out infinite;
  color: #fff;
  text-align: center;
  font-size: 2rem;
  line-height: 1rem;
}

@keyframes pulseGlow {
  0%, 100% {
    text-shadow: 0 0 0.3125rem #ff6666, 0 0 0.625rem #ff6666, 0 0 0.9375rem #ff6666;
  }
  50% {
    text-shadow: 0 0 0.625rem #ff6666, 0 0 1.25rem #ff6666, 0 0 1.875rem #ff6666;
  }
}

.footer-section {
  min-height: 3.75rem;
  text-align: center;
}

.verification-footer {
  color: #ff6666;
  font-size: 0.9rem;
  font-weight: bold;
  margin-top: 1rem;
}

/* ── Microsoft Sign-In (gated by FEATURE_FLAGS.MICROSOFT_AUTH) ─────────────── */
.ms-signin-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding-top: 0.25rem;
}

.ms-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: linear-gradient(90deg, #223 0%, #335 100%);
  border: 0.125rem solid #99ccff;
  border-radius: 0.5rem;
  color: #99ccff;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: bold;
  padding: 0.75rem 1rem;
  transition: all 0.2s ease;
  width: 100%;
}

.ms-btn:hover:not(:disabled) {
  background: linear-gradient(90deg, #335 0%, #446 100%);
  box-shadow: 0 0 0.625rem rgba(153, 204, 255, 0.3);
}

.ms-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ms-icon {
  width: 1.3rem;
  height: 1.3rem;
  flex-shrink: 0;
}

.auth-divider {
  color: rgba(153, 204, 255, 0.4);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  margin: 0.25rem 0;
  text-align: center;
  width: 100%;
}
</style>