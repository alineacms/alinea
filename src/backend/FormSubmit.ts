import type {Config} from '#/core/Config.js'
import type {SubmissionsApi, SubmitRequest} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {Field} from '#/core/Field.js'
import type {FormMailer, FormsOptions} from '#/core/Forms.js'
import type {Graph} from '#/core/Graph.js'
import {HttpError} from '#/core/HttpError.js'
import {createId} from '#/core/Id.js'
import {Type} from '#/core/Type.js'
import {entries, isRecord} from '#/core/util/Objects.js'
import {formInputs} from '#/field/form/FormAnswers.js'
import {
  type FormInputData,
  formDefinition
} from '#/field/form/FormDefinition.js'
import {FormField} from '#/field/form/FormField.js'
import {type FormMailOut, formMails} from '#/field/form/FormMails.js'
import {isSpam} from '#/field/form/FormSpam.js'
import {
  type FormResult,
  validateSubmission
} from '#/field/form/FormSubmission.js'
import {isFormType} from '#/field/form/FormType.js'
import {EntryReference} from '#/picker/entry/EntryReference.js'
import {fileInputs, loadForm} from './FormLoad.js'
import {resolveFiles} from './FormUploads.js'

const storeMethods = [
  'storeSubmission',
  'listSubmissions',
  'updateSubmission',
  'deleteSubmission',
  'storeFormFile',
  'formFiles',
  'attachFormFiles',
  'readFormFile'
] as const

/** The submissions of the backend, which needs a database to keep them */
export function submissionStore(api: SubmissionsApi): Required<SubmissionsApi> {
  const store: Record<string, unknown> = {}
  for (const name of storeMethods) {
    const method = api[name]
    if (!method)
      throw new HttpError(501, 'Configure a database to store submissions')
    store[name] = method.bind(api)
  }
  return store as Required<SubmissionsApi>
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
  api: SubmissionsApi,
  request: SubmitRequest,
  {forms = {}, secret}: {forms?: FormsOptions; secret: string}
): Promise<FormResult> {
  const {entry, type, data, key, field, rows, inputs} = await loadForm(
    config,
    graph,
    request
  )
  const store = submissionStore(api)
  const posted = new FormData()
  for (const [name, value] of request.data) posted.append(name, value)
  if (isSpam(posted)) return {ok: true}
  const files = await resolveFiles(
    store,
    secret,
    request.entryId,
    fileInputs(inputs),
    posted
  )
  if (!files.ok) return {ok: false, errors: files.errors}
  const result = validateSubmission(field, rows, files.data)
  if (!result.ok) return {ok: false, errors: result.errors}
  const notified =
    type && isFormType(type)
      ? await sendMails(
          forms.mailer,
          formMails(
            Field.options(field).inputs,
            rows,
            data.mails,
            result.values
          )
        )
      : []
  const id = createId()
  await store.storeSubmission({
    id,
    entryId: request.entryId,
    locale: entry.locale ?? null,
    field: key,
    values: result.values,
    definition: result.definition,
    createdAt: Math.floor(Date.now() / 1000),
    status: 'new',
    notified
  })
  // Files of inputs the rules hid stay behind and are cleaned up later
  await store.attachFormFiles(
    request.entryId,
    id,
    submittedFiles(result.values)
  )
  if (!type || !isFormType(type)) return {ok: true}
  return afterSending(graph, data)
}

function submittedFiles(values: Record<string, unknown>): Array<string> {
  return Object.values(values).flatMap(value =>
    Array.isArray(value)
      ? value.flatMap(item =>
          isRecord(item) && typeof item.id === 'string' && 'size' in item
            ? [item.id]
            : []
        )
      : []
  )
}

/**
 * Sends the mails, returning the names of those that went out. A mail that
 * fails is reported, the answers are stored anyway.
 */
async function sendMails(
  mailer: FormMailer | undefined,
  mails: Array<FormMailOut>
): Promise<Array<string>> {
  if (mails.length === 0) return []
  if (!mailer) {
    console.warn(
      `Alinea could not send ${mails.length} form mail(s): set forms.mailer in createHandler`
    )
    return []
  }
  const sent = await Promise.all(
    mails.map(async ({name, mail}) => {
      try {
        await mailer(mail)
        return [name]
      } catch (error) {
        console.error(`Alinea could not send the form mail "${name}"`, error)
        return []
      }
    })
  )
  return sent.flat()
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
