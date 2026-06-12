/**
 * cosmosBackend.ts — Azure Cosmos DB implementation of the Firestore API surface
 * CompuTrek actually uses (Phase 2 of the Azure migration).
 *
 * Design notes:
 *
 * - The app's entire Firestore usage is: where('==' | 'in'), orderBy, limit,
 *   doc CRUD, onSnapshot, writeBatch, one runTransaction, serverTimestamp,
 *   Timestamp, increment, arrayUnion/arrayRemove. This module implements
 *   exactly that surface over @azure/cosmos so composables don't change.
 *
 * - WHERE clauses are translated to Cosmos SQL (cross-partition). orderBy and
 *   limit are applied client-side after fetch: at classroom scale (≤ a few
 *   thousand docs per query after filtering) this is well within budget and
 *   sidesteps Cosmos's restrictions on ORDER BY over mixed/object-typed fields.
 *
 * - Timestamps are stored as { "__ts": <epoch ms> } objects and revived to
 *   Timestamp instances on read, so existing `.toDate()` / `.toMillis()` /
 *   `instanceof Timestamp` code keeps working.
 *
 * - onSnapshot is implemented as polling (every COSMOS_POLL_MS). Phase 3
 *   replaces this with Azure SignalR pushed from the Cosmos DB change feed.
 *
 * - writeBatch is sequential, NOT atomic (Cosmos has no cross-partition
 *   transactions). Every existing batch in the app is a fan-out where partial
 *   completion is re-runnable (deploy missions, close period, cascade delete),
 *   so this is acceptable. runTransaction uses optimistic concurrency via
 *   Cosmos etags (ifMatch) with retry, matching Firestore's semantics for the
 *   one place it's used (multi-play game completion counter).
 *
 * - @azure/cosmos is loaded via dynamic import on first use, so it adds zero
 *   bundle weight while AZURE_DATABASE is false.
 */

import type { Container, Database, RequestOptions } from '@azure/cosmos'

// ── Container registry ─────────────────────────────────────────────────────────
// Maps Firestore collection name → Cosmos container name + partition key path.
// Collections not listed here default to { container: <same name>, pk: '/id' }.
// Keep in sync with MIGRATION.md's inventory table and the migration script.
export const CONTAINER_REGISTRY: Record<string, { container: string; pk: string }> = {
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
  // Singleton/keyed-by-id collections (PK = /id is always safe):
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

function containerInfo(collName: string) {
  return CONTAINER_REGISTRY[collName] ?? { container: collName, pk: '/id' }
}

/** Polling cadence for the onSnapshot shim. Replaced by SignalR in Phase 3. */
export const COSMOS_POLL_MS = 4000

// ── Lazy client ────────────────────────────────────────────────────────────────

let dbPromise: Promise<Database> | null = null

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { CosmosClient } = await import('@azure/cosmos')
      const endpoint = import.meta.env.VITE_COSMOS_ENDPOINT
      const key      = import.meta.env.VITE_COSMOS_KEY
      if (!endpoint || !key) {
        throw new Error(
          '[cosmosBackend] VITE_COSMOS_ENDPOINT and VITE_COSMOS_KEY must be set ' +
          'in .env before enabling AZURE_DATABASE.'
        )
      }
      const client = new CosmosClient({ endpoint, key })
      return client.database('computrek')
    })()
  }
  return dbPromise
}

async function getContainer(collName: string): Promise<Container> {
  const db = await getDb()
  return db.container(containerInfo(collName).container)
}

// ── Timestamp ──────────────────────────────────────────────────────────────────
// API-compatible subset of firebase/firestore's Timestamp.

export class Timestamp {
  readonly seconds: number
  readonly nanoseconds: number

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds
    this.nanoseconds = nanoseconds
  }

  toDate(): Date { return new Date(this.toMillis()) }
  toMillis(): number { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6) }
  isEqual(other: Timestamp): boolean { return this.toMillis() === other.toMillis() }
  valueOf(): string { return String(this.toMillis()) }
  toJSON() { return { seconds: this.seconds, nanoseconds: this.nanoseconds } }

  static now(): Timestamp { return Timestamp.fromMillis(Date.now()) }
  static fromDate(date: Date): Timestamp { return Timestamp.fromMillis(date.getTime()) }
  static fromMillis(ms: number): Timestamp {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6)
  }
}

// ── Field-value sentinels ──────────────────────────────────────────────────────

const SENTINEL = Symbol('cosmosSentinel')

