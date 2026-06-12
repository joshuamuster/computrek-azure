/**
 * One-time script: adds jashua.masters@computrek.local to Period 2 (Demo)
 * as a cadet in the approvedUsers Firestore collection.
 *
 * Run from the project root:
 *   node scripts/add-student-account.mjs
 *
 * Requirements: your machine must be able to reach firestore.googleapis.com
 * (i.e. run this from your laptop, not a sandboxed environment).
 */

const PROJECT = 'computrekcs'
const API_KEY = 'AIzaSyBYnvhedPQp5tPzlBp4iRLi0WyFDRS79zI'
const BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

const CADET_EMAIL   = 'jashua.masters@computrek.local'
const TARGET_PERIOD = 'period-2'
const SCHOOL_YEAR   = '2025-2026'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function firestoreGet(path) {
  const res = await fetch(`${BASE}/${path}?key=${API_KEY}`)
  return res.json()
}

async function firestorePatch(path, fields) {
  const res = await fetch(`${BASE}/${path}?key=${API_KEY}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  })
  return res.json()
}

async function firestoreQuery(collectionId, filters) {
  const toFilter = ([field, op, value]) => ({
    fieldFilter: {
      field: { fieldPath: field },
      op,
      value: typeof value === 'boolean'
        ? { booleanValue: value }
        : { stringValue: value },
    }
  })

  const where = filters.length === 1
    ? toFilter(filters[0])
    : { compositeFilter: { op: 'AND', filters: filters.map(toFilter) } }

  const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ structuredQuery: { from: [{ collectionId }], where } }),
  })
  const rows = await res.json()
  return rows.filter(r => r.document).map(r => ({
    id:     r.document.name.split('/').pop(),
    fields: r.document.fields,
  }))
}

function str(fields, key)  { return fields[key]?.stringValue  ?? '' }
function bool(fields, key) { return fields[key]?.booleanValue ?? false }
function arr(fields, key)  { return fields[key]?.arrayValue?.values?.map(v => v.stringValue) ?? [] }

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('CompuTrek — add student account\n')

// 1. Find the teacher for period-2
console.log(`Looking for a staff account that teaches ${TARGET_PERIOD}…`)
const staffDocs = await firestoreQuery('approvedUsers', [['role', 'EQUAL', 'staff']])
const teachers  = staffDocs.filter(d => arr(d.fields, 'periodIds').includes(TARGET_PERIOD))

if (!teachers.length) {
  console.error(`✕  No staff account found with ${TARGET_PERIOD} in periodIds.`)
  console.error('   Go to /admin/users and make sure your teacher account has Period 2 checked.')
  process.exit(1)
}

const teacher = teachers[0]
const teacherEmail = teacher.id
console.log(`✓  Teacher: ${str(teacher.fields, 'displayName')} (${teacherEmail})`)

// 2. Check whether the student doc already exists
console.log(`\nChecking for existing doc: approvedUsers/${CADET_EMAIL}…`)
const existing = await firestoreGet(`approvedUsers/${encodeURIComponent(CADET_EMAIL)}`)

if (!existing.error) {
  console.log('✓  Document already exists:')
  console.log(`   displayName:  ${str(existing.fields, 'displayName')}`)
  console.log(`   role:         ${str(existing.fields, 'role')}`)
  console.log(`   periodId:     ${str(existing.fields, 'periodId')}`)
  console.log(`   teacherEmail: ${str(existing.fields, 'teacherEmail')}`)
  console.log(`   uid:          ${str(existing.fields, 'uid') || '(not set yet — will be written on first login)'}`)
  console.log('\nNothing to do. You can log in now.')
  process.exit(0)
}

// 3. Create the document
console.log('\nCreating approvedUsers document…')
const result = await firestorePatch(
  `approvedUsers/${encodeURIComponent(CADET_EMAIL)}`,
  {
    displayName:            { stringValue:  'Joshua Masters' },
    role:                   { stringValue:  'cadet' },
    periodId:               { stringValue:  TARGET_PERIOD },
    teacherEmail:           { stringValue:  teacherEmail },
    schoolYearId:           { stringValue:  SCHOOL_YEAR },
    autoApproved:           { booleanValue: false },
    requiresPasswordChange: { booleanValue: false },
    conductScore:           { integerValue: '4' },
  }
)

if (result.error) {
  console.error('✕  Firestore write failed:', result.error.message)
  process.exit(1)
}

console.log('✓  approvedUsers doc created successfully!')
console.log(`   ${CADET_EMAIL}  →  ${TARGET_PERIOD}  /  teacher: ${teacherEmail}`)
console.log(`
Next steps:
  1. Log in at the app as username "jashua.masters" (password = whatever you set in Firebase Auth).
     The uid will be written to Firestore automatically on that first login.
  2. Back as admin, go to /admin/missions and assign some missions to Period 2.
  3. Log back in as jashua.masters — the dashboard will show the assigned work.
`)
