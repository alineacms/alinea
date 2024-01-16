import {Request, Response} from '@alinea/iso'
import {
  Auth,
  Config,
  Connection,
  Draft,
  Entry,
  EntryPhase,
  EntryRow,
  PreviewUpdate,
  ResolveDefaults,
  Resolver,
  SyncResponse,
  parseYDoc
} from 'alinea/core'
import {EntryRecord} from 'alinea/core/EntryRecord'
import {EditMutation, Mutation, MutationType} from 'alinea/core/Mutation'
import {createSelection} from 'alinea/core/pages/CreateSelection'
import {Realm} from 'alinea/core/pages/Realm'
import {Selection} from 'alinea/core/pages/Selection'
import {base64, base64url} from 'alinea/core/util/Encoding'
import {Logger, LoggerResult, Report} from 'alinea/core/util/Logger'
import * as Y from 'alinea/yjs'
import {Type, enums, object, string} from 'cito'
import {unzlibSync} from 'fflate'
import pLimit from 'p-limit'
import {mergeUpdatesV2} from 'yjs'
import {Database} from './Database.js'
import {DraftTransport, Drafts} from './Drafts.js'
import {History, Revision} from './History.js'
import {Media} from './Media.js'
import {Pending} from './Pending.js'
import {Previews} from './Previews'
import {Target} from './Target.js'
import {ChangeSetCreator} from './data/ChangeSet.js'
import {EntryResolver} from './resolver/EntryResolver.js'
import {Route, router} from './router/Router.js'

const limit = pLimit(1)

export interface HandlerOptions {
  config: Config
  db: Database
  previews: Previews
  previewAuthToken: string
  auth?: Auth.Server
  target?: Target
  media?: Media
  drafts?: Drafts
  history?: History
  pending?: Pending
  resolveDefaults?: ResolveDefaults
}

export class Handler implements Resolver {
  connect: (ctx: Connection.Context) => Connection
  router: Route<Request, Response | undefined>
  changes: ChangeSetCreator
  protected lastSync = 0
  protected resolver: EntryResolver

  constructor(public options: HandlerOptions) {
    this.resolver = new EntryResolver(
      options.db,
      options.config.schema,
      this.parsePreview.bind(this)
    )
    this.changes = new ChangeSetCreator(options.config)
    const auth = options.auth || Auth.anonymous()
    this.connect = ctx => new HandlerConnection(this, ctx)
    this.router = createRouter(auth, this.connect)
  }

  resolve = async (params: Connection.ResolveParams) => {
    const {resolveDefaults} = this.options
    const resolveParams = {...resolveDefaults, ...params}
    const {syncInterval} = resolveParams
    await this.periodicSync(syncInterval)
    return this.resolver.resolve(resolveParams)
  }

  protected previewAuth(): Connection.Context {
    return {
      logger: new Logger('parsePreview'),
      token: this.options.previewAuthToken
    }
  }

  async parsePreview(preview: PreviewUpdate) {
    const {config} = this.options
    await this.periodicSync()
    const update = unzlibSync(base64url.parse(preview.update))
    const entry = await this.resolver.resolve<EntryRow>({
      selection: createSelection(
        Entry({entryId: preview.entryId}).maybeFirst()
      ),
      realm: Realm.PreferDraft
    })
    if (!entry) return
    const currentDraft = await this.options.drafts?.getDraft(
      preview.entryId,
      this.previewAuth()
    )
    const apply = currentDraft
      ? mergeUpdatesV2([currentDraft.draft, update])
      : update
    const type = config.schema[entry.type]
    if (!type) return
    const doc = new Y.Doc()
    Y.applyUpdateV2(doc, apply)
    const entryData = parseYDoc(type, doc)
    return {...entry, ...entryData, path: entry.path}
  }

  async periodicSync(syncInterval = 5) {
    if (syncInterval === 0) return
    const now = Date.now()
    if (now - this.lastSync < syncInterval * 1000) return
    this.lastSync = now
    try {
      await this.syncPending()
    } catch {}
  }

  syncPending() {
    return limit(async () => {
      const {pending, db} = this.options
      const meta = await db.meta()
      if (!pending) return meta
      try {
        const toApply = await pending.pendingSince(
          meta.commitHash,
          this.previewAuth()
        )
        if (!toApply) return meta
        await db.applyMutations(toApply.mutations, toApply.toCommitHash)
      } catch (error) {
        console.error(error)
        console.warn('> could not sync pending mutations')
      }
      return db.meta()
    })
  }
}

class HandlerConnection implements Connection {
  resolve: Resolver['resolve']

  constructor(protected handler: Handler, protected ctx: Connection.Context) {
    this.resolve = handler.resolve
  }

  // Target

  async mutate(
    mutations: Array<Mutation>,
    retry = 0
  ): Promise<{commitHash: string}> {
    const {target, db} = this.handler.options
    if (!target) throw new Error('Target not available')
    const changeSet = this.handler.changes.create(mutations)
    const {commitHash: fromCommitHash} = await this.handler.syncPending()
    let toCommitHash: string
    try {
      const result = await target.mutate(
        {commitHash: fromCommitHash, mutations: changeSet},
        this.ctx
      )
      toCommitHash = result.commitHash
    } catch (error: any) {
      if ('expectedCommitHash' in error) {
        // Attempt again after syncing
        // Todo: this needs to be handled differently
        if (retry >= 3) throw error
        return this.mutate(mutations, retry + 1)
      }
      throw error
    }
    await db.applyMutations(mutations, toCommitHash)
    const tasks = []
    for (const mutation of mutations) {
      switch (mutation.type) {
        case MutationType.Edit:
          tasks.push(this.persistEdit(mutation))
          continue
      }
    }
    await Promise.all(tasks)
    return {commitHash: toCommitHash}
  }

