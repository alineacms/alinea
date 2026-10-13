import {Client} from '#/core/Client.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {BrowserEntryStore} from '#/database/BrowserEntryStore.js'
import {versionedCacheName} from '#/database/Version.js'
import {init} from '@alinea/sqlite-wasm'
import {indexedDBSnapshots} from '@alinea/sqlite-wasm/snapshots'
import {cms} from './initial-sync.cms.js'

export type Phase = 'initial' | 'incremental' | 'reload' | 'reindex'

/** One measured step; sizes in bytes, times in ms. */
export interface Row {
  step: string
  ms?: number
  blobs?: number
  stored?: number
  written?: number
  reads?: number
  read?: number
  reading?: number
  snapshots?: number
  chain?: number
  size?: number
  heap?: number
}

export type Message = {rows: Array<Row>} | {error: string}

const {config} = cms
const name = 'alinea-sync-bench'
const build = 'bench'
const other = 'another build'
/** Deltas a snapshot may lie over, as snapshot storage keeps by default. */
const maxDepth = 8
const storage = indexedDBSnapshots(`${versionedCacheName(name)}-snapshots`)

interface Save {
  key: string
  bytes: number
  at: number
}

const io = {
  blobs: 0,
  lastBlob: 0,
  reads: 0,
  read: 0,
  reading: 0,
  saves: Array<Save>()
}
let onSave = () => {}

// Snapshots are added as a record with their pages in a Blob.
for (const method of ['add', 'put'] as const) {
  const write = IDBObjectStore.prototype[method]
  IDBObjectStore.prototype[method] = function (
    this: IDBObjectStore,
    value: {key?: string; blob?: Blob},
    key?: IDBValidKey
  ) {
    const request = write.call(this, value, key)
    const {blob} = value ?? {}
    if (blob)
      this.transaction.addEventListener('complete', () => {
        io.saves.push({
          key: value.key!,
          bytes: blob.size,
          at: performance.now()
        })
        onSave()
      })
    return request
  }
}

// Sessions read the pages of a snapshot synchronously from its Blob.
const readSync = FileReaderSync.prototype.readAsArrayBuffer
FileReaderSync.prototype.readAsArrayBuffer = function (
  this: FileReaderSync,
  blob: Blob
) {
  const start = performance.now()
  const result = readSync.call(this, blob)
  io.reads++
  io.read += blob.size
  io.reading += performance.now() - start
  return result
}

const client = new Client({
  config,
  url: `${location.origin}/api`,
  applyAuth: init => ({
    ...init,
    headers: {...init?.headers, authorization: 'Bearer bench'}
  })
})
const remote: RemoteSource = {
  getTreeIfDifferent: sha => client.getTreeIfDifferent(sha),
  async *getBlobs(shas, options) {
    io.blobs += shas.length
    yield* client.getBlobs(shas, options)
    io.lastBlob = performance.now()
  }
}

function open(fingerprint: string) {
  return BrowserEntryStore.open(config, {name, fingerprint})
}

/** Change entries on the server, describing what changed. */
async function change(count: number): Promise<string> {
  const response = await fetch(`/change?count=${count}`, {method: 'POST'})
  return response.text()
}

async function heap(): Promise<number> {
  return (await init()).wasm.HEAPU8.byteLength
}

/** The snapshot of `branch` and `revision` once stored. */
function saved(revision: string, branch: string): Promise<Save> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Not stored')), 60_000)
    onSave = () => {
      const save = io.saves.find(save =>
        save.key.startsWith(`${revision}-${branch}`)
      )
      if (!save) return
      clearTimeout(timeout)
      resolve(save)
    }
    onSave()
  })
}

/** Snapshots stored, and how many the head of `branch` reads. */
async function listing(branch: string) {
  const list = await storage.list()
  const byKey = new Map(list.map(info => [info.key, info]))
  let chain = 0
  for (
    let info = await storage.head(branch);
    info;
    info = info.parent ? byKey.get(info.parent) : undefined
  )
    chain++
  const sizes = await Promise.all(
    list.map(async info => {
      const stored = await storage.store.get(info.key)
      return stored?.source instanceof Blob
        ? stored.source.size
        : (stored?.source.byteLength ?? 0)
    })
  )
  const size = sizes.reduce((sum, size) => sum + size, 0)
  return {snapshots: list.length, chain, size}
}

async function step<T>(
  rows: Array<Row>,
  label: string,
  run: () => Promise<T>
): Promise<T> {
  const {blobs, reads, read, reading} = io
  const start = performance.now()
  const result = await run()
  rows.push({
    step: label,
    ms: performance.now() - start,
    blobs: io.blobs - blobs,
    reads: io.reads - reads,
    read: io.read - read,
    reading: io.reading - reading,
    heap: await heap()
  })
  return result
}

/** Sync `store` and wait until it stored the result as a snapshot. */
async function sync(
  rows: Array<Row>,
  label: string,
  store: BrowserEntryStore,
  branch: string
): Promise<void> {
  const revision = await step(rows, label, () =>
    store.syncWith(remote, {validate: false})
  )
  const end = performance.now()
  const row = rows.pop()!
  const save = await saved(revision, branch)
  rows.push({
    ...row,
    stored: save.at - end,
    written: save.bytes,
    heap: await heap(),
    ...(await listing(branch))
  })
}

const phases: Record<Phase, () => Promise<Array<Row>>> = {
  async initial() {
    const rows = Array<Row>()
    const store = await step(rows, 'open an empty store', () => open(build))
    const start = performance.now()
    await sync(rows, 'sync: tree, blobs, index', store, build)
    const blobs = io.lastBlob - start
    await step(rows, 'first query (count all entries)', () =>
      store.count({status: 'all'})
    )
    const ms = rows.reduce((sum, row) => sum + row.ms!, 0)
    rows.splice(2, 0, {step: '  of which until the last blob', ms: blobs})
    rows.push({step: 'synced and queryable', ms})
    await store.close()
    return rows
  },
  async reload() {
    const rows = Array<Row>()
    const store = await step(rows, 'open the head', () => open(build))
    rows[0] = {...rows[0], ...(await listing(build))}
    await step(rows, 'first query (one entry by id)', () =>
      store.first({id: 'page-1'})
    )
    await step(rows, 'count all entries', () => store.count({status: 'all'}))
    await store.close()
    return rows
  },
  async incremental() {
    const rows = Array<Row>()
    const store = await open(build)
    for (const count of [1, 100, 1000])
      await sync(rows, `sync ${await change(count)}`, store, build)
    // Then small ones until the head lies over as many deltas as it may.
    while (rows.at(-1)!.chain! <= maxDepth && rows.length < 16)
      await sync(rows, `sync ${await change(10)}`, store, build)
    await store.close()
    return rows
  },
  async reindex() {
    const rows = Array<Row>()
    const store = await step(rows, 'open with another config (reindex)', () =>
      open(other)
    )
    await step(rows, 'first query (one entry by id)', () =>
      store.first({id: 'page-1'})
    )
    await sync(rows, 'sync (tree unchanged)', store, other)
    await sync(rows, `sync ${await change(100)}`, store, other)
    await store.close()
    return rows
  }
}

addEventListener('message', async (event: MessageEvent<Phase>) => {
  try {
    postMessage({rows: await phases[event.data]()} satisfies Message)
  } catch (error) {
    const message = error instanceof Error ? error.stack! : String(error)
    postMessage({error: message} satisfies Message)
  }
})
