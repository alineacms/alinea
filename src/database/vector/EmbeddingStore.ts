import {eq, table, type Database} from 'rado'
import * as column from 'rado/universal/columns'
import pLimit from 'p-limit'
import {createId} from '#/core/Id.js'
import {sha256Hash} from '#/core/source/Utils.js'
import {canonicalJson} from '#/core/util/Json.js'
import {
  decodeEmbedding,
  embeddingHash,
  encodeEmbedding,
  validateEmbedding,
  type EmbeddingTarget,
  type EmbeddingJob,
  type EmbeddingManifest
} from './Embedding.js'

const Manifest = table('alinea_embedding_manifest', {
  id: column.varchar(undefined, {length: 64}).primaryKey(),
  generation: column.varchar(undefined, {length: 128}).notNull(),
  spaceId: column.varchar(undefined, {length: 64}).notNull(),
  target: column.json<EmbeddingTarget>().notNull(),
  payloadId: column.varchar(undefined, {length: 64})
})
const Payload = table('alinea_embedding_data', {
  id: column.varchar(undefined, {length: 64}).primaryKey(),
  bytes: column.blob().notNull()
})
const State = table('alinea_embedding_state', {
  id: column.integer().primaryKey(),
  revision: column.varchar(undefined, {length: 128}).notNull()
})

/** Private derived-data store. Use an exclusively owned connection/serialization
 * boundary. These methods do not authorize owners or expose browser transport.
 * Content reconciliation must update/remove targets before publishing a revision.
 */
export class EmbeddingStore {
  #run = pLimit(1)
  constructor(readonly db: Database) {}

  static async createSchema(db: Database): Promise<void> {
    await db.create(Manifest, Payload, State)
    await db.insert(State).values({id: 1, revision: createId()})
  }

  revision(): Promise<string> {
    return this.#run(async () => {
      const revision = await this.db
        .select(State.revision)
        .from(State)
        .where(eq(State.id, 1))
        .get()
      if (!revision) throw new Error('Missing embedding state')
      return revision
    })
  }

  schedule(input: EmbeddingTarget): Promise<EmbeddingJob> {
    const target = structuredClone(input)
    validateEmbedding(target)
    return this.#run(async () => {
      const id = await embeddingHash([target.owner, target.slot, target.chunk])
      const spaceId = await embeddingHash(target.space)
      return this.db.transaction(
        async tx => {
          const previous = await tx
            .select()
            .from(Manifest)
            .where(eq(Manifest.id, id))
            .get()
          if (
            previous &&
            canonicalJson(previous.target) === canonicalJson(target)
          )
            return {id, generation: previous.generation, spaceId, target}
          const job = {id, generation: createId(), spaceId, target}
          await tx.delete(Manifest).where(eq(Manifest.id, id))
          await tx.insert(Manifest).values({...job, payloadId: null})
          await tx
            .update(State)
            .set({revision: createId()})
            .where(eq(State.id, 1))
          return job
        },
        {async: true}
      )
    })
  }

  manifest(id: string): Promise<EmbeddingManifest | undefined> {
    return this.#run(async () => {
      const manifest = await this.db
        .select()
        .from(Manifest)
        .where(eq(Manifest.id, id))
        .get()
      return manifest ? structuredClone(manifest) : undefined
    })
  }

  /** A stale or removed job is rejected, including source A → B → A changes. */
  install(
    input: EmbeddingJob,
    values: ReadonlyArray<number>
  ): Promise<boolean> {
    const job = structuredClone(input)
    validateEmbedding(job.target)
    const bytes = encodeEmbedding(job.target.space, values)
    return this.#run(async () => {
      const payloadId = await sha256Hash(bytes)
      return this.db.transaction(
        async tx => {
          const current = await tx
            .select()
            .from(Manifest)
            .where(eq(Manifest.id, job.id))
            .get()
          if (
            !current ||
            current.generation !== job.generation ||
            current.spaceId !== job.spaceId ||
            canonicalJson(current.target) !== canonicalJson(job.target)
          )
            throw new Error('Obsolete embedding job')
          if (current.payloadId) {
            if (current.payloadId !== payloadId)
              throw new Error(
                'Embedding job already completed with different bytes'
              )
            return false
          }
          const stored = await tx
            .select(Payload.id)
            .from(Payload)
            .where(eq(Payload.id, payloadId))
            .get()
          if (!stored) await tx.insert(Payload).values({id: payloadId, bytes})
          await tx
            .update(Manifest)
            .set({payloadId})
            .where(eq(Manifest.id, job.id))
          await tx
            .update(State)
            .set({revision: createId()})
            .where(eq(State.id, 1))
          return true
        },
        {async: true}
      )
    })
  }

  /** Separate payload read: resident manifests never materialize vector bytes. */
  load(input: EmbeddingJob): Promise<Array<number> | undefined> {
    const job = structuredClone(input)
    return this.#run(async () => {
      const current = await this.db
        .select()
        .from(Manifest)
        .where(eq(Manifest.id, job.id))
        .get()
      if (
        !current ||
        current.generation !== job.generation ||
        current.spaceId !== job.spaceId ||
        canonicalJson(current.target) !== canonicalJson(job.target)
      )
        throw new Error('Obsolete embedding job')
      if (!current.payloadId) return
      const bytes = await this.db
        .select(Payload.bytes)
        .from(Payload)
        .where(eq(Payload.id, current.payloadId))
        .get()
      if (!bytes || (await sha256Hash(bytes)) !== current.payloadId)
        throw new Error('Corrupt embedding payload')
      return decodeEmbedding(current.target.space, bytes)
    })
  }

  remove(id: string): Promise<void> {
    return this.#run(async () => {
      await this.db.transaction(
        async tx => {
          const exists = await tx
            .select(Manifest.id)
            .from(Manifest)
            .where(eq(Manifest.id, id))
            .get()
          if (!exists) return
          await tx.delete(Manifest).where(eq(Manifest.id, id))
          await tx
            .update(State)
            .set({revision: createId()})
            .where(eq(State.id, 1))
        },
        {async: true}
      )
    })
  }
}
