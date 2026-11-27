import type {Config} from '#/core/Config.js'
import type {
  FormFileRef,
  PrepareUploadRequest,
  PrepareUploadResult,
  SubmissionsApi
} from '#/core/Connection.js'
import type {FormsOptions} from '#/core/Forms.js'
import type {Graph} from '#/core/Graph.js'
import {HttpError} from '#/core/HttpError.js'
import {createId} from '#/core/Id.js'
import {sign, verify} from '#/core/util/JWT.js'
import {isRecord} from '#/core/util/Objects.js'
import {type FormInputData, nameKey} from '#/field/form/FormDefinition.js'
import {
  contentProblem,
  fileType,
  isAccepted
} from '#/field/form/FormFileTypes.js'
import {
  type FormMessage,
  type FormProblems,
  translate
} from '#/field/form/FormMessages.js'
import {HandleAction} from './HandleAction.js'
import {fileKey, overLimit, submissionStore, visitorHash} from './FormSubmit.js'
import {fileInputs, loadForm} from './FormLoad.js'

/** How long a visitor has to upload a file after the site asked for it */
const ticketLifetime = 15 * 60
const megabyte = 1024 * 1024

interface UploadTicket extends FormFileRef {
  purpose: 'form-upload'
  entryId: string
  /** The key of the file input */
  input: string
  /** A hash of the visitor, see `visitorHash` */
  visitor: string | null
  /** The locale of the form, for the messages the upload answers with */
  locale?: string | null
}

/** The browser uploads from the site to the handler, which may be elsewhere */
export const uploadCors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'PUT',
  'access-control-allow-headers': 'content-type'
}

export function parsePrepareRequest(body: unknown): PrepareUploadRequest {
  if (
    !isRecord(body) ||
    typeof body.entryId !== 'string' ||
    typeof body.input !== 'string' ||
    typeof body.name !== 'string' ||
    typeof body.size !== 'number'
  )
    throw new HttpError(400, 'Missing the form, input or file')
  return {
    entryId: body.entryId,
    locale: typeof body.locale === 'string' ? body.locale : null,
    input: body.input,
    name: body.name,
    size: body.size,
    type: typeof body.type === 'string' ? body.type : '',
    visitor: typeof body.visitor === 'string' ? body.visitor : undefined
  }
}

/** The largest file an input accepts, in bytes */
function maxSize(config: Config, input: FormInputData): number {
  const own = Number(input.settings.maxSize)
  const limits = [
    own > 0 ? own * megabyte : undefined,
    config.maxUploadSize
  ].filter((limit): limit is number => typeof limit === 'number')
  return limits.length ? Math.min(...limits) : 10 * megabyte
}

/**
 * Checks a file a visitor is about to upload against its input and gives
 * a signed ticket to upload it with, see `receiveUpload`
 */
export async function prepareUpload(
  config: Config,
  graph: Graph,
  api: SubmissionsApi,
  request: PrepareUploadRequest,
  {
    forms = {},
    secret,
    handlerUrl
  }: {forms?: FormsOptions; secret: string; handlerUrl: URL}
): Promise<PrepareUploadResult> {
  const {entry, inputs} = await loadForm(config, graph, request)
  const text = translate(entry.locale, forms.messages)
  const input = fileInputs(inputs).find(input => input.key === request.input)
  if (!input) return {ok: false, message: 'This form has no such file input'}
  const accept = String(input.settings.accept ?? '')
  if (!isAccepted(accept, request))
    return {ok: false, message: text({code: 'fileType', accept})}
  const limit = maxSize(config, input)
  if (request.size > limit) {
    const max = Math.floor(limit / megabyte)
    return {ok: false, message: text({code: 'fileTooLarge', max})}
  }
  const issuedAt = Math.floor(Date.now() / 1000)
  const visitor = await visitorHash(secret, request.visitor)
  const limited = await overLimit(
    submissionStore(api),
    forms,
    request.entryId,
    visitor,
    'uploads'
  )
  if (limited) return {ok: false, message: text(limited)}
  const ticket: UploadTicket = {
    purpose: 'form-upload',
    entryId: request.entryId,
    input: input.key,
    visitor,
    locale: entry.locale,
    id: createId(),
    name: request.name,
    size: request.size,
    // By its name, mails attach it as this type
    type: fileType(request.name)
  }
  const token = await sign(
    {...ticket, iat: issuedAt, exp: issuedAt + ticketLifetime},
    secret
  )
  const url = new URL(handlerUrl)
  url.searchParams.set('action', HandleAction.FormUpload)
  url.searchParams.set('token', token)
  return {ok: true, url: url.href, method: 'PUT', token}
}

