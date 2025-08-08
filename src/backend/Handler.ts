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
import type {LocalDB} from 'alinea/core/db/LocalDB'
import type {GraphQuery} from 'alinea/core/Graph'
import {HttpError} from 'alinea/core/HttpError'
import {getScope} from 'alinea/core/Scope'
import {ShaMismatchError} from 'alinea/core/source/ShaMismatchError'
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
  url: string
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

    async function periodicSync(cnx: RemoteConnection, syncInterval = 60) {
      if (dev) return
      return limit(async () => {
        if (syncInterval === Number.POSITIVE_INFINITY) return
        const now = Date.now()
        if (now - lastSync < syncInterval * 1000) return
        lastSync = now
        await local.syncWith(cnx)
      }).catch(error => {
        console.error(error)
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
        return userCtx.user
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
        const query = scope.parse<GraphQuery>(raw)
        if (!query.preview) {
          await periodicSync(cnx, query.syncInterval)
        } else {
          const {parse} = await previewParser
          const preview = await parse(query.preview, () => local.syncWith(cnx))
          query.preview = preview
        }
        return Response.json((await local.resolve(query)) ?? null)
      }

      if (action === HandleAction.Mutate && request.method === 'POST') {
        const user = expectUser()
        expectJson()
        const policy = await local.createPolicy(user.roles)
        const mutations = await body
        const attempt = async (retry = 0) => {
          await local.syncWith(cnx)
          const request = await local.request(mutations, policy)
          try {
            let {sha} = await cnx.write(request)
            if (sha === request.intoSha) {
              await local.write(request)
            } else {
              sha = await local.syncWith(cnx)
            }
            return sha
          } catch (error) {
            if (error instanceof ShaMismatchError && retry < 3)
              return attempt(retry + 1)
            throw error
          }
        }
        return Response.json({sha: await attempt()})
      }

      if (action === HandleAction.Commit && request.method === 'POST') {
        throw new Error('Mutations expected')
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
        await local.syncWith(cnx)
        const tree = await local.getTreeIfDifferent(sha)
        return Response.json(tree ?? null)
      }

      if (action === HandleAction.Blob && request.method === 'POST') {
        const {shas} = object({shas: array(string)})(await body)
        await periodicSync(cnx)
        const tree = await local.source.getTree()
        const fromLocal = []
        const fromRemote = []
        for (const sha of shas) {
          if (tree.hasSha(sha)) fromLocal.push(sha)
          else fromRemote.push(sha)
        }
        const formData = new FormData()
        if (fromLocal.length > 0) {
          const blobs = local.source.getBlobs(fromLocal)
          for await (const [sha, blob] of blobs) {
            formData.append(sha, new Blob([blob as BlobPart]))
          }
        }
        if (fromRemote.length > 0) {
          const blobs = cnx.getBlobs(fromRemote)
          for await (const [sha, blob] of blobs) {
            formData.append(sha, new Blob([blob as BlobPart]))
          }
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
