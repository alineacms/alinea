import {HttpError} from '#/core/HttpError.js'
import {Permission} from '#/core/Role.js'
import {entryVersionId} from '../entry/Schema.js'
import type {EntryRuntime} from '../runtime/EntryRuntime.js'
import type {EmbeddingSpace} from '../vector/Embedding.js'
import type {EmbeddingStore} from '../vector/EmbeddingStore.js'
import {authorizedIndex} from './Policy.js'

export interface AuthorizedEmbeddingQuery {
  revision: string
  viewId: string
  embeddingRevision: string
  ownerVersionIds: ReadonlyArray<string>
  space: EmbeddingSpace
  slot: string
  vector: ReadonlyArray<number>
  limit: number
}

/** Internal handler boundary. Roles must come from the verified session.
 * Does not expose a transport route or grant plaintext vector access.
 */
export class AuthorizedEmbeddingSearch {
  constructor(
    readonly runtime: EntryRuntime,
    readonly embeddings: EmbeddingStore
  ) {}

  search(roles: ReadonlyArray<string>, input: AuthorizedEmbeddingQuery) {
    if (input.ownerVersionIds.length > 1024)
      throw new HttpError(413, 'Too many embedding owners')
    roles = [...roles]
    const query = structuredClone(input)
    const requested = new Set(query.ownerVersionIds)
    if (requested.size !== query.ownerVersionIds.length)
      throw new HttpError(400, 'Duplicate embedding owner')
    return this.runtime.readConsistent(async () => {
      const view = await authorizedIndex(this.runtime, roles)
      if (view.revision !== query.revision || view.viewId !== query.viewId)
        throw new HttpError(409, 'Stale embedding policy view')
      const owners = view.entries.flatMap(row => {
        const versionId = entryVersionId(
          row.entry.id,
          row.entry.locale,
          row.entry.versionStatus
        )
        if (
          !requested.has(versionId) ||
          !(row.permissions & Permission.Read) ||
          !row.payloadId
        )
          return []
        return [{versionId, payloadId: row.payloadId}]
      })
      const candidateIds = await this.embeddings.candidates(
        query.embeddingRevision,
        owners,
        query.space,
        query.slot
      )
      return this.embeddings.search({
        revision: query.embeddingRevision,
        candidateIds,
        space: query.space,
        vector: query.vector,
        limit: query.limit
      })
    })
  }
}
