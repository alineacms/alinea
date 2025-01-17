import {Database} from 'alinea/backend/Database'
import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {cloudBackend} from 'alinea/cloud/CloudBackend'
import {Entry} from 'alinea/core'
import {CMS} from 'alinea/core/CMS'
import {Connection} from 'alinea/core/Connection'
import {Draft, DraftKey, formatDraftKey} from 'alinea/core/Draft'
import {AnyQueryResult, Graph, GraphQuery} from 'alinea/core/Graph'
import {ErrorCode, HttpError} from 'alinea/core/HttpError'
import {Mutation, MutationType, UpdateMutation} from 'alinea/core/Mutation'
import {PreviewUpdate} from 'alinea/core/Preview'
import {getScope} from 'alinea/core/Scope'
import {decode} from 'alinea/core/util/BufferToBase64'
import {base64} from 'alinea/core/util/Encoding'
import {assign} from 'alinea/core/util/Objects'
import {array, object, string} from 'cito'
import PLazy from 'p-lazy'
import pLimit from 'p-limit'
import {mergeUpdatesV2} from 'yjs'
import {
  AuthedContext,
  Backend,
  DraftTransport,
  RequestContext
} from './Backend.js'
import {HandleAction} from './HandleAction.js'
import {ChangeSetCreator} from './data/ChangeSet.js'
import {createPreviewParser} from './resolver/ParsePreview.js'
import {generatedStore} from './store/GeneratedStore.js'

const limit = pLimit(1)

const PrepareBody = object({
  filename: string
})

const PreviewBody = object({
  locale: string.nullable,
  entryId: string
})

const SyncBody = array(string)

export interface Handler {
  (request: Request, context?: RequestContext): Promise<Response>
}

export interface HandlerWithConnect {
  (request: Request, context: RequestContext): Promise<Response>
  connect(context: RequestContext | AuthedContext): Connection
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
  database?: Promise<Database>
}

