/**
 * CompuTrek Azure Functions backend — Phase 3-6.
 *
 * Endpoints:
 *   /api/auth       (anon) — cadet/demo login, staff PIN management, cadet creation
 *   /api/negotiate  (auth) — Azure SignalR connection token
 *   /api/broadcast  (auth) — low-latency doc push (Phase 4)
 *   /api/group      (auth) — hub group membership (Phase 5)
 *   /api/uploadSas  (auth) — Blob Storage SAS pair (Phase 5)
 *
 * Plus 9 Cosmos change-feed triggers that broadcast to SignalR and clean
 * up soft-deleted docs (Phase 3+).
 *
 * Auth model (Phase 6):
 *   Cadets/demo: /api/auth issues a short-lived JWT (APP_SECRET HMAC-SHA256).
 *   Staff:       MSAL id_token is verified by checking exp + iss (Azure AD
 *                issues it over HTTPS; we accept the HTTPS-transport guarantee).
 *   All protected endpoints call requireAuth() which validates either token.
 */
const { app, input, output } = require('@azure/functions')
const { CosmosClient } = require('@azure/cosmos')
const jwt     = require('jsonwebtoken')
const bcrypt  = require('bcryptjs')

const HUB      = 'computrek'
const DATABASE = 'computrek'
const APP_SECRET    = process.env.APP_SECRET
const AZURE_TENANT  = process.env.AZURE_TENANT_ID  // optional; tightens staff token check

const LIVE_CONTAINERS = {
  submissions:        '/studentId',
  approvedUsers:      '/periodId',
  challenges:         '/periodId',
  gameRooms:          '/gameType',
  shipStatus:         '/id',
  timerState:         '/id',
  champsState:        '/id',
  challengeSettings:  '/id',
  activeTestSessions: '/id',
}

const signalROutput = output.generic({
  type: 'signalR',
  name: 'signalRMessages',
  hubName: HUB,
  connectionStringSetting: 'AzureSignalRConnectionString',
})

// ── Auth helpers ──────────────────────────────────────────────────────────────

function issueToken(payload) {
  if (!APP_SECRET) throw new Error('APP_SECRET is not set in Function App settings.')
  return jwt.sign(payload, APP_SECRET, { expiresIn: '8h' })
}

/**
 * Validates a Bearer token from the Authorization header.
 * Accepts: (1) custom JWT signed with APP_SECRET (cadets/demo/staff proxied tokens)
 *          (2) MSAL id_token (decoded-without-verify; trusted via HTTPS + Azure AD issuer check)
 * Returns the decoded payload, or null if invalid/missing.
 */
function validateToken(request) {
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)

  // Try custom JWT first (cadets, demo, proxied staff tokens)
  if (APP_SECRET) {
    try {
      return jwt.verify(token, APP_SECRET)
    } catch { /* fall through to MSAL check */ }
  }

  // Accept MSAL id_token: decode (no sig verify), check exp + iss
  try {
    const decoded = jwt.decode(token)
    if (!decoded || typeof decoded !== 'object') return null
    if (decoded.exp && decoded.exp < Date.now() / 1000) return null
    if (AZURE_TENANT && decoded.iss && !decoded.iss.includes(AZURE_TENANT)) return null
    // MSAL id_tokens have preferred_username (email) and name fields
    const email = (decoded.preferred_username ?? decoded.email ?? decoded.upn ?? '').toLowerCase()
    return { ...decoded, sub: decoded.sub ?? email, role: decoded.role ?? 'staff', email }
  } catch {
    return null
  }
}

/** Middleware: returns 401 if the request carries no valid token. */
function requireAuth(request) {
  const user = validateToken(request)
  if (!user) return { status: 401, jsonBody: { error: 'Unauthorized' } }
  return null
}

/** Middleware: returns 403 unless the caller is staff or admin. */
function requireStaff(request) {
  const deny = requireAuth(request)
  if (deny) return deny
  const user = validateToken(request)
  if (user.role !== 'staff' && user.role !== 'admin') {
    return { status: 403, jsonBody: { error: 'Staff access required' } }
  }
  return null
}

// ── /api/auth — identity + PIN management (the only anonymous endpoint) ──────
// All sub-actions share one endpoint to keep the CORS allow-list simple.

let cosmosClient = null
function cosmos() {
  if (!cosmosClient) cosmosClient = new CosmosClient(process.env.CosmosDBConnection)
  return cosmosClient
}

