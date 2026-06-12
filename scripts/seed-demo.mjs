/**
 * seed-demo.mjs
 *
 * One-time script that provisions the 10 pre-provisioned demo cadet accounts
 * (TNG main characters) and seeds them with realistic starter data:
 *   • 4 missions covering all board columns (Assigned / Awaiting Grade /
 *     Overdue / Lost in Space)
 *   • 5 conduct entries that net to a score of 3 (green / Good)
 *   • demo/state counter document for slot rotation
 *
 * Run once from the project root:
 *   node scripts/seed-demo.mjs
 *
 * Prerequisites:
 *   1. Download your Firebase service account key:
 *      Firebase Console → Project Settings → Service Accounts
 *      → Generate New Private Key → save as `serviceAccountKey.json`
 *      in the project root (already in .gitignore — do NOT commit it).
 *   2. npm install firebase-admin (already a functions dependency — or run
 *      `npm install --prefix functions` and adjust the path below if needed).
 *
 * Safe to re-run: existing demo docs are overwritten, not duplicated.
 */

import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)

// ── Firebase Admin init ───────────────────────────────────────────────────────

const admin     = require(path.join(__dirname, '../functions/node_modules/firebase-admin'))
const serviceAccount = JSON.parse(
  readFileSync(path.join(__dirname, '../serviceAccountKey.json'), 'utf8')
)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const auth = admin.auth()
const db   = admin.firestore()

// ── Constants ─────────────────────────────────────────────────────────────────

const DEMO_TEACHER_EMAIL = 'demo@computrekcs.demo'
const DEMO_PERIOD_ID     = 'demo-period'
const SCHOOL_YEAR_ID     = '2025-2026'
const QUARTER_ID         = '2026-Q4'
const DEMO_PASSWORD      = 'demo1701'

// The 10 TNG main characters
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
]

// Helper: YYYY-MM-DD, offset days from today
function dateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Helper: Firestore Timestamp from a Date
function ts(date) {
  return admin.firestore.Timestamp.fromDate(date)
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

// ── Step 1: Create Firebase Auth accounts + approvedUsers docs ────────────────

async function provisionAccounts() {
  console.log('\n── Provisioning Firebase Auth accounts ──')
  const uids = {}

  for (const acct of DEMO_ACCOUNTS) {
    const email = `demo.${acct.username}@computrek.local`

    // Create or reset the Auth account
    let uid
    try {
      const existing = await auth.getUserByEmail(email)
      uid = existing.uid
      await auth.updateUser(uid, { password: DEMO_PASSWORD, displayName: acct.displayName })
      console.log(`  ✓ updated   ${email}  (${uid})`)
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        const created = await auth.createUser({
          email,
          password:    DEMO_PASSWORD,
          displayName: acct.displayName,
        })
        uid = created.uid
        console.log(`  ✓ created   ${email}  (${uid})`)
      } else {
        throw e
      }
    }

    uids[acct.slot] = uid

    // approvedUsers doc — the cadet profile
    await db.collection('approvedUsers').doc(email).set({
      displayName:  acct.displayName,
      email,
      uid,
      role:         'cadet',
      periodId:     DEMO_PERIOD_ID,
      teacherEmail: DEMO_TEACHER_EMAIL,
      conductScore: 3,          // starts at 3 pips (green / Good)
      schoolYearId: SCHOOL_YEAR_ID,
      isDemo:       true,       // flag for reset function
    }, { merge: true })
  }

  return uids
}

// ── Step 2: Create 4 demo missions (shared by all demo students) ──────────────

