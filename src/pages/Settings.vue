<template>
  <section class="adventure-page">
    <div class="lcars-text-bar"><span>User Settings</span></div>

    <!-- Access Denied -->
    <div v-if="!isStaff" class="denied-container">
      <div class="denied-icon">⛔</div>
      <h2 class="denied-title">ACCESS DENIED</h2>
      <p class="denied-sub">This section is restricted to administrators.</p>
    </div>

    <!-- Admin Panel -->
    <div v-else class="settings-container">

      <!-- Add User Form — admin and staff -->
      <div v-if="isStaff" class="panel">
        <div class="panel-header">
          <span class="panel-label">ADD APPROVED USER</span>
        </div>
        <div class="panel-body">
          <div class="form-row">
            <div class="field">
              <label class="field-label">DISPLAY NAME</label>
              <input
                  v-model="newUser.displayName"
                  class="lcars-input"
                  type="text"
                  placeholder="e.g. Jean-Luc Picard"
                  :disabled="isSaving"
              />
            </div>

            <!-- Cadet: username field (builds @computrek.local email) -->
            <div v-if="newUser.role === 'cadet'" class="field">
              <label class="field-label">USERNAME</label>
              <input
                  v-model="newUser.username"
                  class="lcars-input"
                  type="text"
                  placeholder="e.g. jpicard"
                  autocomplete="off"
                  :disabled="isSaving"
              />
            </div>

            <!-- Non-cadet: real email field -->
            <div v-else class="field">
              <label class="field-label">EMAIL ADDRESS</label>
              <input
                  v-model="newUser.email"
                  class="lcars-input"
                  type="email"
                  placeholder="e.g. jpicard@starfleet.org"
                  :disabled="isSaving"
              />
            </div>

            <!-- Password field — cadets and audit only (staff/admin use Google OAuth) -->
            <div v-if="newUser.role === 'cadet' || newUser.role === 'audit'" class="field field--narrow">
              <label class="field-label">PASSWORD</label>
              <input
                  v-model="newUser.password"
                  class="lcars-input"
                  type="password"
                  placeholder="min 6 chars"
                  autocomplete="new-password"
                  :disabled="isSaving"
              />
            </div>

            <!-- Cadet: teacher selector — admin picks any teacher; staff is locked to themselves -->
            <div v-if="newUser.role === 'cadet'" class="field">
              <label class="field-label">TEACHER</label>
              <select
                v-if="isAdmin"
                v-model="newUser.teacherEmail"
                class="lcars-input lcars-select"
                :disabled="isSaving"
                @change="newUser.periodId = ''"
              >
                <option value="" disabled>Select teacher…</option>
                <option v-for="t in teacherOptions" :key="t.email" :value="t.email">{{ t.displayName || t.email }}</option>
              </select>
              <span v-else class="lcars-input lcars-static">{{ userInfo?.displayName || currentUserEmail }}</span>
            </div>

            <!-- Cadet: period selector — filtered to selected teacher's periods -->
            <div v-if="newUser.role === 'cadet'" class="field field--narrow">
              <label class="field-label">PERIOD</label>
              <select
                v-model="newUser.periodId"
                class="lcars-input lcars-select"
                :disabled="isSaving || !newUser.teacherEmail"
              >
                <option value="" disabled>
                  {{ newUser.teacherEmail ? 'Select…' : 'Pick teacher first' }}
                </option>
                <option v-for="p in enrollmentPeriods" :key="p.id" :value="p.id">{{ p.label }}</option>
              </select>
            </div>

            <!-- Staff only: period assignment (which periods they teach) -->
            <div v-if="newUser.role === 'staff'" class="field field--wide">
              <label class="field-label">PERIODS TAUGHT</label>
              <div class="period-checkbox-group">
                <label
                    v-for="p in PERIOD_IDS"
                    :key="p.id"
                    class="period-checkbox-label"
                >
                  <input
                      type="checkbox"
                      :value="p.id"
                      v-model="newUser.periodIds"
                      :disabled="isSaving"
                  />
                  {{ p.label }}
                </label>
              </div>
            </div>

            <!-- Admin can set any role; non-admin staff can only add cadets -->
            <div v-if="isAdmin" class="field field--narrow">
              <label class="field-label">ROLE</label>
              <select v-model="newUser.role" class="lcars-input lcars-select" :disabled="isSaving">
                <option value="cadet">Cadet</option>
                <option value="civilian">Civilian</option>
                <option value="staff">Staff</option>
                <option value="audit">Audit</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button class="lcars-btn" :disabled="isSaving" @click="addUser">
              {{ isSaving ? 'SAVING...' : 'ADD USER' }}
            </button>
          </div>
          <div class="form-footer">
            <span v-if="formError"   class="form-error">{{ formError }}</span>
            <span v-if="formSuccess" class="form-success">{{ formSuccess }}</span>
          </div>
        </div>
      </div>

      <!-- User List -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-label">APPROVED USERS</span>
          <span class="panel-header-right">
            <span class="panel-count">{{ filteredUsers.length }} / {{ users.length }} SHOWN</span>
            <button
              v-if="filteredUsers.some(u => u.role === 'cadet')"
              class="print-cards-btn"
              @click="printLoginCards"
            >🖨 PRINT LOGIN CARDS</button>
          </span>
        </div>
        <div class="panel-body">

          <!-- Filter / Search bar -->
          <div class="filter-bar">
            <div class="search-wrap">
              <span class="search-icon">🔍</span>
              <input
                  v-model="searchQuery"
                  class="lcars-input search-input"
                  type="text"
                  placeholder="Search name or email..."
              />
              <button v-if="searchQuery" class="clear-search" @click="searchQuery = ''">✕</button>
            </div>
            <div class="role-filters">
              <button
                  class="role-filter-btn"
                  :class="{ active: roleFilter === '' }"
                  @click="roleFilter = ''"
              >ALL</button>
              <button
                  v-for="r in roleOptions"
                  :key="r"
                  class="role-filter-btn"
                  :class="['active-' + r, { active: roleFilter === r }]"
                  @click="roleFilter = roleFilter === r ? '' : r"
              >{{ r.toUpperCase() }}</button>
            </div>
            <div v-if="roleFilter === 'cadet' && cadetPeriodOptions.length > 1" class="role-filters period-filters">
              <button
                  class="role-filter-btn"
                  :class="{ active: periodFilter === '' }"
                  @click="periodFilter = ''"
              >ALL PERIODS</button>
              <button
                  v-for="p in cadetPeriodOptions"
                  :key="p.id"
                  class="role-filter-btn"
                  :class="{ active: periodFilter === p.id }"
                  @click="periodFilter = periodFilter === p.id ? '' : p.id"
              >{{ p.label }}</button>
            </div>
          </div>

          <div v-if="isLoading" class="loading-msg">LOADING CREW MANIFEST...</div>
          <div v-else-if="users.length === 0" class="empty-msg">No approved users found.</div>
          <div v-else-if="filteredUsers.length === 0" class="empty-msg">No users match your search.</div>
          <div v-else class="user-table">
            <div class="user-table-header">
              <span class="sortable" @click="setSort('displayName')">
                DISPLAY NAME <span class="sort-icon">{{ sortIcon('displayName') }}</span>
              </span>
              <span class="sortable" @click="setSort('email')">
                EMAIL / USERNAME <span class="sort-icon">{{ sortIcon('email') }}</span>
              </span>
              <span class="sortable" @click="setSort('role')">
                ROLE <span class="sort-icon">{{ sortIcon('role') }}</span>
              </span>
              <span></span>
            </div>

            <div
                v-for="user in filteredUsers"
                :key="user.email"
                class="user-row"
                :class="`role--${editingEmail === user.email ? editForm.role : user.role}`"
            >
              <!-- View mode -->
              <template v-if="editingEmail !== user.email">
                <span class="user-name">{{ user.displayName || '—' }}</span>
                <span class="user-email">
                  {{ user.email }}
                  <span v-if="user.role === 'cadet' && user.periodId" class="period-tag">{{ periodLabel(user.periodId) }}</span>
                  <span v-if="user.role === 'cadet' && user.teacherEmail" class="teacher-tag">{{ teacherLabel(user.teacherEmail) }}</span>
                  <span
                      v-if="user.role === 'staff' && user.periodIds?.length"
                      class="period-tag"
                  >{{ user.periodIds.map(id => periodLabel(id)).join(', ') }}</span>
                </span>
                <span class="user-role">
                  <span class="role-badge">{{ user.role?.toUpperCase() }}</span>
                </span>
                <span v-if="isStaff" class="user-actions">
                  <button v-if="isAdmin" class="edit-btn" @click="startEdit(user)">EDIT</button>
                  <button
                      v-if="user.role === 'cadet'"
                      class="reset-pw-btn"
                      title="Reset to default password"
                      @click="confirmPwReset(user)"
                  >RESET PW</button>
                  <button
                      v-if="isAdmin"
                      class="remove-btn"
                      :disabled="user.email === currentUserEmail"
                      :title="user.email === currentUserEmail ? 'Cannot remove yourself' : 'Remove user'"
                      @click="confirmRemove(user)"
                  >REMOVE</button>
                </span>
              </template>

              <!-- Edit mode -->
              <template v-else>
                <input
                    v-model="editForm.displayName"
                    class="lcars-input lcars-input--inline"
                    type="text"
                />
                <span class="user-email-edit">
                  <span class="user-email">{{ user.email }}</span>
                  <select
                      v-if="(editForm.role || user.role) === 'cadet'"
                      v-model="editForm.periodId"
                      class="lcars-input lcars-select lcars-input--inline period-inline-select"
                  >
                    <option value="" disabled>Period…</option>
                    <option v-for="p in editEnrollmentPeriods" :key="p.id" :value="p.id">{{ p.label }}</option>
                  </select>
                  <!-- Teacher reassignment for cadets -->
                  <select
                      v-if="(editForm.role || user.role) === 'cadet'"
                      v-model="editForm.teacherEmail"
                      class="lcars-input lcars-select lcars-input--inline period-inline-select"
                  >
                    <option value="">No teacher…</option>
                    <option v-for="t in teacherOptions" :key="t.email" :value="t.email">{{ t.displayName || t.email }}</option>
                  </select>
                  <!-- Period assignment for staff only -->
                  <div
                      v-if="(editForm.role || user.role) === 'staff'"
                      class="period-checkbox-group period-checkbox-group--inline"
                  >
                    <label
                        v-for="p in PERIOD_IDS"
                        :key="p.id"
                        class="period-checkbox-label"
                    >
                      <input type="checkbox" :value="p.id" v-model="editForm.periodIds" />
                      {{ p.label }}
                    </label>
                  </div>

                  <!-- Force Password Change toggle for Cadets -->
                  <div v-if="(editForm.role || user.role) === 'cadet'" class="password-reset-row">
                    <label class="period-checkbox-label">
                      <input type="checkbox" v-model="editForm.requiresPasswordChange" />
                      FORCE PASSWORD CHANGE ON LOGIN
                    </label>
                  </div>
                </span>
                <span class="user-role">
                  <select v-model="editForm.role" class="lcars-input lcars-select lcars-input--inline">
                    <option value="cadet">Cadet</option>
                    <option value="civilian">Civilian</option>
                    <option value="staff">Staff</option>
                    <option value="audit">Audit</option>
                    <option value="admin">Admin</option>
                  </select>
                </span>
                <span class="user-actions">
                  <button class="edit-btn" @click="saveEdit(user.email)">SAVE</button>
                  <button class="remove-btn" @click="cancelEdit">CANCEL</button>
                </span>
              </template>
            </div>
          </div>

        </div>
      </div>

    </div>

    <!-- Reset Password Modal -->
    <div v-if="pwResetTarget" class="modal-overlay" @click.self="closePwResetModal">
      <div class="modal modal--reset">

        <!-- Auth type — shown in both states so it travels with any screenshot -->
        <div class="modal-account-type" :class="`role--${pwResetTarget.role || 'unknown'}`">
          <span class="modal-account-type-label">Account Type</span>
          <span class="role-badge">{{ (pwResetTarget.role || 'unknown').toUpperCase() }}</span>
        </div>

        <!-- Before reset: confirm prompt -->
        <template v-if="!pwResetResult">
          <div class="modal-title modal-title--reset">RESET PASSWORD</div>
          <p class="modal-body">
            Reset <strong>{{ pwResetTarget.displayName || pwResetTarget.email }}</strong>'s
            password back to the default?<br><br>
            They will be required to change it again on next login.
          </p>
          <p v-if="pwResetError" class="pw-reset-error">{{ pwResetError }}</p>
          <div class="modal-actions">
            <button class="lcars-btn lcars-btn--ghost" :disabled="isPwResetting" @click="closePwResetModal">CANCEL</button>
            <button class="lcars-btn lcars-btn--reset" :disabled="isPwResetting" @click="executePwReset">
              {{ isPwResetting ? 'RESETTING...' : 'CONFIRM RESET' }}
            </button>
          </div>
        </template>

        <!-- After reset: show login credentials (username + temp password) so both can be screenshotted together -->
        <template v-else>
          <div class="modal-title modal-title--reset">PASSWORD RESET</div>
          <p class="modal-body">
            <strong>{{ pwResetResult.displayName }}</strong>'s login credentials:
          </p>
          <div class="credential-list">
            <div class="credential-row">
              <span class="credential-label">Username</span>
              <span class="credential-value">{{ pwResetTarget.email }}</span>
            </div>
            <div class="credential-row credential-row--password">
              <span class="credential-label">Password</span>
              <span class="credential-value">{{ pwResetResult.defaultPassword }}</span>
            </div>
          </div>
          <p class="modal-body" style="margin-top: 0.75rem; font-size: 0.88rem;">
            Give them these credentials and tell them they'll be prompted to set a new password after logging in.
          </p>
          <div class="modal-actions">
            <button class="lcars-btn" @click="closePwResetModal">DONE</button>
          </div>
        </template>

      </div>
    </div>

    <!-- Confirm Remove Modal -->
    <div v-if="userToRemove" class="modal-overlay" @click.self="userToRemove = null">
      <div class="modal">
        <div class="modal-title">CONFIRM REMOVAL</div>
        <p class="modal-body">
          Remove <strong>{{ userToRemove.displayName || userToRemove.email }}</strong> from the
          approved users list? They will lose access immediately.
        </p>
        <div class="modal-actions">
          <button class="lcars-btn lcars-btn--ghost" @click="userToRemove = null">CANCEL</button>
          <button class="lcars-btn lcars-btn--danger" :disabled="isRemoving" @click="removeUser">
            {{ isRemoving ? 'REMOVING...' : 'CONFIRM REMOVE' }}
          </button>
        </div>
      </div>
    </div>

  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, where } from '@/data/db'
