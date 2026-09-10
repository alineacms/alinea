import {eq, inArray, sql, table, type Database} from 'rado'
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
import {
  embeddingDistance,
  type EmbeddingMatch,
  type EmbeddingSearchQuery,
  type EmbeddingSearchResult
} from './EmbeddingSearch.js'

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

  /** Trusted, bounded candidate search. Authorization and complete global scope
   * selection belong to the caller; a browser's cached subset is not that scope.
   */
  search(input: EmbeddingSearchQuery): Promise<EmbeddingSearchResult> {
    if (
      input.candidateIds.length > 1024 ||
      input.candidateIds.length * input.space.dimensions > 1_048_576
    )
      throw new Error('Embedding search scope exceeds local work limit')
    const query = structuredClone(input)
    const vector = decodeEmbedding(
      query.space,
      encodeEmbedding(query.space, query.vector)
    )
    if (
      typeof query.revision !== 'string' ||
      !query.revision ||
      query.revision.length > 128 ||
      !Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 1024 ||
      query.candidateIds.some(
        id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)
      ) ||
      new Set(query.candidateIds).size !== query.candidateIds.length
    )
      throw new Error('Invalid embedding search scope')
    return this.#run(async () => {
      const spaceId = await embeddingHash(query.space)
      return this.db.transaction(
        async tx => {
          const revision = await tx
            .select(State.revision)
            .from(State)
            .where(eq(State.id, 1))
            .get()
          if (revision !== query.revision)
            throw new Error('Embedding search scope is stale')
          const manifests: Array<EmbeddingManifest> = []
          for (
            let offset = 0;
            offset < query.candidateIds.length;
            offset += 128
          ) {
            const ids = query.candidateIds.slice(offset, offset + 128)
            const rows = await tx
              .select()
              .from(Manifest)
              .where(inArray(Manifest.id, ids))
            if (rows.length !== ids.length)
              throw new Error(
                'Embedding search scope contains missing candidates'
              )
            for (const row of rows) {
              if (
                row.spaceId !== spaceId ||
                canonicalJson(row.target.space) !== canonicalJson(query.space)
              )
                throw new Error('Embedding search space mismatch')
              if (!row.payloadId)
                throw new Error('Embedding search scope is not fully embedded')
              manifests.push(row)
            }
          }
          const payloadIds = [...new Set(manifests.map(row => row.payloadId!))]
          const distances = new Map<string, number>()
          for (let offset = 0; offset < payloadIds.length; offset += 128) {
            const ids = payloadIds.slice(offset, offset + 128)
            // Check lengths before materializing blobs; the transaction pins these reads.
            const sizes = await tx
              .select({
                id: Payload.id,
                size: sql<number>`length(${Payload.bytes})`
              })
              .from(Payload)
              .where(inArray(Payload.id, ids))
            if (
              sizes.length !== ids.length ||
              sizes.some(row => row.size !== query.space.dimensions * 4)
            )
              throw new Error('Corrupt embedding payload')
            const payloads = await tx
              .select()
              .from(Payload)
              .where(inArray(Payload.id, ids))
            for (const payload of payloads) {
              if ((await sha256Hash(payload.bytes)) !== payload.id)
                throw new Error('Corrupt embedding payload')
              distances.set(
                payload.id,
                embeddingDistance(
                  query.space.metric,
                  vector,
                  decodeEmbedding(query.space, payload.bytes)
                )
              )
            }
          }
          const matches: Array<EmbeddingMatch> = manifests.map(row => ({
            id: row.id,
            owner: row.target.owner,
            slot: row.target.slot,
            chunk: row.target.chunk,
            distance: distances.get(row.payloadId!)!
          }))
          matches.sort(
            (a, b) =>
              a.distance - b.distance ||
              (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
          )
          return {
            revision,
            spaceId,
            scope: 'provided-candidates',
            candidates: manifests.length,
            exact: true,
            matches: matches.slice(0, query.limit)
          }
        },
        {async: true}
      )
    })
  }
}
