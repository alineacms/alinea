import {Database, JWTPreviews} from 'alinea/backend'
import {cloudBackend} from 'alinea/cloud/CloudBackend'
import {CMS} from 'alinea/core/CMS'
import {Connection} from 'alinea/core/Connection'
import {parseYDoc} from 'alinea/core/Doc'
import {Draft} from 'alinea/core/Draft'
import {Entry} from 'alinea/core/Entry'
import {EntryRow} from 'alinea/core/EntryRow'
import {Graph} from 'alinea/core/Graph'
import {EditMutation, Mutation, MutationType} from 'alinea/core/Mutation'
import {
  PreviewPayload,
  PreviewUpdate,
  ResolveParams,
  ResolveRequest
} from 'alinea/core/Resolver'
import {createSelection} from 'alinea/core/pages/CreateSelection'
import {Realm} from 'alinea/core/pages/Realm'
import {Selection} from 'alinea/core/pages/ResolveData'
import {base64, base64url} from 'alinea/core/util/Encoding'
import {assign} from 'alinea/core/util/Objects'
import {decodePreviewPayload} from 'alinea/preview/PreviewPayload'
import {decode} from 'buffer-to-base64'
import {Type, array, enums, object, string} from 'cito'
import PLazy from 'p-lazy'
import pLimit from 'p-limit'
import * as Y from 'yjs'
import {mergeUpdatesV2} from 'yjs'
import {
  AuthedContext,
  Backend,
  DraftTransport,
  RequestContext
} from './Backend.js'
import {ChangeSetCreator} from './data/ChangeSet.js'
import {EntryResolver} from './resolver/EntryResolver.js'
import {generatedStore} from './store/GeneratedStore.js'

const limit = pLimit(1)

const ResolveBody: Type<ResolveParams> = object({
  selection: Selection.adt,
  realm: enums(Realm).optional,
  locale: string.optional,
  preview: object({payload: string}).optional
})

const PrepareBody = object({
  filename: string
})

const PreviewBody = object({
  entryId: string
})

const SyncBody = array(string)

export enum HandleAction {
  User = 'user',
  Resolve = 'resolve',
  Pending = 'pending',
  Sync = 'sync',
  Draft = 'draft',
  History = 'history',
  PreviewToken = 'previewToken',
  Mutate = 'mutate',
  Upload = 'upload'
}

export interface Handler {
  (request: Request, context?: RequestContext): Promise<Response>
}

export interface HandlerWithConnect {
  (request: Request, context: RequestContext): Promise<Response>
  connect(context: RequestContext | AuthedContext): Connection
}

