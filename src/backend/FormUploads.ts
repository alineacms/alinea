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
import {contentProblem, isAccepted} from '#/field/form/FormFileTypes.js'
import {HandleAction} from './HandleAction.js'
import {fileKey, limitOf, submissionStore, visitorHash} from './FormSubmit.js'
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
    field: typeof body.field === 'string' ? body.field : undefined,
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
  const {inputs} = await loadForm(config, graph, request)
  const input = fileInputs(inputs).find(input => input.key === request.input)
  if (!input) return {ok: false, message: 'This form has no such file input'}
  const accept = String(input.settings.accept ?? '')
  if (!isAccepted(accept, request))
    return {ok: false, message: `Choose a file of type ${accept}`}
  const limit = maxSize(config, input)
  if (request.size > limit)
    return {
      ok: false,
      message: `Choose a file of at most ${Math.floor(limit / megabyte)} MB`
    }
  const issuedAt = Math.floor(Date.now() / 1000)
  const visitor = await visitorHash(secret, request.visitor)
  const perHour = limitOf(forms, 'uploads')
  if (visitor && perHour) {
    const recent = await submissionStore(api).visitorActivity(
      request.entryId,
      visitor,
      issuedAt - 60 * 60
    )
    if (recent.files >= perHour)
      return {ok: false, message: 'You sent many files, try again later'}
  }
  const ticket: UploadTicket = {
    purpose: 'form-upload',
    entryId: request.entryId,
    input: input.key,
    visitor,
    id: createId(),
    name: request.name,
    size: request.size,
    type: request.type
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
  const fail = (status: number, message: string) =>
    new Response(message, {status, headers: uploadCors})
  const ticket = await readTicket(
    new URL(request.url).searchParams.get('token') ?? '',
    secret
  )
  if (!ticket) return fail(401, 'Upload the file again')
  const length = Number(request.headers.get('content-length'))
  if (length > ticket.size) return fail(413, 'The file is larger than said')
  const content = new Uint8Array(await request.arrayBuffer())
  if (content.byteLength !== ticket.size)
    return fail(400, 'The file is not the size that was said')
  const problem = contentProblem(ticket, content)
  if (problem) return fail(415, problem)
  const store = api.storeFormFile
  if (!store) return fail(501, 'Configure a database to store submissions')
  // The bytes go to the storage of forms.files when there is one, the
  // database keeps what the file is
  if (forms.files)
    await forms.files.write(
      fileKey({entryId: ticket.entryId, id: ticket.id}),
      content,
      ticket.type
    )
  await store.call(api, {
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
  return new Response(null, {status: 204, headers: uploadCors})
}

type ResolvedFiles =
  | {ok: true; data: FormData}
  | {ok: false; errors: Record<string, string>}

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
  const errors: Record<string, string> = {}
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
      errors[name] = 'Upload the file again'
    else tickets.set(ticket.id, {ticket, name})
  }
  const stored = await api.formFiles(entryId, [...tickets.keys()])
  for (const {ticket, name} of tickets.values()) {
    const file = stored.find(file => file.id === ticket.id)
    if (!file || file.submissionId || file.input !== ticket.input) {
      errors[name] = 'Upload the file again'
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
