import type {Config} from '#/core/Config.js'
import type {
  FormFileKey,
  Submission,
  SubmissionQuery,
  SubmissionsApi,
  SubmitRequest
} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {Field} from '#/core/Field.js'
import type {FormLimits, FormMailer, FormsOptions} from '#/core/Forms.js'
import type {Graph} from '#/core/Graph.js'
import {HttpError} from '#/core/HttpError.js'
import {createId} from '#/core/Id.js'
import {Type} from '#/core/Type.js'
import {entries, isRecord} from '#/core/util/Objects.js'
import {formInputs, submissionIndex} from '#/field/form/FormAnswers.js'
import {
  type FormInputData,
  formDefinition
} from '#/field/form/FormDefinition.js'
import {FormField} from '#/field/form/FormField.js'
import {type FormMailOut, formMails} from '#/field/form/FormMails.js'
import {formPage, isSpam} from '#/field/form/FormSpam.js'
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
  'notifiedSubmission',
  'retainSubmissions',
  'purgeSubmissions',
  'visitorActivity',
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

export function parseSubmissionQuery(body: unknown): SubmissionQuery {
  if (!isRecord(body)) return {}
  const text = (value: unknown) =>
    typeof value === 'string' ? value : undefined
  const number = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
  const status = text(body.status)
  const choice = isRecord(body.choice) ? body.choice : undefined
  return {
    status:
      status === 'open' ||
      status === 'new' ||
      status === 'read' ||
      status === 'archived' ||
      status === 'all'
        ? status
        : undefined,
    search: text(body.search),
    choice:
      choice && text(choice.key) && text(choice.value)
        ? {key: String(choice.key), value: String(choice.value)}
        : undefined,
    from: number(body.from),
    until: number(body.until),
    offset: number(body.offset),
    limit: number(body.limit)
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
    visitor: typeof body.visitor === 'string' ? body.visitor : undefined,
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
  const now = Math.floor(Date.now() / 1000)
  const visitor = await visitorHash(secret, request.visitor)
  const limit = limitOf(forms, 'submissions')
  if (visitor && limit) {
    const recent = await store.visitorActivity(
      request.entryId,
      visitor,
      now - hour
    )
    if (recent.submissions >= limit)
      return {ok: false, message: 'You sent this form often, try again later'}
  }
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
  const submission: Submission = {
    id: createId(),
    entryId: request.entryId,
    locale: entry.locale ?? null,
    field: key,
    values: result.values,
    definition: result.definition,
    createdAt: now,
    status: 'new',
    notified: [],
    page: pageOf(posted.get(formPage))
  }
  const keep = retentionOf(data)
  await store.storeSubmission({
    ...submission,
    ...submissionIndex(result.definition, result.values),
    visitor,
    expiresAt: keep === null ? null : now + keep
  })
  // Files of inputs the rules hid stay behind and are cleaned up later
  await store.attachFormFiles(
    request.entryId,
    submission.id,
    submittedFiles(result.values)
  )
  // Mails go out once the answers are kept, so none is sent for answers
  // that were lost
  if (type && isFormType(type)) {
    submission.notified = await sendMails(
      forms.mailer,
      formMails(Field.options(field).inputs, rows, data.mails, result.values)
    )
    if (submission.notified.length > 0)
      await store.notifiedSubmission(
        request.entryId,
        submission.id,
        submission.notified
      )
  }
  await store.retainSubmissions(request.entryId, keep)
  await purgeSubmissions(store, forms, now)
  if (forms.onSubmit)
    try {
      const title = typeof data.title === 'string' ? data.title : ''
      await forms.onSubmit({submission, title})
    } catch (error) {
      console.error('Alinea forms.onSubmit failed', error)
    }
  if (!type || !isFormType(type)) return {ok: true}
  return afterSending(graph, data)
}

const hour = 60 * 60
const day = 24 * hour

const defaultLimits: Required<FormLimits> = {submissions: 20, uploads: 50}

/**
 * How long the submissions of a form are kept, in seconds, by its Keep
 * submissions setting, or null to keep them until they are deleted
 */
export function retentionOf(data: Record<string, unknown>): number | null {
  const days = Number(data.keep)
  return days > 0 ? days * day : null
}

/** How often a visitor may send to a form per hour, 0 when they may always */
export function limitOf(forms: FormsOptions, kind: keyof FormLimits): number {
  if (forms.limits === false) return 0
  return forms.limits?.[kind] ?? defaultLimits[kind]
}

/** A visitor as they are kept: a hash, so their address is not stored */
export async function visitorHash(
  secret: string,
  visitor: string | undefined
): Promise<string | null> {
  if (!visitor) return null
  const data = new TextEncoder().encode(`${secret}:${visitor}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest).slice(0, 16)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Where the answers were sent from, without the query, which may be private */
function pageOf(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.origin + url.pathname
  } catch {
    return null
  }
}

/** The key of a file in `forms.files` */
export function fileKey(file: FormFileKey): string {
  return `${file.entryId}/${file.id}`
}

/** Removes files of submissions that were kept in `forms.files` */
export async function removeFiles(
  forms: FormsOptions,
  files: Array<FormFileKey>
): Promise<void> {
  if (!forms.files || files.length === 0) return
  try {
    await forms.files.remove(files.map(fileKey))
  } catch (error) {
    console.error('Alinea could not remove files of submissions', error)
  }
}

/** Removes expired submissions and uploads that were never submitted */
export async function purgeSubmissions(
  store: Required<SubmissionsApi>,
  forms: FormsOptions,
  now = Math.floor(Date.now() / 1000)
): Promise<void> {
  await removeFiles(forms, await store.purgeSubmissions(now))
}

/** The ids of the files in the answers, also in items of repeated sections */
function submittedFiles(value: unknown): Array<string> {
  if (Array.isArray(value)) return value.flatMap(submittedFiles)
  if (!isRecord(value)) return []
  if (typeof value.id === 'string' && 'size' in value) return [value.id]
  return Object.values(value).flatMap(submittedFiles)
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