import { getIdToken } from 'firebase/auth'
import { db, firebaseConfig, auth } from '@/firebase'
import { useAuth } from '@/composables/useAuth.js'
import { PERIOD_IDS } from '@/config/schoolYear'

const { isAdmin, isStaff, userInfo } = useAuth()
const currentUserEmail = computed(() => userInfo.value?.email ?? '')

const periodLabel  = (id)    => PERIOD_IDS.find(p => p.id === id)?.label ?? id
const teacherLabel = (email) => users.value.find(u => u.email === email)?.displayName ?? email

// Computed list of staff users to populate the teacher dropdowns
const teacherOptions = computed(() =>
  users.value.filter(u => u.role === 'staff')
)

// Periods available for the currently selected teacher in the enrollment form.
// Filters to the teacher's configured periodIds so admin can't accidentally
// assign a cadet to a period the teacher doesn't own.
// Falls back to all periods if the teacher has no periodIds configured yet.
const enrollmentPeriods = computed(() => {
  if (!newUser.value.teacherEmail) return []
  const teacher = users.value.find(u => u.email === newUser.value.teacherEmail)
  const ids = teacher?.periodIds
  if (!ids || ids.length === 0) return PERIOD_IDS  // fallback: show all
  return PERIOD_IDS.filter(p => ids.includes(p.id))
})

