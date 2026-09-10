import {
  and,
  asc,
  eq,
  inArray,
  index,
  isNull,
  sql,
  table,
  type Database
} from 'rado'
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
  validateEmbeddingOwner,
  ObsoleteEmbeddingJobError,
  type EmbeddingPublication,
  type EmbeddingTarget,
  type EmbeddingJob,
  type EmbeddingManifest,
  type EmbeddingSpace
} from './Embedding.js'
import {
  embeddingDistance,
  type EmbeddingMatch,
  type EmbeddingSearchQuery,
  type EmbeddingSearchResult
} from './EmbeddingSearch.js'

const Manifest = table(
  'alinea_embedding_manifest',
  {
    id: column.varchar(undefined, {length: 64}).primaryKey(),
    generation: column.varchar(undefined, {length: 128}).notNull(),
    spaceId: column.varchar(undefined, {length: 64}).notNull(),
    target: column.json<EmbeddingTarget>().notNull(),
    ownerVersionId: column.varchar(undefined, {length: 1024}).notNull(),
    slot: column.varchar(undefined, {length: 1024}).notNull(),
    payloadId: column.varchar(undefined, {length: 64})
  },
  row => ({
    alinea_embedding_manifest_owner: index().on(
      row.ownerVersionId,
      row.spaceId,
      row.slot
    )
  })
)
const Payload = table('alinea_embedding_data', {
  id: column.varchar(undefined, {length: 64}).primaryKey(),
  bytes: column.blob().notNull()
})
const Publication = table(
  'alinea_embedding_publication',
  {
    id: column.varchar(undefined, {length: 64}).primaryKey(),
    ownerVersionId: column.varchar(undefined, {length: 1024}).notNull(),
    ownerPayloadId: column.varchar(undefined, {length: 1024}).notNull(),
    slot: column.varchar(undefined, {length: 1024}).notNull(),
    spaceId: column.varchar(undefined, {length: 64}).notNull(),
    jobs: column.json<Array<{id: string; generation: string}>>().notNull()
  },
  row => ({
    alinea_embedding_publication_owner: index().on(row.ownerVersionId, row.slot)
  })
)
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
    await db.create(Manifest, Payload, Publication, State)
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
          await tx
            .delete(Publication)
            .where(
              and(
                eq(Publication.ownerVersionId, target.owner.versionId),
                eq(Publication.slot, target.slot)
              )
            )
          await tx.delete(Manifest).where(eq(Manifest.id, id))
          await tx.insert(Manifest).values({
            ...job,
            ownerVersionId: target.owner.versionId,
            slot: target.slot,
            payloadId: null
          })
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

  /** Durable pending work, limited to published chunk sets in one model space. */
  pending(spaceId: string, limit = 128): Promise<Array<EmbeddingJob>> {
    if (
      !/^[a-f0-9]{64}$/.test(spaceId) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 1024
    )
      throw new Error('Invalid embedding work batch')
    return this.#run(async () => {
      const rows = await this.db
        .select({manifest: Manifest, jobs: Publication.jobs})
        .from(Manifest)
        .innerJoin(
          Publication,
          and(
            eq(Manifest.ownerVersionId, Publication.ownerVersionId),
            eq(Manifest.slot, Publication.slot),
            eq(Manifest.spaceId, Publication.spaceId)
          )
        )
        .where(and(eq(Manifest.spaceId, spaceId), isNull(Manifest.payloadId)))
        .orderBy(asc(Manifest.id))
        .limit(limit)
      return rows.map(({manifest, jobs}) => {
        if (
          !jobs.some(
            job =>
              job.id === manifest.id && job.generation === manifest.generation
          )
        )
          throw new Error('Invalid embedding publication')
        const {id, generation, spaceId, target} = manifest
        return {id, generation, spaceId, target}
      })
    })
  }

  /** Atomically declares the complete chunk set for one owner/slot. An empty
   * set is explicit; missing publication is never interpreted as zero chunks.
   * Capture expectedRevision before asynchronous extraction so a newer published
   * generation cannot be overwritten by older preparation.
   */
  publishOwner(
    input: EmbeddingPublication,
    expectedRevision: string
  ): Promise<Array<EmbeddingJob>> {
    if (input.chunks.length > 1024) throw new Error('Too many embedding chunks')
    const {chunks, ...owner} = structuredClone(input)
    validateEmbeddingOwner(owner)
    if (new Set(chunks.map(chunk => chunk.chunk)).size !== chunks.length)
      throw new Error('Duplicate embedding chunk')
    const targets = chunks.map(({chunk, sourceHash}) => ({
      ...owner,
      chunk,
      sourceHash
    }))
    targets.forEach(validateEmbedding)
    return this.#run(async () => {
      const id = await embeddingHash([owner.owner.versionId, owner.slot])
      const spaceId = await embeddingHash(owner.space)
      const prepared = await Promise.all(
        targets.map(async target => ({
          target,
          id: await embeddingHash([target.owner, target.slot, target.chunk])
        }))
      )
      prepared.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      return this.db.transaction(
        async tx => {
          const revision = await tx
            .select(State.revision)
            .from(State)
            .where(eq(State.id, 1))
            .get()
          if (revision !== expectedRevision)
            throw new Error('Embedding publication revision is stale')
          const scope = and(
            eq(Manifest.ownerVersionId, owner.owner.versionId),
            eq(Manifest.slot, owner.slot)
          )
          const previous = await tx.select().from(Manifest).where(scope)
          const byId = new Map(previous.map(row => [row.id, row]))
          const rows = prepared.map(({id, target}) => {
            const old = byId.get(id)
            if (old && canonicalJson(old.target) === canonicalJson(target))
              return old
            return {
              id,
              target,
              spaceId,
              generation: createId(),
              ownerVersionId: owner.owner.versionId,
              slot: owner.slot,
              payloadId: null
            }
          })
          const publication = {
            id,
            ownerVersionId: owner.owner.versionId,
            ownerPayloadId: owner.ownerPayloadId,
            slot: owner.slot,
            spaceId,
            jobs: rows.map(({id, generation}) => ({id, generation}))
          }
          const old = await tx
            .select()
            .from(Publication)
            .where(eq(Publication.id, id))
            .get()
          const jobs = rows.map(({id, generation, spaceId, target}) => ({
            id,
            generation,
            spaceId,
            target
          }))
          if (
            old &&
            previous.length === rows.length &&
            canonicalJson(old) === canonicalJson(publication)
          )
            return jobs
          await tx.delete(Manifest).where(scope)
          for (let offset = 0; offset < rows.length; offset += 100)
            await tx.insert(Manifest).values(rows.slice(offset, offset + 100))
          await tx.delete(Publication).where(eq(Publication.id, id))
          await tx.insert(Publication).values(publication)
          await tx
            .update(State)
            .set({revision: createId()})
            .where(eq(State.id, 1))
          return jobs
        },
        {async: true}
      )
    })
  }

  /** Callers supply freshly authorized owner descriptors, not just cached IDs.
   * Every requested owner must have current manifests in the selected space/slot.
   */
  candidates(
    revision: string,
    input: ReadonlyArray<{versionId: string; payloadId: string}>,
    space: EmbeddingSpace,
    slot: string
  ): Promise<Array<string>> {
    if (input.length > 1024)
      throw new Error('Embedding search scope exceeds local work limit')
    const owners = new Map(
      input.map(owner => [owner.versionId, owner.payloadId])
    )
    if (owners.size !== input.length || !slot || slot.length > 1024)
      throw new Error('Invalid embedding owner scope')
    const selected = structuredClone(space)
    return this.#run(async () => {
      const spaceId = await embeddingHash(selected)
      return this.db.transaction(
        async tx => {
          const current = await tx
            .select(State.revision)
            .from(State)
            .where(eq(State.id, 1))
            .get()
          if (current !== revision)
            throw new Error('Embedding search scope is stale')
          const ids: Array<string> = []
          const found = new Set<string>()
          const expected = new Map<string, string>()
          const versions = [...owners.keys()]
          for (let offset = 0; offset < versions.length; offset += 128) {
            const publications = await tx
              .select()
              .from(Publication)
              .where(
                and(
                  inArray(
                    Publication.ownerVersionId,
                    versions.slice(offset, offset + 128)
                  ),
                  eq(Publication.slot, slot),
                  eq(Publication.spaceId, spaceId)
                )
              )
            for (const publication of publications) {
              if (
                publication.ownerPayloadId !==
                owners.get(publication.ownerVersionId)
              )
                throw new Error(
                  'Embedding inputs are stale for the current owner'
                )
              found.add(publication.ownerVersionId)
              for (const job of publication.jobs) {
                if (expected.has(job.id))
                  throw new Error('Invalid embedding publication')
                expected.set(job.id, job.generation)
              }
              if (expected.size > 1024)
                throw new Error(
                  'Embedding search scope exceeds local work limit'
                )
            }
            const rows = await tx
              .select()
              .from(Manifest)
              .where(
                and(
                  inArray(
                    Manifest.ownerVersionId,
                    versions.slice(offset, offset + 128)
                  ),
                  eq(Manifest.spaceId, spaceId),
                  eq(Manifest.slot, slot)
                )
              )
              .limit(1025 - ids.length)
            for (const row of rows) {
              if (
                row.target.owner.versionId !== row.ownerVersionId ||
                row.target.slot !== slot ||
                row.target.ownerPayloadId !== owners.get(row.ownerVersionId)
              )
                throw new Error(
                  'Embedding inputs are stale for the current owner'
                )
              ids.push(row.id)
              if (expected.get(row.id) !== row.generation)
                throw new Error('Embedding owner scope is not fully indexed')
            }
            if (ids.length > 1024)
              throw new Error('Embedding search scope exceeds local work limit')
          }
          if (found.size !== owners.size || ids.length !== expected.size)
            throw new Error('Embedding owner scope is not fully indexed')
          return ids
        },
        {async: true}
      )
    })
  }

  /** A stale or removed job is rejected, including source A → B → A changes. */
  install(
    input: EmbeddingJob,
    values: ReadonlyArray<number>,
    signal?: AbortSignal
  ): Promise<boolean> {
    signal?.throwIfAborted()
    const job = structuredClone(input)
    validateEmbedding(job.target)
    const bytes = encodeEmbedding(job.target.space, values)
    return this.#run(async () => {
      const payloadId = await sha256Hash(bytes)
      signal?.throwIfAborted()
      return this.db.transaction(
        async tx => {
          signal?.throwIfAborted()
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
            throw new ObsoleteEmbeddingJobError()
          if (current.payloadId) {
            if (current.payloadId !== payloadId)
              throw new Error(
                'Embedding job already completed with different bytes'
              )
            return false
          }
          signal?.throwIfAborted()
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
          signal?.throwIfAborted()
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
        throw new ObsoleteEmbeddingJobError()
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
            .select()
            .from(Manifest)
            .where(eq(Manifest.id, id))
            .get()
          if (!exists) return
          await tx.delete(Manifest).where(eq(Manifest.id, id))
          await tx
            .delete(Publication)
            .where(
              and(
                eq(Publication.ownerVersionId, exists.ownerVersionId),
                eq(Publication.slot, exists.slot)
              )
            )
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
