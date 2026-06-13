/**
 * CompuTrek Phase 3 — real-time backend.
 *
 * Two responsibilities:
 *
 * 1. /api/negotiate — hands browsers an Azure SignalR connection token.
 *    The Vue app's SignalR client (src/data/realtime.ts) calls this
 *    automatically when it connects.
 *
 * 2. Change-feed fan-out — one Cosmos DB trigger per live-subscribed
 *    container. Whenever documents change, they are broadcast to all
 *    connected clients on a hub target named after the container. The
 *    client matches each doc against its active onSnapshot queries locally.
 *
 * Also cleans up soft-deleted docs: the Cosmos change feed cannot emit hard
 * deletes, so the client marks docs { __deleted: true } (which DOES flow
 * through the feed and tells subscribers to drop the doc) and this app
 * hard-deletes them afterwards.
 *
 * Privacy note: broadcasts go to every connected client, which mirrors what
 * the pseudonymized data model already allows — documents contain student
 * codes and aliases, never real names or district emails. Locking negotiate
 * behind token validation is planned for Phase 6 (standalone MSAL).
 */
const { app, input, output } = require('@azure/functions')
const { CosmosClient } = require('@azure/cosmos')

const HUB = 'computrek'
const DATABASE = 'computrek'

// Containers with live onSnapshot subscribers in the app, with the partition
// key needed for soft-delete cleanup. Keep in sync with CONTAINER_REGISTRY in
// src/data/cosmosBackend.ts (only realtime-subscribed containers belong here).
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

// ── /api/negotiate ─────────────────────────────────────────────────────────────
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
  handler: (request, context) => ({
    jsonBody: context.extraInputs.get(connectionInfo),
  }),
})

// ── /api/broadcast (Phase 4 — low-latency path) ────────────────────────────────
// Clients POST a doc here immediately after writing it to a latency-sensitive
// container (game moves, challenges, timers, CHAMPS), so opponents see it in
// well under a second instead of after the change-feed poll. The change feed
// re-broadcasts the same doc shortly after; subscribers upsert by id, so the
// duplicate is harmless and the feed remains the consistency backstop.
//
// Trust level: anonymous, same as negotiate — clients already hold the Cosmos
// key and receive all broadcast docs, so this adds no new exposure. Endpoint
// auth (validated tokens) lands with Phase 6 alongside negotiate hardening.
// Phase 5: 'liveGameState' is a broadcast-only hub target (no Cosmos
// container behind it) carrying ephemeral per-frame game state — always
// group-scoped so it never fans out beyond the two players in a room.
const VIRTUAL_TARGETS = new Set(['liveGameState'])

app.http('broadcast', {
  methods: ['POST'],
  authLevel: 'anonymous',
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
    let body
    try { body = await request.json() } catch { return { status: 400 } }
    const { container, docs, group } = body ?? {}
    const known = LIVE_CONTAINERS[container] || VIRTUAL_TARGETS.has(container)
    if (!known || !Array.isArray(docs) || docs.length === 0 || docs.length > 20) {
      return { status: 400 }
    }
    if (VIRTUAL_TARGETS.has(container) && typeof group !== 'string') {
      return { status: 400 } // virtual targets must be group-scoped
    }
    context.extraOutputs.set(signalROutput, [{
      target: container,
      arguments: [docs],
      ...(typeof group === 'string' && group ? { groupName: group } : {}),
    }])
    return { status: 204 }
  },
})

// ── /api/group (Phase 5 — hub group membership) ────────────────────────────────
// Adds/removes a connection to a hub group (e.g. live-{joinCode} for the
// ephemeral game channel). Clients re-add themselves after reconnects.
app.http('group', {
  methods: ['POST'],
  authLevel: 'anonymous',
  extraOutputs: [signalROutput],
  handler: async (request, context) => {
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

// ── /api/uploadSas (Phase 5 — Azure Blob Storage uploads) ──────────────────────
// Returns a short-lived write SAS for one exact blob plus a long-lived read
// SAS to store on the submission. The storage account (the Function App's
// own AzureWebJobsStorage account) stays private — no public blob access.
// Paths are pseudonymous (uid + assignmentId), mirroring the privacy model.
const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob')
const UPLOADS_CONTAINER = 'uploads'

app.http('uploadSas', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    let body
    try { body = await request.json() } catch { return { status: 400 } }
    const { path, contentType } = body ?? {}
    // submissions/{year}/{uid}/{assignmentId}.{ext} — forbid traversal/weirdness
    if (typeof path !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,200}$/.test(path) || path.includes('..')) {
      return { status: 400 }
    }

    const service = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage)
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
    // Read SAS lasts two school years — same trust model as Firebase's
    // long-lived tokened download URLs (unguessable, no account access).
    const readUrl = await blob.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      startsOn:  new Date(now - 5 * 60_000),
      expiresOn: new Date(now + 2 * 365 * 24 * 3600_000),
    })

    return { jsonBody: { uploadUrl, readUrl } }
  },
})

// ── Change-feed triggers (one per live container) ──────────────────────────────
let cosmosClient = null
function cosmos() {
  if (!cosmosClient) cosmosClient = new CosmosClient(process.env.CosmosDBConnection)
  return cosmosClient
}

// Faster change-feed polling for containers backing live gameplay — this is
// the backstop behind the /broadcast fast path, so a missed broadcast still
// arrives quickly. Other containers keep the 5s default.
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

      // Broadcast first — subscribers need the __deleted marker too.
      context.extraOutputs.set(signalROutput, [
        { target: containerName, arguments: [documents] },
      ])

      // Then hard-delete soft-deleted docs (idempotent; 404 = already gone).
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
