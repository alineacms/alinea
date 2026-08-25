import {expect, test} from 'bun:test'
import {Entry} from '#/core.js'
import {EntryIndex} from '#/core/db/EntryIndex.js'
import {EntryResolver} from '#/core/db/EntryResolver.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {buildEntryDatabase} from './entry/Source.js'
import {DatabaseResolver} from './query/Resolver.js'
import {exportEntryRelease} from './release/Exporter.js'

test('entry database benchmark harness', async () => {
  const source = new FSSource('test/fixtures/demo')
  const legacyStarted = performance.now()
  const index = new EntryIndex(cms.config)
  await index.syncWith(source)
  const legacyBuildMs = performance.now() - legacyStarted
  const currentStarted = performance.now()
  const snapshot = await buildEntryDatabase(cms.config, source)
  const currentBuildMs = performance.now() - currentStarted
  const legacy = new EntryResolver(cms.config, index)
  const current = new DatabaseResolver(cms.config, snapshot)
  const legacyRecords = await legacy.resolve({count: true, status: 'all'})
  const query = {
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    first: true as const,
    select: {id: Entry.id, title: Entry.title, url: Entry.url}
  }
  const iterations = 100
  const legacyQueryStarted = performance.now()
  let legacyResult: unknown
  for (let iteration = 0; iteration < iterations; iteration++)
    legacyResult = await legacy.resolve(query)
  const legacyQueryMs = performance.now() - legacyQueryStarted
  const currentQueryStarted = performance.now()
  let currentResult: unknown
  for (let iteration = 0; iteration < iterations; iteration++)
    currentResult = await current.resolve(query)
  const currentQueryMs = performance.now() - currentQueryStarted
  const release = await exportEntryRelease({
    bundleId: 'benchmark',
    bundleUrl: '/benchmark.bin',
    snapshot
  })

  expect(currentResult).toEqual(legacyResult)
  expect(snapshot.size).toBeGreaterThan(legacyRecords)
  expect(release.bundle.contents.length).toBeGreaterThan(0)
  console.table({
    legacy: {
      buildMs: legacyBuildMs.toFixed(2),
      queriesMs: legacyQueryMs.toFixed(2),
      records: legacyRecords,
      bundleBytes: '-'
    },
    database: {
      buildMs: currentBuildMs.toFixed(2),
      queriesMs: currentQueryMs.toFixed(2),
      records: snapshot.size,
      bundleBytes: release.bundle.contents.length
    }
  })
})
