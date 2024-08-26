import {Database, JWTPreviews} from 'alinea/backend'
import {cloudBackend} from 'alinea/cloud/CloudBackend'
import {CMS} from 'alinea/core/CMS'
import {Connection} from 'alinea/core/Connection'
import {parseYDoc} from 'alinea/core/Doc'
import {Draft} from 'alinea/core/Draft'
import {Entry} from 'alinea/core/Entry'
import {EntryPhase, EntryRow} from 'alinea/core/EntryRow'
import {Graph} from 'alinea/core/Graph'
import {EditMutation, Mutation, MutationType} from 'alinea/core/Mutation'
import {outcome} from 'alinea/core/Outcome'
import {PreviewUpdate, ResolveRequest} from 'alinea/core/Resolver'
import {createSelection} from 'alinea/core/pages/CreateSelection'
import {Realm} from 'alinea/core/pages/Realm'
import {Selection} from 'alinea/core/pages/ResolveData'
import {base64, base64url} from 'alinea/core/util/Encoding'
import {assign} from 'alinea/core/util/Objects'
import {Type, array, enums, object, string} from 'cito'
import {unzlibSync} from 'fflate'
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

const ResolveBody: Type<ResolveRequest> = object({
  selection: Selection.adt,
  realm: enums(Realm).optional,
  locale: string.optional,
  preview: object({
    entryId: string,
    contentHash: string,
    phase: enums(EntryPhase),
    update: string.optional
  }).optional
})

const PrepareBody = object({
  filename: string
})

const PreviewBody = object({
  entryId: string,
  contentHash: string,
  phase: string
})

const SyncBody = array(string)

export enum HandleAction {
  User = 'user',
  Auth = 'auth',
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
    const dbRevision = (await db.meta()).revisionId
    const resolver = new EntryResolver(db, cms.schema)
    const changes = new ChangeSetCreator(
      cms.config,
      new Graph(cms.config, resolver)
    )
    const drafts = new Map<string, Draft & {contentHash: string}>()
    let lastSync = 0

    return {db, dbRevision, mutate, resolve, syncPending}

    async function resolve(ctx: RequestContext, params: ResolveRequest) {
      await periodicSync(ctx, params.syncInterval)
      if (!params.preview) return resolver.resolve(params)
      const entry =
        'entry' in params.preview
          ? params.preview.entry
          : await parsePreview(ctx, params.preview)
      return resolver.resolve({
        ...params,
        preview: entry ? {entry} : params.preview
      })
    }

    async function periodicSync(ctx: RequestContext, syncInterval = 5) {
      if (syncInterval === Infinity) return
      const now = Date.now()
      if (now - lastSync < syncInterval * 1000) return
      lastSync = now
      try {
        await syncPending(ctx)
      } catch {}
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
      retry = 0
    ): Promise<{commitHash: string}> {
      const changeSet = await changes.create(mutations)
      const {commitHash: fromCommitHash} = await syncPending(ctx)
      let toCommitHash: string
      try {
        const result = await backend.target.mutate(ctx, {
          commitHash: fromCommitHash,
          mutations: changeSet
        })
        toCommitHash = result.commitHash
      } catch (error: any) {
        if ('expectedCommitHash' in error) {
          // Attempt again after syncing
          // Todo: this needs to be handled differently
          if (retry >= 3) throw error
          return mutate(ctx, mutations, retry + 1)
        }
        throw error
      }
      await db.applyMutations(mutations, toCommitHash)
      const tasks = []
      for (const mutation of mutations) {
        switch (mutation.type) {
          case MutationType.Edit:
            tasks.push(persistEdit(ctx, mutation, toCommitHash))
            continue
        }
      }
      await Promise.all(tasks)
      return {commitHash: toCommitHash}
    }

    async function persistEdit(
      ctx: AuthedContext,
      mutation: EditMutation,
      commitHash: string
    ) {
      if (!mutation.update) return
      const update = base64.parse(mutation.update)
      const currentDraft = await backend.drafts.get(ctx, mutation.entryId)
      await backend.drafts.store(ctx, {
        entryId: mutation.entryId,
        fileHash: mutation.entry.fileHash,
        draft: currentDraft
          ? mergeUpdatesV2([currentDraft.draft, update])
          : update
      })
    }

