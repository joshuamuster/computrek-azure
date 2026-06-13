import { ref, computed } from 'vue'

// Global authentication state
const isAuthenticated = ref(false)
const userRole        = ref('')
const userInfo        = ref(null)
// userInfo shape:
//   staff/admin: { displayName, email, uid, periodIds? }
//   cadet:       { displayName, email, uid, periodId, teacherEmail }
//
// localStorage persistence:
//   staff/admin/audit: full userInfo object (email included — needed for teacher-scoped queries)
//   cadet:             email omitted — stored as { displayName, uid, periodId, teacherEmail }
//                      The email (= approvedUsers doc ID) is re-derived from Firebase Auth on
//                      next sign-in and is not needed client-side between sessions.
//
// Roles:
//   cadet    — student, scoped to a teacher's class
//   staff    — teacher (Joshua, Mr. Jones, Mr. Madden), scoped to own data
//   admin    — super-user (Joshua's admin email), sees all data, full edit access
//   audit    — read-only admin; sees all data but cannot edit or grade anything
//   civilian — any other visitor / non-teaching staff, view-only PIN login

// ── Admin emulation state (session-only — never persisted to localStorage) ────
// When admin sets this, all read queries scope to the emulated teacher's email.
// Writes always use the actual logged-in user's email.
const emulatingEmail = ref(null)   // null = not emulating; string = teacher email

export function useAuth() {
  // ── Emulation ─────────────────────────────────────────────────────────────────
  const startEmulation = (teacherEmail) => { emulatingEmail.value = teacherEmail }
  const stopEmulation  = ()             => { emulatingEmail.value = null }

  // The email to use for teacher-scoped Firestore reads.
  // staff        → their own email (always)
  // admin + emulating → the emulated teacher's email
  // admin + not emulating → undefined (sees all data, no filter)
  // audit        → undefined (sees all data, no filter)
  const effectiveTeacherEmail = computed(() => {
    const role = userRole.value
    if (role === 'admin' && emulatingEmail.value) return emulatingEmail.value
    if (role === 'admin' || role === 'audit')     return undefined
    if (role === 'staff') return userInfo.value?.email ?? undefined
    return undefined
  })

  const login = (role, info = null) => {
    isAuthenticated.value = true
    userRole.value        = role
    userInfo.value        = info
    
    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('userRole', role)
    if (info) {
      // Cadets: omit email from localStorage to avoid persisting student PII on
      // shared school computers. The email (= approvedUsers doc ID) is re-derived
      // from Firebase Auth on next sign-in and is not needed between sessions.
      const persisted = role === 'cadet'
        ? { displayName: info.displayName, uid: info.uid, periodId: info.periodId, teacherEmail: info.teacherEmail }
        : info
      localStorage.setItem('userInfo', JSON.stringify(persisted))
    } else {
      localStorage.removeItem('userInfo')
    }
  }
  
  const logout = async () => {
    const role = userRole.value
    if (role === 'staff' || role === 'admin' || role === 'audit') {
      const { msalSignOut } = await import('@/data/msalAuth')
      await msalSignOut().catch(() => {})
    } else {
      const { clearAuthToken } = await import('@/data/sessionAuth')
      clearAuthToken()
    }

    isAuthenticated.value = false
    userRole.value        = ''
    userInfo.value        = null
    emulatingEmail.value  = null  // always clear emulation on logout
    
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userInfo')
  }
  
  const initializeAuth = () => {
    const storedAuth = localStorage.getItem('isAuthenticated')
    const storedRole = localStorage.getItem('userRole')
    const storedInfo = localStorage.getItem('userInfo')
    
    if (storedAuth === 'true' && storedRole) {
      isAuthenticated.value = true
      userRole.value        = storedRole
      userInfo.value        = storedInfo ? JSON.parse(storedInfo) : null
    }
  }
  
  // Computed role checks
  const isCadet    = computed(() => userRole.value === 'cadet')
  const isCivilian = computed(() => userRole.value === 'civilian')
  const isStaff    = computed(() => ['staff', 'admin'].includes(userRole.value))
  const isTeacher  = computed(() => userRole.value === 'staff')
  const isAdmin    = computed(() => userRole.value === 'admin')
  const isAudit    = computed(() => userRole.value === 'audit')

  return {
    // State
    isAuthenticated: computed(() => isAuthenticated.value),
    userRole:        computed(() => userRole.value),
    userInfo:        computed(() => userInfo.value),

    // Computed role checks
    isCadet,
    isCivilian,
    isStaff,
    isTeacher,
    isAdmin,
    isAudit,

    // Emulation (admin only)
    emulatingEmail:        computed(() => emulatingEmail.value),
    effectiveTeacherEmail,
    startEmulation,
    stopEmulation,

    // Actions
    login,
    logout,
    initializeAuth,
  }
}