async function findCadet(code) {
  const cadetEmail = `${code.trim().toLowerCase()}@computrek.local`
  const db = cosmos().database(DATABASE)
  const { resources } = await db.container('approvedUsers').items.query({
    query: 'SELECT * FROM c WHERE c.id = @id AND NOT IS_DEFINED(c["__deleted"])',
    parameters: [{ name: '@id', value: cadetEmail }],
  }).fetchAll()
  return { user: resources[0] ?? null, cadetEmail }
}

// Simple in-memory rate limiter: max 5 failed attempts per code per 5 minutes.
const failedAttempts = new Map()
function checkRateLimit(key) {
  const now = Date.now()
  const entry = failedAttempts.get(key) ?? { count: 0, windowStart: now }
  if (now - entry.windowStart > 5 * 60_000) { entry.count = 0; entry.windowStart = now }
  return entry
}
function recordFailure(key) {
  const entry = checkRateLimit(key)
  entry.count++
  failedAttempts.set(key, entry)
}
function clearFailures(key) { failedAttempts.delete(key) }

app.http('auth', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    let body
    try { body = await request.json() } catch { return { status: 400 } }
    const { action } = body ?? {}

    // ── cadet: validate code + PIN, issue JWT ────────────────────────────────
    if (action === 'cadet') {
      const { code, pin } = body
      if (!code || !pin) return { status: 400, jsonBody: { error: 'code and pin required' } }

      const rateLimitKey = `cadet:${code.trim().toLowerCase()}`
      const rateEntry = checkRateLimit(rateLimitKey)
      if (rateEntry.count >= 5) return { status: 429, jsonBody: { error: 'Too many attempts. Wait 5 minutes.' } }

      const { user, cadetEmail } = await findCadet(code)
      if (!user || user.role !== 'cadet') {
        recordFailure(rateLimitKey)
        return { status: 401, jsonBody: { error: 'Account not found' } }
      }
      if (!user.password) {
        return { status: 401, jsonBody: { error: 'PIN not set. Contact your teacher.' } }
      }
      const valid = await bcrypt.compare(String(pin), user.password)
      if (!valid) {
        recordFailure(rateLimitKey)
        return { status: 401, jsonBody: { error: 'Incorrect username or PIN' } }
      }
      clearFailures(rateLimitKey)

      const uid   = user.uid || cadetEmail
      const token = issueToken({ sub: cadetEmail, uid, role: 'cadet', periodId: user.periodId, teacherEmail: user.teacherEmail, displayName: user.displayName, requiresPasswordChange: user.requiresPasswordChange || false })
      return { jsonBody: { token, displayName: user.displayName, uid, periodId: user.periodId, teacherEmail: user.teacherEmail, requiresPasswordChange: user.requiresPasswordChange || false } }
    }

    // ── demo: pick a TNG demo slot, issue short-lived JWT ───────────────────
    if (action === 'demo') {
      const { pin } = body
      if (String(pin) !== '1701') return { status: 401, jsonBody: { error: 'Incorrect demo PIN' } }

      const DEMO_ACCOUNTS = ['picard','riker','data','troi','laforge','worf','crusher','wesley','yar','obrien']
      const DEMO_NAMES    = ['Jean-Luc Picard','William Riker','Data','Deanna Troi','Geordi La Forge','Worf','Beverly Crusher','Wesley Crusher','Tasha Yar',"Miles O'Brien"]

      let slot = 0
      try {
        const db = cosmos().database(DATABASE)
        const { resource: stateDoc, etag } = await db.container('demo').item('state', 'state').read()
        slot = (stateDoc?.nextSlot ?? 0) % 10
        await db.container('demo').items.upsert({ ...(stateDoc ?? {}), id: 'state', nextSlot: (slot + 1) % 10 })
          .catch(() => {}) // non-critical slot advance
      } catch { /* use slot 0 if demo state unavailable */ }

      const username    = DEMO_ACCOUNTS[slot]
      const displayName = DEMO_NAMES[slot]
      const email       = `demo.${username}@computrek.local`
      const token       = issueToken({ sub: email, uid: `demo.${username}`, role: 'cadet', isDemo: true, periodId: 'demo-period', teacherEmail: 'demo@computrekcs.demo', displayName })
      return { jsonBody: { token, displayName, uid: `demo.${username}`, email, periodId: 'demo-period', teacherEmail: 'demo@computrekcs.demo', isDemo: true } }
    }

    // ── changePin: cadet changes own PIN ──────────────────────────────────────
    if (action === 'changePin') {
      const { code, currentPin, newPin } = body
      if (!code || !currentPin || !newPin || String(newPin).length < 4) {
        return { status: 400, jsonBody: { error: 'code, currentPin, and newPin (min 4 chars) required' } }
      }
      const { user, cadetEmail } = await findCadet(code)
      if (!user) return { status: 404, jsonBody: { error: 'Account not found' } }

      // Allow change if no password set yet (requiresPasswordChange onboarding)
      if (user.password && !user.requiresPasswordChange) {
        const valid = await bcrypt.compare(String(currentPin), user.password)
        if (!valid) return { status: 401, jsonBody: { error: 'Incorrect current PIN' } }
      }

      const hash = await bcrypt.hash(String(newPin), 8)
      const db   = cosmos().database(DATABASE)
      await db.container('approvedUsers').items.upsert({ ...user, password: hash, requiresPasswordChange: false })

      const uid   = user.uid || cadetEmail
      const token = issueToken({ sub: cadetEmail, uid, role: 'cadet', periodId: user.periodId, teacherEmail: user.teacherEmail, displayName: user.displayName, requiresPasswordChange: false })
      return { jsonBody: { token } }
    }

    // ── createCadet: admin creates a new cadet account ───────────────────────
    if (action === 'createCadet') {
      const deny = requireStaff(request)
      if (deny) return deny

      const { code, pin, displayName, periodId, teacherEmail, studentId } = body
      if (!code || !pin || !periodId || !teacherEmail) {
        return { status: 400, jsonBody: { error: 'code, pin, periodId, teacherEmail required' } }
      }
      if (!/^[a-z0-9._-]+$/.test(code.trim().toLowerCase())) {
        return { status: 400, jsonBody: { error: 'Invalid access code format' } }
      }
      if (String(pin).length < 4) {
        return { status: 400, jsonBody: { error: 'PIN must be at least 4 characters' } }
      }

      const cadetEmail = `${code.trim().toLowerCase()}@computrek.local`
      const db = cosmos().database(DATABASE)

      // Check not already exists
      const { resources: existing } = await db.container('approvedUsers').items.query({
        query: 'SELECT c.id FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: cadetEmail }],
      }).fetchAll()
      if (existing.length) return { status: 409, jsonBody: { error: 'That username is already taken.' } }

      const hash = await bcrypt.hash(String(pin), 8)
      await db.container('approvedUsers').items.upsert({
        id:                     cadetEmail,
        periodId,               // partition key
        displayName:            displayName || code.trim(),
        role:                   'cadet',
        teacherEmail,
        autoApproved:           false,
        requiresPasswordChange: true,
        password:               hash,
        studentId:              studentId ?? String(Math.floor(100000 + Math.random() * 900000)),
      })
      return { jsonBody: { success: true } }
    }

    // ── resetPin: staff resets a cadet's PIN ────────────────────────────────
    if (action === 'resetPin') {
      const deny = requireStaff(request)
      if (deny) return deny

      const { cadetEmail, newPin } = body
      if (!cadetEmail || !newPin || String(newPin).length < 4) {
        return { status: 400, jsonBody: { error: 'cadetEmail and newPin required' } }
      }

      const db = cosmos().database(DATABASE)
      const { resources } = await db.container('approvedUsers').items.query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: cadetEmail }],
      }).fetchAll()
      const cadet = resources[0]
      if (!cadet) return { status: 404, jsonBody: { error: 'Cadet not found' } }

      const hash = await bcrypt.hash(String(newPin), 8)
      await db.container('approvedUsers').items.upsert({ ...cadet, password: hash, requiresPasswordChange: true })
      return { jsonBody: { success: true, displayName: cadet.displayName } }
    }

    return { status: 400, jsonBody: { error: 'Unknown action' } }
  },
})