    async function parsePreview(
      ctx: RequestContext,
      preview: PreviewUpdate
    ): Promise<EntryRow | undefined> {
      if (!preview.update) return
      let meta = await db.meta()
      if (preview.contentHash !== meta.contentHash) {
        await periodicSync(ctx)
        meta = await db.meta()
      }
      const update = unzlibSync(base64url.parse(preview.update))
      const entry = await resolver.resolve<EntryRow>({
        selection: createSelection(
          Entry({entryId: preview.entryId}).maybeFirst()
        ),
        realm: Realm.PreferDraft
      })
      if (!entry) return
      const cachedDraft = drafts.get(preview.entryId)
      let currentDraft: Draft | undefined
      if (cachedDraft?.contentHash === meta.contentHash) {
        currentDraft = cachedDraft
      } else {
        currentDraft = await backend.drafts.get(ctx, preview.entryId)
        if (currentDraft)
          drafts.set(preview.entryId, {
            ...currentDraft,
            contentHash: meta.contentHash
          })
      }
      const apply = currentDraft
        ? mergeUpdatesV2([currentDraft.draft, update])
        : update
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
      async resolve(params: ResolveRequest) {
        const {resolve} = await init
        return resolve(context, params)
      },
      async previewToken(request: PreviewUpdate) {
        const previews = new JWTPreviews(context.apiKey)
        return previews.sign(request)
      },
      async prepareUpload(file: string) {
        return backend.media.upload(context as AuthedContext, file)
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
    const {db, resolve, mutate, syncPending} = await init
    const previews = new JWTPreviews(context.apiKey)
    const url = new URL(request.url)
    const params = url.searchParams
    const action = params.get('action') as HandleAction

    if (action === HandleAction.Auth)
      return backend.auth.authenticate(context, request)

    const isJson = request.headers
      .get('content-type')
      ?.includes('application/json')
    if (!isJson) return new Response('Expected JSON', {status: 400})
    const [body] = await outcome(() => request.json())

    async function internal() {
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
        (await resolve(await internal(), ResolveBody(body))) ?? null
      )
    if (action === HandleAction.Pending && request.method === 'GET') {
      const commitHash = url.searchParams.get('commitHash')!
      return Response.json(
        await backend.pending?.since(await internal(), commitHash)
      )
    }
    if (action === HandleAction.Draft && request.method === 'GET') {
      const entryId = url.searchParams.get('entryId')!
      const draft = await backend.drafts.get(await internal(), entryId)
      return Response.json(
        draft ? {...draft, draft: base64url.stringify(draft.draft)} : null
      )
    }

    // Verify auth
    const verified = await backend.auth.verify(context, request)
    if (!verified) return new Response('Unauthorized', {status: 401})

    // User
    if (action === HandleAction.User && request.method === 'GET')
      return Response.json(verified.user)

    // Sign preview token
    if (action === HandleAction.PreviewToken && request.method === 'POST')
      return Response.json(await previews.sign(PreviewBody(body)))

    // History
    if (action === HandleAction.History && request.method === 'GET') {
      const file = url.searchParams.get('file')!
      const revisionId = url.searchParams.get('revisionId')
      return Response.json(
        await (revisionId
          ? backend.history.revision(verified, file, revisionId)
          : backend.history.list(verified, file))
      )
    }

    // Syncable
    if (action === HandleAction.Sync && request.method === 'GET') {
      const contentHash = url.searchParams.get('contentHash')!
      await syncPending(context)
      return Response.json(await db.syncRequired(contentHash))
    }
    if (action === HandleAction.Sync && request.method === 'POST') {
      await syncPending(context)
      return Response.json(await db.sync(SyncBody(body)))
    }

    // Media
    if (action === HandleAction.Upload && request.method === 'POST')
      return Response.json(
        await backend.media.upload(verified, PrepareBody(body).filename)
      )

    // Drafts
    if (action === HandleAction.Draft && request.method === 'POST') {
      const data = body as DraftTransport
      const draft = {...data, draft: new Uint8Array(base64.parse(data.draft))}
      return Response.json(await backend.drafts.store(verified, draft))
    }

    // Target
    if (action === HandleAction.Mutate && request.method === 'POST')
      return Response.json(await mutate(verified, body))

    return new Response('Bad Request', {status: 400})
  }
}