// Periods available for the teacher being edited in the user table.
const editEnrollmentPeriods = computed(() => {
  if (!editForm.value.teacherEmail) return PERIOD_IDS
  const teacher = users.value.find(u => u.email === editForm.value.teacherEmail)
  const ids = teacher?.periodIds
  if (!ids || ids.length === 0) return PERIOD_IDS
  return PERIOD_IDS.filter(p => ids.includes(p.id))
})

// ── User list ─────────────────────────────────────────────────────────────────
const users     = ref([])
const isLoading = ref(false)

const fetchUsers = async () => {
  isLoading.value = true
  try {
    const snap = await getDocs(collection(db, 'approvedUsers'))
    users.value = snap.docs.map(d => ({ email: d.id, ...d.data() }))
  } catch (e) {
    console.error('Failed to fetch users:', e)
  } finally {
    isLoading.value = false
  }
}

// ── Filter & sort ─────────────────────────────────────────────────────────────
const searchQuery  = ref('')
const roleFilter   = ref('')
const periodFilter = ref('')
const sortKey      = ref('displayName')
const sortDir      = ref('asc')

const roleOptions = ['cadet', 'civilian', 'staff', 'audit', 'admin']

// Sorted list of unique periods present in the cadet roster — drives the period filter row
const cadetPeriodOptions = computed(() => {
  const ids = [...new Set(users.value.filter(u => u.role === 'cadet' && u.periodId).map(u => u.periodId))]
  const order = PERIOD_IDS.map(p => p.id)
  return ids
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map(id => ({ id, label: PERIOD_IDS.find(p => p.id === id)?.label ?? id }))
})

