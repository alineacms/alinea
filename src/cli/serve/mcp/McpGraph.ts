import {HandleAction} from '#/backend/HandleAction.js'
import type {Config} from '#/core/Config.js'
import type {UploadMetadata, UploadResponse} from '#/core/Connection.js'
import type {
  EntryReferenceQuery,
  EntryReferenceResult
} from '#/core/db/EntryReference.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {AnyQueryResult, GraphQuery} from '#/core/Graph.js'
import {HttpError} from '#/core/HttpError.js'
import {isRecord} from '#/core/util/Objects.js'
import {Request} from '@alinea/iso'

export interface McpGraphOptions {
  config: Config
  /** The dev server's entry store, used for reads */
  db: LocalStore
  /** The dev server's api handler, used for writes */
  handle(request: Request): Promise<Response>
  /** The url the api handler is served on */
  handlerUrl: string
}

/**
 * A graph which reads from the dev server's entry store and writes through
 * the api handler, the same path dashboard mutations and uploads take, so
 * changes land in the content files and the dashboard reloads them.
 */
export class McpGraph extends WriteableGraph {
  config: Config
  #options: McpGraphOptions

  constructor(options: McpGraphOptions) {
    super()
    this.config = options.config
    this.#options = options
  }

  resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    return this.#options.db.resolve(query)
  }

  referencesTo(query: EntryReferenceQuery): Promise<EntryReferenceResult> {
    return this.#options.db.referencesTo(query)
  }

  mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    return this.#post(HandleAction.Mutate, mutations) as Promise<{sha: string}>
  }

  prepareUpload(
    file: string,
    metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    return this.#post(HandleAction.Upload, {
      filename: file,
      ...metadata
    }) as Promise<UploadResponse>
  }

  async #post(action: HandleAction, body: unknown): Promise<unknown> {
    const url = new URL(this.#options.handlerUrl)
    url.search = new URLSearchParams({action}).toString()
    const response = await this.#options.handle(
      new Request(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      })
    )
    const text = await response.text()
    let result: unknown = text
    try {
      result = JSON.parse(text)
    } catch {
      // Keep the plain text for the error message
    }
    if (!response.ok) {
      const message =
        isRecord(result) && typeof result.error === 'string'
          ? result.error
          : text || response.statusText
      throw new HttpError(response.status, message)
    }
    return result
  }
}
