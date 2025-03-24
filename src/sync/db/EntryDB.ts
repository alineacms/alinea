import type {Config} from 'alinea/core/Config'
import {Entry} from 'alinea/core/Entry'
import {Graph} from 'alinea/core/Graph'
import type {Source} from '../Source.js'
import {MemorySource} from '../source/MemorySource.js'
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

export class EntryDB extends Graph {
  #index: EntryIndex
  #source: Source
  #remote: EntryTarget | undefined

  constructor(
    config: Config,
    source: Source = new MemorySource(),
    remote?: EntryTarget
  ) {
    const index = new EntryIndex(config)
    const resolver = new EntryResolver(config, index)
    super(config, resolver)
    this.#index = index
    this.#source = source
    this.#remote = remote
  }

  async create<Definition>(create: CreateQuery<Definition>) {
    const op = new CreateOperation(create)
    await this.commit(op)
    return this.get({
      id: op.id,
      type: create.type,
      locale: create.locale,
      status: 'preferPublished'
    })
  }

  async update<Definition>(query: UpdateQuery<Definition>) {
    const op = new UpdateOperation<Definition>(query)
    await this.commit(op)
    return this.get({
      type: query.type,
      id: query.id,
      locale: query.locale ?? null,
      status: query.status ?? 'published'
    })
  }

  async remove(...entryIds: Array<string>): Promise<void> {
    await this.commit(new DeleteOp(entryIds))
  }

  async publish(query: PublishQuery): Promise<void> {
    await this.commit(new PublishOperation(query))
  }

  async archive(query: ArchiveQuery): Promise<void> {
    await this.commit(new ArchiveOperation(query))
  }

  async move(query: MoveQuery) {
    const op = new MoveOperation(query)
    await this.commit(op)
    return this.get({
      id: query.id,
      select: {index: Entry.index}
    })
  }

  async commit(...operations: Array<Operation>): Promise<string> {
    const mutations = await Promise.all(operations.map(op => op.task(this)))
    const from = await this.#source.getTree()
    const tx = new EntryTransaction(
      this.config,
      this.#index,
      this.#source,
      from
    )
    tx.apply(mutations.flat())
    return this.#remote ? tx.attempt(this.#remote) : tx.commit()
  }

  async sync() {
    await this.#index.syncWith(this.#source)
    await this.#index.seed(this.#source)
  }

  async syncWithRemote() {
    if (this.#remote) await this.#source.syncWith(this.#remote)
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
}

export class ShaMismatchError extends Error {
  status = 409
  constructor(
    public actual: string,
    public expected: string
  ) {
    super(`SHA mismatch: ${actual} != ${expected}`)
  }
}
