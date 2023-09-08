import {Request, Response} from '@alinea/iso'
import {Auth, Connection, EntryPhase} from 'alinea/core'
import {Realm} from 'alinea/core/pages/Realm'
import {Selection} from 'alinea/core/pages/Selection'
import {Logger, LoggerResult, Report} from 'alinea/core/util/Logger'
import {Type, enums, object, string} from 'cito'
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

    matcher
      .get(Connection.routes.revisions())
      .map(context)
      .map(({ctx, url}) => {
        const api = createApi(ctx)
        const workspace = url.searchParams.get('workspace')!
        const root = url.searchParams.get('root')!
        const filePath = url.searchParams.get('filePath')!
        return ctx.logger.result(api.revisions({workspace, root, filePath}))
      })
      .map(respond),

    matcher
      .get(Connection.routes.revisionData(':revisionId'))
      .map(context)
      .map(({ctx, url, params}) => {
        const api = createApi(ctx)
        const workspace = url.searchParams.get('workspace')!
        const root = url.searchParams.get('root')!
        const filePath = url.searchParams.get('filePath')!
        return ctx.logger.result(
          api.revisionData(
            {workspace, root, filePath},
            params.revisionId as string
          )
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
      .post(Connection.routes.media())
      .map(context)
      .map(router.parseFormData)
      .map(async ({ctx, body}) => {
        const api = createApi(ctx)
        const workspace = String(body.get('workspace'))
        const root = String(body.get('root'))
        const castOrUndefined = <T>(cast: (x: unknown) => T, value: unknown) =>
          value !== null ? cast(value) : undefined
        return ctx.logger.result(
          api.uploadFile({
            workspace,
            root,
            buffer: await (body.get('buffer') as File).arrayBuffer(),
            parentId: String(body.get('parentId')) || undefined,
            path: String(body.get('path')),
            preview: castOrUndefined(String, body.get('preview')),
            averageColor: castOrUndefined(String, body.get('averageColor')),
            thumbHash: castOrUndefined(String, body.get('thumbHash')),
            width: castOrUndefined(Number, body.get('width')),
            height: castOrUndefined(Number, body.get('height'))
          })
        )
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
