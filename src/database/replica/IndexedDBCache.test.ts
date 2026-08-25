import {describe, expect, test} from 'bun:test'
import {DatabaseSchema, DatabaseSnapshot} from '../Database.js'
import {CachedDatabaseReader, SnapshotDatabaseReader} from '../Reader.js'
import {
  BundleFrameLoader,
  encryptFrame,
  MemoryRangeSource,
  packEncryptedFrames
} from './Bundle.js'
import {IndexedDBReplicaCache} from './IndexedDBCache.js'
import type {ReplicaState} from './Types.js'
import {IDBFactory} from 'fake-indexeddb'

interface TestRecord {
  id: string
  value: string
}

describe('IndexedDBReplicaCache', () => {
  test('reuses authenticated ciphertext without another range request', async () => {
    const cache = new IndexedDBReplicaCache<TestRecord>(
      new IDBFactory(),
      'ciphertext'
    )
    const key = new Uint8Array(32).fill(7)
    const encrypted = await encryptFrame({
      bundleId: 'release-1',
      id: 'record-a',
      accessClassId: 'read-a',
      key,
      contents: new TextEncoder().encode('Contents')
    })
    const bundle = packEncryptedFrames([encrypted])
    const grant = [{accessClassId: 'read-a', key}]
    const first = new BundleFrameLoader(
      'release-1',
      new MemoryRangeSource(bundle.contents),
      grant,
      cache
    )
    expect(new TextDecoder().decode(await first.load(bundle.frames[0]))).toBe(
      'Contents'
    )
    const second = new BundleFrameLoader(
      'release-1',
      {
        async read() {
          throw new Error('Unexpected network range request')
        }
      },
      grant,
      cache
    )

    expect(new TextDecoder().decode(await second.load(bundle.frames[0]))).toBe(
      'Contents'
    )
  })

  test('atomically retains the latest authenticated state', async () => {
    const cache = new IndexedDBReplicaCache<TestRecord>(
      new IDBFactory(),
      'state'
    )
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
      grants: [],
      recordAccess: {}
    }
    await cache.installState('user-1', state)

    expect(await cache.state('user-1')).toEqual(state)
  })

  test('caches decoded objects by view and revision', async () => {
    const cache = new IndexedDBReplicaCache<TestRecord>(
      new IDBFactory(),
      'objects'
    )
    const snapshot = new DatabaseSnapshot({
      schema: new DatabaseSchema<TestRecord>(),
      revision: 'tree-1',
      records: [{id: 'a', value: 'A'}]
    })
    const source = new SnapshotDatabaseReader(snapshot)
    const first = new CachedDatabaseReader(source, cache, 'editor')
    expect(await first.get('a')).toEqual({id: 'a', value: 'A'})
    const offline = new CachedDatabaseReader<TestRecord>(
      {
        revision: 'tree-1',
        async get() {
          throw new Error('Unexpected object load')
        },
        scan() {
          throw new Error('Not used')
        }
      },
      cache,
      'editor'
    )

    expect(await offline.get('a')).toEqual({id: 'a', value: 'A'})
  })
})
