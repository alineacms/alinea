import {expose, proxy} from 'comlink'
import {wasmDatabase} from '#/database/driver/WasmDatabase.js'
import {EntryRuntime, type EntryDelta} from '#/database/runtime/EntryRuntime.js'
import {QueryWorker} from '#/database/browser/QueryWorker.js'
import {ReplicaCache} from '#/database/browser/ReplicaCache.js'
import {Permission} from '#/core/Role.js'
import {HttpPayloadLoader} from '#/database/browser/HttpPayloadLoader.js'
import {config, replicaIdentity} from './config.js'

const loads: Array<string> = []
const ready = (async () => {
  const cache = await ReplicaCache.open(indexedDB, replicaIdentity)
  const snapshot = await cache.snapshot()
  function createLoader(revision: string) {
    return new HttpPayloadLoader({
      url: new URL('/replica', location.href).href,
      identity: replicaIdentity,
      revision,
      cache,
      applyAuth(init) {
        return {...init, headers: {...init.headers, authorization: 'Bearer fixture'}}
      },
      fetch(input, init) {
        const body = JSON.parse(init.body as string)
        loads.push(...body.requests.map((row: {payloadId: string}) => row.payloadId))
        return fetch(input, init)
      }
    })
  }
  let loader = createLoader(snapshot.revision ?? 'empty')
  const db = await wasmDatabase()
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(config, db, {
    load: requests => loader.load(requests)
  })
  if (snapshot.revision)
    await runtime.apply({
      fromRevision: 'empty',
      toRevision: snapshot.revision,
      entries: snapshot.entries
    })
  const queries = new QueryWorker(runtime)
  return {
    runtime,
    queries,
    cache,
    async install(delta: EntryDelta) {
      const previous = loader
      loader = createLoader(delta.toRevision)
      await runtime.apply(delta)
      previous.close()
    }
  }
})()
export const api = {
  async queries() {
    return proxy((await ready).queries)
  },
  async install(delta: EntryDelta) {
    const {install, cache} = await ready
    // Test-only trusted index producer.
    await cache.apply({
      ...delta,
      fromRevision:
        delta.fromRevision === 'empty' ? undefined : delta.fromRevision,
      entries: delta.entries.map(row => ({
        ...row,
        permissions: Permission.Explore | Permission.Read,
      }))
    })
    await install(delta)
  },
  loads() {
    return loads.slice()
  }
}
expose(api)
