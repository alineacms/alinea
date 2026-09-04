import type {Config} from '#/core/Config.js'
import type {
  SyncApi,
  UploadMetadata,
  UploadResponse
} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {EventDispatcher} from '#/core/EventDispatcher.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {createId} from '#/core/Id.js'
import type {Policy} from '#/core/Role.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import type {Source} from '#/core/source/Source.js'
import {
  bundleContents,
  syncWith as syncSourceWith
} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {sourceChanges} from '#/core/db/CommitRequest.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {requestRuntimeSourceMutations} from '../handler/SourceWriter.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {
  MemoryRangeSource,
  type ByteRangeSourceFactory
} from '../replica/Bundle.js'
import type {ReplicaTransport} from '../replica/Protocol.js'
import {replicaRangeSource} from '../replica/InlineBundles.js'
import {
  exportRuntimeDatabase,
  exportRuntimeSourceChanges
} from '../runtime/Exporter.js'
import type {RuntimeDatabaseIndex} from '../runtime/Model.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {fixSource, seedSource} from './SourceRepair.js'
import pLimit from 'p-limit'

/** Mutable source graph backed exclusively by the lazy runtime database. */
export class SourceDB extends WriteableGraph implements Source {
  source: Source
  #runtime: RuntimeEntryStore | undefined
  #index: RuntimeDatabaseIndex | undefined
  #resolver: DatabaseResolver | undefined
  #bundles = new Map<string, MemoryRangeSource>()
  #events = new EventDispatcher()
  readonly index = this.#events
  #limit = pLimit(1)

  constructor(
    public config: Config,
    source: Source = new MemorySource(),
    runtime?: RuntimeEntryStore
  ) {
    super()
    this.source = source
    const initial =
      runtime ?? (source instanceof RuntimeEntryStore ? source : undefined)
    if (initial) this.refreshRuntime(initial)
  }

