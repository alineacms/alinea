import type {Config} from '#/core/Config.js'
import {EntryIndex} from '#/core/db/EntryIndex.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {syncWith, type RemoteSource} from '#/core/source/Source.js'
import {entryInfo} from '#/core/util/EntryFilenames.js'
import {basename} from '#/core/util/Paths.js'
import type {Database} from 'rado'
import {entrySource} from '../entry/Schema.js'
import {SqlSource} from '../source/SqlSource.js'
import {
  CheckpointTable,
  checkpointFormat,
  type CheckpointIdentity
} from './Checkpoint.js'
import {EntryRuntime, type EntryReplacement} from './EntryRuntime.js'
import {buildFrames} from '../release/FrameStore.js'

/** Populate a fresh private database. Publish/close the file only after success.
 * The existing normalizer is build-only; opening a checkpoint never imports it.
 */
export async function buildDatabase(
  config: Config,
  db: Database,
  remote: RemoteSource,
  identity: CheckpointIdentity
): Promise<void> {
  if (
    (
      [
        'project',
        'epoch',
        'schemaId',
        'configId',
        'namespace',
        'releaseId'
      ] as const
    ).some(
      key => typeof identity[key] !== 'string' || identity[key].length === 0
    )
  )
    throw new Error('A complete checkpoint identity is required')
  await SqlSource.createSchema(db)
  await EntryRuntime.createSchema(db, 'uninitialized')
  await db.create(CheckpointTable)
  await db.transaction(
    async tx => {
      const snapshot = await SqlSource.create(tx, identity.namespace)
      await syncWith(snapshot, remote)
      const index = new EntryIndex(config)
      await index.syncWith(snapshot)
      const runtime = new EntryRuntime(config, tx)
      const entries: Array<EntryReplacement> = []
      for (const entry of index.filter({})) {
        const source = entrySource(entry)
        const [, versionStatus] = entryInfo(basename(entry.filePath, '.json'))
        const payloadId = await hashBlob(
          new TextEncoder().encode(JSON.stringify({data: entry.data, source}))
        )
        entries.push({
          entry: {...entry, versionStatus, ordinal: entries.length},
          payloadId,
          data: entry.data,
          source
        })
      }
      await runtime.apply({
        fromRevision: 'uninitialized',
        toRevision: index.sha,
        entries
      })
      await buildFrames(tx, identity)
      await tx.insert(CheckpointTable).values({
        id: 1,
        format: checkpointFormat,
        ...identity,
        sourceSha: index.sha
      })
    },
    {async: true}
  )
}
