import {expect, test} from 'bun:test'
import {base64} from '#/core/util/Encoding.js'
import {replicaRangeSource} from './InlineBundles.js'
import type {ReplicaState} from './Types.js'

test('serves an inline live bundle without calling the range fallback', async () => {
  const contents = new Uint8Array([1, 2, 3, 4])
  const state: ReplicaState = {
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
