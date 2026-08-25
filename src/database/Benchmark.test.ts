import {expect, test} from 'bun:test'
import {Entry} from '#/core.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {buildEntryDatabase} from './entry/Source.js'
import {DatabaseResolver} from './query/Resolver.js'
import {exportEntryRelease} from './release/Exporter.js'

test('entry database benchmark harness', async () => {
  const source = new FSSource('test/fixtures/demo')
  const buildStarted = performance.now()
  const snapshot = await buildEntryDatabase(cms.config, source)
  const buildMs = performance.now() - buildStarted
  const current = new DatabaseResolver(cms.config, snapshot)
  const query = {
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    first: true as const,
    select: {id: Entry.id, title: Entry.title, url: Entry.url}
  }
  const iterations = 100
  const queryStarted = performance.now()
  let currentResult: unknown
  for (let iteration = 0; iteration < iterations; iteration++)
    currentResult = await current.resolve(query)
  const queriesMs = performance.now() - queryStarted
  const release = await exportEntryRelease({
    bundleId: 'benchmark',
    bundleUrl: '/benchmark.bin',
    snapshot
  })

  expect(currentResult).toEqual({
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    title: 'Chocolate chip',
    url: '/recipes/chocolate-chip'
  })
  expect(snapshot.size).toBeGreaterThan(0)
  expect(release.bundle.contents.length).toBeGreaterThan(0)
  console.table({
    database: {
      buildMs: buildMs.toFixed(2),
      queriesMs: queriesMs.toFixed(2),
      records: snapshot.size,
      bundleBytes: release.bundle.contents.length
    }
  })
})