  get loaded(): boolean {
    return Boolean(this.#resolver)
  }

  get sha(): string {
    return this.#index?.revision ?? ReadonlyTree.EMPTY.sha
  }

  get runtimeIndex(): RuntimeDatabaseIndex | undefined {
    return this.#index
  }

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return (await this.#readyResolver()).resolve(query)
  }

  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    return (await this.#readyResolver()).referencesTo(query)
  }

  sync(): Promise<string> {
    return this.#limit(() => this.#syncUnlocked())
  }

  syncWith(remote: SyncApi): Promise<string> {
    return this.#limit(async () => {
      await syncSourceWith(this.source, remote)
      return this.#syncUnlocked()
    })
  }

  syncReplica(
    remote: ReplicaTransport,
    ranges: ByteRangeSourceFactory
  ): Promise<string> {
    return this.#limit(async () => {
      const runtime = this.#expectRuntime()
      const state = await remote.state(this.sha)
      if (!state) return this.sha
      runtime.install(state.runtime, replicaRangeSource(state, ranges))
      this.refreshRuntime(runtime)
      return this.sha
    })
  }

  refreshRuntime(store = this.#runtime): void {
    if (!store) return
    this.#runtime = store
    this.#index = store.index
    this.#resolver = new DatabaseResolver(this.config, store)
    this.#dispatchIndex(store.index.entries.map(entry => entry.entryId))
  }

  async fix(): Promise<string> {
    await this.sync()
    return this.#limit(async () => {
      const changes = await fixSource(
        this.config,
        this.source,
        this.#expectRuntime(),
        this.#expectIndex()
      )
      if (changes) await this.#reconcile(changes)
      return this.sha
    })
  }

  async request(
    mutations: Array<Mutation>,
    policy?: Policy
  ): Promise<CommitRequest> {
    await this.sync()
    return requestRuntimeSourceMutations(
      this.config,
      this.source,
      this.#expectRuntime(),
      this.#expectIndex(),
      mutations,
      policy
    )
  }

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.write(await this.request(mutations))
  }

  write(request: CommitRequest): Promise<{sha: string}> {
    return this.#limit(async () => {
      if (this.sha === request.intoSha) return {sha: this.sha}
      const changes = sourceChanges(request)
      await this.source.applyChanges(changes)
      await this.#reconcile(changes)
      return {sha: this.sha}
    })
  }

  applyChanges(batch: ChangesBatch): Promise<void> {
    return this.source.applyChanges(batch)
  }

  getTree(): Promise<ReadonlyTree> {
    return this.source.getTree()
  }

  getTreeIfDifferent(sha: string) {
    return this.source.getTreeIfDifferent(sha)
  }

  getBlobs(shas: Array<string>) {
    return this.source.getBlobs(shas)
  }

  async logEntries(): Promise<void> {
    const entries = await this.find({
      select: {
        id: Entry.id,
        root: Entry.root,
        workspace: Entry.workspace,
        parentId: Entry.parentId,
        locale: Entry.locale,
        status: Entry.status,
        path: Entry.path,
        index: Entry.index,
        title: Entry.title,
        active: Entry.active
      },
      status: 'all'
    })
    console.table(
      entries.map(({id, parentId, ...entry}) => ({
        id: id.slice(-7),
        parentId: parentId?.slice(-7),
        ...entry
      }))
    )
  }

  prepareUpload(
    _file: string,
    _metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    return Promise.reject(new Error('Uploads not supported on source DB'))
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    this.#events.addEventListener(type, listener)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    this.#events.removeEventListener(type, listener)
  }

  dispatchEvent(event: Event): boolean {
    return this.#events.dispatchEvent(event)
  }

  async #readyResolver(): Promise<DatabaseResolver> {
    if (!this.#resolver) await this.sync()
    return this.#resolver!
  }

  async #syncUnlocked(): Promise<string> {
    await this.#reconcile()
    let seeded: ChangesBatch | undefined
    while (
      (seeded = await seedSource(
        this.config,
        this.source,
        this.#expectRuntime(),
        this.#expectIndex()
      ))
    )
      await this.#reconcile(seeded)
    return this.sha
  }

  async #reconcile(knownChanges?: ChangesBatch): Promise<void> {
    const bundleId = createId()
    const bundleUrl = `alinea:runtime/${bundleId}`
    const runtime = this.#runtime
    const index = this.#index
    const previous = index?.entries
    let artifact
    if (runtime && index?.source) {
      const tree = await this.source.getTree()
      if (tree.sha === index.revision) return
      artifact = await exportRuntimeSourceChanges({
        config: this.config,
        previous: index,
        tree,
        changes:
          knownChanges ??
          (await bundleContents(
            this.source,
            (await runtime.getTree()).diff(tree)
          )),
        bundleId,
        bundleUrl
      })
    } else {
      artifact = await exportRuntimeDatabase({
        config: this.config,
        source: this.source,
        bundleId,
        bundleUrl
      })
    }
    this.#bundles.set(bundleUrl, new MemoryRangeSource(artifact.bundle))
    if (runtime) runtime.install(artifact.index, this.#rangeSource)
    else
      this.#runtime = new RuntimeEntryStore({
        index: artifact.index,
        source: this.#rangeSource
      })
    this.#index = artifact.index
    this.#resolver = new DatabaseResolver(this.config, this.#expectRuntime())
    this.#dispatchIndex(
      knownChanges && previous
        ? changedEntryIds(previous, artifact.index.entries, knownChanges)
        : artifact.index.entries.map(entry => entry.entryId)
    )
  }

  #rangeSource = (url: string) => {
    const source = this.#bundles.get(url)
    if (!source) throw new Error(`Unknown runtime bundle: ${url}`)
    return source
  }

  #expectRuntime(): RuntimeEntryStore {
    if (!this.#runtime) throw new Error('Runtime database is not loaded')
    return this.#runtime
  }

  #expectIndex(): RuntimeDatabaseIndex {
    if (!this.#index) throw new Error('Runtime database is not loaded')
    return this.#index
  }

  #dispatchIndex(entryIds: ReadonlyArray<string>): void {
    this.#events.dispatchEvent(
      new IndexEvent({
        op: 'index',
        sha: this.sha,
        ids: [...new Set(entryIds)]
      })
    )
  }
}

function changedEntryIds(
  previous: ReadonlyArray<import('../runtime/Model.js').RuntimeIndexEntry>,
  next: ReadonlyArray<import('../runtime/Model.js').RuntimeIndexEntry>,
  changes: ChangesBatch
): Array<string> {
  const paths = new Set(changes.changes.map(change => change.path))
  return [...previous, ...next].flatMap(entry =>
    entry.frames?.read && paths.has(entry.frames.read.filePath)
      ? [entry.entryId]
      : []
  )
}