const setSort = (key) => {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const sortIcon = (key) => {
  if (sortKey.value !== key) return '⇅'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

const filteredUsers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return users.value
      .filter(u => {
        const matchesSearch  = !q ||
            (u.displayName || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        const matchesRole   = !roleFilter.value   || u.role     === roleFilter.value
        const matchesPeriod = !periodFilter.value || u.periodId === periodFilter.value
        return matchesSearch && matchesRole && matchesPeriod
      })
      .sort((a, b) => {
        const valA = (a[sortKey.value] || '').toLowerCase()
        const valB = (b[sortKey.value] || '').toLowerCase()
        const cmp  = valA.localeCompare(valB)
        return sortDir.value === 'asc' ? cmp : -cmp
      })
})

// ── Add user ──────────────────────────────────────────────────────────────────
const newUser     = ref({ displayName: '', email: '', username: '', password: '', periodId: '', teacherEmail: '', periodIds: [], role: 'civilian' })
const isSaving    = ref(false)
const formError   = ref('')
const formSuccess = ref('')

// When a non-admin staff member loads the page, lock the add form to cadet + their own email.
watch(currentUserEmail, (email) => {
  if (isStaff.value && !isAdmin.value && email) {
    newUser.value.role         = 'cadet'
    newUser.value.teacherEmail = email
  }
}, { immediate: true })

const addUser = async () => {
  formError.value   = ''
  formSuccess.value = ''

  // Non-admin staff can only add cadets to their own class — enforce server-side.
  if (!isAdmin.value) {
    newUser.value.role        = 'cadet'
    newUser.value.teacherEmail = currentUserEmail.value
  }

  const isCadet = newUser.value.role === 'cadet'
  const name    = newUser.value.displayName.trim()

  if (isCadet) {
    const username     = newUser.value.username.trim().toLowerCase()
    const password     = newUser.value.password
    const periodId     = newUser.value.periodId
    const teacherEmail = newUser.value.teacherEmail

    if (!username)             { formError.value = 'Username is required.'; return }
    if (!/^[a-z0-9._-]+$/.test(username)) { formError.value = 'Username may only contain letters, numbers, dots, hyphens, and underscores.'; return }
    if (!password || password.length < 6) { formError.value = 'Password must be at least 6 characters.'; return }
    if (!periodId)             { formError.value = 'Please select a period.'; return }
    if (!teacherEmail)         { formError.value = 'Please select a teacher.'; return }

    const cadetEmail = `${username}@computrek.local`
    if (users.value.find(u => u.email === cadetEmail)) { formError.value = 'That username is already taken.'; return }

    isSaving.value = true
    try {
      // Create Firebase Auth account via the REST API instead of the SDK.
      // Using createUserWithEmailAndPassword from the SDK would auto-sign-in
      // as the new cadet, displacing the admin session and breaking the
      // Firestore write that follows. The REST API creates the user without
      // touching the browser's auth state at all.
      const signUpRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cadetEmail, password, returnSecureToken: false }),
        }
      )
      if (!signUpRes.ok) {
        const err = await signUpRes.json()
        const code = err?.error?.message ?? 'UNKNOWN'
        if (code === 'EMAIL_EXISTS') throw Object.assign(new Error(), { code: 'auth/email-already-in-use' })
        throw new Error(`Auth error: ${code}`)
      }

      // Save to Firestore
      const cadetDoc = {
        displayName:  name || username,
        role:         'cadet',
        periodId,
        teacherEmail,
        autoApproved: false,
        requiresPasswordChange: true,
        createdAt:    serverTimestamp(),
      }
      cadetDoc.studentId = String(Math.floor(100000 + Math.random() * 900000))
      await setDoc(doc(db, 'approvedUsers', cadetEmail), cadetDoc)
      const teacherName = teacherOptions.value.find(t => t.email === teacherEmail)?.displayName ?? teacherEmail
      formSuccess.value = `${name || username} has been enrolled in ${PERIOD_IDS.find(p => p.id === periodId)?.label} under ${teacherName}.`
      newUser.value = {
        displayName: '', email: '', username: '', password: '', periodId: '',
        teacherEmail: isAdmin.value ? '' : currentUserEmail.value,
        periodIds: [], role: 'cadet',
      }
      await fetchUsers()
    } catch (e) {
      console.error(e)
      if (e.code === 'auth/email-already-in-use') {
        formError.value = 'That username is already taken in Firebase Auth.'
      } else {
        formError.value = 'Failed to add cadet. ' + (e.message ?? '')
      }
    } finally {
      isSaving.value = false
    }

  } else {
    const email    = newUser.value.email.trim().toLowerCase()
    const isAudit  = newUser.value.role === 'audit'
    const password = newUser.value.password

    if (!email)                                     { formError.value = 'Email address is required.'; return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { formError.value = 'Please enter a valid email.'; return }
    if (users.value.find(u => u.email === email))   { formError.value = 'That email is already approved.'; return }

    // Only audit accounts need a password — they use email/password login.
    // Staff and admin use Google OAuth, so no Firebase Auth account is created here.
    if (isAudit && (!password || password.length < 6)) {
      formError.value = 'Password is required and must be at least 6 characters for Audit accounts.'
      return
    }

    isSaving.value = true
    try {
      // Audit accounts need a Firebase Auth record for email/password login.
      // Staff/admin sign in via Google OAuth — no Auth record needed here.
      if (isAudit) {
        const signUpRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: false }),
          }
        )
        if (!signUpRes.ok) {
          const err  = await signUpRes.json()
          const code = err?.error?.message ?? 'UNKNOWN'
          if (code === 'EMAIL_EXISTS') throw Object.assign(new Error(), { code: 'auth/email-already-in-use' })
          throw new Error(`Auth error: ${code}`)
        }
      }

      const staffDoc = {
        displayName:  name || email,
        role:         newUser.value.role,
        autoApproved: false,
        createdAt:    serverTimestamp(),
      }
      if (newUser.value.role === 'staff' && newUser.value.periodIds.length) {
        staffDoc.periodIds = newUser.value.periodIds
      }
      await setDoc(doc(db, 'approvedUsers', email), staffDoc)
      formSuccess.value = `${name || email} has been granted access.`
      newUser.value = { displayName: '', email: '', username: '', password: '', periodId: '', teacherEmail: '', periodIds: [], role: 'civilian' }
      await fetchUsers()
    } catch (e) {
      console.error(e)
      if (e.code === 'auth/email-already-in-use') {
        formError.value = 'That email already has a Firebase Auth account.'
      } else {
        formError.value = 'Failed to add user. ' + (e.message ?? 'Check your permissions.')
      }
    } finally {
      isSaving.value = false
    }
  }
}

