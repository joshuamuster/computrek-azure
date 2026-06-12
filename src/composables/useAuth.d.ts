// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useAuth.d.ts
//
// Type declarations for useAuth.js so TypeScript-consuming files get full
// type inference on userInfo, role checks, and emulation state.
// ─────────────────────────────────────────────────────────────────────────────

import type { ComputedRef } from 'vue'

// Shape of the userInfo object stored after login.
// Staff/admin and cadet have slightly different fields.
export interface UserInfo {
  displayName:   string
  email:         string
  uid:           string
  // Staff / admin only
  periodIds?:    string[]
  // Cadet only
  periodId?:     string
  teacherEmail?: string
  schoolYearId?: string
}

export interface AuthComposable {
  // State
  isAuthenticated:       ComputedRef<boolean>
  userRole:              ComputedRef<string>
  userInfo:              ComputedRef<UserInfo | null>

  // Role checks
  isCadet:               ComputedRef<boolean>
  isCivilian:            ComputedRef<boolean>
  isParent:              ComputedRef<boolean>
  isStaff:               ComputedRef<boolean>
  isTeacher:             ComputedRef<boolean>
  isAdmin:               ComputedRef<boolean>
  isAudit:               ComputedRef<boolean>

  // Admin emulation
  emulatingEmail:        ComputedRef<string | null>
  effectiveTeacherEmail: ComputedRef<string | undefined>
  startEmulation:        (teacherEmail: string) => void
  stopEmulation:         () => void

  // Auth actions
  login:                 (role: string, info?: UserInfo | null) => void
  logout:                () => Promise<void>
  initializeAuth:        () => void
}

declare module '@/composables/useAuth.js' {
  export function useAuth(): AuthComposable
}