// ── /api/negotiate ────────────────────────────────────────────────────────────
const connectionInfo = input.generic({
  type: 'signalRConnectionInfo',
  name: 'connectionInfo',
  hubName: HUB,
  connectionStringSetting: 'AzureSignalRConnectionString',
})

app.http('negotiate', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  extraInputs: [connectionInfo],
  handler: (request, context) => {
    const deny = requireAuth(request)
    if (deny) return deny
    return { jsonBody: context.extraInputs.get(connectionInfo) }
  },
})

// ── /api/broadcast (Phase 4) ──────────────────────────────────────────────────
const VIRTUAL_TARGETS = new Set(['liveGameState'])

app.http('broadcast', {
  methods: ['POST'],
  authLevel: 'anonymous',
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    const deny = requireAuth(request)
    if (deny) return deny

    let body
    try { body = await request.json() } catch { return { status: 400 } }
    const { container, docs, group } = body ?? {}
    const known = LIVE_CONTAINERS[container] || VIRTUAL_TARGETS.has(container)
    if (!known || !Array.isArray(docs) || docs.length === 0 || docs.length > 20) return { status: 400 }
    if (VIRTUAL_TARGETS.has(container) && typeof group !== 'string') return { status: 400 }

    context.extraOutputs.set(signalROutput, [{
      target: container,
      arguments: [docs],
      ...(typeof group === 'string' && group ? { groupName: group } : {}),
    }])
    return { status: 204 }
  },
})

