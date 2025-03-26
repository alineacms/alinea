import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {cloudBackend} from 'alinea/cloud/CloudBackend'
import type {Entry} from 'alinea/core'
import type {CMS} from 'alinea/core/CMS'
import type {DraftKey} from 'alinea/core/Draft'
import type {GraphQuery} from 'alinea/core/Graph'
import {} from 'alinea/core/HttpError'
import {getScope} from 'alinea/core/Scope'
import {
  type CommitRequest,
  attemptCommit
} from 'alinea/core/db/CommitRequest.js'
import {LocalDB} from 'alinea/core/db/LocalDB.js'
import type {Source} from 'alinea/core/source/Source'
import {base64} from 'alinea/core/util/Encoding'
import {object, string} from 'cito'
import PLazy from 'p-lazy'
import pLimit from 'p-limit'
import type {
  AuthedContext,
  Backend,
  DraftTransport,
  RequestContext
} from './Backend.js'
import {HandleAction} from './HandleAction.js'
import {createPreviewParser} from './resolver/ParsePreview.js'
import {generatedSource} from './store/GeneratedSource.js'

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
  backend?: Backend
  source?: Promise<Source>
}

export function createHandler({
  cms,
  backend = cloudBackend(cms.config),
  source = generatedSource,
  ...hooks
}: HandlerOptions): Handler {
  let lastSync = 0

  const localDb = PLazy.from(async () => {
    const source = await generatedSource
    const local = new LocalDB(cms.config, source)
    await local.sync()
    return local
    /*    async function persistEdit(ctx: AuthedContext, mutation: UpdateMutation) {
      if (!mutation.update) return
      const update = new Uint8Array(await decode(mutation.update))
      const currentDraft = await backend.drafts.get(
        ctx,
        formatDraftKey(mutation.entry)
      )
      const updatedDraft = currentDraft
        ? mergeUpdatesV2([currentDraft.draft, update])
        : update
      const draft = {
        entryId: mutation.entryId,
        locale: mutation.locale,
        fileHash: mutation.entry.fileHash,
        draft: updatedDraft
      }
      await backend.drafts.store(ctx, draft)
      const {contentHash} = await db.meta()
      previews.setDraft(formatDraftKey(mutation.entry), {contentHash, draft})
    }*/
  })

  return async function handle(
    request: Request,
    context: RequestContext
  ): Promise<Response> {
    const local = await localDb
    const target = backend.target
    const remote = {
      getTreeIfDifferent: target.getTreeIfDifferent.bind(target, context),
      getBlob: target.getBlob.bind(target, context),
      commit: target.commit.bind(target, context)
    }
    const previewParser = createPreviewParser(local, remote)

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

      if (auth) return backend.auth.authenticate(context, request)

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

      const verified = PLazy.from(() => backend.auth.verify(context, request))

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
          const {user} = await backend.auth.verify(context, request)
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
          const preview = await previewParser.parse(query.preview, entryId =>
            backend.drafts.get(ctx, entryId)
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
          ? backend.history.revision(ctx, file, revisionId)
          : backend.history.list(ctx, file))
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
        const {media} = backend
        const entryId = url.searchParams.get('entryId')
        if (!entryId) {
          const ctx = await verified
          expectJson()
          return Response.json(
            await media.prepareUpload(ctx, PrepareBody(await body).filename)
          )
        }
        const isPost = request.method === 'POST'
        if (isPost) {
          if (!media.handleUpload)
            throw new Response('Bad Request', {status: 400})
          const ctx = await verified
          await media.handleUpload(ctx, entryId, await request.blob())
          return new Response('OK', {status: 200})
        }
        if (!media.previewUpload)
          throw new Response('Bad Request', {status: 400})
        return media.previewUpload(context, entryId)
      }

      // Drafts
      if (action === HandleAction.Draft && request.method === 'GET') {
        const ctx = await internal
        expectJson()
        const key = string(url.searchParams.get('key')) as DraftKey
        const draft = await backend.drafts.get(ctx, key)
        return Response.json(
          draft ? {...draft, draft: base64.stringify(draft.draft)} : null
        )
      }

      if (action === HandleAction.Draft && request.method === 'POST') {
        expectJson()
        const data = (await body) as DraftTransport
        const draft = {...data, draft: base64.parse(data.draft)}
        return Response.json(await backend.drafts.store(await verified, draft))
      }
    } catch (error) {
      if (error instanceof Response) return error
      console.error(error)
      return new Response('Internal Server Error', {status: 500})
    }

    return new Response('Bad Request', {status: 400})
  }
}
