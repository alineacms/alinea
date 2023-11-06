import {Request, Response} from '@alinea/iso'
import {Auth, Connection, EntryPhase} from 'alinea/core'
import {Realm} from 'alinea/core/pages/Realm'
import {Selection} from 'alinea/core/pages/Selection'
import {base64} from 'alinea/core/util/Encoding'
import {Logger, LoggerResult, Report} from 'alinea/core/util/Logger'
import {Type, enums, object, string} from 'cito'
import {DraftTransport} from './Drafts.js'
import {Server, ServerOptions} from './Server.js'
import {Handle, Route, router} from './router/Router.js'

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
    auth.handler,

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

export interface HandlerOptions extends ServerOptions {
  auth?: Auth.Server
}

export class Handler {
  handle: Handle<Request, Response | undefined>

  constructor(public options: HandlerOptions) {
    const auth = options.auth || Auth.anonymous()
    const {handle} = createRouter(auth, context => new Server(options, context))
    this.handle = handle
  }
}