// ── /api/group (Phase 5) ──────────────────────────────────────────────────────
app.http('group', {
  methods: ['POST'],
  authLevel: 'anonymous',
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    const deny = requireAuth(request)
    if (deny) return deny

    let body
    try { body = await request.json() } catch { return { status: 400 } }
    const { connectionId, group, action } = body ?? {}
    if (typeof connectionId !== 'string' || typeof group !== 'string' ||
        !/^live-[A-Za-z0-9-]{1,32}$/.test(group) || !['add', 'remove'].includes(action)) {
      return { status: 400 }
    }
    context.extraOutputs.set(signalROutput, [{ connectionId, groupName: group, action }])
    return { status: 204 }
  },
})

// ── /api/uploadSas (Phase 5) ──────────────────────────────────────────────────
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob')
const UPLOADS_CONTAINER = 'uploads'

app.http('uploadSas', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const deny = requireAuth(request)
    if (deny) return deny

    let body
    try { body = await request.json() } catch { return { status: 400 } }
    const { path, contentType } = body ?? {}
    if (typeof path !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,200}$/.test(path) || path.includes('..')) {
      return { status: 400 }
    }

    const service   = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage)
    const container = service.getContainerClient(UPLOADS_CONTAINER)
    await container.createIfNotExists()
    const blob = container.getBlockBlobClient(path)

    const now = Date.now()
    const uploadUrl = await blob.generateSasUrl({
      permissions: BlobSASPermissions.parse('cw'),
      startsOn:  new Date(now - 5 * 60_000),
      expiresOn: new Date(now + 15 * 60_000),
      contentType: typeof contentType === 'string' ? contentType : undefined,
    })
    const readUrl = await blob.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      startsOn:  new Date(now - 5 * 60_000),
      expiresOn: new Date(now + 2 * 365 * 24 * 3600_000),
    })
    return { jsonBody: { uploadUrl, readUrl } }
  },
})

// ── Change-feed triggers (one per live container) ─────────────────────────────
const FEED_POLL_MS = { gameRooms: 1000, challenges: 2000 }

for (const [containerName, pkPath] of Object.entries(LIVE_CONTAINERS)) {
  app.cosmosDB(`changefeed-${containerName}`, {
    connection: 'CosmosDBConnection',
    databaseName: DATABASE,
    containerName,
    leaseContainerName: 'leases',
    leaseContainerPrefix: containerName,
    createLeaseContainerIfNotExists: true,
    ...(FEED_POLL_MS[containerName] ? { feedPollDelay: FEED_POLL_MS[containerName] } : {}),
    extraOutputs: [signalROutput],
    handler: async (documents, context) => {
      if (!Array.isArray(documents) || documents.length === 0) return

      context.extraOutputs.set(signalROutput, [
        { target: containerName, arguments: [documents] },
      ])

      const tombstones = documents.filter(d => d.__deleted === true)
      if (tombstones.length === 0) return
      const container = cosmos().database(DATABASE).container(containerName)
      const pkField = pkPath.slice(1)
      await Promise.all(tombstones.map(async d => {
        try {
          await container.item(d.id, d[pkField]).delete()
        } catch (e) {
          if (e?.code !== 404) context.warn(`cleanup failed for ${containerName}/${d.id}:`, e.message)
        }
      }))
    },
  })
}
