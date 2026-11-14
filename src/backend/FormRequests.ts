import type {Database} from 'rado'
import * as driver from 'rado/driver'
import {SubmissionStore} from './api/SubmissionStore.js'
import type {Config} from '#/core/Config.js'
import type {SubmissionsApi} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {FormsOptions} from '#/core/Forms.js'
import type {Graph} from '#/core/Graph.js'
import {ErrorCode, HttpError} from '#/core/HttpError.js'
import {Permission} from '#/core/Role.js'
import {
  fileKey,
  parseSubmissionQuery,
  parseSubmitRequest,
  purgeSubmissions,
  removeFiles,
  retentionOf,
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
   * Asserts the editor may do this with the form entry, for requests of the
   * dashboard. The caller checks the api key of requests of the site.
   */
  authorize(entryId: string, permission: Permission): Promise<void>
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
      await submitForm(config, graph, api, submit, {forms, secret})
    )
  }

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
    await authorize(entryId, Permission.Read)
    const file = await submissionStore(api).readFormFile(entryId, param('id'))
    const content =
      file && (file.content ?? (await forms.files?.read(fileKey(file))))
    if (!file || !content)
      throw new HttpError(ErrorCode.NotFound, 'File not found')
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
      await authorize(entryId, Permission.Read)
      // The form keeps its submissions as long as it says now, and those
      // that expired are gone before the list is read
      const data = await graph.first({
        id: entryId,
        status: 'preferPublished',
        select: Entry.data
      })
      await store.retainSubmissions(
        entryId,
        retentionOf((data ?? {}) as Record<string, unknown>)
      )
      await purgeSubmissions(store, forms)
      const query = url.searchParams.get('query')
      return Response.json(
        await store.listSubmissions(
          entryId,
          query ? parseSubmissionQuery(JSON.parse(query)) : {}
        )
      )
    }
    const id = param('id')
    if (request.method === 'DELETE') {
      await authorize(entryId, Permission.Delete)
      await removeFiles(forms, await store.deleteSubmission(entryId, id))
      return new Response(null, {status: 204})
    }
    if (request.method === 'POST') {
      await authorize(entryId, Permission.Update)
      const {status} = (await request.json()) as {status?: unknown}
      if (status !== 'new' && status !== 'read' && status !== 'archived')
        throw new HttpError(400, 'Unknown status')
      await store.updateSubmission(entryId, id, status)
      return new Response(null, {status: 204})
    }
  }
  return undefined
}
