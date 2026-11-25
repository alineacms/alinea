import type {Database} from 'rado'
import * as driver from 'rado/driver'
import {SubmissionStore} from './api/SubmissionStore.js'
import type {Config} from '#/core/Config.js'
import type {Submission, SubmissionsApi} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {FormsOptions} from '#/core/Forms.js'
import type {Graph} from '#/core/Graph.js'
import {ErrorCode, HttpError} from '#/core/HttpError.js'
import {Permission} from '#/core/Role.js'
import {formSettings} from '#/field/form/FormType.js'
import {
  fileKey,
  formStatus,
  parseSubmissionQuery,
  parseSubmitRequest,
  purgeSubmissions,
  removeFiles,
  submissionStore,
  submitForm
} from './FormSubmit.js'
import {
  parsePrepareRequest,
  prepareUpload,
  receiveUpload,
  uploadCors
} from './FormUploads.js'
import {HandleAction} from './HandleAction.js'

function expectJson(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(400, 'Expected JSON')
}

async function submissionOf(
  store: Required<SubmissionsApi>,
  entryId: string,
  id: string
): Promise<Submission | undefined> {
  const {submissions} = await store.listSubmissions(entryId, {
    id,
    status: 'all',
    limit: 1
  })
  return submissions[0]
}

/** The store of forms.database, when it is set */
export function databaseStore(
  forms: FormsOptions | undefined
): SubmissionStore | undefined {
  const declaration = forms?.database
  if (!declaration) return undefined
  const connect = driver[declaration.driver] as (client: unknown) => Database
  return new SubmissionStore({db: connect(declaration.client)})
}

/** The actions of the handler that are about forms */
export const formActions = new Set<string>([
  HandleAction.Submit,
  HandleAction.FormUpload,
  HandleAction.FormStatus,
  HandleAction.Submissions,
  HandleAction.SubmissionFile
])

/** Whether a request is for one of the actions about forms */
export function isFormRequest(request: Request): boolean {
  const action = new URL(request.url).searchParams.get('action')
  return action !== null && formActions.has(action)
}

/** Whether a form request comes from the browser of a visitor */
export function isVisitorUpload(request: Request): boolean {
  const action = new URL(request.url).searchParams.get('action')
  return (
    action === HandleAction.FormUpload &&
    (request.method === 'PUT' || request.method === 'OPTIONS')
  )
}

/** What an editor needs to be allowed for a request about submissions */
export function editorPermission(method: string): Permission {
  if (method === 'DELETE') return Permission.Delete
  if (method === 'POST') return Permission.Update
  return Permission.Read
}

/**
 * The languages of a form an editor may work with the submissions of, or
 * all of them
 */
export type FormAccess = 'all' | Array<string | null>

function allows(access: FormAccess, locale: string | null): boolean {
  return access === 'all' || access.includes(locale)
}

function refuse(): never {
  throw new HttpError(ErrorCode.Unauthorized, 'Permission denied')
}

export interface FormRequestOptions {
  config: Config
  /** The content, where the published forms are read from */
  graph: Graph
  /** Where submissions and their files are stored */
  api: SubmissionsApi
  forms: FormsOptions
  /** Signs the tickets of uploads and hashes visitors */
  secret: string
  /** Where browsers upload the files of forms to */
  handlerUrl: URL
  /**
   * Asserts the editor may do this with the form entry and gives the
   * languages they may, for requests of the dashboard. The caller checks
   * the api key of requests of the site.
   */
  authorize(entryId: string, permission: Permission): Promise<FormAccess>
}

/**
 * Answers a request about forms: the answers and uploads of visitors, sent
 * by the site, and the submissions editors read in the dashboard
 */
