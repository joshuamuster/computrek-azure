/**
 * migrate-firestore-to-cosmos.mjs — one-shot data migration for Phase 2 cutover.
 *
 * Reads every Firestore collection and writes it to the matching Azure Cosmos DB
 * container (creating the database + containers with correct partition keys if
 * they don't exist yet). Timestamps are converted to the { "__ts": <epoch ms> }
 * encoding that src/data/cosmosBackend.ts expects.
 *
 * Safe to re-run: writes are upserts keyed by the original Firestore doc ID.
 *
 * Usage:
 *   node scripts/migrate-firestore-to-cosmos.mjs               # migrate everything
 *   node scripts/migrate-firestore-to-cosmos.mjs --dry-run     # count docs only
 *   node scripts/migrate-firestore-to-cosmos.mjs --only=missions,assignments
 *
 * Requires:
 *   - serviceAccountKey.json at the repo root (Firebase admin credentials)
 *   - VITE_COSMOS_ENDPOINT / VITE_COSMOS_KEY in .env (or COSMOS_ENDPOINT /
 *     COSMOS_KEY in the environment)
 *
 * ⚠ COST: the Cosmos account MUST be created in SERVERLESS capacity mode.
 *   On a provisioned-throughput account, each of the 25 containers this script
 *   creates gets a dedicated 400 RU/s allocation (~$580/month total). Serverless
 *   bills per request — classroom traffic costs a few dollars a month.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { CosmosClient } from '@azure/cosmos'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ── Collection → container mapping ────────────────────────────────────────────
// Keep in sync with CONTAINER_REGISTRY in src/data/cosmosBackend.ts and the
// inventory table in MIGRATION.md.
const REGISTRY = {
  approvedUsers:      { container: 'approvedUsers',      pk: '/periodId' },
  missions:           { container: 'missions',           pk: '/teacherEmail' },
  assignments:        { container: 'assignments',        pk: '/periodId' },
  submissions:        { container: 'submissions',        pk: '/studentId' },
  typingResults:      { container: 'typingResults',      pk: '/uid' },
  typingLessons:      { container: 'typingLessons',      pk: '/section' },
  typingCustomTexts:  { container: 'typingCustomTexts',  pk: '/teacherEmail' },
  gameScores:         { container: 'gameScores',         pk: '/periodId' },
  game_rooms:         { container: 'gameRooms',          pk: '/gameType' },
  challenges:         { container: 'challenges',         pk: '/periodId' },
  conductEntries:     { container: 'conductEntries',     pk: '/studentId' },
  conductRatings:     { container: 'conductRatings',     pk: '/studentId' },
  activityLogs:       { container: 'activityLogs',       pk: '/uid' },
  shipStatus:         { container: 'shipStatus',         pk: '/id' },
  periods:            { container: 'periods',            pk: '/schoolYearId' },
  seatingCharts:      { container: 'seatingCharts',      pk: '/periodId' },
  challengeSettings:  { container: 'challengeSettings',  pk: '/id' },
  timerState:         { container: 'timerState',         pk: '/id' },
  champsState:        { container: 'champsState',        pk: '/id' },
  periodStats:        { container: 'periodStats',        pk: '/id' },
  missionCards:       { container: 'missionCards',       pk: '/id' },
  gradebookSnapshots: { container: 'gradebookSnapshots', pk: '/id' },
  gradebookOrder:     { container: 'gradebookOrder',     pk: '/id' },
  activeTestSessions: { container: 'activeTestSessions', pk: '/id' },
  demo:               { container: 'demo',               pk: '/id' },
}

// ── CLI args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const onlyArg = args.find(a => a.startsWith('--only='))
const ONLY = onlyArg ? onlyArg.slice(7).split(',').map(s => s.trim()) : null

// ── Env (.env at repo root, minimal parser — no dotenv dependency) ────────────
function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  const env = { ...process.env }
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

const env = loadEnv()
const COSMOS_ENDPOINT = env.COSMOS_ENDPOINT || env.VITE_COSMOS_ENDPOINT
const COSMOS_KEY      = env.COSMOS_KEY      || env.VITE_COSMOS_KEY

if (!DRY_RUN && (!COSMOS_ENDPOINT || !COSMOS_KEY)) {
  console.error('Set VITE_COSMOS_ENDPOINT and VITE_COSMOS_KEY in .env (or COSMOS_ENDPOINT/COSMOS_KEY env vars).')
  process.exit(1)
}

// ── Firestore (admin) ──────────────────────────────────────────────────────────
const keyPath = path.join(ROOT, 'serviceAccountKey.json')
if (!existsSync(keyPath)) {
  console.error('serviceAccountKey.json not found at repo root.')
  process.exit(1)
}
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
const firestore = getFirestore()

// ── Value conversion (Firestore admin types → Cosmos JSON) ────────────────────
function convert(v) {
  if (v === null || v === undefined) return v
  // Admin SDK Timestamp (duck-typed — instanceof is fragile across versions)
  if (typeof v === 'object' && typeof v.toMillis === 'function' && 'seconds' in v) {
    return { __ts: v.toMillis() }
  }
  if (v instanceof Date) return { __ts: v.getTime() }
  if (Array.isArray(v)) return v.map(convert)
  if (typeof v === 'object') {
    // GeoPoint / DocumentReference are not used by the app; serialize defensively
    if (typeof v.path === 'string' && typeof v.firestore === 'object') return v.path
    const out = {}
    for (const [k, val] of Object.entries(v)) {
      if (val === undefined) continue
      out[k] = convert(val)
    }
    return out
  }
  return v
}

// Cosmos item ids must not contain / \ ? #
function assertValidId(coll, id) {
  if (/[/\\?#]/.test(id)) {
    throw new Error(`${coll}/${id}: doc ID contains characters illegal in Cosmos (/ \\ ? #) — needs manual handling`)
  }
}

// ── Migration ──────────────────────────────────────────────────────────────────
async function main() {
  const collections = Object.keys(REGISTRY).filter(c => !ONLY || ONLY.includes(c))
  if (ONLY) {
    const unknown = ONLY.filter(c => !(c in REGISTRY))
    if (unknown.length) {
      console.error(`Unknown collection(s): ${unknown.join(', ')}`)
      process.exit(1)
    }
  }

  let database = null
  if (!DRY_RUN) {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY })
    ;({ database } = await client.databases.createIfNotExists({ id: 'computrek' }))
    console.log(`Connected to Cosmos DB: ${COSMOS_ENDPOINT} → database "computrek"\n`)
  } else {
    console.log('DRY RUN — counting Firestore docs only, nothing written.\n')
  }

  let grandTotal = 0
  for (const coll of collections) {
    const { container: containerName, pk } = REGISTRY[coll]
    const snap = await firestore.collection(coll).get()
    grandTotal += snap.size

    if (DRY_RUN) {
      console.log(`${coll.padEnd(20)} ${String(snap.size).padStart(6)} docs → ${containerName} (pk ${pk})`)
      continue
    }

    const { container } = await database.containers.createIfNotExists({
      id: containerName,
      partitionKey: { paths: [pk], kind: 'Hash' },
    })

    let written = 0
    const docs = snap.docs
    const CHUNK = 25
    for (let i = 0; i < docs.length; i += CHUNK) {
      await Promise.all(docs.slice(i, i + CHUNK).map(async d => {
        assertValidId(coll, d.id)
        const body = { id: d.id, ...convert(d.data()) }
        await container.items.upsert(body)
        written++
      }))
      process.stdout.write(`\r${coll.padEnd(20)} ${written}/${docs.length}`)
    }
    console.log(`\r${coll.padEnd(20)} ${written}/${docs.length} ✓`)
  }

  console.log(`\n${DRY_RUN ? 'Would migrate' : 'Migrated'} ${grandTotal} documents across ${collections.length} collections.`)
  if (!DRY_RUN) {
    console.log('\nNext steps:')
    console.log('  1. Spot-check a few containers in the Azure Portal Data Explorer.')
    console.log('  2. Set AZURE_DATABASE = true in src/config/featureFlags.ts.')
    console.log('  3. Test with a demo login before class.')
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('\nMigration failed:', err)
  process.exit(1)
})
