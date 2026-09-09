import {expose, proxy} from 'comlink'
import {wasmDatabase} from '#/database/driver/WasmDatabase.js'
import {EntryRuntime, type EntryDelta} from '#/database/runtime/EntryRuntime.js'
import {QueryWorker} from '#/database/browser/QueryWorker.js'
import {ReplicaCache} from '#/database/browser/ReplicaCache.js'
import {Permission} from '#/core/Role.js'
import {config} from './config.js'

const loads: Array<string> = []
const ready = (async () => {
  const cache = await ReplicaCache.open(indexedDB, {
    project: 'browser-fixture',
    namespace: 'main',
    epoch: 'epoch',
    schemaId: 'schema',
    configId: 'config',
    principal: 'fixture-user',
    viewId: 'view',
    releaseId: 'release'
  })
  const snapshot = await cache.snapshot()
  const db = await wasmDatabase()
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(config, db, {
    async load(requests) {
      return requests.map(request => {
        loads.push(request.payloadId)
        return {...request, data: {title: `Payload ${request.payloadId}`}}
      })
    }
  })
  if (snapshot.revision)
    await runtime.apply({
      fromRevision: 'empty',
      toRevision: snapshot.revision,
      entries: snapshot.entries
    })
  const queries = new QueryWorker(runtime)
  return {runtime, queries, cache}
})()
export const api = {
  async queries() {
    return proxy((await ready).queries)
  },
  async install(delta: EntryDelta) {
    const {runtime, cache} = await ready
    // Test-only trusted index producer. Production grants must come from the handler.
    await cache.apply({
      ...delta,
      fromRevision:
        delta.fromRevision === 'empty' ? undefined : delta.fromRevision,
      entries: delta.entries.map(row => ({
        ...row,
        permissions: Permission.Explore | Permission.Read
      }))
    })
    await runtime.apply(delta)
  },
  loads() {
    return loads.slice()
  }
}
expose(api)
