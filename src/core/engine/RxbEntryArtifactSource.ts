import type {Config} from '../Config.js'
import {createRecord} from '../EntryRecord.js'
import type {Policy} from '../Role.js'
import {sourceChanges} from '../db/CommitRequest.js'
import type {Mutation} from '../db/Mutation.js'
import {MemorySource} from '../source/MemorySource.js'
import {syncWith, type RemoteSource} from '../source/Source.js'
import {ReadonlyTree} from '../source/Tree.js'
import {EntryIndex} from './EntryIndex.js'
import {EntryTransaction} from './EntryTransaction.js'
import {
  createRxbEntryArtifact,
  type RxbEntryArtifact,
  type RxbEntryRow
} from './RxbEntryArtifact.js'

function createSourceFromRxbEntryArtifact(
  artifact: RxbEntryArtifact
): MemorySource {
  const tree = ReadonlyTree.fromFlat(artifact.payload.tree)
  const blobs = new Map<string, Uint8Array>()
  for (const row of Object.values(artifact.payload.rowsById)) {
    blobs.set(row.fileHash, encodeRxbEntryRow(row))
  }
  return new MemorySource(tree, blobs)
}

export async function applyRxbEntryMutations(
  config: Config,
  artifact: RxbEntryArtifact,
  mutations: Array<Mutation>,
  options: {policy?: Policy} = {}
): Promise<RxbEntryArtifact> {
  const source = createSourceFromRxbEntryArtifact(artifact)
  const index = new EntryIndex(config)
  await index.syncWith(source)
  const from = await source.getTree()
  const tx = new EntryTransaction(config, index, source, from, options.policy)
  tx.apply(mutations)
  const request = await tx.toRequest()
  const batch = sourceChanges(request)
  if (batch.changes.length) {
    await index.indexChanges(batch)
    await source.applyChanges(batch)
  }
  return createRxbEntryArtifact(index.snapshot, {
    configHash: artifact.meta.configHash,
    contentHash: index.sha
  })
}

export async function syncRxbEntryArtifact(
  config: Config,
  artifact: RxbEntryArtifact,
  remote: RemoteSource
): Promise<RxbEntryArtifact> {
  const source = createSourceFromRxbEntryArtifact(artifact)
  await syncWith(source, remote)
  const index = new EntryIndex(config)
  await index.syncWith(source)
  return createRxbEntryArtifact(index.snapshot, {
    configHash: artifact.meta.configHash,
    contentHash: index.sha
  })
}

function encodeRxbEntryRow(row: RxbEntryRow): Uint8Array {
  const record = createRecord(
    {
      id: row.id,
      type: row.type,
      index: row.index,
      root: row.root,
      path: row.path,
      title: row.title,
      seeded: row.seeded,
      data: row.data,
      parentId: row.parentId
    },
    row.versionStatus ?? row.status
  )
  return new TextEncoder().encode(JSON.stringify(record, null, 2))
}
