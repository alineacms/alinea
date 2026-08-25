import {describe, expect, test} from 'bun:test'
import {DatabaseSchema, DatabaseSnapshot} from '../Database.js'
import {ReplicaDatabaseReader} from '../Reader.js'
import {DatabaseIndex} from '../SecondaryIndex.js'
import {CatalogFrameLoader, MemoryRangeSource} from '../replica/Bundle.js'
import {JsonReplicaCodec, LazyIndexReader} from '../replica/IndexReader.js'
import {exportReleaseDelta} from './Delta.js'
import {exportRelease} from './Exporter.js'

interface TestRecord {
  id: string
  group: string
  rank: number
  title: string
}

const byGroup = new DatabaseIndex<TestRecord, string>({
  name: 'group',
  project(record) {
    return [{key: record.group, order: [record.rank], metadata: record.title}]
  }
})

describe('exportReleaseDelta', () => {
  test('reuses static frames and encrypts only changed records and buckets', async () => {
    const before = new DatabaseSnapshot({
      schema: new DatabaseSchema<TestRecord>().add(byGroup),
      revision: 'tree-1',
      records: [
        {id: 'a', group: 'pages', rank: 1, title: 'A'},
        {id: 'b', group: 'pages', rank: 2, title: 'B'},
        {id: 'c', group: 'pages', rank: 3, title: 'C'}
      ]
    })
    const base = await exportRelease({
      bundleId: 'base',
      bundleUrl: '/static/base.bin',
      snapshot: before,
      accessClass: () => 'read'
    })
    const commit = before.apply('tree-2', [
      {
        op: 'put',
        record: {id: 'a', group: 'pages', rank: 1, title: 'Updated'}
      },
      {
        op: 'put',
        record: {id: 'b', group: 'other', rank: 2, title: 'B'}
      },
      {op: 'delete', id: 'c'}
    ])
    const delta = await exportReleaseDelta({
      bundleId: 'overlay-1',
      bundleUrl: '/api?action=replicaBundle&bundle=overlay-1',
      snapshot: commit.snapshot,
      changes: commit.changes,
      previousCatalog: base.catalog,
      previousKeys: base.keys,
      accessClass: () => 'read'
    })
    const grants = Object.entries(delta.keys.accessClasses).map(
      ([accessClassId, key]) => ({accessClassId, key})
    )
    const loader = new CatalogFrameLoader(
      delta.catalog.bundleId,
      delta.catalog.bundleUrl,
      url =>
        new MemoryRangeSource(
          url === '/static/base.bin'
            ? base.bundle.contents
            : delta.overlay.contents
        ),
      grants
    )
    const reader = new ReplicaDatabaseReader(
      new LazyIndexReader<TestRecord, unknown>(
        delta.catalog,
        loader,
        new JsonReplicaCodec()
      )
    )
    const pages = []
    for await (const item of reader.scan(byGroup, 'pages')) pages.push(item.id)
    const other = []
    for await (const item of reader.scan(byGroup, 'other')) other.push(item.id)

    expect(delta.overlay.frames).toHaveLength(4)
    expect(await reader.get('a')).toEqual({
      id: 'a',
      group: 'pages',
      rank: 1,
      title: 'Updated'
    })
    expect(await reader.get('c')).toBeUndefined()
    expect(pages).toEqual(['a'])
    expect(other).toEqual(['b'])
  })
})
