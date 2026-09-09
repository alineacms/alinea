import type {Config} from '#/core/Config.js'
import {syncWith, type RemoteSource} from '#/core/source/Source.js'
import type {Database} from 'rado'
import {SqlSource} from '../source/SqlSource.js'
import {
  CheckpointTable,
  checkpointFormat,
  type CheckpointIdentity
} from './Checkpoint.js'
import {EntryRuntime} from './EntryRuntime.js'
import {buildFrames} from '../release/FrameStore.js'
import {normalizeSource, SourceRecordTable} from './NormalizeSource.js'
import {EntryReferenceTable, replaceEntryReferences} from './EntryReferences.js'

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
  await db.create(CheckpointTable, SourceRecordTable, EntryReferenceTable)
  await db.transaction(
    async tx => {
      const snapshot = await SqlSource.create(tx, identity.namespace)
      await syncWith(snapshot, remote)
      const {entries, revision} = await normalizeSource(config, tx, snapshot)
      const runtime = new EntryRuntime(config, tx)
      await runtime.apply({
        fromRevision: 'uninitialized',
        toRevision: revision,
        entries
      })
      for (const entry of entries)
        await replaceEntryReferences(config, tx, entry)
      await buildFrames(tx, identity)
      await tx.insert(CheckpointTable).values({
        id: 1,
        format: checkpointFormat,
        ...identity,
        sourceSha: revision
      })
    },
    {async: true}
  )
}
