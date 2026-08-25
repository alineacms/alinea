import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core.js'
import {cms} from '#test/cms.js'
import {IDBFactory} from 'fake-indexeddb'
import {EntryReplicaClient} from './EntryClient.js'
import {IndexedDBReplicaCache} from './IndexedDBCache.js'
import type {ReplicaTransport} from './Protocol.js'
import type {ReplicaState} from './Types.js'
import type {AlineaDatabaseRecord} from '../entry/Model.js'

describe('EntryReplicaClient', () => {
  test('installs authenticated state atomically and keeps the current resolver', async () => {
    const state: ReplicaState = {
      viewId: 'editor',
      catalog: {
        version: 1,
        bundleId: 'release-1',
        bundleUrl: 'https://example.com/database.bin',
        revision: 'tree-1',
        records: {},
        indexes: {}
      },
      grants: [],
      recordAccess: {}
    }
    let stateCalls = 0
    const transport: ReplicaTransport = {
      async bootstrap() {
        return {
          user: {id: 'user-1', roles: ['editor']},
          configId: 'config-1',
          configUrl: '/secret/config.js',
          cacheKey: 'site-1'
        }
      },
      async state(knownRevision) {
        stateCalls++
        return knownRevision === state.catalog.revision ? undefined : state
      },
      async mutate() {
        return {revision: 'tree-1', conflicts: []}
      }
    }
    const cache = new IndexedDBReplicaCache<AlineaDatabaseRecord>(
      new IDBFactory(),
      'entry-client'
    )
    const client = new EntryReplicaClient({transport, cache})

    expect(await client.sync()).toMatchObject({
      revision: 'tree-1',
      changed: true
    })
    expect(
      await client.resolver(cms.config).resolve({select: Entry.id})
    ).toEqual([])
    expect(client.resolver(cms.config)).toBe(client.resolver(cms.config))
    expect(await client.sync()).toMatchObject({
      revision: 'tree-1',
      changed: false
    })
    expect(stateCalls).toBe(2)
    expect(await cache.state('site-1')).toEqual(state)
  })
})
