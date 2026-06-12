// ─────────────────────────────────────────────────────────────────────────────
// src/composables/useChallengeSettings.ts
//
// Singleton that manages the `challengeSettings/{teacherEmail}` Firestore doc.
//
// Fields on the doc:
//   challengesEnabled  boolean         — master on/off toggle
//   mode               'all'|'caughtUp' — who can participate
//   caughtUpUids       string[]        — UIDs eligible when mode='caughtUp'
//   caughtUpRefreshedAt Timestamp      — when the pool was last computed
//   updatedAt          Timestamp       — last write
//
// "Caught up" means the student has no submissions with status 'assigned'
// (i.e. deployed missions they haven't turned in yet). Submitted-but-ungraded
// work does NOT block — turning it in is all we ask.
// ─────────────────────────────────────────────────────────────────────────────

import { ref, computed } from 'vue'
import {
  doc, onSnapshot, setDoc, getDocs,
  query, collection, where, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'

// ── Singleton state ───────────────────────────────────────────────────────────

const challengesEnabled    = ref(false)
const mode                 = ref<'all' | 'caughtUp'>('caughtUp')
const caughtUpUids         = ref<string[]>([])
const caughtUpRefreshedAt  = ref<Date | null>(null)

let unsub:        (() => void) | null = null
let watchedEmail: string | null = null

// ── Composable ────────────────────────────────────────────────────────────────

export function useChallengeSettings() {

  // Subscribe to a teacher's settings doc (idempotent — skips if already watching).
  function init(teacherEmail: string) {
    if (!teacherEmail || teacherEmail === watchedEmail) return
    if (unsub) unsub()
    watchedEmail = teacherEmail
    unsub = onSnapshot(doc(db, 'challengeSettings', teacherEmail), snap => {
      if (!snap.exists()) {
        challengesEnabled.value   = false
        mode.value                = 'caughtUp'
        caughtUpUids.value        = []
        caughtUpRefreshedAt.value = null
        return
      }
      const d = snap.data()
      challengesEnabled.value   = d.challengesEnabled    ?? false
      mode.value                = d.mode                 ?? 'caughtUp'
      caughtUpUids.value        = d.caughtUpUids         ?? []
      caughtUpRefreshedAt.value = d.caughtUpRefreshedAt?.toDate?.() ?? null
    })
  }

  // Master on/off toggle.
  async function setEnabled(teacherEmail: string, value: boolean) {
    await setDoc(doc(db, 'challengeSettings', teacherEmail), {
      challengesEnabled: value,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  // Switch between 'all' and 'caughtUp' modes.
  async function setMode(teacherEmail: string, value: 'all' | 'caughtUp') {
    await setDoc(doc(db, 'challengeSettings', teacherEmail), {
      mode: value,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  // Teacher-triggered refresh: compute the caught-up UID list and publish it.
  // Returns the number of eligible students.
  async function refreshCaughtUpList(teacherEmail: string): Promise<number> {
    // 1. All cadets for this teacher (across all their periods)
    const cadetsSnap = await getDocs(query(
      collection(db, 'approvedUsers'),
      where('teacherEmail', '==', teacherEmail),
      where('role', '==', 'cadet'),
    ))
    const allUids = cadetsSnap.docs
      .map(d => d.data().uid as string)
      .filter(Boolean)

    // 2. Students who have at least one unsubmitted assignment
    const blockedSnap = await getDocs(query(
      collection(db, 'submissions'),
      where('teacherEmail', '==', teacherEmail),
      where('status', '==', 'assigned'),
    ))
    const blockedUids = new Set(
      blockedSnap.docs.map(d => d.data().studentId as string).filter(Boolean)
    )

    // 3. Caught up = everyone not blocked
    const eligible = allUids.filter(uid => !blockedUids.has(uid))

    // 4. Publish
    await setDoc(doc(db, 'challengeSettings', teacherEmail), {
      caughtUpUids:        eligible,
      caughtUpRefreshedAt: serverTimestamp(),
    }, { merge: true })

    return eligible.length
  }

  return {
    challengesEnabled,
    mode,
    caughtUpUids,
    caughtUpRefreshedAt,
    init,
    setEnabled,
    setMode,
    refreshCaughtUpList,
  }
}