async function provisionMissions() {
  console.log('\n── Provisioning demo missions ──')

  const missions = [
    {
      id:    'demo-mission-assigned',
      title: 'Holodeck Simulation Protocol',
      summary: 'Design a holodeck safety program.',
      description: 'Using your knowledge of computer science fundamentals, design a safety interlock system for a holodeck simulation. Document your design choices and testing methodology.',
      type:           'file',
      deliveryItems:  [{ kind: 'paper', submissionMethod: 'manual', name: 'Design Document' }],
      pointsPossible: 100,
      rubric:         [],
      attachments:    [],
      teacherEmail:   DEMO_TEACHER_EMAIL,
      archived:       false,
      unitId:         null,
    },
    {
      id:    'demo-mission-awaiting',
      title: 'LCARS Interface Design',
      summary: 'Prototype a LCARS-style user interface.',
      description: 'Research the principles behind the LCARS design language and create a prototype interface for a ship system of your choice. Include a brief written explanation of your design decisions.',
      type:           'file',
      deliveryItems:  [{ kind: 'link', submissionMethod: 'manual', label: 'Submit Figma Link' }],
      pointsPossible: 50,
      rubric:         [],
      attachments:    [],
      teacherEmail:   DEMO_TEACHER_EMAIL,
      archived:       false,
      unitId:         null,
    },
    {
      id:    'demo-mission-overdue',
      title: 'Warp Core Diagnostics',
      summary: 'Run a diagnostic sweep and document your findings.',
      description: 'Perform a Level 3 diagnostic on a simulated warp core system. Identify any anomalies in the power relay matrix and propose corrective measures using the engineering principles covered in class.',
      type:           'game',
      deliveryItems:  [{ kind: 'game', submissionMethod: 'auto', gameId: 'fractured-frontier' }],
      pointsPossible: 75,
      rubric:         [],
      attachments:    [],
      teacherEmail:   DEMO_TEACHER_EMAIL,
      archived:       false,
      unitId:         null,
    },
    {
      id:    'demo-mission-lost',
      title: 'Federation Database Query',
      summary: 'Query the Federation database using structured logic.',
      description: 'Using Boolean logic and structured query principles, retrieve specific crew records from a simulated Federation database. Submit a report documenting your query approach and the results you obtained.',
      type:           'file',
      deliveryItems:  [{ kind: 'paper', submissionMethod: 'manual', name: 'Query Report' }],
      pointsPossible: 100,
      rubric:         [],
      attachments:    [],
      teacherEmail:   DEMO_TEACHER_EMAIL,
      archived:       false,
      unitId:         null,
    },
  ]

  for (const m of missions) {
    const { id, ...data } = m
    await db.collection('missions').doc(id).set({
      ...data,
      createdAt: ts(daysAgo(30)),
    }, { merge: true })
    console.log(`  ✓ mission   ${id}`)
  }

  return missions.map(m => m.id)
}

// ── Step 3: Create 4 demo assignments ────────────────────────────────────────

async function provisionAssignments() {
  console.log('\n── Provisioning demo assignments ──')

  const assignments = [
    {
      id:          'demo-assignment-assigned',
      missionId:   'demo-mission-assigned',
      dueDate:     dateOffset(10),   // 10 days in the future → ASSIGNED column
      quarterId:   QUARTER_ID,
    },
    {
      id:          'demo-assignment-awaiting',
      missionId:   'demo-mission-awaiting',
      dueDate:     dateOffset(5),    // 5 days future, status='submitted' → AWAITING GRADE
      quarterId:   QUARTER_ID,
    },
    {
      id:          'demo-assignment-overdue',
      missionId:   'demo-mission-overdue',
      dueDate:     dateOffset(-3),   // 3 days past, status='assigned' → OVERDUE column
      quarterId:   QUARTER_ID,
    },
    {
      id:          'demo-assignment-lost',
      missionId:   'demo-mission-lost',
      dueDate:     dateOffset(-16),  // 16 days past (>7), status='assigned' → LOST IN SPACE
      quarterId:   QUARTER_ID,
    },
  ]

  for (const a of assignments) {
    const { id, ...data } = a
    await db.collection('assignments').doc(id).set({
      ...data,
      periodId:     DEMO_PERIOD_ID,
      schoolYearId: SCHOOL_YEAR_ID,
      teacherEmail: DEMO_TEACHER_EMAIL,
      assignedAt:   ts(daysAgo(20)),
    }, { merge: true })
    console.log(`  ✓ assignment  ${id}`)
  }
}

// ── Step 4: Create submissions for each demo student ─────────────────────────

