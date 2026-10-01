import {Client} from '#/core/Client.js'
import type {RemoteSource} from '#/core/source/Source.js'
import {BrowserEntryStore} from '#/database/BrowserEntryStore.js'
import {cms} from './initial-sync.cms.js'

const {config} = cms
const options = {name: 'alinea-sync-bench', revision: 'bench'}

const idb = {puts: 0, bytes: 0, transactions: Array<number>()}
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
const put = IDBObjectStore.prototype.put
IDBObjectStore.prototype.put = function (
  this: IDBObjectStore,
  value: Uint8Array,
  key?: IDBValidKey
) {
  idb.puts++
  idb.bytes += value?.byteLength ?? 0
  return put.call(this, value, key)
}

async function run() {
  const timings: Record<string, number> = {}
  let last = performance.now()
  function mark(label: string) {
    const now = performance.now()
    timings[label] = Math.round(now - last)
    last = now
  }
  const client = new Client({
    config,
    url: '/api',
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
  // Storing a database under the same name waits for its pages to be stored.
  const reopened = await BrowserEntryStore.open(config, options)
  mark('reopen from IndexedDB once stored (next load)')
  await reopened.close()
  const rebuild = {...options, revision: 'another build'}
  const rebuilt = await BrowserEntryStore.open(config, rebuild)
  mark('reopen with another build (derives every entry again)')
  await rebuilt.close()
  await (await BrowserEntryStore.open(config, rebuild)).close()
  mark('reopen once stored')
  const requests = performance
    .getEntriesByType('resource')
    .map(entry => new URL(entry.name).searchParams.get('action'))
    .filter(action => action)
  return {count, timings, requests, idb}
}

declare global {
  interface Window {
    bench: () => ReturnType<typeof run>
  }
}

window.bench = run
