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
import type {EntryCoreRecord, EntrySearchRecord} from '../entry/Model.js'
import type {EntryLinkReference, EntryStore} from '../entry/Store.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {MemoryRangeSource} from '../replica/Bundle.js'
import {exportRuntimeSourceChanges} from '../runtime/Exporter.js'
import type {RuntimeDatabaseIndex, RuntimeIndexEntry} from '../runtime/Model.js'
import {RuntimeEntryStore} from '../runtime/Store.js'

/** Builds source commits through the same lazy graph used for reads. */
export async function requestRuntimeSourceMutations(
  config: Config,
  source: Source,
  store: EntryStore,
  index: RuntimeDatabaseIndex,
  mutations: ReadonlyArray<Mutation>,
  policy?: Policy
): Promise<CommitRequest> {
  const originalTree = await source.getTree()
  if (canBatchContentUpdates(mutations)) {
    const transaction = new EntryTransaction(
      config,
      index.revision,
      new DatabaseResolver(config, store),
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
  let workingIndex = index
  let workingStore = store
  const descriptions: Array<string> = []
  const fileChanges: Array<CommitChange> = []

  for (const [position, mutation] of mutations.entries()) {
    const transaction = new EntryTransaction(
      config,
      workingIndex.revision,
      new DatabaseResolver(config, workingStore),
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
    const runtime = await exportRuntimeSourceChanges({
      config,
      previous: workingIndex,
      tree: workingTree,
      changes: batch,
      bundleId,
      bundleUrl
    })
    const changed = new RuntimeEntryStore({
      index: runtime.index,
      source: () => new MemoryRangeSource(runtime.bundle)
    })
    workingStore = new TransactionEntryStore(
      runtime.index,
      workingStore,
      changed,
      bundleId
    )
    workingIndex = runtime.index
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

/** Presents an incrementally reconciled index without mutating the live store. */
class TransactionEntryStore implements EntryStore {
  readonly revision: string

  constructor(
    readonly index: RuntimeDatabaseIndex,
    readonly previous: EntryStore,
    readonly changed: RuntimeEntryStore,
    readonly bundleId: string
  ) {
    this.revision = index.revision
  }

  async cores(signal?: AbortSignal): Promise<ReadonlyArray<EntryCoreRecord>> {
    signal?.throwIfAborted()
    return this.index.entries
  }

  load(core: EntryCoreRecord, signal?: AbortSignal) {
    return this.#store(core, 'data').load(core, signal)
  }

  loadMany(cores: ReadonlyArray<EntryCoreRecord>, signal?: AbortSignal) {
    const groups = this.#groups(cores, 'data')
    const result = new Array<Awaited<ReturnType<EntryStore['load']>>>(
      cores.length
    )
    return Promise.all(
      [...groups].map(async ([store, positions]) => {
        const loaded = await store.loadMany(
          positions.map(([, core]) => core),
          signal
        )
        for (const [index, [position]] of positions.entries())
          result[position] = loaded[index]
      })
    ).then(() => result)
  }

  search(
    core: EntryCoreRecord,
    audience: 'explore' | 'read',
    signal?: AbortSignal
  ): Promise<EntrySearchRecord | undefined> {
    return this.#store(core, 'search').search(core, audience, signal)
  }

  searchMany(
    cores: ReadonlyArray<EntryCoreRecord>,
    audience: 'explore' | 'read',
    signal?: AbortSignal
  ) {
    const groups = this.#groups(cores, 'search')
    const result = new Array<Awaited<ReturnType<EntryStore['search']>>>(
      cores.length
    )
    return Promise.all(
      [...groups].map(async ([store, positions]) => {
        const loaded = await store.searchMany(
          positions.map(([, core]) => core),
          audience,
          signal
        )
        for (const [index, [position]] of positions.entries())
          result[position] = loaded[index]
      })
    ).then(() => result)
  }

  referencesTo(
    targetId: string,
    signal?: AbortSignal
  ): AsyncIterable<EntryLinkReference> {
    return this.previous.referencesTo(targetId, signal)
  }

  referencesFrom(
    sourceId: string,
    signal?: AbortSignal
  ): AsyncIterable<EntryLinkReference> {
    return this.previous.referencesFrom(sourceId, signal)
  }

  #store(core: EntryCoreRecord, frame: 'data' | 'search'): EntryStore {
    const descriptor = (core as RuntimeIndexEntry).frames?.[frame]
    return descriptor?.bundleId === this.bundleId ? this.changed : this.previous
  }

  #groups(
    cores: ReadonlyArray<EntryCoreRecord>,
    frame: 'data' | 'search'
  ): Map<EntryStore, Array<readonly [number, EntryCoreRecord]>> {
    const groups = new Map<
      EntryStore,
      Array<readonly [number, EntryCoreRecord]>
    >()
    for (const [position, core] of cores.entries()) {
      const store = this.#store(core, frame)
      const group = groups.get(store) ?? []
      group.push([position, core])
      groups.set(store, group)
    }
    return groups
  }
}
