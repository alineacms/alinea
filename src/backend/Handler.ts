import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {CloudRemote} from 'alinea/cloud/CloudRemote'
import type {Entry} from 'alinea/core'
import type {CMS} from 'alinea/core/CMS'
import type {
  AuthedContext,
  DraftTransport,
  RemoteConnection,
  RequestContext
} from 'alinea/core/Connection'
import type {DraftKey} from 'alinea/core/Draft'
import type {GraphQuery} from 'alinea/core/Graph'
import {HttpError} from 'alinea/core/HttpError'
import {getScope} from 'alinea/core/Scope'
import type {LocalDB} from 'alinea/core/db/LocalDB'
import {base64} from 'alinea/core/util/Encoding'
import {array, object, string} from 'cito'
import PLazy from 'p-lazy'
import pLimit from 'p-limit'
import {HandleAction} from './HandleAction.js'
import {createPreviewParser} from './resolver/ParsePreview.js'

const limit = pLimit(1)

const PrepareBody = object({
  filename: string
})

const PreviewBody = object({
  locale: string.nullable,
  entryId: string
})

export interface Handler {
  (request: Request, context: RequestContext): Promise<Response>
}

export type HookResponse<T = void> = void | T | Promise<T> | Promise<void>

export interface HandlerHooks {
  beforeCreate?(entry: Entry): HookResponse<Entry>
  afterCreate?(entry: Entry): HookResponse
  beforeUpdate?(entry: Entry): HookResponse<Entry>
  afterUpdate?(entry: Entry): HookResponse
  beforeArchive?(entryId: string): HookResponse
  afterArchive?(entryId: string): HookResponse
  beforeRemove?(entryId: string): HookResponse
  afterRemove?(entryId: string): HookResponse
}

export interface HandlerOptions extends HandlerHooks {
  cms: CMS
  db: LocalDB | Promise<LocalDB>
  remote?: (context: RequestContext) => RemoteConnection
}

