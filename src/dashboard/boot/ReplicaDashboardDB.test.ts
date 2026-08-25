import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core.js'
import type {LocalConnection} from '#/core/Connection.js'
import {cms} from '#test/cms.js'
import {serializeReplicaState} from '#/database/replica/Serialization.js'
import type {ReplicaState} from '#/database/replica/Types.js'
import {IDBFactory} from 'fake-indexeddb'
import {ReplicaDashboardDB} from './ReplicaDashboardDB.js'

describe('ReplicaDashboardDB', () => {
  test('boots production reads without hydrating LocalDB or EntryIndex', async () => {
    const state: ReplicaState = {
      viewId: 'editor',
      catalog: {
        version: 1,
        bundleId: 'release-1',
        bundleUrl: '/admin/release/release-1/database.bin',
        revision: 'tree-1',
        records: {},
        indexes: {}
      },
      grants: [],
      recordAccess: {}
    }
    const fetch = Object.assign(
      async function fetch(input: URL | RequestInfo) {
        const action = new URL(String(input)).searchParams.get('action')
        if (action === 'replicaBootstrap')
          return Response.json({
            user: {id: 'user-1', roles: ['editor']},
            configId: 'config-1',
            configUrl: '/secret/config.js',
            cacheKey: 'site-1'
          })
        if (action === 'replicaState')
          return Response.json(serializeReplicaState(state))
        throw new Error(`Unexpected request: ${input}`)
      },
      {preconnect() {}}
    )
    const client = {
      async mutate() {
        return {sha: 'tree-1'}
      },
      async prepareUpload() {
        throw new Error('Not used')
      }
    } as unknown as LocalConnection
    const db = await ReplicaDashboardDB.load(
      cms.config,
      client,
      'https://example.com/api/cms',
      new IDBFactory(),
      fetch
    )

    expect(await db.resolve({select: Entry.id})).toEqual([])
    expect(db.sha).toBe('tree-1')
    expect((await db.referencesTo({targetId: 'missing'})).total).toBe(0)
  })
})
