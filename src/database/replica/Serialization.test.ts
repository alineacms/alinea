import {describe, expect, test} from 'bun:test'
import {
  deserializeHandlerKeys,
  deserializeReplicaState,
  serializeHandlerKeys,
  serializeReplicaState
} from './Serialization.js'
import type {ReplicaState} from './Types.js'

describe('replica wire serialization', () => {
  test('round trips catalog nonces and authenticated grants through JSON', () => {
    const frame = {
      id: 'record-a',
      accessClassId: 'read-a',
      offset: 1,
      length: 2,
      nonce: new Uint8Array([1, 2, 3]),
      cipherHash: 'hash',
      compression: 'gzip' as const
    }
    const state: ReplicaState = {
      viewId: 'editor',
      catalog: {
        version: 1,
        bundleId: 'release-1',
        bundleUrl: '/secret/database.bin',
        revision: 'tree-1',
        records: {a: frame},
        indexes: {all: [frame]}
      },
      grants: [{accessClassId: 'read-a', key: new Uint8Array([4, 5, 6])}],
      recordAccess: {a: 'read'}
    }
    const encoded = JSON.parse(JSON.stringify(serializeReplicaState(state)))

    expect(deserializeReplicaState(encoded)).toEqual(state)
  })

  test('round trips the server-only key catalog through JSON', () => {
    const keys = {
      version: 1 as const,
      bundleId: 'release-1',
      revision: 'tree-1',
      accessClasses: {read: new Uint8Array([7, 8, 9])}
    }
    const encoded = JSON.parse(JSON.stringify(serializeHandlerKeys(keys)))

    expect(deserializeHandlerKeys(encoded)).toEqual(keys)
  })
})