export function createHandler(
  cms: CMS,
  backend: Backend = cloudBackend(cms.config),
  database = generatedStore.then(store => new Database(cms.config, store))
): HandlerWithConnect {
  const init = PLazy.from(async () => {
    const db = await database
    const resolver = new EntryResolver(db, cms.schema)
    const changes = new ChangeSetCreator(
      cms.config,
      new Graph(cms.config, resolver)
    )
    const drafts = new Map<
      string,
      Promise<{contentHash: string; draft?: Draft}>
    >()
    let lastSync = Date.now()

    return {db, mutate, resolve, syncPending}

    async function resolve(ctx: RequestContext, params: ResolveParams) {
      if (!params.preview) {
        await periodicSync(ctx, params.syncInterval)
        return resolver.resolve(params as ResolveRequest)
      }
      const entry = params.preview && (await parsePreview(ctx, params.preview))
      return resolver.resolve({
        ...params,
        preview: entry && {entry}
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
          if (!toApply) return meta
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
      const changeSet = await changes.create(mutations)
      let fromCommitHash: string = await db.meta().then(meta => meta.commitHash)
      try {
        const result = await backend.target.mutate(ctx, {
          commitHash: fromCommitHash,
          mutations: changeSet
        })
        await db.applyMutations(mutations, result.commitHash)
        const tasks = []
        for (const mutation of mutations) {
          switch (mutation.type) {
            case MutationType.Edit:
              tasks.push(persistEdit(ctx, mutation))
              continue
          }
        }
        await Promise.all(tasks)
        return {commitHash: result.commitHash}
      } catch (error: any) {
        if ('expectedCommitHash' in error) {
          if (retry) throw error
          await syncPending(ctx)
          return mutate(ctx, mutations, true)
        }
        throw error
      }
    }

    async function persistEdit(ctx: AuthedContext, mutation: EditMutation) {
      if (!mutation.update) return
      const update = new Uint8Array(await decode(mutation.update))
      const currentDraft = await backend.drafts.get(ctx, mutation.entryId)
      const updatedDraft = currentDraft
        ? mergeUpdatesV2([currentDraft.draft, update])
        : update
      const draft = {
        entryId: mutation.entryId,
        fileHash: mutation.entry.fileHash,
        draft: updatedDraft
      }
      await backend.drafts.store(ctx, draft)
      const {contentHash} = await db.meta()
      drafts.set(mutation.entryId, Promise.resolve({contentHash, draft}))
    }

    async function parsePreview(
      ctx: RequestContext,
      preview: PreviewPayload
    ): Promise<EntryRow | undefined> {
      const update = await decodePreviewPayload(preview.payload)
      let meta = await db.meta()
      if (update.contentHash !== meta.contentHash) {
        await syncPending(ctx)
        meta = await db.meta()
      }
      const entry = await resolver.resolve<EntryRow>({
        selection: createSelection(
          Entry({entryId: update.entryId}).maybeFirst()
        ),
        realm: Realm.PreferDraft
      })
      if (!entry) return
      const cachedDraft = await drafts.get(update.entryId)
      let currentDraft: Draft | undefined
      if (cachedDraft?.contentHash === meta.contentHash) {
        currentDraft = cachedDraft.draft
      } else {
        try {
          const pending = backend.drafts.get(ctx, update.entryId)
          drafts.set(
            update.entryId,
            pending.then(draft => ({contentHash: meta.contentHash, draft}))
          )
          currentDraft = await pending
        } catch (error) {
          console.warn('> could not fetch draft', error)
        }
      }
      const apply = currentDraft
        ? mergeUpdatesV2([currentDraft.draft, update.update])
        : update.update
      const type = cms.config.schema[entry.type]
      if (!type) return
      const doc = new Y.Doc()
      Y.applyUpdateV2(doc, apply)
      const entryData = parseYDoc(type, doc)
      return {...entry, ...entryData, path: entry.path}
    }
  })

  return assign(handle, {connect})

  function connect(context: RequestContext | AuthedContext): Connection {
    return {
      async user() {
        return 'user' in context ? context.user : undefined
      },
      async resolve(params: ResolveParams) {
        const {resolve} = await init
        return resolve(context, params)
      },
      async previewToken(request: PreviewUpdate) {
        const previews = new JWTPreviews(context.apiKey)
        return previews.sign(request)
      },
      async prepareUpload(file: string) {
        return backend.media.prepareUpload(context as AuthedContext, file)
      },
      async handleUpload(destination, file) {
        return backend.media.handleUpload?.(
          context as AuthedContext,
          destination,
          file
        )
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
      async getDraft(entryId: string) {
        return backend.drafts.get(context as AuthedContext, entryId)
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
      const {db, resolve, mutate, syncPending} = await init
      const previews = new JWTPreviews(context.apiKey)
      const url = new URL(request.url)
      const params = url.searchParams
      const auth = params.get('auth')

      if (auth) return backend.auth.authenticate(context, request)

      const action = params.get('action') as HandleAction

      const isJson = request.headers
        .get('content-type')
        ?.includes('application/json')
      if (!isJson) return new Response('Expected JSON', {status: 400})
      const body = PLazy.from(() => request.json())

      // User
      if (action === HandleAction.User && request.method === 'GET') {
        try {
          const {user} = await backend.auth.verify(context, request)
          return Response.json(user)
        } catch {
          return Response.json(null)
        }
      }

      async function verifyInternal() {
        try {
          return await backend.auth.verify(context, request)
        } catch {
          const authorization = request.headers.get('authorization')
          const bearer = authorization?.slice('Bearer '.length)
          if (!context.apiKey) throw new Error('Missing API key')
          if (bearer !== context.apiKey)
            throw new Error('Expected matching api key')
          return context
        }
      }

      // These actions can be run internally or by a user
      if (action === HandleAction.Resolve && request.method === 'POST')
        return Response.json(
          (await resolve(await verifyInternal(), ResolveBody(await body))) ??
            null
        )
      if (action === HandleAction.Pending && request.method === 'GET') {
        const commitHash = string(url.searchParams.get('commitHash'))
        return Response.json(
          await backend.pending?.since(await verifyInternal(), commitHash)
        )
      }
      if (action === HandleAction.Draft && request.method === 'GET') {
        const entryId = string(url.searchParams.get('entryId'))
        const draft = await backend.drafts.get(await verifyInternal(), entryId)
        return Response.json(
          draft ? {...draft, draft: base64url.stringify(draft.draft)} : null
        )
      }

      // Verify auth
      const verified = await backend.auth.verify(context, request)
      if (!verified) return new Response('Unauthorized', {status: 401})

      // Sign preview token
      if (action === HandleAction.PreviewToken && request.method === 'POST')
        return Response.json(await previews.sign(PreviewBody(await body)))

      // History
      if (action === HandleAction.History && request.method === 'GET') {
        const file = string(url.searchParams.get('file'))
        const revisionId = string.optional(url.searchParams.get('revisionId'))
        return Response.json(
          await (revisionId
            ? backend.history.revision(verified, file, revisionId)
            : backend.history.list(verified, file))
        )
      }

      // Syncable
      if (action === HandleAction.Sync && request.method === 'GET') {
        const contentHash = string(url.searchParams.get('contentHash'))
        await syncPending(context)
        return Response.json(await db.syncRequired(contentHash))
      }
      if (action === HandleAction.Sync && request.method === 'POST') {
        await syncPending(context)
        return Response.json(await db.sync(SyncBody(await body)))
      }

      // Media
      if (action === HandleAction.Upload && request.method === 'POST') {
        const {handleUpload, prepareUpload} = backend.media
        const isMultipart = request.headers
          .get('content-type')
          ?.includes('multipart')
        if (!isMultipart)
          return Response.json(
            await prepareUpload(verified, PrepareBody(await body).filename)
          )
        if (!handleUpload) return new Response('Bad Request', {status: 400})
        const entryId = string(url.searchParams.get('entryId'))
        const location = string(url.searchParams.get('location'))
        return Response.json(
          await handleUpload(
            verified,
            {entryId, location},
            await request.blob()
          )
        )
      }

      // Drafts
      if (action === HandleAction.Draft && request.method === 'POST') {
        const data = (await body) as DraftTransport
        const draft = {...data, draft: new Uint8Array(base64.parse(data.draft))}
        return Response.json(await backend.drafts.store(verified, draft))
      }

      // Target
      if (action === HandleAction.Mutate && request.method === 'POST')
        return Response.json(await mutate(verified, await body))
    } catch (error) {
      if (error instanceof Response) return error
      console.error(error)
      return new Response('Internal Server Error', {status: 500})
    }

    return new Response('Bad Request', {status: 400})
  }
}
