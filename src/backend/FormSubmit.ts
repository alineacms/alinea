import type {Config} from '#/core/Config.js'
import type {SubmissionsApi, SubmitRequest} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {Graph} from '#/core/Graph.js'
import {HttpError} from '#/core/HttpError.js'
import {createId} from '#/core/Id.js'
import {Type} from '#/core/Type.js'
import {entries, isRecord} from '#/core/util/Objects.js'
import {FormField} from '#/field/form/FormField.js'
import {isSpam} from '#/field/form/FormSpam.js'
import {isFormType} from '#/field/form/FormType.js'
import {EntryReference} from '#/picker/entry/EntryReference.js'
import {
  type FormResult,
  validateSubmission
} from '#/field/form/FormSubmission.js'

/** The submissions of the backend, which needs a database to keep them */
export function submissionStore(api: SubmissionsApi): Required<SubmissionsApi> {
  const {storeSubmission, listSubmissions, updateSubmission, deleteSubmission} =
    api
  if (
    !storeSubmission ||
    !listSubmissions ||
    !updateSubmission ||
    !deleteSubmission
  )
    throw new HttpError(501, 'Configure a database to store submissions')
  return {
    storeSubmission: storeSubmission.bind(api),
    listSubmissions: listSubmissions.bind(api),
    updateSubmission: updateSubmission.bind(api),
    deleteSubmission: deleteSubmission.bind(api)
  }
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
  await submissionStore(store).storeSubmission({
    id: createId(),
    entryId: request.entryId,
    locale: entry.locale ?? null,
    field: key,
    values: result.values,
    definition: result.definition,
    createdAt: Math.floor(Date.now() / 1000),
    status: 'new'
  })
  if (!type || !isFormType(type)) return {ok: true}
  return afterSending(graph, entry.data as Record<string, unknown>)
}

/** What a form made with `Form.type` does after it is sent */
async function afterSending(
  graph: Graph,
  data: Record<string, unknown>
): Promise<FormResult> {
  const message = typeof data.message === 'string' ? data.message.trim() : ''
  if (data.after !== 'page')
    return message ? {ok: true, confirmation: message} : {ok: true}
  const page = isRecord(data.page) ? data.page[EntryReference.entry] : undefined
  if (typeof page !== 'string') return {ok: true}
  const url = await graph.first({
    id: page,
    select: Entry.url,
    status: 'published'
  })
  return url ? {ok: true, redirect: url} : {ok: true}
}
