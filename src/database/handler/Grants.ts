import {Permission} from '#/core/Role.js'
import {entryVersionId} from '../entry/Schema.js'
import type {EntryRuntime, PayloadRequest} from '../runtime/EntryRuntime.js'
import type {FrameBinding, FrameGrant} from '../replica/Frame.js'
import type {FrameStore} from '../release/FrameStore.js'
import {authorizedIndex} from './Policy.js'

export interface GrantCursor {
  revision: string
  viewId: string
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
        throw new Error('Too many payload grant requests')
      const requested = new Set(requests.map(request => request.versionId))
      if (requested.size !== requests.length)
        throw new Error('Duplicate payload grant request')
      const view = await authorizedIndex(this.#runtime, roles)
      if (view.revision !== cursor.revision || view.viewId !== cursor.viewId)
        throw new Error('Stale payload grant cursor')
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
          throw new Error('Payload read denied')
      }
      return Promise.all(
        requests.map(request =>
          this.#frames.grant({...this.#binding, ...request, kind: 'data'})
        )
      )
    })
  }
}
