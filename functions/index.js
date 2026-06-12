const { onRequest }   = require('firebase-functions/v2/https')
const { onSchedule }  = require('firebase-functions/v2/scheduler')
const { initializeApp } = require('firebase-admin/app')
const { getAuth }     = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

initializeApp()

/**
 * Resets a cadet's Firebase Auth password back to the default formula
 * (lowercase first name + last 2 digits of student ID) and flags the account
 * for a forced password change on next login.
 *
 * Callable by staff and admin accounts only.
 * POST body: { email: string }
 * Returns:   { displayName: string, defaultPassword: string }
 */
exports.resetCadetPassword = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  const authHeader = (req.headers.authorization || '')
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthenticated. Must be signed in.' })
    return
  }

  let callerEmail
  try {
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7))
    callerEmail = decoded.email
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token.' })
    return
  }

  if (!callerEmail) {
    res.status(403).json({ error: 'No email in token.' })
    return
  }

  const db = getFirestore()

  const callerSnap = await db.collection('approvedUsers').doc(callerEmail).get()
  if (!callerSnap.exists || !['admin', 'staff'].includes(callerSnap.data().role)) {
    res.status(403).json({ error: 'Only staff and admins can reset passwords.' })
    return
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const { email } = req.body
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'email is required.' })
    return
  }

  // ── Look up the student ───────────────────────────────────────────────────
  const studentSnap = await db.collection('approvedUsers').doc(email).get()
  if (!studentSnap.exists) {
    res.status(404).json({ error: `No approvedUsers record for: ${email}` })
    return
  }

  const data = studentSnap.data()
  if (data.role !== 'cadet') {
    res.status(400).json({ error: 'Only cadet passwords can be reset this way.' })
    return
  }

  const displayName = data.displayName || ''
  const studentId   = String(data.studentId || '')
  if (!studentId) {
    res.status(400).json({
      error: 'No studentId on this record — cannot derive a default password.'
    })
    return
  }

  // ── Derive default password ───────────────────────────────────────────────
  const firstName       = displayName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
  const defaultPassword = firstName + studentId.slice(-4)

  // ── Reset Auth password ───────────────────────────────────────────────────
  const firebaseAuth = getAuth()
  const user = await firebaseAuth.getUserByEmail(email)
  await firebaseAuth.updateUser(user.uid, { password: defaultPassword })

  // ── Flag for forced reset on next login ───────────────────────────────────
  await db.collection('approvedUsers').doc(email).update({ requiresPasswordChange: true })

  res.json({ displayName, defaultPassword })
})

// ── resetDemoStudents ─────────────────────────────────────────────────────────
//
// Runs every night at midnight (America/Los_Angeles) and resets all 10 demo
// cadet accounts back to their fresh seed state so each new day starts clean.
//
// What it does per student:
//   1. Delete all submissions  (teacherEmail == 'demo@computrekcs.demo')
//   2. Delete all conductEntries (teacherEmail == 'demo@computrekcs.demo')
//   3. Delete all typingResults (uid in demoUids)
//   4. Re-create seeded submissions (4 statuses) + conduct entries (score → 3)
//   5. Reset approvedUsers.conductScore back to 3
//
// Also resets demo/state.nextSlot to 0 so the rotation starts fresh.

