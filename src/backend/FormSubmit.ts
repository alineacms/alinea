import {Config} from '#/core/Config.js'
import type {
  FormFileKey,
  FormFileRef,
  FormStatus,
  Submission,
  SubmissionQuery,
  SubmissionsApi,
  SubmitRequest
} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {Field} from '#/core/Field.js'
import type {
  FormLimits,
  FormMailAttachment,
  FormMailer,
  FormsOptions
} from '#/core/Forms.js'
import type {Graph} from '#/core/Graph.js'
import {HttpError} from '#/core/HttpError.js'
import {createId} from '#/core/Id.js'
import {Type} from '#/core/Type.js'
import {encode} from '#/core/util/BufferToBase64.js'
import {entries, isRecord, keys} from '#/core/util/Objects.js'
import {href} from '#/dashboard/Href.js'
import {
  answerText,
  formColumns,
  formInputs,
  submissionIndex
} from '#/field/form/FormAnswers.js'
import {
  type FormDefinition,
  type FormInputData,
  formDefinition
} from '#/field/form/FormDefinition.js'
import {FormField} from '#/field/form/FormField.js'
import {
  type FormMailOut,
  formMails,
  linkedEntries
} from '#/field/form/FormMails.js'
import {
  type FormMessage,
  type FormProblems,
  translate,
  translateErrors
} from '#/field/form/FormMessages.js'
import {formPage, isSpam} from '#/field/form/FormSpam.js'
import {
  type FormResult,
  type FormValues,
  validateSubmission
} from '#/field/form/FormSubmission.js'
import {isFormType} from '#/field/form/FormType.js'
import {EntryReference} from '#/picker/entry/EntryReference.js'
import {type FormLocation, fileInputs, loadForm} from './FormLoad.js'
import {resolveFiles} from './FormUploads.js'

