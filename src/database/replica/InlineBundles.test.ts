import {expect, test} from 'bun:test'
import {base64} from '#/core/util/Encoding.js'
import type {RuntimeIndexEntry} from '../runtime/Model.js'
import {createRuntimeDelta} from '../runtime/Snapshot.js'
import {applyReplicaState, replicaRangeSource} from './InlineBundles.js'
import type {ReplicaSnapshotState} from './Types.js'

test('serves an inline live bundle without calling the range fallback', async () => {
  const contents = new Uint8Array([1, 2, 3, 4])
  const state: ReplicaSnapshotState = {
    viewId: 'view',
    runtime: {
      revision: 'tree',
      bundleId: 'base',
      bundleUrl: '/base.bundle',
      entries: []
    },
    inlineBundles: {overlay: base64.stringify(contents)}
  }
  let fallbackReads = 0
  const source = replicaRangeSource(state, () => ({
    async read() {
      fallbackReads++
      return new Uint8Array()
    }
  }))('/api?action=replicaBundle&bundle=overlay')

  expect(await source.read(1, 2)).toEqual(new Uint8Array([2, 3]))
  expect(fallbackReads).toBe(0)
})

test('applies a replica delta and retains only live inline bundles', () => {
  const first = entry('first', 'old')
  const previous: ReplicaSnapshotState = {
    viewId: 'view',
    runtime: {
      revision: 'one',
      bundleId: 'base',
      bundleUrl: '/base.bundle',
      entries: [first]
    },
    inlineBundles: {
      old: base64.stringify(new Uint8Array([1])),
      retired: base64.stringify(new Uint8Array([2]))
    }
  }
  const second = entry('second', 'new')
  const runtime = {
    ...previous.runtime,
    revision: 'two',
    entries: [first, second]
  }

  const state = applyReplicaState(previous, {
    viewId: 'view',
    delta: createRuntimeDelta(previous.runtime, runtime, 'new', '/new.bundle'),
    inlineBundles: {new: base64.stringify(new Uint8Array([3]))}
  })

  expect(state.runtime).toEqual(runtime)
  expect(Object.keys(state.inlineBundles!)).toEqual(['old', 'new'])
})

function entry(entryId: string, bundleId: string): RuntimeIndexEntry {
  return {
    kind: 'entry',
    id: `entry:${entryId}`,
    queryable: true,
    entryId,
    versionStatus: 'published',
    status: 'published',
    active: true,
    main: true,
    type: 'Page',
    title: entryId,
    seeded: null,
    workspace: 'main',
    root: 'pages',
    locale: null,
    level: 0,
    index: entryId,
    parentId: null,
    parents: [],
    path: entryId,
    url: `/${entryId}`,
    frames: {
      decodeKey: 'key',
      data: {
        bundleId,
        bundleUrl: `/${bundleId}.bundle`,
        offset: 0,
        length: 1,
        nonce: '',
        compression: 'none'
      }
    }
  }
}