type Sentinel =
  | { [SENTINEL]: 'serverTimestamp' }
  | { [SENTINEL]: 'increment'; operand: number }
  | { [SENTINEL]: 'arrayUnion'; elements: unknown[] }
  | { [SENTINEL]: 'arrayRemove'; elements: unknown[] }

export function serverTimestamp(): any { return { [SENTINEL]: 'serverTimestamp' } }
export function increment(operand: number): any { return { [SENTINEL]: 'increment', operand } }
export function arrayUnion(...elements: unknown[]): any { return { [SENTINEL]: 'arrayUnion', elements } }
export function arrayRemove(...elements: unknown[]): any { return { [SENTINEL]: 'arrayRemove', elements } }

function isSentinel(v: unknown): v is Sentinel {
  return typeof v === 'object' && v !== null && SENTINEL in v
}

/**
 * Resolves a field's new value, applying sentinels against the existing value.
 * Used by setDoc / updateDoc / transactions.
 */
function resolveValue(newVal: unknown, existingVal: unknown): unknown {
  if (isSentinel(newVal)) {
    switch (newVal[SENTINEL]) {
      case 'serverTimestamp':
        // Client clock — true server time would require an Azure Functions
        // write proxy; acceptable drift for classroom data. Revisit in Phase 3.
        return Timestamp.now()
      case 'increment':
        return (typeof existingVal === 'number' ? existingVal : 0) +
               (newVal as any).operand
      case 'arrayUnion': {
        const arr = Array.isArray(existingVal) ? [...existingVal] : []
        for (const el of (newVal as any).elements) {
          if (!arr.some(x => deepEqual(x, el))) arr.push(el)
        }
        return arr
      }
      case 'arrayRemove': {
        const arr = Array.isArray(existingVal) ? existingVal : []
        return arr.filter(x => !(newVal as any).elements.some((el: unknown) => deepEqual(x, el)))
      }
    }
  }
  if (Array.isArray(newVal)) return newVal.map(v => resolveValue(v, undefined))
  if (isPlainObject(newVal)) {
    const out: Record<string, unknown> = {}
    const existing = isPlainObject(existingVal) ? existingVal as Record<string, unknown> : {}
    for (const [k, v] of Object.entries(newVal as Record<string, unknown>)) {
      if (v === undefined) continue // Firestore rejects undefined; we strip it
      out[k] = resolveValue(v, existing[k])
    }
    return out
  }
  return newVal
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a instanceof Timestamp && b instanceof Timestamp) return a.isEqual(b)
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a as object), kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every(k => deepEqual((a as any)[k], (b as any)[k]))
}

function isPlainObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v) &&
         !(v instanceof Timestamp) && !(v instanceof Date) && !isSentinel(v)
}

// ── Encode / decode (Timestamp ⇄ { __ts: ms }) ────────────────────────────────

const TS_KEY = '__ts'

function encodeValue(v: unknown): unknown {
  if (v instanceof Timestamp) return { [TS_KEY]: v.toMillis() }
  if (v instanceof Date)      return { [TS_KEY]: v.getTime() }
  if (Array.isArray(v))       return v.map(encodeValue)
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === undefined) continue
      out[k] = encodeValue(val)
    }
    return out
  }
  return v
}

function isEncodedTs(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v) &&
         TS_KEY in (v as object) && Object.keys(v as object).length === 1 &&
         typeof (v as any)[TS_KEY] === 'number'
}

function decodeValue(v: unknown): unknown {
  if (isEncodedTs(v)) return Timestamp.fromMillis((v as any)[TS_KEY])
  if (Array.isArray(v)) return v.map(decodeValue)
  if (typeof v === 'object' && v !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      // Strip Cosmos system fields so they don't leak into app data
      if (k.startsWith('_')) continue
      out[k] = decodeValue(val)
    }
    return out
  }
  return v
}

/** Decodes a raw Cosmos item into Firestore-shaped doc data (no id, no _system). */
function decodeItem(item: Record<string, unknown>): Record<string, unknown> {
  const { id, ...rest } = item
  return decodeValue(rest) as Record<string, unknown>
}

// ── Refs ───────────────────────────────────────────────────────────────────────

export class CollectionReference {
  readonly type = 'collection'
  constructor(readonly collName: string) {}
}

export class DocumentReference {
  readonly type = 'document'
  constructor(readonly collName: string, readonly id: string) {}
  get path(): string { return `${this.collName}/${this.id}` }
}

export function collection(_db: unknown, name: string): CollectionReference {
  return new CollectionReference(name)
}