  previewToken(): Promise<string> {
    const {previews} = this.handler.options
    const user = this.ctx.user
    if (!user) return previews.sign({anonymous: true})
    return previews.sign({sub: user.sub})
  }

  // Media

  prepareUpload(file: string): Promise<Connection.UploadResponse> {
    const {media} = this.handler.options
    if (!media) throw new Error('Media not available')
    return media.prepareUpload(file, this.ctx)
  }

  // History

  async revisions(file: string): Promise<Array<Revision>> {
    const {history} = this.handler.options
    if (!history) return []
    return history.revisions(file, this.ctx)
  }

  async revisionData(file: string, revisionId: string): Promise<EntryRecord> {
    const {history} = this.handler.options
    if (!history) throw new Error('History not available')
    return history.revisionData(file, revisionId, this.ctx)
  }

  // Syncable

  async syncRequired(contentHash: string): Promise<boolean> {
    const {db} = this.handler.options
    await this.handler.syncPending()
    return db.syncRequired(contentHash)
  }

  async sync(contentHashes: Array<string>): Promise<SyncResponse> {
    const {db} = this.handler.options
    await this.handler.syncPending()
    return db.sync(contentHashes)
  }

  // Drafts

  private async persistEdit(mutation: EditMutation) {
    const {drafts} = this.handler.options
    if (!drafts || !mutation.update) return
    const update = base64.parse(mutation.update)
    const currentDraft = await this.getDraft(mutation.entryId)
    await this.storeDraft({
      entryId: mutation.entryId,
      fileHash: mutation.entry.fileHash,
      draft: currentDraft
        ? mergeUpdatesV2([currentDraft.draft, update])
        : update
    })
  }

  getDraft(entryId: string): Promise<Draft | undefined> {
    const {drafts} = this.handler.options
    if (!drafts) throw new Error('Drafts not available')
    return drafts.getDraft(entryId, this.ctx)
  }

  storeDraft(draft: Draft): Promise<void> {
    const {drafts} = this.handler.options
    if (!drafts) throw new Error('Drafts not available')
    return drafts.storeDraft(draft, this.ctx)
  }
}

function respond<T>({result, logger}: LoggerResult<T>) {
  return router.jsonResponse(result, {
    headers: {'server-timing': Report.toServerTiming(logger.report())}
  })
}

const ResolveBody: Type<Connection.ResolveParams> = object({
  selection: Selection.adt,
  locale: string.optional,
  realm: enums(Realm),
  preview: object({
    entryId: string,
    phase: enums(EntryPhase),
    update: string
  }).optional
})

const PrepareBody = object({
  filename: string
})

function createRouter(
  auth: Auth.Server,
  createApi: (context: Connection.Context) => Connection
): Route<Request, Response | undefined> {
  const matcher = router.startAt(Connection.routes.base)
  async function context<T extends {request: Request; url: URL}>(
    input: T
  ): Promise<T & {ctx: Connection.Context; logger: Logger}> {
    const logger = new Logger(`${input.request.method} ${input.url.pathname}`)
    return {
      ...input,
      ctx: {...(await auth.contextFor(input.request)), logger},
      logger
    }
  }
  return router(
    auth.router,

    matcher
      .get(Connection.routes.previewToken())
      .map(context)
      .map(({ctx}) => {
        const api = createApi(ctx)
        return ctx.logger.result(api.previewToken())
      })
      .map(respond),

    // History

    matcher
      .get(Connection.routes.revisions())
      .map(context)
      .map(({ctx, url}) => {
        const api = createApi(ctx)
        const file = url.searchParams.get('file')!
        const revisionId = url.searchParams.get('revisionId')
        return ctx.logger.result<any>(
          revisionId ? api.revisionData(file, revisionId) : api.revisions(file)
        )
      })
      .map(respond),

    matcher
      .post(Connection.routes.resolve())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        // This validates the input, and throws if it's invalid
        const api = createApi(ctx)
        return ctx.logger.result(api.resolve(ResolveBody(body)))
      })
      .map(respond),

    // Target

    matcher
      .post(Connection.routes.mutate())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        if (!Array.isArray(body)) throw new Error('Expected array')
        // Todo: validate mutations properly
        return ctx.logger.result(api.mutate(body))
      })
      .map(respond),

    // Syncable

    matcher
      .get(Connection.routes.sync())
      .map(context)
      .map(({ctx, url}) => {
        const api = createApi(ctx)
        const contentHash = url.searchParams.get('contentHash')!
        return ctx.logger.result(api.syncRequired(contentHash))
      })
      .map(respond),

    matcher
      .post(Connection.routes.sync())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        if (!Array.isArray(body)) throw new Error(`Array expected`)
        const contentHashes = body as Array<string>
        return ctx.logger.result(api.sync(contentHashes))
      })
      .map(respond),

    // Media

    matcher
      .post(Connection.routes.prepareUpload())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        const {filename} = PrepareBody(body)
        return ctx.logger.result(api.prepareUpload(filename))
      })
      .map(respond),

    // Drafts

    matcher
      .get(Connection.routes.draft())
      .map(context)
      .map(({ctx, url}) => {
        const api = createApi(ctx)
        const entryId = url.searchParams.get('entryId')!
        return ctx.logger.result(
          api.getDraft(entryId).then(draft => {
            if (!draft) return null
            return {...draft, draft: base64.stringify(draft.draft)}
          })
        )
      })
      .map(respond),

    matcher
      .post(Connection.routes.draft())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        const data = body as DraftTransport
        const draft = {...data, draft: new Uint8Array(base64.parse(data.draft))}
        return ctx.logger.result(api.storeDraft(draft))
      })
      .map(respond)
  ).recover(router.reportError)
}
