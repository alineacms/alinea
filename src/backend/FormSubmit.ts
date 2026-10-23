import type {Config} from '#/core/Config.js'
import type {SubmissionsApi} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {Graph} from '#/core/Graph.js'
import {HttpError} from '#/core/HttpError.js'
import {createId} from '#/core/Id.js'
import {Type} from '#/core/Type.js'
import {entries, isRecord} from '#/core/util/Objects.js'
import {FormField} from '#/field/form/FormField.js'
import {isSpam} from '#/field/form/FormSpam.js'
import {
  type FormResult,
  validateSubmission
} from '#/field/form/FormSubmission.js'

/** What a site sends to the handler for a visitor's answers */
export interface SubmitRequest {
  /** The id of the entry holding the form */
  entryId: string
  locale?: string | null
  /** The key of the form field, the first one of the entry by default */
  field?: string
  /** The FormData the visitor sent, as its entries */
  data: Array<[string, string]>
}

export function parseSubmitRequest(body: unknown): SubmitRequest {
  if (!isRecord(body) || typeof body.entryId !== 'string')
    throw new HttpError(400, 'Missing the id of the form')
  if (!Array.isArray(body.data)) throw new HttpError(400, 'Missing the answers')
  const data = body.data.filter(
    (pair): pair is [string, string] =>
      Array.isArray(pair) &&
      typeof pair[0] === 'string' &&
      typeof pair[1] === 'string'
  )
  return {
    entryId: body.entryId,
    locale: typeof body.locale === 'string' ? body.locale : null,
    field: typeof body.field === 'string' ? body.field : undefined,
    data
  }
}

/**
 * Checks the answers against the published form and stores them. Bots are
 * told their answers were sent, so they do not try again.
 */
export async function submitForm(
  config: Config,
  graph: Graph,
  store: SubmissionsApi,
  request: SubmitRequest
): Promise<FormResult> {
  const entry = await graph.first({
    id: request.entryId,
    ...(request.locale ? {locale: request.locale} : {}),
    status: 'published',
    select: {type: Entry.type, locale: Entry.locale, data: Entry.data}
  })
  if (!entry) throw new HttpError(404, 'Form not found')
  const type = config.schema[entry.type]
  const fields = type ? entries(Type.fields(type)) : []
  const [key, field] =
    fields.find(
      ([key, field]) =>
        field instanceof FormField &&
        (request.field === undefined || key === request.field)
    ) ?? []
  if (!key || !(field instanceof FormField))
    throw new HttpError(400, 'The entry has no form')
  const data = new FormData()
  for (const [name, value] of request.data) data.append(name, value)
  if (isSpam(data)) return {ok: true}
  const rows = (entry.data as Record<string, unknown>)[key]
  const result = validateSubmission(field, rows, data)
  if (!result.ok) return {ok: false, errors: result.errors}
  if (!store.storeSubmission)
    throw new HttpError(501, 'Configure a database to store submissions')
  await store.storeSubmission({
    id: createId(),
    entryId: request.entryId,
    locale: entry.locale ?? null,
    field: key,
    values: result.values,
    definition: result.definition,
    createdAt: Math.floor(Date.now() / 1000)
  })
  return {ok: true}
}
