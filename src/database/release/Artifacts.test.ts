import {expect, test} from 'bun:test'
import type {Config} from '#/core/Config.js'
import type {Source} from '#/core/source/Source.js'
import type {RuntimeDatabaseExport} from '../runtime/Exporter.js'
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
