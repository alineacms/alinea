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
import {} from 'alinea/core/HttpError'
import {getScope} from 'alinea/core/Scope'
import {
  type CommitRequest,
  attemptCommit
} from 'alinea/core/db/CommitRequest.js'
import type {LocalDB} from 'alinea/core/db/LocalDB.js'
import {base64} from 'alinea/core/util/Encoding'
import {object, string} from 'cito'
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
  remote?: RemoteConnection
}

export function createHandler({
  cms,
  remote = new CloudRemote(cms.config),
  db,
  ...hooks
}: HandlerOptions): Handler {
  let lastSync = 0

  return async function handle(
    request: Request,
    context: RequestContext
  ): Promise<Response> {
    const local = await db
    const previewParser = createPreviewParser(local)

    function periodicSync(syncInterval = 60) {
      return limit(async () => {
        if (syncInterval === Number.POSITIVE_INFINITY) return
        const now = Date.now()
        if (now - lastSync < syncInterval * 1000) return
        lastSync = now
        await local.syncWith(remote)
      })
    }

    try {
      const previews = new JWTPreviews(context.apiKey)
      const url = new URL(request.url)
      const params = url.searchParams
      const auth = params.get('auth')

      if (auth) return remote.authenticate(request, context)

      const action = params.get('action') as HandleAction

      const expectJson = () => {
        const acceptsJson = request.headers
          .get('accept')
          ?.includes('application/json')
        if (!acceptsJson) throw new Response('Expected JSON', {status: 400})
      }

      const body = PLazy.from(() => {
        const isJson = request.headers
          .get('content-type')
          ?.includes('application/json')
        if (!isJson) throw new Response('Expected JSON', {status: 400})
        return request.json()
      })

      const verified = PLazy.from(() => remote.verify(request, context))

      const internal = PLazy.from(async function verifyInternal(): Promise<
        AuthedContext | RequestContext
      > {
        try {
          return await verified
        } catch {
          const authorization = request.headers.get('authorization')
          const bearer = authorization?.slice('Bearer '.length)
          if (!context.apiKey) throw new Error('Missing API key')
          if (bearer !== context.apiKey)
            throw new Error('Expected matching api key')
          return context
        }
      })

      // Sign preview token
      if (action === HandleAction.PreviewToken && request.method === 'POST') {
        await verified
        expectJson()
        return Response.json(await previews.sign(PreviewBody(await body)))
      }

      // User
      if (action === HandleAction.User && request.method === 'GET') {
        expectJson()
        try {
          const {user} = await remote.verify(request, context)
          return Response.json(user)
        } catch {
          return Response.json(null)
        }
      }

      // Resolve
      if (action === HandleAction.Resolve && request.method === 'POST') {
        const ctx = await internal
        expectJson()
        const raw = await request.text()
        const scope = getScope(cms.config)
        const query = scope.parse(raw) as GraphQuery
        if (!query.preview) {
          await periodicSync(query.syncInterval)
        } else {
          const preview = await previewParser.parse(
            query.preview,
            () => local.syncWith(remote),
            entryId => remote.getDraft(entryId, ctx)
          )
          query.preview = preview
        }
        return Response.json((await local.resolve(query)) ?? null)
      }

      if (action === HandleAction.Commit && request.method === 'POST') {
        const ctx = await verified
        expectJson()
        const request: CommitRequest = await body
        return Response.json(await attemptCommit(local, remote, request))
      }

      // History
      if (action === HandleAction.History && request.method === 'GET') {
        const ctx = await verified
        expectJson()
        const file = string(url.searchParams.get('file'))
        const revisionId = string.nullable(url.searchParams.get('revisionId'))
        const result = await (revisionId
          ? remote.revisionData(file, revisionId, ctx)
          : remote.revisions(file, ctx))
        return Response.json(result ?? null)
      }

      // Syncable

      if (action === HandleAction.Tree && request.method === 'GET') {
        const ctx = await internal
        expectJson()
        const sha = string(url.searchParams.get('sha'))
        await periodicSync()
        return Response.json(await local.getTreeIfDifferent(sha))
      }

      if (action === HandleAction.Blob && request.method === 'GET') {
        const ctx = await verified
        const sha = string(url.searchParams.get('sha'))
        await periodicSync()
        return new Response(await local.getBlob(sha), {
          headers: {'content-type': 'application/octet-stream'}
        })
      }

      // Media
      if (action === HandleAction.Upload) {
        const entryId = url.searchParams.get('entryId')
        if (!entryId) {
          const ctx = await verified
          expectJson()
          return Response.json(
            await remote.prepareUpload(PrepareBody(await body).filename, ctx)
          )
        }
        const isPost = request.method === 'POST'
        if (isPost) {
          const ctx = await verified
          if (!remote.handleUpload)
            throw new Response('Bad Request', {status: 400})
          await remote.handleUpload(entryId, await request.blob(), ctx)
          return new Response('OK', {status: 200})
        }
        if (!remote.previewUpload)
          throw new Response('Bad Request', {status: 400})
        return remote.previewUpload(entryId, context)
      }

      // Drafts
      if (action === HandleAction.Draft && request.method === 'GET') {
        const ctx = await internal
        expectJson()
        const key = string(url.searchParams.get('key')) as DraftKey
        const draft = await remote.getDraft(key, ctx)
        return Response.json(
          draft ? {...draft, draft: base64.stringify(draft.draft)} : null
        )
      }

      if (action === HandleAction.Draft && request.method === 'POST') {
        expectJson()
        const data = (await body) as DraftTransport
        const draft = {...data, draft: base64.parse(data.draft)}
        return Response.json(await remote.storeDraft(draft, await verified))
      }
    } catch (error) {
      if (error instanceof Response) return error
      console.error(error)
      return new Response('Internal Server Error', {status: 500})
    }

    return new Response('Bad Request', {status: 400})
  }
}
