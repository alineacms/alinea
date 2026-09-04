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
      recordAccess: {},
      runtime: {
        bundleId: 'release-1',
        bundleUrl: '/admin/release/release-1/database.bin',
        revision: 'tree-1',
        entries: []
      }
    }
    let commandBody: unknown
    const fetch = Object.assign(
      async function fetch(input: URL | RequestInfo, init?: RequestInit) {
        const action = new URL(String(input)).searchParams.get('action')
        if (action === 'replicaBootstrap')
          return Response.json({
            user: {id: 'user-1', roles: ['editor']},
            configId: 'config-1',
            configUrl: '/secret/config.js',
            cacheKey: 'site-1',
            policy: {root: 0, entries: []}
          })
        if (
          action === 'replicaState' &&
          new URL(String(input)).searchParams.get('revision') === 'tree-1'
        )
          return new Response(null, {status: 204})
        if (action === 'replicaState')
          return Response.json(serializeReplicaState(state))
        if (action === 'replicaCommand') {
          commandBody = JSON.parse(String(init?.body))
          return Response.json({revision: 'tree-1'})
        }
        throw new Error(`Unexpected request: ${input}`)
      },
      {preconnect() {}}
    )
    const client = {
      async mutate() {
        throw new Error('Production mutations must use replica transports')
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
    expect(await db.mutate([{op: 'remove', id: 'entry-1'}])).toEqual({
      sha: 'tree-1'
    })
    expect(commandBody).toEqual([{kind: 'removeEntry', id: 'entry-1'}])
  })
})
