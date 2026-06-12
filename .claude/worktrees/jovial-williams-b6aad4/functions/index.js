const { onRequest }  = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth }    = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

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
