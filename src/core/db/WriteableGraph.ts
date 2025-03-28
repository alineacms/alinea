import type {UploadResponse} from '../Connection.js'
import {Entry} from '../Entry.js'
import {Graph} from '../Graph.js'
import type {Mutation} from './Mutation.js'
import {
  ArchiveOperation,
  type ArchiveQuery,
  CreateOperation,
  type CreateQuery,
  DeleteOp,
  DiscardOp,
  type DiscardQuery,
  MoveOperation,
  type MoveQuery,
  type Operation,
  PublishOperation,
  type PublishQuery,
  UpdateOperation,
  type UpdateQuery,
  UploadOperation,
  type UploadQuery
} from './Operation.js'

export abstract class WriteableGraph extends Graph {
  abstract mutate(mutations: Array<Mutation>): Promise<string>
  abstract prepareUpload(file: string): Promise<UploadResponse>

  async create<Definition>(create: CreateQuery<Definition>) {
    const op = new CreateOperation(create)
    await this.#commitOps(op)
    return this.get({
      id: op.id,
      type: create.type,
      locale: create.locale,
      status: 'preferPublished'
    })
  }

  async update<Definition>(query: UpdateQuery<Definition>) {
    const op = new UpdateOperation<Definition>(query)
    await this.#commitOps(op)
    return this.get({
      type: query.type,
      id: query.id,
      locale: query.locale ?? null,
      status: query.status ?? 'published'
    })
  }

  async remove(...entryIds: Array<string>): Promise<void> {
    await this.#commitOps(new DeleteOp(entryIds))
  }

  async publish(query: PublishQuery): Promise<void> {
    await this.#commitOps(new PublishOperation(query))
  }

  async archive(query: ArchiveQuery): Promise<void> {
    await this.#commitOps(new ArchiveOperation(query))
  }

  async move(query: MoveQuery) {
    const op = new MoveOperation(query)
    await this.#commitOps(op)
    return this.get({
      id: query.id,
      select: {index: Entry.index}
    })
  }

  async discard(query: DiscardQuery) {
    const op = new DiscardOp(query)
    await this.#commitOps(op)
  }

  async upload(query: UploadQuery) {
    const op = new UploadOperation(query)
    await this.#commitOps(op)
    return this.get({
      id: op.id
    })
  }

  async #commitOps(...operations: Array<Operation>) {
    const mutations = await Promise.all(operations.map(op => op.task(this)))
    await this.mutate(mutations.flat())
  }
}
