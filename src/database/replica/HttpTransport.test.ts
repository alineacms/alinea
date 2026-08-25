import {describe, expect, test} from 'bun:test'
import {HttpRangeSource, HttpReplicaTransport} from './HttpTransport.js'
import {serializeReplicaState} from './Serialization.js'
import type {ReplicaState} from './Types.js'

describe('HttpReplicaTransport', () => {
  test('loads authenticated bootstrap and deserializes state', async () => {
    const state: ReplicaState = {
      viewId: 'editor',
      catalog: {
        version: 1,
        bundleId: 'release-1',
        bundleUrl: '/secret/database.bin',
        revision: 'tree-1',
        records: {},
        indexes: {}
      },
      grants: [{accessClassId: 'read', key: new Uint8Array([1, 2, 3])}],
      recordAccess: {}
    }
    const actions: Array<string | null> = []
    const fetch = Object.assign(
      async function fetch(input: URL | RequestInfo) {
        const url = new URL(String(input))
        const action = url.searchParams.get('action')
        actions.push(action)
        if (action === 'replicaBootstrap')
          return Response.json({
            user: {id: 'user-1', roles: ['editor']},
            configId: 'config-1',
            configUrl: '/secret/config.js',
            cacheKey: 'cache-1'
          })
        if (action === 'replicaEligible') return Response.json(['entry-a'])
        return Response.json(serializeReplicaState(state))
      },
      {preconnect() {}}
    )
    const transport = new HttpReplicaTransport({
      handlerUrl: 'https://example.com/api/cms',
      fetch
    })

    expect((await transport.bootstrap()).configId).toBe('config-1')
    expect(await transport.state()).toEqual(state)
    expect(await transport.eligible('{"filter":{}}')).toEqual(['entry-a'])
    expect(actions).toEqual([
      'replicaBootstrap',
      'replicaState',
      'replicaEligible'
    ])
  })

  test('sends byte ranges and handles static hosts that ignore Range', async () => {
    const contents = new Uint8Array([0, 1, 2, 3, 4, 5])
    let requestedRange = ''
    const fetch = Object.assign(
      async function fetch(_input: URL | RequestInfo, init?: RequestInit) {
        requestedRange = new Headers(init?.headers).get('range') ?? ''
        return new Response(contents)
      },
      {preconnect() {}}
    )
    const source = new HttpRangeSource(
      'https://example.com/secret/database.bin',
      fetch
    )

    expect(await source.read(2, 3)).toEqual(new Uint8Array([2, 3, 4]))
    expect(requestedRange).toBe('bytes=2-4')
  })
})
