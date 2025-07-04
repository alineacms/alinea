import type {UploadResponse} from '../Connection.js'
import {Entry} from '../Entry.js'
import {Graph} from '../Graph.js'
import {MediaFile} from '../media/MediaTypes.js'
import type {Mutation} from './Mutation.js'
import {
  ArchiveOperation,
  type ArchiveQuery,
  CreateOp,
  type CreateQuery,
  DeleteOp,
  DiscardOp,
  type DiscardQuery,
  MoveOperation,
  type MoveQuery,
  type Operation,
  PublishOperation,
  type PublishQuery,
  UnpublishOperation,
  type UnpublishQuery,
  UpdateOperation,
  type UpdateQuery,
  UploadOperation,
  type UploadQuery
} from './Operation.js'

export abstract class WriteableGraph extends Graph {
  abstract sync(): Promise<string>
  abstract mutate(mutations: Array<Mutation>): Promise<{sha: string}>
  abstract prepareUpload(file: string): Promise<UploadResponse>

  async create<Definition>(create: CreateQuery<Definition>) {
    const op = new CreateOp(create)
    await this.commit(op)
    return this.get({
      id: op.id,
      type: create.type,
      locale: create.locale,
      status:
        create.status === 'draft'
          ? 'preferDraft'
          : create.status === 'archived'
            ? 'archived'
            : 'preferPublished'
    })
  }

  async update<Definition>(update: UpdateQuery<Definition>) {
    const op = new UpdateOperation<Definition>(update)
    await this.commit(op)
    return this.get({
      type: update.type,
      id: update.id,
      locale: update.locale ?? null,
      status: update.status ?? 'published'
    })
  }

  async remove(...entryIds: Array<string>): Promise<void> {
    await this.commit(new DeleteOp(entryIds))
  }

  async publish(publish: PublishQuery): Promise<void> {
    await this.commit(new PublishOperation(publish))
  }

  async unpublish(unpublish: UnpublishQuery): Promise<void> {
    await this.commit(new UnpublishOperation(unpublish))
  }

  async archive(archive: ArchiveQuery): Promise<void> {
    await this.commit(new ArchiveOperation(archive))
  }

  async move(query: MoveQuery) {
    const op = new MoveOperation(query)
    await this.commit(op)
    return this.get({
      id: query.id,
      select: {index: Entry.index},
      status: 'preferDraft'
    })
  }

  async discard(query: DiscardQuery) {
    const op = new DiscardOp(query)
    await this.commit(op)
  }

  async upload(query: UploadQuery) {
    const op = new UploadOperation(query)
    await this.commit(op)
    return this.get({
      type: MediaFile,
      id: op.id
    })
  }

  async commit(...operations: Array<Operation>) {
    const mutations = await Promise.all(operations.map(op => op.task(this)))
    await this.mutate(mutations.flat())
  }
}
