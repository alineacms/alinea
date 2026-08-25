import type {Config} from '#/core/Config.js'
import {EventDispatcher} from '#/core/EventDispatcher.js'
import type {
  SyncApi,
  UploadMetadata,
  UploadResponse
} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import type {Policy} from '#/core/Role.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import type {Source} from '#/core/source/Source.js'
import {syncWith as syncSourceWith} from '#/core/source/Source.js'
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
import {requestSourceMutations} from '../handler/SourceWriter.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {
  diffDatabaseSnapshots,
  type DatabaseCommit,
  type DatabaseSnapshot
} from '../Database.js'
import {SourceEntryDatabase} from './Source.js'
import type {AlineaDatabaseRecord} from './Model.js'
import {fixSource, seedSource} from './SourceRepair.js'
import pLimit from 'p-limit'

/** Mutable source graph backed by the normalized database and query engine. */
export class SourceDB extends WriteableGraph {
  source: Source
  #database: SourceEntryDatabase | undefined
  #resolver: DatabaseResolver | undefined
  #events = new EventDispatcher()
  #limit = pLimit(1)

  constructor(
    public config: Config,
    source: Source = new MemorySource()
  ) {
    super()
    this.source = source
  }

  get loaded(): boolean {
    return Boolean(this.#database)
  }

  get sha(): string {
    return this.#database?.snapshot.revision ?? ReadonlyTree.EMPTY.sha
  }

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    const resolver = await this.#readyResolver()
    return resolver.resolve(query)
  }

  async referencesTo(
    query: EntryReferenceQuery
  ): Promise<EntryReferenceResult> {
    const resolver = await this.#readyResolver()
    return resolver.referencesTo(query)
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

  async fix(): Promise<string> {
    await this.sync()
    return this.#limit(async () => {
      const previous = this.#database!.snapshot
      this.#database = await fixSource(
        this.config,
        this.source,
        this.#database!
      )
      if (this.#database.snapshot.revision === previous.revision)
        return this.sha
      const commit = diffDatabaseSnapshots(previous, this.#database.snapshot)
      this.#resolver = new DatabaseResolver(this.config, commit.snapshot)
      this.#dispatchIndex(commit, previous)
      return this.sha
    })
  }

  async request(
    mutations: Array<Mutation>,
    policy?: Policy
  ): Promise<CommitRequest> {
    await this.sync()
    return requestSourceMutations(this.config, this.source, mutations, policy)
  }

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.write(await this.request(mutations))
  }

  write(request: CommitRequest): Promise<{sha: string}> {
    return this.#limit(async () => {
      if (this.sha === request.intoSha) return {sha: this.sha}
      await this.source.applyChanges(sourceChanges(request))
      return {sha: await this.#syncUnlocked()}
    })
  }

  applyChanges(batch: ChangesBatch): Promise<void> {
    return this.source.applyChanges(batch)
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
    const previous = this.#database?.snapshot
    if (!this.#database) {
      this.#database = await SourceEntryDatabase.load(this.config, this.source)
    } else await this.#database.sync(this.source)
    this.#database = await seedSource(this.config, this.source, this.#database)
    const current = this.#database.snapshot
    if (previous?.revision === current.revision) return this.sha
    this.#resolver = new DatabaseResolver(this.config, current)
    const commit = previous
      ? diffDatabaseSnapshots(previous, current)
      : undefined
    this.#dispatchIndex(commit, previous)
    return this.sha
  }

  #dispatchIndex(
    commit: DatabaseCommit<AlineaDatabaseRecord> | undefined,
    previous?: DatabaseSnapshot<AlineaDatabaseRecord>
  ): void {
    const ids = new Set<string>()
    if (!commit) {
      for (const record of this.#database!.snapshot.records())
        if (record.kind === 'entry') ids.add(record.entryId)
    } else {
      for (const id of commit.changes.records) {
        const before = previous?.get(id)
        const after = commit.snapshot.get(id)
        if (before?.kind === 'entry') ids.add(before.entryId)
        if (after?.kind === 'entry') ids.add(after.entryId)
      }
    }
    this.#events.dispatchEvent(
      new IndexEvent({op: 'index', sha: this.sha, ids: [...ids]})
    )
  }
}
