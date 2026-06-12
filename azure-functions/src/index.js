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

// ── Change-feed triggers (one per live container) ──────────────────────────────
let cosmosClient = null
function cosmos() {
  if (!cosmosClient) cosmosClient = new CosmosClient(process.env.CosmosDBConnection)
  return cosmosClient
}

for (const [containerName, pkPath] of Object.entries(LIVE_CONTAINERS)) {
  app.cosmosDB(`changefeed-${containerName}`, {
    connection: 'CosmosDBConnection',
    databaseName: DATABASE,
    containerName,
    leaseContainerName: 'leases',
    leaseContainerPrefix: containerName,
    createLeaseContainerIfNotExists: true,
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