exports.resetDemoStudents = onSchedule(
  { schedule: '0 0 * * *', timeZone: 'America/Los_Angeles' },
  async () => {
    const db = getFirestore()

    const DEMO_TEACHER_EMAIL = 'demo@computrekcs.demo'
    const DEMO_PERIOD_ID     = 'demo-period'
    const SCHOOL_YEAR_ID     = '2025-2026'
    const QUARTER_ID         = '2026-Q4'

    // ── Load demo account metadata from demo/state ──────────────────────────
    const stateSnap = await db.collection('demo').doc('state').get()
    if (!stateSnap.exists) {
      console.error('[resetDemo] demo/state not found — run seed-demo.mjs first')
      return
    }

    const accounts = stateSnap.data().accounts  // [{slot, email, uid, displayName}]

    // ── Date helpers ─────────────────────────────────────────────────────────
    const dateOffset = (days) => {
      const d = new Date()
      d.setDate(d.getDate() + days)
      return d.toISOString().slice(0, 10)
    }
    const daysAgo = (n) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d
    }
    const ts = (date) => require('firebase-admin/firestore').Timestamp
      ? require('firebase-admin/firestore').Timestamp.fromDate(date)
      : FieldValue.serverTimestamp()

    // ── Helper: delete a Firestore query in batches of 400 ──────────────────
    const deleteQuery = async (q) => {
      const snap  = await q.get()
      if (snap.empty) return
      const batch = db.batch()
      snap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
    }

    // ── 1. Delete all demo submissions ───────────────────────────────────────
    await deleteQuery(
      db.collection('submissions')
        .where('teacherEmail', '==', DEMO_TEACHER_EMAIL)
    )
    console.log('[resetDemo] submissions deleted')

    // ── 2. Delete all demo conductEntries ────────────────────────────────────
    await deleteQuery(
      db.collection('conductEntries')
        .where('teacherEmail', '==', DEMO_TEACHER_EMAIL)
    )
    console.log('[resetDemo] conductEntries deleted')

    // ── 3. Delete typingResults for each demo UID ────────────────────────────
    for (const acct of accounts) {
      await deleteQuery(
        db.collection('typingResults')
          .where('uid', '==', acct.uid)
      )
    }
    console.log('[resetDemo] typingResults deleted')

    // ── 4. Re-seed per-student data ──────────────────────────────────────────
    const submissionTemplates = [
      { assignmentId: 'demo-assignment-assigned', missionId: 'demo-mission-assigned', type: 'file', status: 'assigned',  submittedAt: null },
      { assignmentId: 'demo-assignment-awaiting', missionId: 'demo-mission-awaiting', type: 'file', status: 'submitted', submittedAt: daysAgo(1) },
      { assignmentId: 'demo-assignment-overdue',  missionId: 'demo-mission-overdue',  type: 'game', status: 'assigned',  submittedAt: null },
      { assignmentId: 'demo-assignment-lost',     missionId: 'demo-mission-lost',     type: 'file', status: 'assigned',  submittedAt: null },
    ]

    const conductTemplates = [
      { daysAgo: 5, type: 'positive', reason: 'participation', scoreDelta: 1,  scoreAfter: 1, note: 'Great discussion contributions today.' },
      { daysAgo: 4, type: 'positive', reason: 'effort',        scoreDelta: 1,  scoreAfter: 2, note: 'Stayed focused for the entire period.' },
      { daysAgo: 3, type: 'positive', reason: 'onTask',        scoreDelta: 1,  scoreAfter: 3, note: 'On task and helping classmates.' },
      { daysAgo: 2, type: 'negative', reason: 'onTask',        scoreDelta: -1, scoreAfter: 2, note: 'Off task during independent work time.' },
      { daysAgo: 1, type: 'positive', reason: 'respect',       scoreDelta: 1,  scoreAfter: 3, note: 'Showed great respect for peers today.' },
    ]

    // Re-seed assignments with fresh relative due dates
    const assignmentUpdates = [
      { id: 'demo-assignment-assigned', dueDate: dateOffset(10)  },
      { id: 'demo-assignment-awaiting', dueDate: dateOffset(5)   },
      { id: 'demo-assignment-overdue',  dueDate: dateOffset(-3)  },
      { id: 'demo-assignment-lost',     dueDate: dateOffset(-16) },
    ]

    for (const a of assignmentUpdates) {
      await db.collection('assignments').doc(a.id).update({ dueDate: a.dueDate })
    }

    for (const acct of accounts) {
      const batch = db.batch()

      // Submissions
      for (const tmpl of submissionTemplates) {
        const tag   = tmpl.assignmentId.replace('demo-assignment-', '')
        const docId = `demo-sub-${acct.email.split('.')[1].split('@')[0]}-${tag}`
        batch.set(db.collection('submissions').doc(docId), {
          ...tmpl,
          studentId:       acct.uid,
          studentName:     acct.displayName,
          periodId:        DEMO_PERIOD_ID,
          schoolYearId:    SCHOOL_YEAR_ID,
          quarterId:       QUARTER_ID,
          teacherEmail:    DEMO_TEACHER_EMAIL,
          data:            {},
          feedbackNote:    '',
          pointsEarned:    null,
          dueDateOverride: null,
          submittedAt:     tmpl.submittedAt ? FieldValue.serverTimestamp() : null,
          componentChecks: {},
          isDemo:          true,
        })
      }

      // Conduct entries
      for (const tmpl of conductTemplates) {
        const date    = daysAgo(tmpl.daysAgo)
        const dateStr = date.toISOString().slice(0, 10)
        const username = acct.email.split('.')[1].split('@')[0]
        const docId   = `demo-conduct-${username}-d${tmpl.daysAgo}`
        batch.set(db.collection('conductEntries').doc(docId), {
          studentId:    acct.uid,
          studentName:  acct.displayName,
          teacherEmail: DEMO_TEACHER_EMAIL,
          periodId:     DEMO_PERIOD_ID,
          schoolYearId: SCHOOL_YEAR_ID,
          quarterId:    QUARTER_ID,
          type:         tmpl.type,
          source:       'teacher',
          reason:       tmpl.reason,
          scoreDelta:   tmpl.scoreDelta,
          scoreAfter:   tmpl.scoreAfter,
          note:         tmpl.note,
          date:         dateStr,
          loggedAt:     FieldValue.serverTimestamp(),
          isDemo:       true,
        })
      }

      // Reset conductScore
      const email = acct.email
      batch.update(db.collection('approvedUsers').doc(email), { conductScore: 3 })

      await batch.commit()
    }

    console.log('[resetDemo] all 10 demo students re-seeded')

    // ── 5. Reset the slot counter ────────────────────────────────────────────
    await db.collection('demo').doc('state').update({ nextSlot: 0 })
    console.log('[resetDemo] slot counter reset to 0 — reset complete')
  }
)
