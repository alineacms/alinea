import {HttpError} from '#/core/HttpError.js'
import {Permission} from '#/core/Role.js'
import {entryVersionId} from '../entry/Schema.js'
import {
  payloadRequestLimit,
  type PayloadBatchRequest
} from '../replica/PayloadBatch.js'
import type {EntryRuntime, LoadedPayload} from '../runtime/EntryRuntime.js'
import {authorizedIndex} from './Policy.js'

/** Authorize and read exact payload identities from one immutable SQL view. */
export function authorizedPayloads(
  runtime: EntryRuntime,
  roles: ReadonlyArray<string>,
  request: PayloadBatchRequest
): Promise<Array<LoadedPayload>> {
  roles = [...roles]
  request = structuredClone(request)
  return runtime.readConsistent(async () => {
    await authorizePayloadRequests(runtime, roles, request)
    return runtime.payloads(request.requests)
  })
}

/** Validate exact payload requests without reading their potentially large rows. */
export function authorizePayloadRequests(
  runtime: EntryRuntime,
  roles: ReadonlyArray<string>,
  request: PayloadBatchRequest
): Promise<void> {
  roles = [...roles]
  request = structuredClone(request)
  return runtime.readConsistent(async () => {
    if (request.requests.length > payloadRequestLimit)
      throw new HttpError(413, 'Too many payload requests')
    const requested = new Set(request.requests.map(row => row.versionId))
    if (requested.size !== request.requests.length)
      throw new HttpError(400, 'Duplicate payload request')
    const view = await authorizedIndex(runtime, roles)
    if (
      view.revision !== request.revision ||
      view.viewId !== request.identity.viewId
    )
      throw new HttpError(409, 'Stale payload cursor')
    const rows = new Map(
      view.entries.map(row => [
        entryVersionId(row.entry.id, row.entry.locale, row.entry.versionStatus),
        row
      ])
    )
    for (const requested of request.requests) {
      const row = rows.get(requested.versionId)
      if (
        !row ||
        !(row.permissions & Permission.Read) ||
        row.payloadId !== requested.payloadId
      )
        throw new HttpError(403, 'Payload read denied')
    }
  })
}
