import {expect, test} from 'bun:test'
import type {Config} from '#/core/Config.js'
import {FSSource} from '#/core/source/FSSource.js'
import type {Source} from '#/core/source/Source.js'
import {cms} from '#test/cms.js'
import {SourceDB} from '../entry/SourceDB.js'
import {MemoryRangeSource} from '../replica/Bundle.js'
import type {RuntimeDatabaseExport} from '../runtime/Exporter.js'
import {exportRuntimeDatabase} from '../runtime/Exporter.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {buildEntryReleaseArtifacts} from './Artifacts.js'

test('reuses a complete runtime export without reopening the source', async () => {
  const runtime: RuntimeDatabaseExport = {
    index: {
      revision: 'revision',
      bundleId: 'internal-bundle',
      bundleUrl: 'alinea:runtime/internal-bundle',
      entries: []
    },
    bundle: new Uint8Array([1, 2, 3])
  }
  const source = {
    getTree() {
      throw new Error('Source should not be opened')
    }
  } as unknown as Source
  const artifacts = await buildEntryReleaseArtifacts(
    {adminPath: '/admin'} as Config,
    source,
    {releaseId: 'release', configId: 'config', runtime}
  )

  expect(artifacts.runtime.bundle).toBe(runtime.bundle)
  expect(artifacts.runtime.index).toEqual({
    ...runtime.index,
    bundleUrl: '/admin/release/payload.bundle'
  })
})

test('publishes a reused runtime at a new URL without changing its authenticated bundle id', async () => {
  const source = new FSSource('test/fixtures/demo')
  const generated = await exportRuntimeDatabase({
    config: cms.config,
    source,
    bundleId: 'encrypted-bundle',
    bundleUrl: 'alinea:runtime/encrypted-bundle',
    compression: 'none'
  })
  const artifacts = await buildEntryReleaseArtifacts(cms.config, source, {
    releaseId: 'deployment-release',
    configId: 'config',
    runtime: generated
  })
  const store = new RuntimeEntryStore({
    index: artifacts.runtime.index,
    source: () => new MemoryRangeSource(artifacts.runtime.bundle)
  })
  const db = new SourceDB(cms.config, store)

  expect(artifacts.runtime.index.bundleId).toBe('encrypted-bundle')
  expect(artifacts.runtime.index.bundleUrl).toBe(
    '/admin/deployment-release/payload.bundle'
  )
  expect(
    await db.get({
      type: cms.schema.DemoRecipe,
      path: 'chocolate-chip',
      select: cms.schema.DemoRecipe.intro
    })
  ).toEqual(expect.any(Array))
})