// ── Edit user ─────────────────────────────────────────────────────────────────
const editingEmail = ref(null)
const editForm     = ref({ displayName: '', role: '', periodId: '', teacherEmail: '', periodIds: [], requiresPasswordChange: false, studentId: '' })

const startEdit = (user) => {
  editingEmail.value = user.email
  editForm.value = {
    displayName:            user.displayName  || '',
    role:                   user.role         || 'staff',
    periodId:               user.periodId     || '',
    teacherEmail:           user.teacherEmail || '',
    periodIds:              user.periodIds    ? [...user.periodIds] : [],
    requiresPasswordChange: user.requiresPasswordChange || false,
    studentId:              user.studentId != null ? String(user.studentId) : '',
  }
}

const cancelEdit = () => { editingEmail.value = null }

const saveEdit = async (email) => {
  try {
    const update = {
      displayName:  editForm.value.displayName || email,
      role:         editForm.value.role,
      autoApproved: false,
    }
    if (editForm.value.role === 'cadet') {
      update.periodId     = editForm.value.periodId     || ''
      update.teacherEmail = editForm.value.teacherEmail || ''
      if (editForm.value.requiresPasswordChange !== undefined) {
        update.requiresPasswordChange = editForm.value.requiresPasswordChange
      }
      const sid = (editForm.value.studentId || '').trim()
      if (sid) update.studentId = sid
    }
    if (editForm.value.role === 'staff') {
      update.periodIds = editForm.value.periodIds || []
    }
    await setDoc(doc(db, 'approvedUsers', email), update, { merge: true })
    editingEmail.value = null
    await fetchUsers()
  } catch (e) {
    console.error('Failed to update user:', e)
  }
}

// ── Reset cadet password ──────────────────────────────────────────────────────
const pwResetTarget  = ref(null)   // the user object to reset
const isPwResetting  = ref(false)
const pwResetResult  = ref(null)   // { displayName, defaultPassword } on success
const pwResetError   = ref('')

