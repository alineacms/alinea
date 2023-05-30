import {Request, Response} from '@alinea/iso'
import {Auth, Connection, Entry, EntryPhase} from 'alinea/core'
import {Realm} from 'alinea/core/pages/Realm'
import {Selection} from 'alinea/core/pages/Selection'
import {Logger, LoggerResult, Report} from 'alinea/core/util/Logger'
import {enums, object, string} from 'cito'
import {Server, ServerOptions} from './Server.js'
import {Handle, Route, router} from './router/Router.js'

function respond<T>({result, logger}: LoggerResult<T>) {
  return router.jsonResponse(result, {
    headers: {'server-timing': Report.toServerTiming(logger.report())}
  })
}

const ResolveBody = object({
  selection: Selection.adt,
  realm: enums(Realm),
  preview: object({
    entryId: string,
    phase: enums(EntryPhase),
    update: string
  }).optional
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
    matcher
      .get(Connection.routes.previewToken())
      .map(context)
      .map(({ctx}) => {
        const api = createApi(ctx)
        return ctx.logger.result(api.previewToken())
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

    matcher
      .get(Connection.routes.updates())
      .map(context)
      .map(({ctx, url}) => {
        const api = createApi(ctx)
        const contentHash = url.searchParams.get('contentHash')!
        const modifiedAt = Number(url.searchParams.get('modifiedAt'))!
        return ctx.logger.result(api.updates({contentHash, modifiedAt}))
      })
      .map(respond),

    matcher
      .get(Connection.routes.versionIds())
      .map(context)
      .map(({ctx}) => {
        const api = createApi(ctx)
        return ctx.logger.result(api.versionIds())
      })
      .map(respond),

    matcher
      .post(Connection.routes.saveDraft())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        return ctx.logger.result(api.saveDraft(body as Entry))
      })
      .map(respond),

    matcher
      .post(Connection.routes.publishDrafts())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        return ctx.logger.result(api.publishDrafts(body as Array<Entry>))
      })
      .map(respond),

    matcher
      .post(Connection.routes.upload())
      .map(context)
      .map(router.parseFormData)
      .map(async ({ctx, body}) => {
        const api = createApi(ctx)
        const workspace = String(body.get('workspace'))
        const root = String(body.get('root'))
        return ctx.logger.result(
          api.uploadFile({
            workspace,
            root,
            buffer: await (body.get('buffer') as File).arrayBuffer(),
            parentId: String(body.get('parentId')) || undefined,
            path: String(body.get('path')),
            preview: String(body.get('preview')),
            averageColor: String(body.get('averageColor')),
            blurHash: String(body.get('blurHash')),
            width: Number(body.get('width')),
            height: Number(body.get('height'))
          })
        )
      })
      .map(respond)
  ).recover(router.reportError)
}

export interface HandlerOptions extends ServerOptions {
  auth?: Auth.Server
  dashboardUrl: string
}

export class Handler {
  handle: Handle<Request, Response | undefined>

  constructor(public options: HandlerOptions) {
    const auth = options.auth || Auth.anonymous()
    const {handle} = createRouter(auth, context => new Server(options, context))
    this.handle = handle
  }
}
