import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core.js'
import {cms} from '#test/cms.js'
import {IDBFactory} from 'fake-indexeddb'
import {EntryReplicaClient} from './EntryClient.js'
import {IndexedDBReplicaCache} from './IndexedDBCache.js'
import type {ReplicaTransport} from './Protocol.js'
import type {ReplicaState} from './Types.js'
import {FSSource} from '#/core/source/FSSource.js'
import {exportRuntimeDatabase} from '../runtime/Exporter.js'

describe('EntryReplicaClient', () => {
  test('installs authenticated state atomically and keeps the current resolver', async () => {
    const state: ReplicaState = {
      viewId: 'editor',
      recordAccess: {},
      runtime: {
        bundleId: 'release-1',
        bundleUrl: 'https://example.com/database.bin',
        revision: 'tree-1',
        entries: []
      }
    }
    let stateCalls = 0
    const transport: ReplicaTransport = {
      async bootstrap() {
        return {
          user: {id: 'user-1', roles: ['editor']},
          configId: 'config-1',
          configUrl: '/secret/config.js',
          cacheKey: 'site-1',
          policy: {root: 0, entries: []}
        }
      },
      async state(knownRevision) {
        stateCalls++
        return knownRevision === state.runtime.revision ? undefined : state
      },
      async mutate() {
        return {revision: 'tree-1', conflicts: []}
      },
      async command() {
        return {revision: 'tree-1'}
      }
    }
    const cache = new IndexedDBReplicaCache(new IDBFactory(), 'entry-client')
    const client = new EntryReplicaClient({transport, cache})

    expect(await client.sync()).toMatchObject({
      revision: 'tree-1',
      changed: true
    })
    expect(
      await client.resolver(cms.config).resolve({select: Entry.id})
    ).toEqual([])
    expect(client.resolver(cms.config)).toBe(client.resolver(cms.config))
    const tracked = client.trackedResolver(cms.config)
    expect(await tracked.resolver.resolve({select: Entry.id})).toEqual([])
    expect([...tracked.dependencies()]).toEqual(['revision:*'])
    expect(await client.sync()).toMatchObject({
      revision: 'tree-1',
      changed: false
    })
    expect(stateCalls).toBe(2)
    expect(await cache.state('site-1')).toEqual(state)
  })

  test('opens a filtered runtime index without hydrating normalized records', async () => {
    const source = new FSSource('test/fixtures/demo')
    const release = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'release-2',
      bundleUrl: 'https://example.com/payload.bundle',
      source,
      compression: 'none'
    })
    const state: ReplicaState = {
      viewId: 'editor',
      recordAccess: Object.fromEntries(
        release.index.entries.map(entry => [entry.id, 'read'])
      ),
      runtime: {...release.index, source: undefined}
    }
    const transport: ReplicaTransport = {
      async bootstrap() {
        return {
          user: {id: 'user-1', roles: ['editor']},
          configId: 'config-1',
          configUrl: '/secret/config.js',
          cacheKey: 'runtime:release-2',
          policy: {root: 0, entries: []}
        }
      },
      async state(knownRevision) {
        return knownRevision === state.runtime.revision ? undefined : state
      },
      async mutate() {
        return {revision: state.runtime.revision, conflicts: []}
      },
      async command() {
        return {revision: state.runtime.revision}
      }
    }
    let rangeReads = 0
    const fetch = (async (_input, init) => {
      rangeReads++
      const range = new Headers(init?.headers).get('range')!
      const [, from, to] = /^bytes=(\d+)-(\d+)$/.exec(range)!
      return new Response(release.bundle.slice(Number(from), Number(to) + 1), {
        status: 206
      })
    }) as typeof globalThis.fetch
    const client = new EntryReplicaClient({
      transport,
      cache: new IndexedDBReplicaCache(
        new IDBFactory(),
        'runtime-entry-client'
      ),
      fetch
    })

    await client.sync()
    expect(
      await client.resolver(cms.config).resolve({
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: Entry.id,
        first: true
      })
    ).toBe('oi4qtV9YaXNRIUDT2s61Y')
    expect(rangeReads).toBe(0)
    expect(
      await client.resolver(cms.config).resolve({
        id: 'oi4qtV9YaXNRIUDT2s61Y',
        select: cms.config.schema.DemoRecipe.intro,
        first: true
      })
    ).toEqual(expect.any(Array))
    expect(rangeReads).toBe(1)
    expect([...client.trackedResolver(cms.config).dependencies()]).toEqual([
      'revision:*'
    ])
  })
})
