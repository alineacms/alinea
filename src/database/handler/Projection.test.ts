import {describe, expect, test} from 'bun:test'
import type {HandlerKeyCatalog} from '../release/Exporter.js'
import type {FrameDescriptor, ReplicaCatalog} from '../replica/Types.js'
import {projectReplicaState} from './Projection.js'

function frame(id: string, accessClassId: string): FrameDescriptor {
  return {
    id,
    accessClassId,
    offset: 0,
    length: 1,
    nonce: new Uint8Array(12),
    cipherHash: id,
    compression: 'none'
  }
}

describe('projectReplicaState', () => {
  test('returns only authenticated records, index fragments, and keys', () => {
    const explore = frame('entry-a', 'explore-a')
    const read = frame('payload-a', 'read-a')
    const hidden = frame('entry-b', 'explore-b')
    const catalog: ReplicaCatalog = {
      version: 1,
      bundleId: 'release-1',
      bundleUrl: '/admin/release/secret/database.bin',
      revision: 'tree-1',
      records: {a: explore, payloadA: read, b: hidden},
      indexes: {all: [explore, hidden], payloads: [read]}
    }
    const keys: HandlerKeyCatalog = {
      version: 1,
      bundleId: 'release-1',
      revision: 'tree-1',
      accessClasses: {
        'explore-a': new Uint8Array([1]),
        'read-a': new Uint8Array([2]),
        'explore-b': new Uint8Array([3])
      }
    }
    const state = projectReplicaState({
      viewId: 'user-1',
      catalog,
      keys,
      accessClasses: new Set(['explore-a']),
      recordAccess: {a: 'explore', b: 'read'}
    })

    expect(Object.keys(state.catalog.records)).toEqual(['a'])
    expect(state.catalog.indexes.all).toEqual([explore])
    expect(state.catalog.indexes.payloads).toBeUndefined()
    expect(state.grants).toEqual([
      {accessClassId: 'explore-a', key: new Uint8Array([1])}
    ])
    expect(state.recordAccess).toEqual({a: 'explore'})
  })

  test('rejects mismatched public and handler artifacts', () => {
    const catalog: ReplicaCatalog = {
      version: 1,
      bundleId: 'release-1',
      bundleUrl: '/database.bin',
      revision: 'tree-1',
      records: {},
      indexes: {}
    }
    expect(() =>
      projectReplicaState({
        viewId: 'user-1',
        catalog,
        keys: {
          version: 1,
          bundleId: 'release-2',
          revision: 'tree-1',
          accessClasses: {}
        },
        accessClasses: new Set(),
        recordAccess: {}
      })
    ).toThrow('different bundles')
  })
})
