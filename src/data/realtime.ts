/**
 * realtime.ts — SignalR connection manager for Phase 3 of the Azure migration.
 *
 * One SignalR connection per browser session, shared by every live
 * subscription. The Azure Functions app (azure-functions/) watches the Cosmos
 * DB change feed and broadcasts each changed document to a hub target named
 * after its container ('submissions', 'shipStatus', ...). This module fans
 * those messages out to whoever subscribed via subscribeContainer().
 *
 * cosmosBackend.ts builds Firestore-compatible onSnapshot semantics on top of
 * this: it does the initial query, then applies broadcast docs to its local
 * result set. This module knows nothing about queries — it only moves raw
 * container events.
 *
 * @microsoft/signalr is dynamically imported so it stays out of the bundle
 * until AZURE_REALTIME is flipped on.
 */

type DocHandler = (rawDoc: Record<string, unknown>) => void
export type ConnectionEvent = 'connected' | 'reconnected' | 'failed'
type StateHandler = (event: ConnectionEvent) => void

const docHandlers   = new Map<string, Set<DocHandler>>()   // container → handlers
const stateHandlers = new Set<StateHandler>()
const boundTargets  = new Set<string>()                    // containers with a connection.on() registered

let connection: any = null            // signalR.HubConnection (lazy)
let connectPromise: Promise<boolean> | null = null

/** Base URL of the Azure Functions app's /api route.
 *  Default '/api' works when hosted on Azure Static Web Apps (same origin).
 *  For local dev against `func start`, set VITE_SIGNALR_URL=http://localhost:7071/api */
const SIGNALR_URL = import.meta.env.VITE_SIGNALR_URL || '/api'

async function ensureConnected(): Promise<boolean> {
  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const signalR = await import('@microsoft/signalr')
        connection = new signalR.HubConnectionBuilder()
          // The client POSTs {url}/negotiate, then connects to Azure SignalR.
          // withCredentials must be false for cross-origin negotiate: auth is
          // header-token based (no cookies), and the Function App's CORS
          // correctly refuses credentialed requests.
          .withUrl(SIGNALR_URL, { withCredentials: false })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .configureLogging(signalR.LogLevel.Warning)
          .build()

        // Subscribers refetch on reconnect — change-feed events during the
        // outage were missed, so local result sets must be rebuilt.
        connection.onreconnected(() => notifyState('reconnected'))

        // Bind any targets that were requested before the connection existed
        for (const container of docHandlers.keys()) bindTarget(container)

        await connection.start()
        notifyState('connected')
        return true
      } catch (e) {
        console.warn('[realtime] SignalR connection failed — subscriptions fall back to polling:', e)
        notifyState('failed')
        return false
      }
    })()
  }
  return connectPromise
}

function bindTarget(container: string) {
  if (!connection || boundTargets.has(container)) return
  boundTargets.add(container)
  // The Functions app sends batches: { target: container, arguments: [docsArray] }
  connection.on(container, (docs: Record<string, unknown>[]) => {
    const handlers = docHandlers.get(container)
    if (!handlers) return
    for (const doc of docs) {
      for (const h of handlers) {
        try { h(doc) } catch (e) { console.error('[realtime] handler error:', e) }
      }
    }
  })
}

function notifyState(event: ConnectionEvent) {
  for (const h of stateHandlers) {
    try { h(event) } catch { /* subscriber's problem */ }
  }
}

/**
 * Subscribe to raw document change events for one container.
 * Returns an unsubscribe function. Connection state changes (including the
 * initial success/failure) arrive via onState — use 'failed' to fall back
 * to polling and 'reconnected' to refetch.
 */
export function subscribeContainer(
  container: string,
  onDoc: DocHandler,
  onState?: StateHandler,
): () => void {
  let handlers = docHandlers.get(container)
  if (!handlers) {
    handlers = new Set()
    docHandlers.set(container, handlers)
  }
  handlers.add(onDoc)
  if (onState) stateHandlers.add(onState)
  bindTarget(container)

  // Kick off (or join) the shared connection; report initial result.
  ensureConnected().then(ok => {
    if (onState) onState(ok ? 'connected' : 'failed')
  })

  return () => {
    handlers!.delete(onDoc)
    if (onState) stateHandlers.delete(onState)
  }
}