async function readTicket(
  token: string,
  secret: string
): Promise<UploadTicket | undefined> {
  try {
    const payload = await verify(token, secret)
    if (isRecord(payload) && payload.purpose === 'form-upload')
      return payload as unknown as UploadTicket
  } catch {}
  return undefined
}

/**
 * Keeps the file a visitor uploads with a ticket until it is submitted. Its
 * first bytes must fit its name, so a script can not pass for a document.
 */
export async function receiveUpload(
  request: Request,
  api: SubmissionsApi,
  {forms = {}, secret}: {forms?: FormsOptions; secret: string}
): Promise<Response> {
  const ticket = await readTicket(
    new URL(request.url).searchParams.get('token') ?? '',
    secret
  )
  const text = translate(ticket?.locale, forms.messages)
  // As JSON, so the browser tells our reasons apart from errors of the host
  const fail = (status: number, message: string | FormMessage) =>
    Response.json({error: text(message)}, {status, headers: uploadCors})
  if (!ticket) return fail(401, {code: 'uploadAgain'})
  if (!api.storeFormFile)
    return fail(501, 'Configure a database to store submissions')
  const store = submissionStore(api)
  // Tickets were given within the limits, a script that collected many is
  // stopped as it uploads them
  const limited = await overLimit(
    store,
    forms,
    ticket.entryId,
    ticket.visitor,
    'uploads'
  )
  if (limited) return fail(429, limited)
  const length = Number(request.headers.get('content-length'))
  if (length > ticket.size) return fail(413, {code: 'uploadFailed'})
  const content = await readBody(request, ticket.size)
  if (!content) return fail(413, {code: 'uploadFailed'})
  if (content.byteLength !== ticket.size)
    return fail(400, {code: 'uploadFailed'})
  const problem = contentProblem(ticket, content)
  if (problem) return fail(415, problem)
  // The row is stored first so a ticket that is sent again is refused before
  // it overwrites the bytes in forms.files
  try {
    await store.storeFormFile({
      id: ticket.id,
      entryId: ticket.entryId,
      input: ticket.input,
      name: ticket.name,
      size: ticket.size,
      type: ticket.type,
      submissionId: null,
      content: forms.files ? null : content,
      visitor: ticket.visitor ?? null,
      createdAt: Math.floor(Date.now() / 1000)
    })
  } catch (error) {
    const [stored] = await store.formFiles(ticket.entryId, [ticket.id])
    if (stored) return fail(409, {code: 'uploadAgain'})
    throw error
  }
  if (forms.files)
    await forms.files.write(
      fileKey({entryId: ticket.entryId, id: ticket.id}),
      content,
      ticket.type
    )
  return new Response(null, {status: 204, headers: uploadCors})
}

/** The body of a request, or undefined once it is longer than the limit */
async function readBody(
  request: Request,
  limit: number
): Promise<Uint8Array | undefined> {
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks = Array<Uint8Array>()
  let size = 0
  while (true) {
    const {done, value} = await reader.read()
    if (done) break
    if ((size += value.byteLength) > limit) {
      await reader.cancel()
      return undefined
    }
    chunks.push(value)
  }
  const content = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    content.set(chunk, offset)
    offset += chunk.byteLength
  }
  return content
}

type ResolvedFiles =
  | {ok: true; data: FormData}
  | {ok: false; errors: FormProblems}

/**
 * The answers with the tokens of uploaded files replaced by the files they
 * refer to, as JSON for the parse of the file input
 */
export async function resolveFiles(
  api: Required<SubmissionsApi>,
  secret: string,
  entryId: string,
  inputs: Array<FormInputData>,
  posted: FormData
): Promise<ResolvedFiles> {
  const keys = new Set(inputs.map(input => input.key))
  const data = new FormData()
  const errors: FormProblems = {}
  // By the id of the file, with the name it was sent under: the key of its
  // input, or its name in an item of a repeatable section
  const tickets = new Map<string, {ticket: UploadTicket; name: string}>()
  for (const [name, value] of posted) {
    const key = nameKey(name)
    if (!keys.has(key)) {
      data.append(name, value)
      continue
    }
    if (typeof value !== 'string' || value === '') continue
    const ticket = await readTicket(value, secret)
    if (!ticket || ticket.entryId !== entryId || ticket.input !== key)
      errors[name] = {code: 'uploadAgain'}
    else tickets.set(ticket.id, {ticket, name})
  }
  const stored = await api.formFiles(entryId, [...tickets.keys()])
  for (const {ticket, name} of tickets.values()) {
    const file = stored.find(file => file.id === ticket.id)
    if (!file || file.submissionId || file.input !== ticket.input) {
      errors[name] = {code: 'uploadAgain'}
      continue
    }
    const ref: FormFileRef = {
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type
    }
    data.append(name, JSON.stringify(ref))
  }
  if (Object.keys(errors).length > 0) return {ok: false, errors}
  return {ok: true, data}
}
