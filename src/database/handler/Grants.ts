import {Permission} from '#/core/Role.js'
import {HttpError} from '#/core/HttpError.js'
import {entryVersionId} from '../entry/Schema.js'
import type {EntryRuntime, PayloadRequest} from '../runtime/EntryRuntime.js'
import type {FrameBinding, FrameGrant} from '../replica/Frame.js'
import type {FrameStore} from '../release/FrameStore.js'
import {authorizedIndex} from './Policy.js'

export interface GrantCursor {
  revision: string
  viewId: string
}

export interface PublishedGrant extends FrameGrant {
  url: string
  offset: number
}

/** Internal handler service: roles come from the verified session, never a request body. */
export class GrantService {
  #runtime: EntryRuntime
  #frames: FrameStore
  #binding: FrameBinding

  constructor(
    runtime: EntryRuntime,
    frames: FrameStore,
    binding: FrameBinding
  ) {
    this.#runtime = runtime
    this.#frames = frames
    this.#binding = {...binding}
  }

  /** The bundle base URL is trusted handler configuration, not a caller-supplied URL. */
  async published(
    roles: ReadonlyArray<string>,
    cursor: GrantCursor,
    requests: ReadonlyArray<PayloadRequest>,
    baseUrl: string
  ): Promise<Array<PublishedGrant>> {
    const base = new URL(baseUrl)
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      !base.pathname.endsWith('/') ||
      base.search ||
      base.hash
    )
      throw new Error('Invalid public bundle base URL')
    roles = [...roles]
    cursor = {...cursor}
    requests = requests.map(request => ({...request}))
    return this.#runtime.readConsistent(async () => {
      const grants = await this.issue(roles, cursor, requests)
      return Promise.all(
        grants.map(async grant => {
          const location = await this.#frames.location(grant.descriptor)
          if (
            !/^[a-f0-9]{64}$/.test(location.bundle) ||
            !Number.isSafeInteger(location.offset) ||
            location.offset < 0
          )
            throw new Error('Invalid published frame location')
          return {
            ...grant,
            url: new URL(`${location.bundle}.bin`, base).href,
            offset: location.offset
          }
        })
      )
    })
  }

  issue(
    roles: ReadonlyArray<string>,
    cursor: GrantCursor,
    requests: ReadonlyArray<PayloadRequest>
  ): Promise<Array<FrameGrant>> {
    // Capture request/session inputs once; a retried read must not change authority.
    roles = [...roles]
    cursor = {...cursor}
    requests = requests.map(request => ({...request}))
    return this.#runtime.readConsistent(async () => {
      if (requests.length > 100)
        throw new HttpError(413, 'Too many payload grant requests')
      const requested = new Set(requests.map(request => request.versionId))
      if (requested.size !== requests.length)
        throw new HttpError(400, 'Duplicate payload grant request')
      const view = await authorizedIndex(this.#runtime, roles)
      if (view.revision !== cursor.revision || view.viewId !== cursor.viewId)
        throw new HttpError(409, 'Stale payload grant cursor')
      const rows = new Map(
        view.entries.map(row => [
          entryVersionId(
            row.entry.id,
            row.entry.locale,
            row.entry.versionStatus
          ),
          row
        ])
      )
      // Validate the whole batch before reading any private keys.
      for (const request of requests) {
        const row = rows.get(request.versionId)
        if (
          !row ||
          !(row.permissions & Permission.Read) ||
          !row.payloadId ||
          row.payloadId !== request.payloadId
        )
          throw new HttpError(403, 'Payload read denied')
      }
      return Promise.all(
        requests.map(request =>
          this.#frames.grant({...this.#binding, ...request, kind: 'data'})
        )
      )
    })
  }
}
