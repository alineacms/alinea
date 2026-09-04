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
import {
  MemoryRangeSource,
  type ByteRangeSourceFactory
} from '../replica/Bundle.js'
import type {ReplicaTransport} from '../replica/Protocol.js'
import {
  applyReplicaState,
  replicaRangeSource
} from '../replica/InlineBundles.js'
import {
  exportRuntimeDatabase,
  exportRuntimeSourceChanges,
  type RuntimeDatabaseExport
} from '../runtime/Exporter.js'
import {RuntimeSnapshot, runtimeDeltaEntryIds} from '../runtime/Snapshot.js'
import {RuntimeEntryStore} from '../runtime/Store.js'
import {fixSource} from './SourceFix.js'
import {seedSource} from './SourceSeeds.js'
import pLimit from 'p-limit'

/** Mutable source graph backed exclusively by the lazy runtime database. */
export class SourceDB extends WriteableGraph implements Source {
  source: Source
  #snapshot: RuntimeSnapshot | undefined
  #runtimeExport: RuntimeDatabaseExport | undefined
  #events = new EventDispatcher()
  #replicaViewId: string | undefined
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
    if (initial)
      this.#snapshot = new RuntimeSnapshot(config, initial.index, initial)
  }

  get loaded(): boolean {
    return Boolean(this.#snapshot)
  }

  get sha(): string {
    return this.#snapshot?.index.revision ?? ReadonlyTree.EMPTY.sha
  }

  get runtimeSnapshot(): RuntimeSnapshot | undefined {
    return this.#snapshot
  }

  /** Complete single-bundle export produced by the latest full reconciliation. */
  get runtimeExport(): RuntimeDatabaseExport | undefined {
    return this.#runtimeExport
  }

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return (await this.#readySnapshot()).resolver.resolve(query)
  }

  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    return (await this.#readySnapshot()).resolver.referencesTo(query)
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
      const snapshot = this.#expectSnapshot()
      const state = await remote.state(
        this.#replicaViewId
          ? {revision: this.sha, viewId: this.#replicaViewId}
          : undefined
      )
      if (!state) return this.sha
      const materialized = applyReplicaState(
        this.#replicaViewId
          ? {viewId: this.#replicaViewId, runtime: snapshot.index}
          : undefined,
        state
      )
      this.#replicaViewId = materialized.viewId
      const source = replicaRangeSource(materialized, ranges)
      const entryIds =
        'delta' in state
          ? runtimeDeltaEntryIds(state.delta)
          : materialized.runtime.entries.map(entry => entry.entryId)
      if (snapshot.store === this.source && !materialized.runtime.source) {
        // A server runtime also owns the trusted Source frames. A client
        // projection intentionally omits those frames, so install it in a
        // separate query store instead of removing Source capabilities from
        // the trusted store.
        this.refreshSnapshot(
          RuntimeSnapshot.open(this.config, materialized.runtime, source),
          entryIds
        )
      } else {
        this.refreshSnapshot(
          snapshot.replace(materialized.runtime, source),
          entryIds
        )
      }
      return this.sha
    })
  }

  refreshSnapshot(
    snapshot: RuntimeSnapshot,
    entryIds: Iterable<string> = snapshot.index.entries.map(
      entry => entry.entryId
    )
  ): void {
    this.#runtimeExport = undefined
    this.#snapshot = snapshot
    this.#dispatchIndex([...entryIds])
  }

  async fix(): Promise<string> {
    await this.sync()
    return this.#limit(async () => {
      const changes = await fixSource(
        this.config,
        this.source,
        this.#expectSnapshot().store,
        this.#expectSnapshot().index
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
      this.#expectSnapshot().store,
      this.#expectSnapshot().index,
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
    this.#runtimeExport = undefined
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

  async #readySnapshot(): Promise<RuntimeSnapshot> {
    if (!this.#snapshot) await this.sync()
    return this.#snapshot!
  }

  async #syncUnlocked(): Promise<string> {
    const reconciled = await this.#reconcile()
    if (!reconciled) return this.sha
    let seeded: ChangesBatch | undefined
    while (
      (seeded = await seedSource(
        this.config,
        this.source,
        this.#expectSnapshot().store,
        this.#expectSnapshot().index
      ))
    )
      await this.#reconcile(seeded)
    return this.sha
  }

  async #reconcile(knownChanges?: ChangesBatch): Promise<boolean> {
    const bundleId = createId()
    const bundleUrl = `alinea:runtime/${bundleId}`
    const snapshot = this.#snapshot
    const index = snapshot?.index
    let entryIds: ReadonlySet<string>
    if (snapshot && index?.source) {
      const tree = await this.source.getTreeIfDifferent(index.revision)
      if (!tree) return false
      const artifact = await exportRuntimeSourceChanges({
        config: this.config,
        previous: index,
        tree,
        changes:
          knownChanges ??
          (await bundleContents(
            this.source,
            (await snapshot.store.getTree()).diff(tree)
          )),
        bundleId,
        bundleUrl
      })
      this.#runtimeExport = undefined
      this.#snapshot = snapshot.apply(artifact)
      entryIds = runtimeDeltaEntryIds(artifact.delta)
    } else {
      const artifact = await exportRuntimeDatabase({
        config: this.config,
        source: this.source,
        bundleId,
        bundleUrl
      })
      this.#runtimeExport = artifact
      this.#snapshot = RuntimeSnapshot.open(
        this.config,
        artifact.index,
        () => new MemoryRangeSource(artifact.bundle)
      )
      entryIds = new Set(artifact.index.entries.map(entry => entry.entryId))
    }
    this.#dispatchIndex([...entryIds])
    return true
  }

  #expectSnapshot(): RuntimeSnapshot {
    if (!this.#snapshot) throw new Error('Runtime database is not loaded')
    return this.#snapshot
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
