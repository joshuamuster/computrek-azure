/**
 * One-time script: creates Firebase Auth accounts + Firestore approvedUsers docs
 * for all 27 students in Mr. Muster's 7th Period class (Intro to Computer Science).
 *
 * Run from the project root:
 *   node scripts/add-period7-students.mjs
 *
 * Email convention:  {firstname}.{lastname}{last2ofStudentId}@computrek.local
 * Password:          {firstname}{last4ofStudentId}
 * Password-change flag is set to true so students are prompted on first login.
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)
const projectRoot = resolve(__dirname, '..')

const require = createRequire(import.meta.url)

const admin = require(resolve(projectRoot, 'functions/node_modules/firebase-admin/lib/index.js'))
const key   = require(resolve(projectRoot, 'serviceAccountKey.json'))

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(key) })
}

const db   = admin.firestore()
const auth = admin.auth()

// ── Period config ─────────────────────────────────────────────────────────────

const TEACHER_EMAIL  = 'joshuamusterfusd@gmail.com'
const PERIOD_ID      = 'period-7'
const SCHOOL_YEAR_ID = '2025-2026'

// ── Student roster (from Fresno USD gradebook, Period 07) ─────────────────────
// Format: { displayName, studentId }
// Email  → {first}.{last}{id[-2:]}@computrek.local
// Pass   → {first}{id[-4:]}

const STUDENTS = [
  { displayName: 'Jude Bush',               studentId: '670823' },
  { displayName: 'Isabella Castro',          studentId: '672944' },
  { displayName: 'Emmanuel Del Angel',       studentId: '693066' },
  { displayName: 'Juan Delgado Carrillo',    studentId: '673305' },
  { displayName: 'Noah Diaz',               studentId: '669670' },
  { displayName: 'Ayden Gastelum',          studentId: '683745' },
  { displayName: 'Matilda Gonzalez',        studentId: '661749' },
  { displayName: 'David Henning',           studentId: '674101' },
  { displayName: 'Olive Hiebert',           studentId: '697942' },
  { displayName: "Safrin Jaurique",         studentId: '696633' },
  { displayName: 'Allison Maldonado Serrato', studentId: '671375' },
  { displayName: 'Jayden Medrano',          studentId: '686131' },
  { displayName: 'Terence Men',             studentId: '695521' },
  { displayName: 'Sofia Miramontes',        studentId: '679671' },
  { displayName: 'Alex Montes Lopez',       studentId: '671473' },
  { displayName: 'Brandon Mora',            studentId: '645920' },
  { displayName: 'Edwin Navarrete',         studentId: '661805' },
  { displayName: 'Azalea Pallares Garcia',  studentId: '747018' },
  { displayName: 'Jimena Perez',            studentId: '669034' },
  { displayName: 'Rodrigo Ramirez Lopez',   studentId: '673450' },
  { displayName: 'Jayden Reyes',            studentId: '667081' },
  { displayName: 'Lilybeth Rodriguez',      studentId: '673468' },
  { displayName: 'Urijah Rodriguez',        studentId: '716365' },
  { displayName: "Jah'Zyia Sears",         studentId: '712914' },
  { displayName: 'Holden Waterbury',        studentId: '661717' },
  { displayName: 'Nakaylyn Xiong',          studentId: '684223' },
  { displayName: 'Jana Zedan',             studentId: '712643' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strips everything except a-z from a string and lowercases it. */
function alphaOnly(str) {
  return str.toLowerCase().replace(/[^a-z]/g, '')
}

/** Builds email and default password from a student record. */
function buildCredentials({ displayName, studentId }) {
  const parts     = displayName.split(' ')
  const firstName = alphaOnly(parts[0])
  const lastName  = alphaOnly(parts.slice(1).join(''))   // compound last names concat'd
  const suffix2   = studentId.slice(-2)
  const suffix4   = studentId.slice(-4)
  return {
    email:    `${firstName}.${lastName}${suffix2}@computrek.local`,
    password: `${firstName}${suffix4}`,
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`CompuTrek — Period 7 bulk student import\n`)
console.log(`Teacher : ${TEACHER_EMAIL}`)
console.log(`Period  : ${PERIOD_ID}`)
console.log(`Students: ${STUDENTS.length}\n`)

let created = 0, skipped = 0, failed = 0

for (const student of STUDENTS) {
  const { email, password } = buildCredentials(student)
  const username = email.split('@')[0]

  process.stdout.write(`  ${student.displayName.padEnd(30)} ${username.padEnd(32)}`)

  // ── 1. Firebase Auth ───────────────────────────────────────────────────────
  let authSkipped = false
  try {
    await auth.createUser({ email, password, displayName: student.displayName })
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      authSkipped = true
    } else {
      console.log(`  ✕  Auth error: ${e.message}`)
      failed++
      continue
    }
  }

  // ── 2. Firestore approvedUsers doc ─────────────────────────────────────────
  const docRef   = db.collection('approvedUsers').doc(email)
  const existing = await docRef.get()

  if (existing.exists) {
    console.log(`  —  already exists`)
    skipped++
    continue
  }

  try {
    await docRef.set({
      displayName:            student.displayName,
      role:                   'cadet',
      periodId:               PERIOD_ID,
      teacherEmail:           TEACHER_EMAIL,
      schoolYearId:           SCHOOL_YEAR_ID,
      studentId:              student.studentId,
      conductScore:           4,
      autoApproved:           false,
      requiresPasswordChange: true,
      createdAt:              admin.firestore.FieldValue.serverTimestamp(),
    })
    console.log(`  ✓${authSkipped ? ' (auth existed)' : ''}`)
    created++
  } catch (e) {
    console.log(`  ✕  Firestore error: ${e.message}`)
    failed++
  }
}

console.log(`\n── Summary ──────────────────────────────────────────────────────`)
console.log(`  ✓ Created : ${created}`)
console.log(`  — Skipped : ${skipped}`)
console.log(`  ✕ Failed  : ${failed}`)

if (created > 0) {
  console.log(`
Next steps:
  1. Students log in at the app with their username (e.g. "jude.bush23")
     and their default password ({firstname}{last4 of student ID}, e.g. "jude0823").
  2. They will be prompted to set a new password on first login.
  3. Use Admin → Settings to view, edit, or reset any account.
  4. Use Admin → Missions to assign work to Period 7.
`)
}

process.exit(failed > 0 ? 1 : 0)
