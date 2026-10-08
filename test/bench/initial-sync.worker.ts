import {Client} from '#/core/Client.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {BrowserEntryStore} from '#/database/BrowserEntryStore.js'
import {cms} from './initial-sync.cms.js'

const {config} = cms
const options = {name: 'alinea-sync-bench', fingerprint: 'bench'}

const idb = {writes: 0, bytes: 0, transactions: Array<number>()}
const transaction = IDBDatabase.prototype.transaction
IDBDatabase.prototype.transaction = function (
  this: IDBDatabase,
  ...args: Parameters<typeof transaction>
) {
  const tx = transaction.apply(this, args)
  const start = performance.now()
  tx.addEventListener('complete', () =>
    idb.transactions.push(Math.round(performance.now() - start))
  )
  return tx
}
// Bases are stored with add, count put as well should that change.
for (const method of ['add', 'put'] as const) {
  const write = IDBObjectStore.prototype[method]
  IDBObjectStore.prototype[method] = function (
    this: IDBObjectStore,
    value: {blob?: Blob; byteLength?: number},
    key?: IDBValidKey
  ) {
    idb.writes++
    idb.bytes += value?.blob?.size ?? value?.byteLength ?? 0
    return write.call(this, value, key)
  }
}

export interface BenchResult {
  count: number
  timings: Record<string, number>
  requests: Array<string>
  idb: typeof idb
}

async function run(): Promise<BenchResult> {
  const timings: Record<string, number> = {}
  let last = performance.now()
  function mark(label: string) {
    const now = performance.now()
    timings[label] = Math.round(now - last)
    last = now
  }
  const client = new Client({
    config,
    url: `${location.origin}/api`,
    applyAuth: init => ({
      ...init,
      headers: {...init?.headers, authorization: 'Bearer bench'}
    })
  })
  let blobsDone = 0
  const remote: RemoteSource = {
    async getTreeIfDifferent(sha) {
      const tree = await client.getTreeIfDifferent(sha)
      mark('tree request')
      return tree
    },
    async *getBlobs(shas, options) {
      yield* client.getBlobs(shas, options)
      blobsDone = performance.now()
    }
  }
  const store = await BrowserEntryStore.open(config, options)
  mark('open empty store')
  await store.syncWith(remote, {validate: false})
  timings['  of which until the last blob arrived'] = Math.round(
    blobsDone - last
  )
  mark('sync: blobs + index into WASM SQLite')
  const count = await store.count({status: 'all'})
  mark('count entries right after the sync')
  await store.close()
  mark('close')
  // Closing waits for the checkpoint of the sync.
  const reopened = await BrowserEntryStore.open(config, options)
  mark('reopen the newest base (next load)')
  await reopened.close()
  const rebuild = {...options, fingerprint: 'another build'}
  const rebuilt = await BrowserEntryStore.open(config, rebuild)
  mark('reopen with another config (derives every entry again)')
  // As the dashboard does after opening: the sync finds the tree unchanged
  // and stores the derived entries as a base of this config.
  await rebuilt.syncWith(client, {validate: false})
  await rebuilt.close()
  mark('sync and close it (stores a base)')
  await (await BrowserEntryStore.open(config, rebuild)).close()
  mark('reopen once stored')
  const requests = performance
    .getEntriesByType('resource')
    .map(entry => new URL(entry.name).searchParams.get('action'))
    .filter(action => action !== null)
  return {count, timings, requests, idb}
}

postMessage(await run())
