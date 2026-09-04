import {expect, test} from 'bun:test'
import {
  deserializeFrame,
  deserializeReplicaState,
  serializeFrame,
  serializeReplicaState
} from './Serialization.js'
import type {ReplicaState} from './Types.js'

test('round trips runtime replica state and frame nonces through JSON', () => {
  const frame = {
    id: 'entry-a',
    accessClassId: 'read-a',
    offset: 1,
    length: 2,
    nonce: new Uint8Array([1, 2, 3]),
    compression: 'gzip' as const
  }
  expect(
    deserializeFrame(
      JSON.parse(JSON.stringify(serializeFrame(frame))),
      frame.id,
      frame.accessClassId
    )
  ).toEqual(frame)

  const state: ReplicaState = {
    viewId: 'editor',
    runtime: {
      revision: 'tree-1',
      bundleId: 'release-1',
      bundleUrl: '/payload.bundle',
      entries: []
    }
  }
  expect(
    deserializeReplicaState(
      JSON.parse(JSON.stringify(serializeReplicaState(state)))
    )
  ).toEqual(state)
})