export async function handleFormRequest(
  request: Request,
  {config, graph, api, forms, secret, handlerUrl, authorize}: FormRequestOptions
): Promise<Response | undefined> {
  const url = new URL(request.url)
  const action = url.searchParams.get('action')
  const param = (name: string) => {
    const value = url.searchParams.get(name)
    if (!value) throw new HttpError(400, `Missing ${name}`)
    return value
  }

  // Visitors upload the files of a form from their browser, the signed
  // ticket the site asked for is all it takes
  if (action === HandleAction.FormUpload && request.method === 'OPTIONS')
    return new Response(null, {status: 204, headers: uploadCors})
  if (action === HandleAction.FormUpload && request.method === 'PUT')
    return receiveUpload(request, api, {forms, secret})

  // Answers of a form, sent by the server of the site
  if (action === HandleAction.Submit && request.method === 'POST') {
    const submit = parseSubmitRequest(await request.json())
    return Response.json(
      await submitForm(config, graph, api, submit, {
        forms,
        secret,
        handlerUrl
      })
    )
  }

  // Whether a form takes answers, for the server of the site
  if (action === HandleAction.FormStatus && request.method === 'GET')
    return Response.json(
      await formStatus(
        config,
        graph,
        api,
        {
          entryId: param('entryId'),
          locale: url.searchParams.get('locale'),
          field: url.searchParams.get('field') ?? undefined
        },
        forms
      )
    )

  // A ticket to upload a file to a form, for the server of the site
  if (action === HandleAction.FormUpload && request.method === 'POST') {
    const prepare = parsePrepareRequest(await request.json())
    return Response.json(
      await prepareUpload(config, graph, api, prepare, {
        forms,
        secret,
        handlerUrl
      })
    )
  }

  // A file of a submission, for editors who can read its form
  if (action === HandleAction.SubmissionFile && request.method === 'GET') {
    const entryId = param('entryId')
    const access = await authorize(entryId, Permission.Read)
    const store = submissionStore(api)
    const file = await store.readFormFile(entryId, param('id'))
    if (!file) throw new HttpError(ErrorCode.NotFound, 'File not found')
    if (access !== 'all') {
      const submission =
        file.submissionId &&
        (await submissionOf(store, entryId, file.submissionId))
      if (!submission || !allows(access, submission.locale)) refuse()
    }
    const content = file.content ?? (await forms.files?.read(fileKey(file)))
    if (!content) throw new HttpError(ErrorCode.NotFound, 'File not found')
    return new Response(new Uint8Array(content), {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, no-store'
      }
    })
  }

  // The submissions of a form, for editors who can read its entry
  if (action === HandleAction.Submissions) {
    const entryId = param('entryId')
    const store = submissionStore(api)
    if (request.method === 'GET') {
      const access = await authorize(entryId, Permission.Read)
      // The form keeps its submissions as long as it says now
      const entry = await graph.first({
        id: entryId,
        status: 'preferPublished',
        select: {type: Entry.type, data: Entry.data}
      })
      if (entry)
        await store.retainSubmissions(
          entryId,
          formSettings(config.schema[entry.type], entry.data).keep
        )
      await purgeSubmissions(store, forms)
      const search = url.searchParams.get('query')
      const query = search ? parseSubmissionQuery(JSON.parse(search)) : {}
      if (query.locale !== undefined && !allows(access, query.locale)) refuse()
      return Response.json(
        await store.listSubmissions(
          entryId,
          access === 'all' ? query : {...query, locales: access}
        )
      )
    }
    const id = param('id')
    // Browsers ask before they send json to another site, a form can not
    expectJson(request)
    const permission = editorPermission(request.method)
    const access = await authorize(entryId, permission)
    if (access !== 'all') {
      const submission = await submissionOf(store, entryId, id)
      if (submission && !allows(access, submission.locale)) refuse()
    }
    if (request.method === 'DELETE') {
      await removeFiles(forms, await store.deleteSubmission(entryId, id))
      return new Response(null, {status: 204})
    }
    if (request.method === 'POST') {
      const {status} = (await request.json()) as {status?: unknown}
      if (status !== 'new' && status !== 'read' && status !== 'archived')
        throw new HttpError(400, 'Unknown status')
      await store.updateSubmission(entryId, id, status)
      return new Response(null, {status: 204})
    }
  }
  return undefined
}