const confirmPwReset = (user) => {
  pwResetTarget.value = user
  pwResetResult.value = null
  pwResetError.value  = ''
}

const executePwReset = async () => {
  if (!pwResetTarget.value) return
  isPwResetting.value = true
  pwResetError.value  = ''
  try {
    const token = await getIdToken(auth.currentUser)
    const res   = await fetch(
      `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/resetCadetPassword`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ email: pwResetTarget.value.email }),
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Reset failed.')
    pwResetResult.value = data
    await fetchUsers()
  } catch (e) {
    console.error('resetCadetPassword error:', e)
    pwResetError.value = e?.message ?? 'Reset failed. Please try again.'
  } finally {
    isPwResetting.value = false
  }
}

const closePwResetModal = () => {
  pwResetTarget.value = null
  pwResetResult.value = null
  pwResetError.value  = ''
}

// ── Remove user ───────────────────────────────────────────────────────────────
const userToRemove = ref(null)
const isRemoving   = ref(false)

const confirmRemove = (user) => { userToRemove.value = user }

const removeUser = async () => {
  if (!userToRemove.value) return
  isRemoving.value = true
  try {
    await deleteDoc(doc(db, 'approvedUsers', userToRemove.value.email))
    userToRemove.value = null
    await fetchUsers()
  } catch (e) {
    console.error(e)
  } finally {
    isRemoving.value = false
  }
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    if (userToRemove.value)  userToRemove.value = null
    else if (editingEmail.value) cancelEdit()
  }
}

// ── Login card printing ───────────────────────────────────────────────────────