/** Supports doc(db, 'coll', id) and doc(collectionRef) for auto-generated IDs. */
export function doc(dbOrColl: unknown, collName?: string, id?: string): DocumentReference {
  if (dbOrColl instanceof CollectionReference) {
    return new DocumentReference(dbOrColl.collName, autoId())
  }
  if (!collName || !id) {
    throw new Error('[cosmosBackend] doc() requires (db, collectionName, docId)')
  }
  return new DocumentReference(collName, id)
}

/** 20-char alphanumeric, same shape as Firestore auto-IDs. */
function autoId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

// ── Query builders ─────────────────────────────────────────────────────────────

const DOCUMENT_ID = Symbol('documentId')
export function documentId(): any { return DOCUMENT_ID }

type WhereOp = '==' | 'in' | '<' | '<=' | '>' | '>=' | '!='

interface WhereConstraint  { kind: 'where'; field: string | typeof DOCUMENT_ID; op: WhereOp; value: unknown }
interface OrderByConstraint{ kind: 'orderBy'; field: string; dir: 'asc' | 'desc' }
interface LimitConstraint  { kind: 'limit'; n: number }
type QueryConstraint = WhereConstraint | OrderByConstraint | LimitConstraint

export function where(field: string | typeof DOCUMENT_ID, op: WhereOp, value: unknown): QueryConstraint {
  return { kind: 'where', field, op, value }
}
export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { kind: 'orderBy', field, dir }
}
export function limit(n: number): QueryConstraint {
  return { kind: 'limit', n }
}

export class Query {
  constructor(readonly collName: string, readonly constraints: QueryConstraint[]) {}
}

export function query(target: CollectionReference | Query, ...constraints: QueryConstraint[]): Query {
  const base = target instanceof Query
    ? target
    : new Query(target.collName, [])
  return new Query(base.collName, [...base.constraints, ...constraints.filter(Boolean)])
}

// ── SQL translation (WHERE only — orderBy/limit applied client-side) ──────────

function fieldToSqlPath(field: string | typeof DOCUMENT_ID): string {
  if (field === DOCUMENT_ID) return 'c.id'
  // Dotted paths ('data.score') → c["data"]["score"]
  return 'c' + field.split('.').map(seg => `[${JSON.stringify(seg)}]`).join('')
}

function buildSql(wheres: WhereConstraint[]) {
  const params: { name: string; value: any }[] = []
  const clauses = wheres.map((w, i) => {
    const name = `@p${i}`
    let path = fieldToSqlPath(w.field)
    let value: unknown = w.value

    if (w.op === 'in') {
      const arr = (Array.isArray(value) ? value : []).map(encodeValue)
      params.push({ name, value: arr })
      return `ARRAY_CONTAINS(${name}, ${path})`
    }

    // Range comparisons on timestamps compare the embedded epoch-ms number
    if (value instanceof Timestamp || value instanceof Date) {
      const ms = value instanceof Timestamp ? value.toMillis() : value.getTime()
      if (w.op === '==' || w.op === '!=') {
        params.push({ name, value: encodeValue(value) })
      } else {
        path = `${path}[${JSON.stringify(TS_KEY)}]`
        params.push({ name, value: ms })
      }
    } else {
      params.push({ name, value: encodeValue(value) })
    }
    return `${path} ${w.op === '==' ? '=' : w.op} ${name}`
  })

  const whereSql = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
  return { query: `SELECT * FROM c${whereSql}`, parameters: params }
}

// Firestore orderBy semantics: docs missing the field are excluded; null sorts first.
function applyOrderAndLimit(items: Record<string, unknown>[], constraints: QueryConstraint[]) {
  const orders = constraints.filter((c): c is OrderByConstraint => c.kind === 'orderBy')
  const limitC = constraints.find((c): c is LimitConstraint => c.kind === 'limit')

  let result = items
  if (orders.length) {
    result = result.filter(it => orders.every(o => getFieldValue(it, o.field) !== undefined))
    result = [...result].sort((a, b) => {
      for (const o of orders) {
        const cmp = compareValues(getFieldValue(a, o.field), getFieldValue(b, o.field))
        if (cmp !== 0) return o.dir === 'desc' ? -cmp : cmp
      }
      return 0
    })
  }
  if (limitC) result = result.slice(0, limitC.n)
  return result
}

function getFieldValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, seg) => (typeof acc === 'object' && acc !== null ? (acc as any)[seg] : undefined),
    obj
  )
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  const am = a instanceof Timestamp ? a.toMillis() : a
  const bm = b instanceof Timestamp ? b.toMillis() : b
  if (typeof am === 'number' && typeof bm === 'number') return am - bm
  if (typeof am === 'boolean' && typeof bm === 'boolean') return Number(am) - Number(bm)
  return String(am) < String(bm) ? -1 : String(am) > String(bm) ? 1 : 0
}

// ── Snapshots ──────────────────────────────────────────────────────────────────

export class DocumentSnapshot {
  constructor(
    readonly ref: DocumentReference,
    private readonly _data: Record<string, unknown> | undefined,
  ) {}
  get id(): string { return this.ref.id }
  exists(): boolean { return this._data !== undefined }
  data(): Record<string, unknown> | undefined { return this._data }
}

export class QuerySnapshot {
  constructor(readonly docs: DocumentSnapshot[]) {}
  get empty(): boolean { return this.docs.length === 0 }
  get size(): number { return this.docs.length }
  forEach(cb: (doc: DocumentSnapshot) => void): void { this.docs.forEach(cb) }
}

// ── Raw item helpers (internal) ────────────────────────────────────────────────

/** Point-read by id via cross-partition query (we don't always know the PK value). */
async function fetchRawItem(collName: string, id: string): Promise<Record<string, unknown> | undefined> {
  const container = await getContainer(collName)
  const { resources } = await container.items
    .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
    .fetchAll()
  return resources[0]
}

function pkValueOf(collName: string, item: Record<string, unknown>): unknown {
  const pkField = containerInfo(collName).pk.slice(1) // '/periodId' → 'periodId'
  return item[pkField]
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export async function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  const raw = await fetchRawItem(ref.collName, ref.id)
  return new DocumentSnapshot(ref, raw ? decodeItem(raw) : undefined)
}

export async function getDocs(target: Query | CollectionReference): Promise<QuerySnapshot> {
  const q = target instanceof Query ? target : new Query(target.collName, [])
  const container = await getContainer(q.collName)
  const wheres = q.constraints.filter((c): c is WhereConstraint => c.kind === 'where')
  const { resources } = await container.items.query(buildSql(wheres)).fetchAll()

  const decoded = resources.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    data: decodeItem(item),
  }))
  const ordered = applyOrderAndLimit(decoded.map(d => ({ ...d.data, __id: d.id })), q.constraints)

  return new QuerySnapshot(ordered.map(it => {
    const { __id, ...data } = it
    return new DocumentSnapshot(new DocumentReference(q.collName, __id as string), data)
  }))
}

// ── Writes ─────────────────────────────────────────────────────────────────────

export async function addDoc(collRef: CollectionReference, data: Record<string, unknown>): Promise<DocumentReference> {
  const ref = new DocumentReference(collRef.collName, autoId())
  await setDoc(ref, data)
  return ref
}

export async function setDoc(
  ref: DocumentReference,
  data: Record<string, unknown>,
  options?: { merge?: boolean },
): Promise<void> {
  const container = await getContainer(ref.collName)
  // Existing doc is needed both for merge mode and for sentinel resolution
  // (increment / arrayUnion are relative to current values).
  const raw = await fetchRawItem(ref.collName, ref.id)
  const existing = raw ? decodeItem(raw) : {}
  const resolved = resolveValue(data, existing) as Record<string, unknown>
  const merged = options?.merge ? deepMerge(existing, resolved) : resolved
  await container.items.upsert({ id: ref.id, ...(encodeValue(merged) as object) })
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k])
      ? deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>)
      : v
  }
  return out
}

export async function updateDoc(ref: DocumentReference, fields: Record<string, unknown>): Promise<void> {
  await applyUpdate(ref, fields)
}

/**
 * Shared by updateDoc and transactions. Expands Firestore dot-path keys
 * ('data.score') into nested updates, resolves sentinels, then replaces the item.
 */
async function applyUpdate(
  ref: DocumentReference,
  fields: Record<string, unknown>,
  requestOptions?: RequestOptions,
): Promise<void> {
  const container = await getContainer(ref.collName)
  const raw = await fetchRawItem(ref.collName, ref.id)
  if (!raw) {
    throw new Error(`[cosmosBackend] updateDoc: no document ${ref.collName}/${ref.id}`)
  }
  const existing = decodeItem(raw)

  for (const [path, value] of Object.entries(fields)) {
    if (value === undefined) continue
    const segs = path.split('.')
    let target: Record<string, unknown> = existing
    for (const seg of segs.slice(0, -1)) {
      if (!isPlainObject(target[seg])) target[seg] = {}
      target = target[seg] as Record<string, unknown>
    }
    const leaf = segs[segs.length - 1]
    target[leaf] = resolveValue(value, target[leaf])
  }

  const body = { id: ref.id, ...(encodeValue(existing) as object) }
  await container.item(ref.id, pkValueOf(ref.collName, raw)).replace(body, requestOptions)
}