async function provisionSubmissions(uids) {
  console.log('\n── Provisioning demo submissions ──')

  const submissionTemplates = [
    {
      assignmentId: 'demo-assignment-assigned',
      missionId:    'demo-mission-assigned',
      type:         'file',
      status:       'assigned',
      quarterId:    QUARTER_ID,
    },
    {
      assignmentId: 'demo-assignment-awaiting',
      missionId:    'demo-mission-awaiting',
      type:         'file',
      status:       'submitted',    // handed in → AWAITING GRADE
      quarterId:    QUARTER_ID,
    },
    {
      assignmentId: 'demo-assignment-overdue',
      missionId:    'demo-mission-overdue',
      type:         'game',
      status:       'assigned',     // not turned in, past due → OVERDUE
      quarterId:    QUARTER_ID,
    },
    {
      assignmentId: 'demo-assignment-lost',
      missionId:    'demo-mission-lost',
      type:         'file',
      status:       'assigned',     // not turned in, long past due → LOST IN SPACE
      quarterId:    QUARTER_ID,
    },
  ]

  const batch = db.batch()

  for (const acct of DEMO_ACCOUNTS) {
    const email = `demo.${acct.username}@computrek.local`
    const uid   = uids[acct.slot]

    for (const tmpl of submissionTemplates) {
      const docId = `demo-sub-${acct.username}-${tmpl.assignmentId.replace('demo-assignment-', '')}`
      const ref   = db.collection('submissions').doc(docId)
      batch.set(ref, {
        ...tmpl,
        studentId:       uid,
        studentName:     acct.displayName,
        periodId:        DEMO_PERIOD_ID,
        schoolYearId:    SCHOOL_YEAR_ID,
        teacherEmail:    DEMO_TEACHER_EMAIL,
        data:            {},
        feedbackNote:    '',
        pointsEarned:    tmpl.status === 'submitted' ? null : null,
        dueDateOverride: null,
        submittedAt:     tmpl.status === 'submitted' ? ts(daysAgo(1)) : null,
        componentChecks: {},
        isDemo:          true,
      }, { merge: true })
    }

    console.log(`  ✓ submissions for ${acct.displayName}`)
  }

  await batch.commit()
}

// ── Step 5: Create conduct entries for each demo student ─────────────────────
// 4 positive + 1 negative = mostly positive, score nets to 3

async function provisionConductEntries(uids) {
  console.log('\n── Provisioning conduct entries ──')

  const entryTemplates = [
    { daysAgo: 5, type: 'positive', reason: 'participation', scoreDelta: 1, scoreAfter: 1, note: 'Great discussion contributions today.' },
    { daysAgo: 4, type: 'positive', reason: 'effort',        scoreDelta: 1, scoreAfter: 2, note: 'Stayed focused for the entire period.' },
    { daysAgo: 3, type: 'positive', reason: 'onTask',        scoreDelta: 1, scoreAfter: 3, note: 'On task and helping classmates.' },
    { daysAgo: 2, type: 'negative', reason: 'onTask',        scoreDelta: -1, scoreAfter: 2, note: 'Off task during independent work time.' },
    { daysAgo: 1, type: 'positive', reason: 'respect',       scoreDelta: 1, scoreAfter: 3, note: 'Showed great respect for peers today.' },
  ]

  for (const acct of DEMO_ACCOUNTS) {
    const email = `demo.${acct.username}@computrek.local`
    const uid   = uids[acct.slot]
    const batch = db.batch()

    for (const tmpl of entryTemplates) {
      const date = daysAgo(tmpl.daysAgo)
      const dateStr = date.toISOString().slice(0, 10)
      const docId = `demo-conduct-${acct.username}-d${tmpl.daysAgo}`
      const ref   = db.collection('conductEntries').doc(docId)
      batch.set(ref, {
        studentId:    uid,
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
        loggedAt:     ts(date),
        isDemo:       true,
      })
    }

    await batch.commit()
    console.log(`  ✓ conduct entries for ${acct.displayName}`)
  }
}

// ── Step 6: Create demo/state counter doc ────────────────────────────────────

async function provisionDemoState(uids) {
  console.log('\n── Provisioning demo/state ──')
  await db.collection('demo').doc('state').set({
    nextSlot: 0,
    // Store account metadata so the reset function can look up UIDs cheaply
    accounts: DEMO_ACCOUNTS.map(acct => ({
      slot:         acct.slot,
      email:        `demo.${acct.username}@computrek.local`,
      uid:          uids[acct.slot],
      displayName:  acct.displayName,
    })),
  })
  console.log('  ✓ demo/state  (nextSlot: 0, 10 accounts stored)')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   CompuTrek Demo Seed Script             ║')
  console.log('╚══════════════════════════════════════════╝')

  try {
    const uids = await provisionAccounts()
    await provisionMissions()
    await provisionAssignments()
    await provisionSubmissions(uids)
    await provisionConductEntries(uids)
    await provisionDemoState(uids)

    console.log('\n✅  All done! Demo environment is ready.')
    console.log('   10 TNG cadet accounts seeded with missions + conduct data.')
    console.log('   The resetDemoStudents Cloud Function will reset them each midnight.')
    console.log('\n   Next steps:')
    console.log('   1. Deploy the reset Cloud Function: npm run deploy')
    console.log('   2. Test by signing in with PIN 1701 at computrekcs.web.app')
  } catch (e) {
    console.error('\n❌  Seed failed:', e)
    process.exit(1)
  }

  process.exit(0)
}

main()
