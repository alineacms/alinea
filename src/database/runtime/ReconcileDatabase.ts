import type {Config} from '#/core/Config.js'
import {bundleContents, type RemoteSource} from '#/core/source/Source.js'
import {eq, inArray, type Database} from 'rado'
import {entryIndexRow} from '../entry/Schema.js'
import {SqlSource} from '../source/SqlSource.js'
import {
  CheckpointTable,
  openCheckpoint,
  type CheckpointIdentity
} from './Checkpoint.js'
import {EntryRuntime, type EntryReplacement} from './EntryRuntime.js'
import {normalizeSource} from './NormalizeSource.js'
import {EntryReferenceTable, replaceEntryReferences} from './EntryReferences.js'
import {rebuildSearch} from '../query/Search.js'

/** Reconcile an exclusively owned writable checkpoint copy, never a published
 * release or a connection serving live queries. The owner swaps readers only
 * after commit; remote I/O is completed before holding the SQL transaction.
 */
export async function reconcileDatabase(
  config: Config,
  db: Database,
  remote: RemoteSource,
  identity: CheckpointIdentity
) {
  const {descriptor} = await openCheckpoint(config, db, identity)
  const remoteTree = await remote.getTreeIfDifferent(descriptor.sourceSha)
  if (!remoteTree || remoteTree.sha === descriptor.sourceSha)
    return {revision: descriptor.sourceSha, parsed: 0, replaced: 0, removed: 0}
  const source = new SqlSource(db, identity.namespace)
  const tree = await source.getTree()
  const batch = await bundleContents(remote, tree.diff(remoteTree))
  return db.transaction(
    async tx => {
      const snapshot = new SqlSource(tx, identity.namespace)
      await snapshot.applyChanges(batch)
      const {entries, parsed, revision} = await normalizeSource(
        config,
        tx,
        snapshot
      )
      if (revision !== remoteTree.sha)
        throw new Error('Reconciled source revision mismatch')
      const runtime = new EntryRuntime(config, tx)
      const previous = await runtime.indexSnapshot()
      const remaining = new Map(
        previous.entries.map(row => [entryIndexRow(row.entry).versionId, row])
      )
      const changed: Array<EntryReplacement> = []
      for (const row of entries) {
        const index = entryIndexRow(row.entry)
        const before = remaining.get(index.versionId)
        remaining.delete(index.versionId)
        if (
          before &&
          before.payloadId === row.payloadId &&
          JSON.stringify(entryIndexRow(before.entry)) === JSON.stringify(index)
        )
          continue
        changed.push(
          before?.payloadId === row.payloadId
            ? {entry: row.entry, payloadId: row.payloadId}
            : row
        )
        if (before?.payloadId !== row.payloadId)
          await replaceEntryReferences(config, tx, row)
      }
      await runtime.apply({
        fromRevision: descriptor.sourceSha,
        toRevision: revision,
        entries: changed,
        removedVersionIds: [...remaining.keys()]
      })
      await rebuildSearch(tx)
      const removed = [...remaining.keys()]
      for (let offset = 0; offset < removed.length; offset += 100)
        await tx
          .delete(EntryReferenceTable)
          .where(
            inArray(
              EntryReferenceTable.versionId,
              removed.slice(offset, offset + 100)
            )
          )
      await tx
        .update(CheckpointTable)
        .set({sourceSha: revision})
        .where(eq(CheckpointTable.id, 1))
      return {
        revision,
        parsed,
        replaced: changed.length,
        removed: remaining.size
      }
    },
    {async: true}
  )
}