export function createHandler({
  cms,
  remote = context => new CloudRemote(context, cms.config),
  db,
  ...hooks
}: HandlerOptions): Handler {
  let lastSync = 0
  const previewParser = PLazy.from(async () => {
    const local = await db
    return createPreviewParser(local)
  })
  return async function handle(
    request: Request,
    context: RequestContext
  ): Promise<Response> {
    const dev = process.env.ALINEA_DEV_SERVER
    const local = await db
    const simulateLatency = process.env.ALINEA_LATENCY

    if (simulateLatency) await new Promise(resolve => setTimeout(resolve, 2000))

    function periodicSync(cnx: RemoteConnection, syncInterval = 60) {
      if (dev) return
      return limit(async () => {
        if (syncInterval === Number.POSITIVE_INFINITY) return
        const now = Date.now()
        if (now - lastSync < syncInterval * 1000) return
        lastSync = now
        await local.syncWith(cnx)
      })
    }

    try {
      const previews = new JWTPreviews(context.apiKey)
      const url = new URL(request.url)
      const params = url.searchParams
      const auth = params.get('auth')
      let cnx = remote(context)
      let userCtx: AuthedContext | undefined
      const action = params.get('action') as HandleAction

      if (auth) return cnx.authenticate(request)

      const expectJson = () => {
        const acceptsJson = request.headers
          .get('accept')
          ?.includes('application/json')
        if (!acceptsJson) throw new Response('Expected JSON', {status: 400})
      }

      // User
      if (action === HandleAction.User && request.method === 'GET') {
        expectJson()
        try {
          const {user} = await cnx.verify(request)
          return Response.json(user)
        } catch {
          return Response.json(null)
        }
      }

      try {
        userCtx = await cnx.verify(request)
        cnx = remote(userCtx)
      } catch {
        const authorization = request.headers.get('authorization')
        const bearer = authorization?.slice('Bearer '.length)
        if (!context.apiKey) throw new Error('Missing API key')
        if (bearer !== context.apiKey)
          throw new Error('Expected matching api key')
      }

      const expectUser = () => {
        if (!userCtx) throw new Response('Unauthorized', {status: 401})
      }

      const body = PLazy.from(() => {
        const isJson = request.headers
          .get('content-type')
          ?.includes('application/json')
        if (!isJson) throw new Response('Expected JSON', {status: 400})
        return request.json()
      })

      // Sign preview token
      if (action === HandleAction.PreviewToken && request.method === 'POST') {
        expectUser()
        expectJson()
        return Response.json(await previews.sign(PreviewBody(await body)))
      }

      // Resolve
      if (action === HandleAction.Resolve && request.method === 'POST') {
        expectJson()
        const raw = await request.text()
        const scope = getScope(cms.config)
        const query = scope.parse(raw) as GraphQuery
        if (!query.preview) {
          await periodicSync(cnx, query.syncInterval)
        } else {
          const {parse} = await previewParser
          const preview = await parse(
            query.preview,
            () => local.syncWith(cnx),
            entryId => cnx.getDraft(entryId)
          )
          query.preview = preview
        }
        return Response.json((await local.resolve(query)) ?? null)
      }

      if (action === HandleAction.Mutate && request.method === 'POST') {
        expectUser()
        expectJson()
        const mutations = await body
        const request = await local.request(mutations)
        let sha: string
        try {
          await cnx.write(request)
          await local.write(request)
        } finally {
          sha = await local.syncWith(cnx)
        }
        return Response.json(sha)
      }

      if (action === HandleAction.Commit && request.method === 'POST') {
        throw new Error('Mutations expected')
        /*const ctx = await verified
        expectJson()
        const request: CommitRequest = await body
        return Response.json(
          (await attemptCommit(local, remote, request)) ?? null
        )*/
      }

      // History
      if (action === HandleAction.History && request.method === 'GET') {
        expectUser()
        expectJson()
        const file = string(url.searchParams.get('file'))
        const revisionId = string.nullable(url.searchParams.get('revisionId'))
        const result = await (revisionId
          ? cnx.revisionData(file, revisionId)
          : cnx.revisions(file))
        return Response.json(result ?? null)
      }

      // Syncable

      if (action === HandleAction.Tree && request.method === 'GET') {
        expectJson()
        const sha = string(url.searchParams.get('sha'))
        await periodicSync(cnx)
        return Response.json((await local.getTreeIfDifferent(sha)) ?? null)
      }

      if (action === HandleAction.Blob && request.method === 'POST') {
        expectUser()
        const {shas} = object({shas: array(string)})(await body)
        await periodicSync(cnx)
        const blobs = await cnx.getBlobs(shas)
        const formData = new FormData()
        for (const [sha, blob] of blobs) {
          formData.append(sha, new Blob([blob]), sha)
        }
        return new Response(formData)
      }

      // Media
      if (action === HandleAction.Upload) {
        const entryId = url.searchParams.get('entryId')
        if (!entryId) {
          expectUser()
          expectJson()
          return Response.json(
            await cnx.prepareUpload(PrepareBody(await body).filename)
          )
        }
        const isPost = request.method === 'POST'
        if (isPost) {
          expectUser()
          if (!cnx.handleUpload)
            throw new Response('Bad Request', {status: 400})
          await cnx.handleUpload(entryId, await request.blob())
          return new Response('OK', {status: 200})
        }
        if (!cnx.previewUpload) throw new Response('Bad Request', {status: 400})
        return cnx.previewUpload(entryId)
      }

      // Drafts
      if (action === HandleAction.Draft && request.method === 'GET') {
        expectJson()
        const key = string(url.searchParams.get('key')) as DraftKey
        const draft = await cnx.getDraft(key)
        return Response.json(
          draft ? {...draft, draft: base64.stringify(draft.draft)} : null
        )
      }

      if (action === HandleAction.Draft && request.method === 'POST') {
        expectUser()
        expectJson()
        const data = (await body) as DraftTransport
        const draft = {...data, draft: base64.parse(data.draft)}
        return Response.json(await cnx.storeDraft(draft))
      }
    } catch (error) {
      if (error instanceof Response) return error
      console.error(error)
      return Response.json(
        {success: false, error: String(error)},
        {status: error instanceof HttpError ? error.code : 500}
      )
    }

    return new Response('Bad Request', {status: 400})
  }
}
