import {expose, proxy} from 'comlink'
import {wasmDatabase} from '#/database/driver/WasmDatabase.js'
import {EntryRuntime, type EntryDelta} from '#/database/runtime/EntryRuntime.js'
import {QueryWorker} from '#/database/browser/QueryWorker.js'
import {ReplicaCache} from '#/database/browser/ReplicaCache.js'
import {Permission} from '#/core/Role.js'
import {PayloadLoader} from '#/database/browser/PayloadLoader.js'
import {HttpFrameReader} from '#/database/replica/Transport.js'
import type {FrameDescriptor} from '#/database/replica/Frame.js'
import {config, replicaIdentity} from './config.js'

const loads: Array<string> = []
const ready = (async () => {
  const cache = await ReplicaCache.open(indexedDB, replicaIdentity)
  // Test-only grant endpoint. Production will authenticate before returning keys.
  const wire: Array<{
    descriptor: Omit<FrameDescriptor, 'nonce'> & {nonce: Array<number>}
    key: Array<number>
    url: string
    offset: number
  }> = await (await fetch('/grants')).json()
  const grants = wire.map(grant => ({
    ...grant,
    descriptor: {
      ...grant.descriptor,
      nonce: new Uint8Array(grant.descriptor.nonce)
    },
    key: new Uint8Array(grant.key)
  }))
  const transport = new HttpFrameReader(grants)
  const snapshot = await cache.snapshot()
  function createLoader(revision: string) {
    return new PayloadLoader({
      identity: replicaIdentity,
      revision,
      grants,
      cache,
      read(frame, signal) {
        loads.push(frame.payloadId)
        return transport.read(frame, signal)
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
    // Test-only trusted index producer. Production grants must come from the handler.
    await cache.apply({
      ...delta,
      fromRevision:
        delta.fromRevision === 'empty' ? undefined : delta.fromRevision,
      entries: delta.entries.map(row => ({
        ...row,
        permissions: Permission.Explore | Permission.Read,
        fields: {title: Permission.Explore | Permission.Read}
      }))
    })
    await install(delta)
  },
  loads() {
    return loads.slice()
  }
}
expose(api)