export function createHandler({
  cms,
  backend = cloudBackend(cms.config),
  database = generatedStore.then(store => new Database(cms.config, store)),
  ...hooks
}: HandlerOptions): HandlerWithConnect {
  const init = PLazy.from(async () => {
    const db = await database
    const previews = createPreviewParser(db)
    const resolver = db.resolver
    const changes = new ChangeSetCreator(
      cms.config,
      new Graph(cms.config, resolver)
    )
    let lastSync = 0

    return {db, mutate, resolve, periodicSync, syncPending}

    async function resolve(ctx: RequestContext, query: GraphQuery) {
      if (!query.preview) {
        await periodicSync(ctx, query.syncInterval)
        return resolver.resolve(query as GraphQuery)
      }
      const preview = await previews.parse(
        query.preview,
        () => syncPending(ctx),
        entryId => backend.drafts.get(ctx, entryId)
      )
      return resolver.resolve({
        ...query,
        preview: preview
      })
    }

    function periodicSync(ctx: RequestContext, syncInterval = 60) {
      if (syncInterval === Infinity) return
      const now = Date.now()
      if (now - lastSync < syncInterval * 1000) return Promise.resolve()
      lastSync = now
      return syncPending(ctx).catch(() => undefined)
    }

    function syncPending(ctx: RequestContext) {
      return limit(async () => {
        const meta = await db.meta()
        if (!backend.pending) return meta
        try {
          const toApply = await backend.pending.since(ctx, meta.commitHash)
          console.info(`> nothing to sync from ${meta.commitHash}`)
          if (!toApply) return meta
          console.info(
            `> sync ${toApply.mutations.length} pending mutations, from ${meta.commitHash} to ${toApply.toCommitHash}`
          )
          await db.applyMutations(toApply.mutations, toApply.toCommitHash)
        } catch (error) {
          console.error(error)
          console.warn('> could not sync pending mutations')
        }
        return db.meta()
      })
    }

    async function mutate(
      ctx: AuthedContext,
      mutations: Array<Mutation>,
      retry = false
    ): Promise<{commitHash: string}> {
      let fromCommitHash: string = await db.meta().then(meta => meta.commitHash)
      try {
        for (const mutation of mutations) {
          switch (mutation.type) {
            case MutationType.Create: {
              if (!hooks.beforeCreate) continue
              const maybeEntry = await hooks.beforeCreate(mutation.entry)
              if (maybeEntry) mutation.entry.data = maybeEntry.data
              continue
            }
            case MutationType.Edit: {
              if (!hooks.beforeUpdate) continue
              const maybeEntry = await hooks.beforeUpdate(mutation.entry)
              if (maybeEntry) mutation.entry.data = maybeEntry.data
              continue
            }
            case MutationType.Archive: {
              if (!hooks.beforeArchive) continue
              await hooks.beforeArchive(mutation.entryId)
              continue
            }
            case MutationType.RemoveEntry: {
              if (!hooks.beforeRemove) continue
              await hooks.beforeRemove(mutation.entryId)
              continue
            }
          }
        }
        const changeSet = await changes.create(mutations)
        const result = await backend.target.mutate(ctx, {
          commitHash: fromCommitHash,
          mutations: changeSet
        })
        await db.applyMutations(mutations, result.commitHash)
        for (const mutation of mutations) {
          switch (mutation.type) {
            case MutationType.Create: {
              if (!hooks.afterCreate) continue
              await hooks.afterCreate(mutation.entry)
              continue
            }
            case MutationType.Edit: {
              await persistEdit(ctx, mutation)
              if (!hooks.afterUpdate) continue
              await hooks.afterUpdate(mutation.entry)
              continue
            }
            case MutationType.Archive: {
              if (!hooks.afterArchive) continue
              await hooks.afterArchive(mutation.entryId)
              continue
            }
            case MutationType.RemoveEntry: {
              if (!hooks.afterRemove) continue
              await hooks.afterRemove(mutation.entryId)
              continue
            }
          }
        }
        return {commitHash: result.commitHash}
      } catch (error: any) {
        if (retry) throw error
        if (error instanceof HttpError && error.code === ErrorCode.Conflict) {
          await syncPending(ctx)
          return mutate(ctx, mutations, true)
        }
        throw error
      }
    }

    async function persistEdit(ctx: AuthedContext, mutation: UpdateMutation) {
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
    }
  })

  return assign(handle, {connect})

  function connect(context: RequestContext | AuthedContext): Connection {
    return {
      async user() {
        return 'user' in context ? context.user : undefined
      },
      async resolve<Query extends GraphQuery>(
        query: Query
      ): Promise<AnyQueryResult<Query>> {
        const {resolve} = await init
        return resolve(context, query) as Promise<AnyQueryResult<Query>>
      },
      async previewToken(request: PreviewUpdate) {
        const previews = new JWTPreviews(context.apiKey)
        return previews.sign(request)
      },
      async prepareUpload(file: string) {
        return backend.media.prepareUpload(context as AuthedContext, file)
      },
      async mutate(mutations: Array<Mutation>) {
        const {mutate} = await init
        return mutate(context as AuthedContext, mutations)
      },
      async syncRequired(contentHash: string) {
        const {db} = await init
        return db.syncRequired(contentHash)
      },
      async sync(contentHashes: Array<string>) {
        const {db} = await init
        return db.sync(contentHashes)
      },
      async revisions(file: string) {
        return backend.history.list(context as AuthedContext, file)
      },
      async revisionData(file: string, revisionId: string) {
        return backend.history.revision(
          context as AuthedContext,
          file,
          revisionId
        )
      },
      async getDraft(key) {
        return backend.drafts.get(context as AuthedContext, key)
      },
      async storeDraft(draft: Draft) {
        return backend.drafts.store(context as AuthedContext, draft)
      }
    }
  }

  async function handle(
    request: Request,
    context: RequestContext
  ): Promise<Response> {
    try {
      const {db, resolve, mutate, periodicSync, syncPending} = await init
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
        return Response.json((await resolve(ctx, scope.parse(raw))) ?? null)
      }

      // Pending
      if (action === HandleAction.Pending && request.method === 'GET') {
        const ctx = await internal
        expectJson()
        const commitHash = string(url.searchParams.get('commitHash'))
        return Response.json(await backend.pending?.since(ctx, commitHash))
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
      if (action === HandleAction.Sync && request.method === 'GET') {
        const ctx = await internal
        expectJson()
        const contentHash = string(url.searchParams.get('contentHash'))
        if ('user' in ctx) await periodicSync(ctx)
        else await syncPending(context)
        return Response.json(await db.syncRequired(contentHash))
      }

      if (action === HandleAction.Sync && request.method === 'POST') {
        const ctx = await internal
        expectJson()
        if ('user' in ctx) await periodicSync(ctx)
        else await syncPending(context)
        return Response.json(await db.sync(SyncBody(await body)))
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

      // Target
      if (action === HandleAction.Mutate && request.method === 'POST') {
        expectJson()
        return Response.json(await mutate(await verified, await body))
      }
    } catch (error) {
      if (error instanceof Response) return error
      console.error(error)
      return new Response('Internal Server Error', {status: 500})
    }

    return new Response('Bad Request', {status: 400})
  }
}
