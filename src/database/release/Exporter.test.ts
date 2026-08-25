import {describe, expect, test} from 'bun:test'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {DatabaseSchema, DatabaseSnapshot} from '../Database.js'
import {ReplicaDatabaseReader} from '../Reader.js'
import {DatabaseIndex} from '../SecondaryIndex.js'
import {projectReplicaState} from '../handler/Projection.js'
import {
  BundleFrameLoader,
  MemoryRangeSource,
  MissingFrameGrantError
} from '../replica/Bundle.js'
import {JsonReplicaCodec, LazyIndexReader} from '../replica/IndexReader.js'
import {buildEntryReleaseArtifacts} from './Artifacts.js'
import {exportRelease} from './Exporter.js'

interface TestRecord {
  id: string
  group: string
  rank: number
}

const byGroup = new DatabaseIndex<TestRecord, string>({
  name: 'group',
  project(record) {
    return [{key: record.group, order: [record.rank], metadata: record.group}]
  }
})

describe('exportRelease', () => {
  test('builds co-located release artifacts with a separate config secret', async () => {
    const artifacts = await buildEntryReleaseArtifacts(
      cms.config,
      new FSSource('test/fixtures/demo'),
      {releaseId: 'release-secret', configId: 'config-secret'}
    )

    expect(artifacts.releasePath).toBe('admin/release/release-secret')
    expect(artifacts.releaseUrl).toBe(
      '/admin/release/release-secret/database.bin'
    )
    expect(artifacts.configUrl).toBe('/admin/config/config-secret/config.js')
    expect(artifacts.catalogJson).toContain('release-secret')
    expect(artifacts.handlerKeysJson).not.toContain('database.bin')
  })

  test('round trips records and ordered index buckets through range frames', async () => {
    const snapshot = new DatabaseSnapshot({
      schema: new DatabaseSchema<TestRecord>().add(byGroup),
      revision: 'tree-1',
      records: [
        {id: 'b', group: 'pages', rank: 2},
        {id: 'a', group: 'pages', rank: 1}
      ]
    })
    const release = await exportRelease({
      bundleId: 'release-secret',
      bundleUrl: '/admin/release/release-secret/database.bin',
      snapshot,
      accessClass({kind, record}) {
        return kind === 'record' ? `record:${record.id}` : 'index:pages'
      }
    })
    const grants = Object.entries(release.keys.accessClasses).map(
      ([accessClassId, key]) => ({accessClassId, key})
    )
    const loader = new BundleFrameLoader(
      release.catalog.bundleId,
      new MemoryRangeSource(release.bundle.contents),
      grants
    )
    const lazy = new LazyIndexReader<TestRecord, unknown>(
      release.catalog,
      loader,
      new JsonReplicaCodec()
    )
    const reader = new ReplicaDatabaseReader(lazy)

    expect(await reader.get('a')).toEqual({id: 'a', group: 'pages', rank: 1})
    const result = []
    for await (const item of reader.scan(byGroup, 'pages')) result.push(item)
    expect(result).toEqual([
      {id: 'a', order: [1], metadata: 'pages'},
      {id: 'b', order: [2], metadata: 'pages'}
    ])
    expect(release.catalog.revision).toBe('tree-1')
    expect(release.catalog.bundleUrl).toContain('release-secret')
  })

  test('keeps independently classified records inaccessible without a grant', async () => {
    const snapshot = new DatabaseSnapshot({
      schema: new DatabaseSchema<TestRecord>().add(byGroup),
      revision: 'tree-1',
      records: [{id: 'a', group: 'pages', rank: 1}]
    })
    const release = await exportRelease({
      bundleId: 'release-secret',
      bundleUrl: '/database.bin',
      snapshot,
      accessClass({kind}) {
        return kind === 'record' ? 'content' : 'indexes'
      }
    })
    const indexKey = release.keys.accessClasses.indexes
    const loader = new BundleFrameLoader(
      release.catalog.bundleId,
      new MemoryRangeSource(release.bundle.contents),
      [{accessClassId: 'indexes', key: indexKey}]
    )
    const record = release.catalog.records.a

    expect(() => loader.load(record)).toThrow(MissingFrameGrantError)
  })

  test('splits shared indexes so an authenticated view reveals only granted rows', async () => {
    const snapshot = new DatabaseSnapshot({
      schema: new DatabaseSchema<TestRecord>().add(byGroup),
      revision: 'tree-1',
      records: [
        {id: 'a', group: 'pages', rank: 1},
        {id: 'b', group: 'pages', rank: 2}
      ]
    })
    const release = await exportRelease({
      bundleId: 'release-secret',
      bundleUrl: '/database.bin',
      snapshot,
      accessClass({record}) {
        return `entry:${record.id}`
      }
    })
    const state = projectReplicaState({
      viewId: 'only-a',
      catalog: release.catalog,
      keys: release.keys,
      accessClasses: new Set(['entry:a']),
      recordAccess: {a: 'read'}
    })
    const loader = new BundleFrameLoader(
      state.catalog.bundleId,
      new MemoryRangeSource(release.bundle.contents),
      state.grants
    )
    const lazy = new LazyIndexReader<TestRecord, unknown>(
      state.catalog,
      loader,
      new JsonReplicaCodec()
    )
    const reader = new ReplicaDatabaseReader(lazy)
    const visible = []
    for await (const item of reader.scan(byGroup, 'pages'))
      visible.push(item.id)

    expect(release.catalog.indexes['["group","pages"]']).toHaveLength(2)
    expect(visible).toEqual(['a'])
    expect(await reader.get('b')).toBeUndefined()
  })
})