const storeMethods = [
  'storeSubmission',
  'listSubmissions',
  'updateSubmission',
  'deleteSubmission',
  'notifiedSubmission',
  'retainSubmissions',
  'purgeSubmissions',
  'recentActivity',
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
    id: text(body.id),
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
    locale: text(body.locale),
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
  {
    forms = {},
    secret,
    handlerUrl
  }: {forms?: FormsOptions; secret: string; handlerUrl?: URL}
): Promise<FormResult> {
  const {entry, type, data, key, field, rows, inputs} = await loadForm(
    config,
    graph,
    request
  )
  const store = submissionStore(api)
  const locale = entry.locale ?? null
  const text = translate(locale, forms.messages)
  const posted = new FormData()
  for (const [name, value] of request.data) posted.append(name, value)
  const sent = () =>
    type && isFormType(type) ? afterSending(graph, data) : {ok: true as const}
  // Bots see what people see, so they can not tell they were caught
  if (isSpam(posted)) return sent()
  const now = Math.floor(Date.now() / 1000)
  const visitor = await visitorHash(secret, request.visitor)
  const limited = await overLimit(
    store,
    forms,
    request.entryId,
    visitor,
    'submissions'
  )
  if (limited) return {ok: false, message: text(limited)}
  const full = await fullMessage(store, request.entryId, data)
  if (full) return {ok: false, message: text(full)}
  const files = await resolveFiles(
    store,
    secret,
    request.entryId,
    fileInputs(inputs),
    posted
  )
  if (!files.ok) return {ok: false, ...translateErrors(files.errors, text)}
  const result = validateSubmission(field, rows, files.data, {
    locale,
    messages: forms.messages
  })
  if (!result.ok) return {ok: false, errors: result.errors, codes: result.codes}
  const repeated = await repeatedAnswers(
    store,
    request.entryId,
    result.definition,
    result.values
  )
  if (keys(repeated).length > 0)
    return {ok: false, ...translateErrors(repeated, text)}
  const submission: Submission = {
    id: createId(),
    entryId: request.entryId,
    locale,
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
  const submitted = submittedFiles(result.values)
  await store.attachFormFiles(
    request.entryId,
    submission.id,
    submitted.map(file => file.id)
  )
  // Mails go out once the answers are kept, so none is sent for answers
  // that were lost
  if (type && isFormType(type)) {
    // The dashboard is served by the site, at its admin path
    const site = Config.baseUrl(config) ?? handlerUrl
    const dashboard = site && new URL(Config.adminPath(config), site)
    const mails = formMails(
      Field.options(field).inputs,
      rows,
      data.mails,
      result.values,
      {
        locale,
        link: dashboard
          ? dashboard.href +
            href({
              entryId: request.entryId,
              locale,
              submission: submission.id
            })
          : undefined,
        entries: site
          ? await entryUrls(graph, data.mails, site, locale)
          : undefined,
        messages: forms.messages
      }
    )
    const attachments = mails.some(out => out.attach)
      ? await readFiles(store, forms, request.entryId, submitted)
      : []
    submission.notified = await sendMails(
      forms.mailer,
      mails.map(out =>
        out.attach && attachments.length > 0
          ? {...out, mail: {...out.mail, attachments}}
          : out
      )
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
  return sent()
}

/** Whether the published form of an entry still takes answers */
export async function formStatus(
  config: Config,
  graph: Graph,
  api: SubmissionsApi,
  location: FormLocation,
  forms: FormsOptions = {}
): Promise<FormStatus> {
  const {entry, data} = await loadForm(config, graph, location)
  const full = await fullMessage(submissionStore(api), location.entryId, data)
  if (!full) return {open: true}
  return {open: false, message: translate(entry.locale, forms.messages)(full)}
}

/**
 * The most submissions a form takes by its Most submissions setting, or null
 * when it takes any number
 */
export function limitOf(data: Record<string, unknown>): number | null {
  const limit = Number(data.limit)
  return Number.isInteger(limit) && limit > 0 ? limit : null
}

/** What visitors see once a form took its most submissions */
async function fullMessage(
  store: Required<SubmissionsApi>,
  entryId: string,
  data: Record<string, unknown>
): Promise<string | FormMessage | undefined> {
  const limit = limitOf(data)
  if (limit === null) return undefined
  // Archived submissions count, deleted ones free their place
  const {total} = await store.listSubmissions(entryId, {
    status: 'all',
    limit: 1
  })
  if (total < limit) return undefined
  const full = typeof data.full === 'string' ? data.full.trim() : ''
  return full || {code: 'closed'}
}

/**
 * Errors for answers to unique inputs that an earlier submission sent, eg.
 * an email address that is on the waiting list. Inputs of repeatable
 * sections are not compared.
 */
async function repeatedAnswers(
  store: Required<SubmissionsApi>,
  entryId: string,
  definition: FormDefinition,
  values: FormValues
): Promise<FormProblems> {
  const errors: FormProblems = {}
  const unique = formColumns(definition).filter(
    (column): column is FormInputData =>
      column.control !== 'section' && column.unique === true
  )
  for (const input of unique) {
    const value = values[input.key]
    if (value === undefined) continue
    // The search text holds answers as text, which narrows it down
    const {submissions} = await store.listSubmissions(entryId, {
      status: 'all',
      search: answerText(input, value),
      limit: 500
    })
    const same = submissions.some(
      submission =>
        comparable(submission.values[input.key]) === comparable(value)
    )
    if (same) errors[input.key] = {code: 'alreadySent'}
  }
  return errors
}

function comparable(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

const hour = 60 * 60
const day = 24 * hour

type LimitKind = 'submissions' | 'uploads'

/** What a form takes per hour, and one visitor of it */
const formLimits = {submissions: 500, uploads: 1000}
const visitorLimits = {submissions: 20, uploads: 50}

/**
 * How long the submissions of a form are kept, in seconds, by its Keep
 * submissions setting, or null to keep them until they are deleted
 */
export function retentionOf(data: Record<string, unknown>): number | null {
  const days = Number(data.keep)
  return days > 0 ? days * day : null
}

/**
 * Why a form takes no more submissions or files now: it took as many as it
 * does in an hour, or the visitor sent as many as one may
 */
export async function overLimit(
  store: Required<SubmissionsApi>,
  forms: FormsOptions,
  entryId: string,
  visitor: string | null,
  kind: LimitKind
): Promise<FormMessage | undefined> {
  if (forms.limits === false) return undefined
  const limits: FormLimits = forms.limits ?? {}
  const since = Math.floor(Date.now() / 1000) - hour
  const count = async (visitor?: string) => {
    const recent = await store.recentActivity(entryId, since, visitor)
    return kind === 'submissions' ? recent.submissions : recent.files
  }
  const perForm = limits[kind] ?? formLimits[kind]
  if (perForm > 0 && (await count()) >= perForm) return {code: 'busy'}
  const perVisitor = limits.perVisitor?.[kind] ?? visitorLimits[kind]
  if (visitor && perVisitor > 0 && (await count(visitor)) >= perVisitor)
    return {code: 'tooOften'}
  return undefined
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

/** The files in the answers, also in items of repeated sections */
function submittedFiles(value: unknown): Array<FormFileRef> {
  if (Array.isArray(value)) return value.flatMap(submittedFiles)
  if (!isRecord(value)) return []
  if (typeof value.id === 'string' && 'size' in value)
    return [value as unknown as FormFileRef]
  return Object.values(value).flatMap(submittedFiles)
}

/**
 * The files of a submission to attach to mails. A file that can not be read
 * is left out, the mail is sent without it.
 */
async function readFiles(
  store: Required<SubmissionsApi>,
  forms: FormsOptions,
  entryId: string,
  files: Array<FormFileRef>
): Promise<Array<FormMailAttachment>> {
  const read = await Promise.all(
    files.map(async (ref): Promise<Array<FormMailAttachment>> => {
      try {
        const file = await store.readFormFile(entryId, ref.id)
        const content =
          file && (file.content ?? (await forms.files?.read(fileKey(file))))
        if (!content) throw new Error('The file is missing')
        return [
          {
            filename: ref.name,
            content: await encode(content, ''),
            encoding: 'base64',
            ...(ref.type && {contentType: ref.type})
          }
        ]
      } catch (error) {
        console.error(`Alinea could not attach "${ref.name}" to a mail`, error)
        return []
      }
    })
  )
  return read.flat()
}

/** The urls of the entries the bodies of mails link to, by id */
async function entryUrls(
  graph: Graph,
  mails: unknown,
  site: string | URL,
  locale: string | null
): Promise<Record<string, string>> {
  const ids = linkedEntries(mails)
  if (ids.length === 0) return {}
  const linked = await graph.find({
    id: {in: ids},
    status: 'published',
    preferredLocale: locale ?? undefined,
    select: {id: Entry.id, url: Entry.url}
  })
  return Object.fromEntries(
    linked.map(({id, url}) => [id, new URL(url, site).href])
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
