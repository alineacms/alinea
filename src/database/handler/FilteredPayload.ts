import type {Config} from '#/core/Config.js'
import {Field} from '#/core/Field.js'
import {Permission} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import {sha256Hash, compareStrings} from '#/core/source/Utils.js'
import {isRecord} from '#/core/util/Objects.js'
import {entryVersionId} from '../entry/Schema.js'
import {validateSource, type LoadedPayload} from '../runtime/EntryRuntime.js'
import type {AuthorizedEntry} from './Policy.js'

export interface PayloadProjection {
  readonly versionId: string
  readonly type: string
  readonly sourcePayloadId: string
  readonly payloadId: string
  readonly readableFields: ReadonlyArray<string>
}

/** Trusted handler plan from compiled permissions, not a client-supplied mask.
 * Its identity is computable from resident metadata without reading entry data.
 */
export async function payloadProjection(
  row: AuthorizedEntry
): Promise<PayloadProjection> {
  if (
    !(row.permissions & Permission.Explore) ||
    !(row.permissions & Permission.Read) ||
    !row.payloadId
  )
    throw new Error('Payload projection is not readable')
  const versionId = entryVersionId(
    row.entry.id,
    row.entry.locale,
    row.entry.versionStatus
  )
  const type = row.entry.type,
    sourcePayloadId = row.payloadId
  const readableFields = Object.entries(row.fields)
    .filter(([, permissions]) => Boolean(permissions & Permission.Read))
    .map(([name]) => name)
    .sort(compareStrings)
  const payloadId = await sha256Hash(
    new TextEncoder().encode(
      JSON.stringify([
        'alinea.filtered-payload.v1',
        versionId,
        type,
        sourcePayloadId,
        readableFields
      ])
    )
  )
  return Object.freeze({
    versionId,
    type,
    sourcePayloadId,
    payloadId,
    readableFields: Object.freeze(readableFields)
  })
}

/** Project exact immutable source data. Top-level fields are the policy's grant
 * unit, so a readable collection/object is copied as a whole. Unknown stored
 * fields are omitted; source search text must never bypass a denied field.
 * This function does not issue keys or authorize a request by itself.
 */
export function filterPayload(
  config: Config,
  projection: PayloadProjection,
  payload: LoadedPayload
): LoadedPayload {
  if (
    payload.versionId !== projection.versionId ||
    payload.payloadId !== projection.sourcePayloadId ||
    !isRecord(payload.data)
  )
    throw new Error('Payload projection source mismatch')
  const type = config.schema[projection.type]
  if (!type) throw new Error('Unknown payload projection type')
  const fields = Type.fields(type)
  if (
    new Set(projection.readableFields).size !==
      projection.readableFields.length ||
    projection.readableFields.some(name => !Object.hasOwn(fields, name))
  )
    throw new Error('Unknown or duplicate payload projection field')
  const data = Object.fromEntries(
    projection.readableFields
      .filter(name => Object.hasOwn(payload.data, name))
      .map(name => [name, structuredClone(payload.data[name])])
  )
  const allowed = new Set(projection.readableFields)
  // Keep schema order, matching Type.searchableText, and never invoke denied fields.
  let searchableText = ''
  for (const [name, field] of Object.entries(fields))
    if (allowed.has(name))
      searchableText += Field.searchableText(field, data[name])
  return {
    versionId: projection.versionId,
    payloadId: projection.payloadId,
    data,
    source: {
      ...validateSource(payload.source),
      searchableText: searchableText.trim()
    }
  }
}