const printLoginCards = () => {
  const cadets = filteredUsers.value.filter(u => u.role === 'cadet')
  if (!cadets.length) return

  const clean = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
  const derivePassword = (u) => {
    if (!u.studentId) return '(see teacher)'
    const firstName = (u.displayName || '').split(' ')[0]
    return clean(firstName) + u.studentId.toString().slice(-4)
  }

  const escape = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

  const cards = cadets.map(u => `
    <div class="card">
      <div class="card-header">CompuTrek Login</div>
      <div class="card-name">${escape(u.displayName || u.email)}</div>
      <div class="card-field"><span class="label">Username</span>${escape(u.email)}</div>
      <div class="card-field"><span class="label">Password</span>${escape(derivePassword(u))}</div>
      <div class="card-note">You will be asked to change your password when you first sign in.</div>
    </div>`).join('')

  const periodHeading = periodFilter.value
    ? PERIOD_IDS.find(p => p.id === periodFilter.value)?.label ?? ''
    : ''
  const title = periodHeading ? `Login Cards — ${periodHeading}` : 'Login Cards'

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escape(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .card {
    border: 1px dashed #bbb;
    padding: 0.25in 0.35in;
    height: 2in;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.2rem;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .card-header {
    font-size: 0.55rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #999;
    margin-bottom: 0.1rem;
  }
  .card-name {
    font-size: 1.1rem;
    font-weight: bold;
    color: #111;
    margin-bottom: 0.1rem;
    line-height: 1.2;
  }
  .card-field {
    font-size: 0.78rem;
    color: #333;
    display: flex;
    flex-direction: column;
    gap: 0.02rem;
    margin-bottom: 0.05rem;
  }
  .label {
    font-size: 0.55rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
  }
  .card-note {
    font-size: 0.58rem;
    color: #aaa;
    margin-top: 0.15rem;
    font-style: italic;
    line-height: 1.3;
  }
  @media print {
    @page { margin: 0.3in; size: letter; }
  }
</style>
</head>
<body>
<div class="grid">${cards}</div>
<script>window.onload = () => window.print();<\/script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  if (isStaff.value) fetchUsers()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
@import '../assets/styles/classic.css';

/* ── Layout ──────────────────────────────────────────────────────────────────── */
.settings-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1.5rem 2rem 3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}

/* ── Access Denied ───────────────────────────────────────────────────────────── */
.denied-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rem 2rem;
  gap: 1rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
}
.denied-icon  { font-size: 4rem; }
.denied-title { color: #ff6e6e; font-size: 2.5rem; margin: 0; letter-spacing: 0.2em; }
.denied-sub   { color: #99ccff; font-size: 1.1rem; margin: 0; }

/* ── Panel ───────────────────────────────────────────────────────────────────── */
.panel {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 0.125rem solid #ff9900;
  border-radius: 0.75rem;
  overflow: hidden;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(90deg, #cc6600, #ff9900);
  padding: 0.6rem 1.25rem;
}
.panel-label { color: black; font-size: 1.1rem; font-weight: bold; letter-spacing: 0.1em; }
.panel-count { color: rgba(0,0,0,0.65); font-size: 0.85rem; font-weight: bold; }
.panel-body  { padding: 1.5rem; }

/* ── Form ────────────────────────────────────────────────────────────────────── */
.form-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1 1 200px;
}
.field--narrow { flex: 0 0 120px; }
.field-label   { color: #99ccff; font-size: 0.8rem; letter-spacing: 0.1em; }

.lcars-input {
  background: rgba(0,0,0,0.35);
  border: 0.125rem solid #99ccff;
  border-radius: 0.4rem;
  color: #e6f0ff;
  font-family: inherit;
  font-size: 1rem;
  padding: 0.55rem 0.75rem;
  transition: border-color 0.2s;
  text-transform: none;
}
.lcars-input:focus    { outline: none; border-color: #ff9900; }
.lcars-input:disabled { opacity: 0.5; cursor: not-allowed; }
.lcars-select option  { background: #16213e; }

.lcars-input--inline {
  padding: 0.25rem 0.5rem;
  font-size: 0.9rem;
  width: 100%;
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}
.form-error   { color: #ff6e6e; font-size: 0.95rem; flex: 1; }
.form-success { color: #69f0ae; font-size: 0.95rem; flex: 1; }

/* ── Buttons ─────────────────────────────────────────────────────────────────── */
.lcars-btn {
  background: linear-gradient(90deg, #cc6600, #ff9900);
  border: none;
  border-radius: 0.4rem;
  color: black;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: bold;
  letter-spacing: 0.08em;
  padding: 0.6rem 1.4rem;
  transition: opacity 0.2s, box-shadow 0.2s;
}
.lcars-btn:hover:not(:disabled) { box-shadow: 0 0 0.75rem rgba(255,153,0,0.5); }
.lcars-btn:disabled             { opacity: 0.5; cursor: not-allowed; }

.lcars-btn--ghost {
  background: transparent;
  border: 0.125rem solid #99ccff;
  color: #99ccff;
}
.lcars-btn--ghost:hover:not(:disabled) { box-shadow: 0 0 0.75rem rgba(153,204,255,0.3); }

.lcars-btn--danger {
  background: linear-gradient(90deg, #cc2200, #ff4444);
  color: white;
}
.lcars-btn--danger:hover:not(:disabled) { box-shadow: 0 0 0.75rem rgba(255,68,68,0.5); }

/* ── Filter bar ──────────────────────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.search-wrap {
  position: relative;
  flex: 1 1 200px;
}
.search-icon {
  position: absolute;
  left: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.85rem;
  pointer-events: none;
}
.search-input {
  padding-left: 2rem;
  padding-right: 2rem;
  width: 100%;
}
.clear-search {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #99ccff;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
}
.clear-search:hover { color: #ff9900; }

.role-filters {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.role-filter-btn {
  background: transparent;
  border: 1px solid rgba(153,204,255,0.3);
  border-radius: 0.3rem;
  color: rgba(153,204,255,0.6);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.08em;
  padding: 0.25rem 0.65rem;
  transition: all 0.2s;
}
.role-filter-btn:hover       { border-color: #99ccff; color: #99ccff; }
.role-filter-btn.active      { background: rgba(153,204,255,0.15); border-color: #99ccff; color: #e6f0ff; }

.role-filter-btn.active-admin.active   { border-color: #ffd740; color: #ffd740; background: rgba(255,215,64,0.12); }
.role-filter-btn.active-staff.active   { border-color: #99ccff; color: #99ccff; background: rgba(153,204,255,0.12); }
.role-filter-btn.active-cadet.active    { border-color: #69f0ae; color: #69f0ae; background: rgba(105,240,174,0.12); }
.role-filter-btn.active-civilian.active { border-color: #ea80fc; color: #ea80fc; background: rgba(234,128,252,0.12); }
.role-filter-btn.active-audit.active    { border-color: #40c4ff; color: #40c4ff; background: rgba(64,196,255,0.12); }

/* ── User Table ──────────────────────────────────────────────────────────────── */
.loading-msg,
.empty-msg {
  color: #99ccff;
  font-size: 1rem;
  text-align: center;
  padding: 2rem 0;
  opacity: 0.7;
}

.user-table { display: flex; flex-direction: column; gap: 0.5rem; }

.user-table-header,
.user-row {
  display: grid;
  grid-template-columns: 1fr 1fr 0.5fr 0.75fr;
  align-items: center;
}

.user-table-header {
  padding: 0.4rem 0.75rem;
  color: #99ccff;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  border-bottom: 1px solid rgba(153,204,255,0.2);
}

.sortable {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: color 0.15s;
}
.sortable:hover { color: #ff9900; }
.sort-icon      { font-size: 0.75rem; opacity: 0.8; }

.user-row {
  padding: 0.6rem 0.75rem;
  border-radius: 0.4rem;
  background: rgba(255,255,255,0.04);
  border-left: 3px solid transparent;
  transition: background 0.2s;
}
.user-row:hover { background: rgba(255,255,255,0.07); }

.user-row.role--admin   { border-left-color: #ffd740; }
.user-row.role--staff   { border-left-color: #99ccff; }
.user-row.role--cadet    { border-left-color: #69f0ae; }
.user-row.role--civilian { border-left-color: #ea80fc; }
.user-row.role--audit    { border-left-color: #40c4ff; }

.user-name  { color: #e6f0ff; font-size: 1rem; }
.user-email { color: #99ccff; font-size: 0.9rem; word-break: break-all; }
.user-email-edit { display: flex; flex-direction: column; gap: 0.5rem; }

.password-reset-row {
  margin-top: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 153, 0, 0.1);
  border-radius: 0.3rem;
  border: 1px solid rgba(255, 153, 0, 0.2);
}
.password-reset-row .period-checkbox-label {
  color: #ff9900;
  font-size: 0.75rem;
  font-weight: bold;
}

.period-tag {
  display: inline-block;
  background: rgba(105,240,174,0.12);
  border: 1px solid rgba(105,240,174,0.35);
  border-radius: 0.25rem;
  color: #69f0ae;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  margin-left: 0.5rem;
  padding: 0.1rem 0.4rem;
  vertical-align: middle;
}

.teacher-tag {
  display: inline-block;
  background: rgba(153,204,255,0.1);
  border: 1px solid rgba(153,204,255,0.3);
  border-radius: 0.25rem;
  color: #99ccff;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  margin-left: 0.35rem;
  padding: 0.1rem 0.4rem;
  vertical-align: middle;
}

.period-inline-select {
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
}

.period-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.4rem 0;
}
.period-checkbox-group--inline {
  padding: 0.1rem 0;
}
.period-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #99ccff;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.period-checkbox-label input[type="checkbox"] {
  accent-color: #ff9900;
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
}

.role-badge {
  display: inline-block;
  background: rgba(153,204,255,0.15);
  border: 1px solid rgba(153,204,255,0.3);
  border-radius: 0.25rem;
  color: #99ccff;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  padding: 0.15rem 0.5rem;
}
.role--admin .role-badge   { background: rgba(255,215,64,0.15);  border-color: rgba(255,215,64,0.4);  color: #ffd740; }
.role--cadet .role-badge    { background: rgba(105,240,174,0.15); border-color: rgba(105,240,174,0.4); color: #69f0ae; }
.role--civilian .role-badge { background: rgba(234,128,252,0.15); border-color: rgba(234,128,252,0.4); color: #ea80fc; }
.role--audit .role-badge    { background: rgba(64,196,255,0.15);  border-color: rgba(64,196,255,0.4);  color: #40c4ff; }

.user-actions { display: flex; gap: 0.4rem; align-items: center; }

.edit-btn {
  background: transparent;
  border: 1px solid #69f0ae;
  border-radius: 0.3rem;
  color: #69f0ae;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.6rem;
  transition: all 0.2s;
}
.edit-btn:hover { background: rgba(105,240,174,0.15); }

.remove-btn {
  background: transparent;
  border: 1px solid #ff6e6e;
  border-radius: 0.3rem;
  color: #ff6e6e;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.6rem;
  transition: all 0.2s;
}
.remove-btn:hover:not(:disabled) { background: rgba(255,110,110,0.15); }
.remove-btn:disabled             { opacity: 0.25; cursor: not-allowed; }

.reset-pw-btn {
  background: transparent;
  border: 1px solid #ff9900;
  border-radius: 0.3rem;
  color: #ff9900;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.6rem;
  transition: all 0.2s;
}
.reset-pw-btn:hover { background: rgba(255,153,0,0.15); }

/* ── Modal ───────────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  border: 0.125rem solid #ff6e6e;
  border-radius: 0.75rem;
  box-shadow: 0 0 2rem rgba(255,110,110,0.3);
  max-width: 28rem;
  padding: 2rem;
  width: 90%;
}
.modal-title           { color: #ff6e6e; font-size: 1.4rem; font-weight: bold; letter-spacing: 0.15em; margin-bottom: 1rem; }
.modal-body            { color: #99ccff; font-size: 1rem; line-height: 1.5; margin-bottom: 1.5rem; }
.modal-body strong     { color: #e6f0ff; }
.modal-actions         { display: flex; gap: 1rem; justify-content: flex-end; }

/* ── Print cards button ───────────────────────────────────────────────────────── */
.panel-header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.print-cards-btn {
  margin-left: auto;
  background: rgba(255, 153, 0, 0.1);
  border: 1px solid rgba(255, 153, 0, 0.4);
  color: #ff9900;
  padding: 0.25rem 0.75rem;
  border-radius: 0.3rem;
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.print-cards-btn:hover {
  background: rgba(255, 153, 0, 0.2);
  border-color: #ff9900;
}

/* ── Period filter row ────────────────────────────────────────────────────────── */
.period-filters { margin-top: 0.5rem; }

/* ── Reset password modal ─────────────────────────────────────────────────────── */
.modal--reset          { border-color: #ff9900; box-shadow: 0 0 2rem rgba(255,153,0,0.25); }
.modal-title--reset    { color: #ff9900; }
.lcars-btn--reset {
  background: linear-gradient(90deg, #cc6600, #ff9900);
  border: none;
  color: black;
}
.lcars-btn--reset:hover:not(:disabled) { box-shadow: 0 0 0.75rem rgba(255,153,0,0.5); }

/* Auth-type chip at the top of the modal — travels with the screenshot */
.modal-account-type {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.modal-account-type-label {
  color: #6688aa;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

/* Username + password pairing — styled so both read clearly in a screenshot */
.credential-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.credential-row {
  background: rgba(255, 153, 0, 0.1);
  border: 1px solid rgba(255, 153, 0, 0.5);
  border-radius: 0.5rem;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 1rem;
}
.credential-label {
  color: #ffcc80;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  flex-shrink: 0;
}
.credential-value {
  color: #ff9900;
  font-weight: bold;
  letter-spacing: 0.08em;
  text-align: right;
  word-break: break-all;
}
.credential-row--password .credential-value {
  font-size: 1.5rem;
}

.pw-reset-error {
  color: #ff6e6e;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}
</style>