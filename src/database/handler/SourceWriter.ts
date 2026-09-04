import type {Config} from '#/core/Config.js'
import {
  commitChanges,
  sourceChanges,
  type CommitChange,
  type CommitRequest
} from '#/core/db/CommitRequest.js'
import {EntryTransaction} from '#/core/db/EntryTransaction.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {createId} from '#/core/Id.js'
import type {Policy} from '#/core/Role.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import {bundleContents, type Source} from '#/core/source/Source.js'
import {exportRuntimeSourceChanges} from '../runtime/Exporter.js'
import type {RuntimeDatabaseIndex} from '../runtime/Model.js'
import {RuntimeSnapshot} from '../runtime/Snapshot.js'
import {RuntimeEntryStore} from '../runtime/Store.js'

/** Builds source commits through the same lazy graph used for reads. */
export async function requestRuntimeSourceMutations(
  config: Config,
  source: Source,
  store: RuntimeEntryStore,
  index: RuntimeDatabaseIndex,
  mutations: ReadonlyArray<Mutation>,
  policy?: Policy
): Promise<CommitRequest> {
  const originalTree = await source.getTree()
  let snapshot = new RuntimeSnapshot(config, index, store)
  if (canBatchContentUpdates(mutations)) {
    const transaction = new EntryTransaction(
      config,
      index.revision,
      snapshot.resolver,
      source,
      originalTree,
      policy
    )
    await transaction.apply(mutations)
    const request = await transaction.toRequest()
    return {
      ...request,
      description: withoutBatchDescriptionSuffix(
        request.description,
        mutations.length
      )
    }
  }

  const workingSource = new OverlaySource(source, originalTree)
  let workingTree = originalTree
  const descriptions: Array<string> = []
  const fileChanges: Array<CommitChange> = []

  for (const [position, mutation] of mutations.entries()) {
    const transaction = new EntryTransaction(
      config,
      snapshot.index.revision,
      snapshot.resolver,
      workingSource,
      workingTree,
      policy
    )
    await transaction.apply([mutation])
    const request = await transaction.toRequest()
    if (request.description) descriptions.push(request.description)
    fileChanges.push(
      ...request.changes.filter(
        change => change.op === 'removeFile' || change.op === 'uploadFile'
      )
    )
    const batch = sourceChanges(request)
    if (batch.changes.length === 0) continue
    await workingSource.applyChanges(batch)
    workingTree = await workingSource.getTree()
    if (position === mutations.length - 1) continue
    const bundleId = `transaction-${createId()}`
    const bundleUrl = `alinea:transaction/${bundleId}`
    const artifact = await exportRuntimeSourceChanges({
      config,
      previous: snapshot.index,
      tree: workingTree,
      changes: batch,
      bundleId,
      bundleUrl
    })
    snapshot = snapshot.apply(artifact)
  }

  const combined = await bundleContents(
    workingSource,
    originalTree.diff(workingTree)
  )
  return {
    fromSha: originalTree.sha,
    intoSha: workingTree.sha,
    description: descriptions.join('\n'),
    changes: fileChanges.concat(commitChanges(combined.changes))
  }
}

/**
 * Content updates to separate entries cannot depend on each other's source
 * writes. EntryTransaction already tracks URL claims within such a batch.
 */
function canBatchContentUpdates(mutations: ReadonlyArray<Mutation>): boolean {
  if (mutations.length < 2) return false
  const ids = new Set<string>()
  return mutations.every(mutation => {
    if (
      mutation.op !== 'update' ||
      'path' in mutation.set ||
      ids.has(mutation.id)
    )
      return false
    ids.add(mutation.id)
    return true
  })
}

function withoutBatchDescriptionSuffix(description: string, count: number) {
  const suffix = ` (and ${count - 1} other edits)`
  const firstLineEnd = description.indexOf('\n')
  const firstLine = description.slice(
    0,
    firstLineEnd === -1 ? undefined : firstLineEnd
  )
  if (!firstLine.endsWith(suffix)) return description
  return `${firstLine.slice(0, -suffix.length)}${
    firstLineEnd === -1 ? '' : description.slice(firstLineEnd)
  }`
}
