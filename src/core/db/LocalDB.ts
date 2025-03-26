import type {Config} from '../Config.js'
import {Entry} from '../Entry.js'
import {type AnyQueryResult, Graph, type GraphQuery} from '../Graph.js'
import type {Resolver} from '../Resolver.js'
import type {Change} from '../source/Change.js'
import {MemorySource} from '../source/MemorySource.js'
import {syncWith} from '../source/Source.js'
import type {Source} from '../source/Source.js'
import type {CommitRequest} from './CommitRequest.js'
import {EntryIndex} from './EntryIndex.js'
import {EntryResolver} from './EntryResolver.js'
import type {EntryTarget} from './EntryTarget.js'
import {EntryTransaction} from './EntryTransaction.js'
import {
  ArchiveOperation,
  type ArchiveQuery,
  CreateOperation,
  type CreateQuery,
  DeleteOp,
  MoveOperation,
  type MoveQuery,
  type Operation,
  PublishOperation,
  type PublishQuery,
  UpdateOperation,
  type UpdateQuery
} from './Operation.js'

export class LocalDB extends Graph implements Resolver {
  protected source: Source
  protected index: EntryIndex
  #resolver: EntryResolver

  constructor(config: Config, source: Source = new MemorySource()) {
    const index = new EntryIndex(config)
    const resolver = new EntryResolver(config, index)
    super(config, resolver)
    this.#resolver = resolver
    this.index = index
    this.source = source
  }

  get sha() {
    return this.index.sha
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return this.#resolver.resolve(query)
  }

  indexChanges(changes: Array<Change>) {
    return this.index.indexChanges(changes)
  }

  applyChanges(changes: Array<Change>) {
    return this.source.applyChanges(changes)
  }

  getTreeIfDifferent(sha: string) {
    return this.source.getTreeIfDifferent(sha)
  }

  getBlob(sha: string) {
    return this.source.getBlob(sha)
  }

  async sync() {
    await this.index.syncWith(this.source)
    await this.index.seed(this.source)
  }

  async syncWith(remote: EntryTarget) {
    await syncWith(this.source, remote)
    return this.sync()
  }

  async logEntries() {
    const entries = await this.find({
      select: {
        id: Entry.id,
        root: Entry.root,
        workspace: Entry.workspace,
        parentId: Entry.parentId,
        locale: Entry.locale,
        status: Entry.status,
        path: Entry.path
      }
    })
    console.table(entries)
  }

  async create<Definition>(create: CreateQuery<Definition>) {
    const op = new CreateOperation(create)
    await this.commitOps(op)
    return this.get({
      id: op.id,
      type: create.type,
      locale: create.locale,
      status: 'preferPublished'
    })
  }

  async update<Definition>(query: UpdateQuery<Definition>) {
    const op = new UpdateOperation<Definition>(query)
    await this.commitOps(op)
    return this.get({
      type: query.type,
      id: query.id,
      locale: query.locale ?? null,
      status: query.status ?? 'published'
    })
  }

  async remove(...entryIds: Array<string>): Promise<void> {
    await this.commitOps(new DeleteOp(entryIds))
  }

  async publish(query: PublishQuery): Promise<void> {
    await this.commitOps(new PublishOperation(query))
  }

  async archive(query: ArchiveQuery): Promise<void> {
    await this.commitOps(new ArchiveOperation(query))
  }

  async move(query: MoveQuery) {
    const op = new MoveOperation(query)
    await this.commitOps(op)
    return this.get({
      id: query.id,
      select: {index: Entry.index}
    })
  }

  protected async commitOps(...operations: Array<Operation>) {
    const mutations = await Promise.all(operations.map(op => op.task(this)))
    const from = await this.source.getTree()
    const tx = new EntryTransaction(this.config, this.index, this.source, from)
    tx.apply(mutations.flat())
    const request = await tx.toRequest()
    return this.commit(request)
  }

  async commit(request: CommitRequest) {
    const sourceChanges = request.changes.filter(
      change => change.op === 'add' || change.op === 'delete'
    )
    await this.applyChanges(sourceChanges)
    return this.sync()
  }
}
