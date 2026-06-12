# CompuTrek Realtime Backend (Phase 3)

Azure Functions app that watches the Cosmos DB change feed and pushes document
changes to browsers through Azure SignalR Service. This is what replaces the
client's 4-second polling with instant updates.

```
Cosmos DB change feed ──► Functions (this app) ──► Azure SignalR ──► browsers
```

## One-time Azure setup

### 1. Create the SignalR Service

Portal → Create resource → **SignalR Service**:

- Resource group: `computrek-rg` (same as Cosmos)
- Name: e.g. `computrek-signalr`
- Region: West US
- Pricing tier: **Free F1** is fine for development (20 concurrent
  connections). Before deploying to students, upgrade to **Standard S1**
  (1,000 concurrent connections, ~$50/mo) — six periods of ~32 students
  exceeds the free tier during the school day.
- **Service mode: Serverless** ← required; this app uses serverless bindings.

After it deploys: **Settings → Connection strings** → copy the primary
connection string.

### 2. Create the Function App

Portal → Create resource → **Function App**:

- Hosting plan: **Consumption (Serverless)** — effectively free at this scale
- Resource group: `computrek-rg`
- Name: e.g. `computrek-realtime`
- Runtime: **Node.js 20**, OS: Linux
- It creates a small storage account with it — accept that.

After it deploys, under **Settings → Environment variables** add:

| Name | Value |
|---|---|
| `CosmosDBConnection` | `AccountEndpoint=https://computrek-fusd.documents.azure.com:443/;AccountKey=<cosmos primary key>;` |
| `AzureSignalRConnectionString` | the SignalR connection string from step 1 |

Then under **API → CORS**, add the app's origins:
- `http://localhost:1701`
- your production domain (later)

### 3. Deploy this app

```bash
npm install -g azure-functions-core-tools@4   # once
cd azure-functions
npm install
func azure functionapp publish computrek-realtime
```

### 4. Point the Vue app at it

In the repo root `.env`:

```
VITE_SIGNALR_URL=https://computrek-realtime.azurewebsites.net/api
```

Then set `AZURE_REALTIME = true` in `src/config/featureFlags.ts`.

## Local development

```bash
cd azure-functions
npm install
cp local.settings.json.example local.settings.json   # fill in both connection strings
func start
```

Set `VITE_SIGNALR_URL=http://localhost:7071/api` in `.env` and run the Vue dev
server as usual. (The Cosmos triggers also need `AzureWebJobsStorage`; the
example file uses the local storage emulator — installing
[Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite)
via `npm i -g azurite` covers that, or paste a real storage connection string.)

## How it works

- `negotiate` — standard Azure SignalR serverless negotiate endpoint; the
  browser client calls it automatically.
- `changefeed-<container>` ×9 — Cosmos DB triggers on every container the app
  live-subscribes to (`submissions`, `approvedUsers`, `challenges`,
  `gameRooms`, `shipStatus`, `timerState`, `champsState`, `challengeSettings`,
  `activeTestSessions`). Changed docs are broadcast to a SignalR target named
  after the container; `src/data/realtime.ts` in the Vue app routes them to
  active subscriptions, which update their local result sets without
  re-querying Cosmos.
- Soft-delete cleanup — the change feed can't emit hard deletes, so the client
  marks deleted docs `{ __deleted: true }` (which does flow through the feed);
  this app hard-deletes those tombstones after broadcasting them.
- All triggers share one `leases` container (auto-created, prefixed per
  function) which tracks change-feed progress.
