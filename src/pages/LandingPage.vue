<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { doc, getDoc, updateDoc } from '@/data/db'
import { msalLogin, msalHandleRedirect } from '@/data/msalAuth'
import { setAuthToken } from '@/data/sessionAuth'

import soundUserType from '@/assets/sounds/SFX-Computer/keyok2.wav'
import soundKeypad   from '@/assets/sounds/SFX-Computer/keyok3.wav'
import soundError    from '@/assets/sounds/SFX-Computer/inputfailed1.wav'
import soundSuccess  from '@/assets/sounds/SFX-Technology/Misc/stellarzoomin.wav'

const emit = defineEmits(['authenticate'])

const API_BASE = import.meta.env.VITE_SIGNALR_URL || '/api'

const playSound = (path: string, volume = 0.75) => {
  try {
    const audio = new Audio(path)
    audio.volume = volume
    audio.play().catch(() => {})
  } catch { /* audio not critical */ }
}

const selectedRole        = ref('civilian')
const password            = ref('')
const username            = ref('')
const errorMessage        = ref('')
const isSigningIn         = ref(false)

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
  playSound(soundUserType, 0.75)
}

// ── PIN / Civilian / Demo flow ───────────────────────────────────────────────
const authenticate = async () => {
  if (!selectedRole.value) { errorMessage.value = 'Please select a role first'; return }
  const expected = rolePasswords[selectedRole.value]
  if (!expected) return

  if ((password.value || '').toLowerCase() !== expected.toLowerCase()) {
    playSound(soundError, 0.6)
    errorMessage.value = 'Incorrect access code'
    password.value     = ''
    return
  }

  if (selectedRole.value === 'civilian') {
    isSigningIn.value  = true
    errorMessage.value = ''
    try {
      const res = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'demo', pin: password.value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Demo login failed (${res.status})`)
      }
      const data = await res.json()
      setAuthToken(data.token)
      playSound(soundSuccess, 0.6)
      emit('authenticate', 'cadet', {
        displayName:  data.displayName,
        email:        data.email,
        uid:          data.uid,
        periodId:     data.periodId,
        teacherEmail: data.teacherEmail,
        isDemo:       true,
      })
    } catch (err: any) {
      console.error('[demo login]', err)
      playSound(soundError, 0.6)
      errorMessage.value = 'Demo unavailable. Ask your teacher to run the demo setup script.'
      isSigningIn.value  = false
    }
    return
  }

  playSound(soundSuccess, 0.6)
  emit('authenticate', selectedRole.value, null)
}

// ── Cadet sign-in (access code + PIN via /api/auth) ──────────────────────────
const signInAsCadet = async () => {
  if (!username.value.trim()) { errorMessage.value = 'Please enter your access code'; return }
  if (!password.value.trim()) { errorMessage.value = 'Please enter your PIN'; return }

  isSigningIn.value  = true
  errorMessage.value = ''

  try {
    const res = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'cadet', code: username.value.trim(), pin: password.value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      playSound(soundError, 0.6)
      const msg = data?.error ?? ''
      if (msg.includes('not found') || msg.includes('not set')) {
        errorMessage.value = msg.includes('PIN not set')
          ? 'PIN not set up yet. Ask your teacher to set your PIN in Settings.'
          : 'Account not found. Ask your teacher for help.'
      } else if (res.status === 429) {
        errorMessage.value = 'Too many attempts. Please wait a moment.'
      } else {
        errorMessage.value = 'Incorrect username or PIN'
      }
      return
    }

    setAuthToken(data.token)

    if (data.requiresPasswordChange) {
      needsPasswordChange.value = true
      pendingCode.value         = username.value.trim()
      pendingRole.value         = 'cadet'
      pendingInfo.value         = {
        displayName:  data.displayName,
        email:        `${username.value.trim().toLowerCase()}@computrek.local`,
        uid:          data.uid,
        periodId:     data.periodId,
        teacherEmail: data.teacherEmail,
      }
      playSound(soundKeypad, 0.6)
      return
    }

    playSound(soundSuccess, 0.6)
    emit('authenticate', 'cadet', {
      displayName:  data.displayName,
      email:        `${username.value.trim().toLowerCase()}@computrek.local`,
      uid:          data.uid,
      periodId:     data.periodId,
      teacherEmail: data.teacherEmail,
    })
  } catch (err: any) {
    playSound(soundError, 0.6)
    errorMessage.value = 'Sign-in failed. Ask your teacher for help.'
    console.error(err)
  } finally {
    isSigningIn.value = false
  }
}

// ── Staff sign-in via MSAL ───────────────────────────────────────────────────
const signInAsStaffWithMicrosoft = async () => {
  isSigningIn.value  = true
  errorMessage.value = ''
  try {
    const msalUser = await msalLogin()
    if (!msalUser) return  // iOS redirect — page will navigate away
    await handleStaffAuthResult(msalUser.email, msalUser.idToken)
  } catch (err: any) {
    const msg = err?.message ?? ''
    if (msg.includes('popup_window_error') || msg.includes('user_cancelled')) {
      errorMessage.value = 'Sign-in cancelled. Please try again.'
    } else if (msg.includes('popup_blocked')) {
      errorMessage.value = 'Popup blocked by browser. Allow pop-ups for this site and try again.'
    } else if (msg.includes('VITE_AZURE_CLIENT_ID')) {
      errorMessage.value = 'Microsoft sign-in is not configured yet. Contact your administrator.'
    } else {
      errorMessage.value = `Sign-in failed. Please try again.`
      console.error('[MSAL login]', err)
    }
    isSigningIn.value = false
  }
}

/** Shared staff lookup: given an MSAL-verified email, find their approvedUsers record. */
const handleStaffAuthResult = async (email: string, idToken: string) => {
  const snap = await getDoc(doc({}, 'approvedUsers', email))
  if (!snap.exists()) {
    playSound(soundError, 0.6)
    errorMessage.value = 'Access denied. Contact your administrator.'
    isSigningIn.value  = false
    return
  }
  const data        = snap.data()
  const role        = data.role ?? 'staff'
  const displayName = data.displayName ?? email
  setAuthToken(idToken) // store MSAL id_token for Function API calls
  playSound(soundSuccess, 0.6)
  emit('authenticate', role, { displayName, email, uid: email, periodIds: data.periodIds ?? [] })
}

// ── PIN change flow (cadets with requiresPasswordChange) ────────────────────
const needsPasswordChange  = ref(false)
const pendingCode          = ref('')
const pendingRole          = ref('')
const pendingInfo          = ref<any>(null)
const newPassword          = ref('')
const confirmNewPassword   = ref('')
const isChangingPassword   = ref(false)

const submitPasswordChange = async () => {
  if (!newPassword.value || newPassword.value.length < 4) {
    errorMessage.value = 'New PIN must be at least 4 characters'
    playSound(soundError, 0.6)
    return
  }
  if (newPassword.value !== confirmNewPassword.value) {
    errorMessage.value = 'PINs do not match'
    playSound(soundError, 0.6)
    return
  }

  isChangingPassword.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action:     'changePin',
        code:       pendingCode.value,
        currentPin: password.value,
        newPin:     newPassword.value,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error ?? 'PIN change failed')

    setAuthToken(data.token)
    playSound(soundSuccess, 0.6)
    emit('authenticate', pendingRole.value, pendingInfo.value)

    needsPasswordChange.value = false
    pendingCode.value         = ''
    pendingRole.value         = ''
    pendingInfo.value         = null
    newPassword.value         = ''
    confirmNewPassword.value  = ''
  } catch (err: any) {
    errorMessage.value = err?.message ?? 'Failed to update PIN. Please try again.'
    playSound(soundError, 0.6)
  } finally {
    isChangingPassword.value = false
  }
}

const cancelPasswordChange = () => {
  needsPasswordChange.value = false
  pendingCode.value         = ''
  pendingRole.value         = ''
  pendingInfo.value         = null
  newPassword.value         = ''
  confirmNewPassword.value  = ''
  isSigningIn.value         = false
  errorMessage.value        = 'PIN change cancelled.'
}

// ── Mounted: handle MSAL iOS redirect return ─────────────────────────────────
onMounted(async () => {
  window.addEventListener('keydown', handleEnterKey)
  try {
    const msalUser = await msalHandleRedirect()
    if (msalUser) {
      isSigningIn.value = true
      await handleStaffAuthResult(msalUser.email, msalUser.idToken)
    }
  } catch (err) {
    errorMessage.value = 'Sign-in failed. Please try again.'
    isSigningIn.value  = false
  }
})

// ── Keyboard support (PIN roles) ─────────────────────────────────────────────
const handleEnterKey = (event: KeyboardEvent) => {
  if (selectedRole.value === 'staff' || selectedRole.value === 'cadet' || needsPasswordChange.value) return
  const target      = event.target as HTMLElement | null
  const isTextInput = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any)?.isContentEditable)
  if (isTextInput) return
  if (event.key === 'Enter')     { event.preventDefault(); authenticate(); return }
  if (event.key === 'Backspace') { event.preventDefault(); backspace();    return }
  const isDigit = /^\d$/.test(event.key) || ((event.code || '').startsWith('Numpad') && /^\d$/.test(event.key))
  if (isDigit) { event.preventDefault(); appendDigit(event.key) }
}

onBeforeUnmount(() => window.removeEventListener('keydown', handleEnterKey))

const appendDigit = (digit: number | string) => {
  if (/^\d$/.test(String(digit))) { password.value += String(digit); playSound(soundKeypad, 0.5) }
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

              <!-- Staff: Microsoft Sign-In (standalone MSAL, Phase 6) -->
              <template v-else-if="selectedRole === 'staff'">
                <div class="lcars-subtitle">STEP 02</div>
                <div class="ms-signin-area">
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
            This is your first login. You must set a new PIN before you can proceed.
          </p>

          <div class="password-change-form">
            <div class="field-group">
              <label class="field-label">NEW PIN</label>
              <input
                  v-model="newPassword"
                  class="lcars-text-input"
                  type="password"
                  placeholder="min 4 characters"
                  :disabled="isChangingPassword"
                  @keyup.enter="submitPasswordChange"
              />
            </div>
            <div class="field-group">
              <label class="field-label">CONFIRM NEW PIN</label>
              <input
                  v-model="confirmNewPassword"
                  class="lcars-text-input"
                  type="password"
                  placeholder="re-enter PIN"
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