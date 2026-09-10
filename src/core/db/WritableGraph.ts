import type {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import type {Infer} from '#/index.js'
import type {UploadMetadata, UploadResponse} from '../Connection.js'
import {Entry} from '../Entry.js'
import type {EntryFields} from '../EntryFields.js'
import {Graph, type InferProjection, type Projection} from '../Graph.js'
import {MediaFile} from '../media/MediaTypes.js'
import {Policy, WritablePolicy} from '../Role.js'
import {getScope} from '../Scope.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from './EntryReference.js'
import type {Mutation} from './Mutation.js'
import type {MutationContext} from './MutationContext.js'
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

export abstract class WritableGraph extends Graph {
  abstract mutate(
    mutations: Array<Mutation>,
    expected?: MutationContext
  ): Promise<{sha: string}>
  mutationContext():
    | MutationContext
    | undefined
    | Promise<MutationContext | undefined> {
    return undefined
  }
  abstract prepareUpload(
    file: string,
    metadata?: UploadMetadata
  ): Promise<UploadResponse>

  referencesTo(query: EntryReferenceQuery): Promise<EntryReferenceResult> {
    throw new Error('Entry references are not supported on this graph')
  }

  async create<Definition, Selection extends Projection>(
    create: CreateQuery<Definition> & {select: Selection},
    expected?: MutationContext
  ): Promise<InferProjection<Selection>>
  async create<Definition>(
    create: CreateQuery<Definition>,
    expected?: MutationContext
  ): Promise<EntryFields & Infer<Type<Definition>>>
  async create<Definition>(
    create: CreateQuery<Definition> & {select?: Projection},
    expected?: MutationContext
  ) {
    const op = new CreateOp(create)
    await this.#commit(expected ?? (await this.mutationContext()), [op])
    const status =
      create.status === 'draft'
        ? 'preferDraft'
        : create.status === 'archived'
          ? 'archived'
          : 'preferPublished'
    if (create.select)
      return this.get({
        id: op.id,
        type: create.type,
        locale: create.locale,
        status,
        select: create.select
      })
    return this.get({
      id: op.id,
      type: create.type,
      locale: create.locale,
      status
    })
  }

  async update<Definition>(
    update: UpdateQuery<Definition>
  ): Promise<EntryFields & Infer<Type<Definition>>> {
    const op = new UpdateOperation<Definition>(update)
    await this.commit(op)
    return this.get({
      type: update.type,
      id: update.id,
      locale: update.locale ?? null,
      status: update.status ?? 'published'
    }) as Promise<EntryFields & Infer<Type<Definition>>>
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
    const expected = await this.mutationContext()
    await this.#commit(expected, operations)
  }

  async #commit(
    expected: MutationContext | undefined,
    operations: Array<Operation>
  ) {
    const context = structuredClone(expected)
    const mutations = await Promise.all(operations.map(op => op.task(this)))
    await this.mutate(mutations.flat(), context)
  }

  async createPolicy(forRoles: Array<string>): Promise<Policy> {
    const roles = this.config.roles ?? {}
    let result = Policy.ALLOW_NONE
    for (const name of forRoles) {
      const role = roles[name]
      assert(role, `Role ${name} not found in config`)
      const policy = new WritablePolicy(getScope(this.config))
      await role.permissions(policy, this)
      result = result.concat(policy)
    }
    return result
  }
}