export async function deleteDoc(ref: DocumentReference): Promise<void> {
  const container = await getContainer(ref.collName)
  const raw = await fetchRawItem(ref.collName, ref.id)
  if (!raw) return // Firestore deleteDoc on a missing doc is a no-op
  await container.item(ref.id, pkValueOf(ref.collName, raw)).delete()
}

// ── Batch (sequential, non-atomic — see header comment) ───────────────────────

type BatchOp =
  | { type: 'set'; ref: DocumentReference; data: Record<string, unknown>; options?: { merge?: boolean } }
  | { type: 'update'; ref: DocumentReference; fields: Record<string, unknown> }
  | { type: 'delete'; ref: DocumentReference }

export class WriteBatch {
  private ops: BatchOp[] = []
  set(ref: DocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }) {
    this.ops.push({ type: 'set', ref, data, options }); return this
  }
  update(ref: DocumentReference, fields: Record<string, unknown>) {
    this.ops.push({ type: 'update', ref, fields }); return this
  }
  delete(ref: DocumentReference) {
    this.ops.push({ type: 'delete', ref }); return this
  }
  async commit(): Promise<void> {
    for (const op of this.ops) {
      if (op.type === 'set')         await setDoc(op.ref, op.data, op.options)
      else if (op.type === 'update') await updateDoc(op.ref, op.fields)
      else                           await deleteDoc(op.ref)
    }
  }
}

export function writeBatch(_db: unknown): WriteBatch {
  return new WriteBatch()
}

// ── Transaction (optimistic concurrency via etag, retried) ────────────────────

interface TxWrite { ref: DocumentReference; fields: Record<string, unknown> }

class Transaction {
  readonly etags = new Map<string, string>()
  readonly writes: TxWrite[] = []

  async get(ref: DocumentReference): Promise<DocumentSnapshot> {
    const raw = await fetchRawItem(ref.collName, ref.id)
    if (raw) this.etags.set(ref.path, raw._etag as string)
    return new DocumentSnapshot(ref, raw ? decodeItem(raw) : undefined)
  }
  update(ref: DocumentReference, fields: Record<string, unknown>): void {
    this.writes.push({ ref, fields })
  }
  set(ref: DocumentReference, data: Record<string, unknown>): void {
    this.writes.push({ ref, fields: data })
  }
}

export async function runTransaction<T>(
  _db: unknown,
  updateFunction: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const MAX_ATTEMPTS = 5
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const tx = new Transaction()
    const result = await updateFunction(tx)
    try {
      for (const w of tx.writes) {
        const etag = tx.etags.get(w.ref.path)
        await applyUpdate(w.ref, w.fields, etag
          ? { accessCondition: { type: 'IfMatch', condition: etag } }
          : undefined)
      }
      return result
    } catch (e: any) {
      // 412 = etag mismatch (someone wrote between our read and write) → retry
      if (e?.code === 412 || e?.statusCode === 412) { lastErr = e; continue }
      throw e
    }
  }
  throw lastErr
}

// ── onSnapshot (polling shim — replaced by SignalR in Phase 3) ────────────────

type Unsubscribe = () => void

export function onSnapshot(
  target: Query | CollectionReference | DocumentReference,
  onNext: (snap: any) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  let cancelled = false

  const tick = async () => {
    try {
      const snap = target instanceof DocumentReference
        ? await getDoc(target)
        : await getDocs(target)
      if (!cancelled) onNext(snap)
    } catch (e) {
      if (!cancelled && onError) onError(e as Error)
      else if (!cancelled) console.error('[cosmosBackend] onSnapshot poll error:', e)
    }
  }

  tick() // immediate first emit, like Firestore
  const interval = setInterval(tick, COSMOS_POLL_MS)
  return () => { cancelled = true; clearInterval(interval) }
}

// ── Network toggles (Firestore-only concept — no-ops on Cosmos) ───────────────

export async function enableNetwork(_db: unknown): Promise<void> {}
export async function disableNetwork(_db: unknown): Promise<void> {}
