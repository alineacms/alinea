import {Request, Response} from '@alinea/iso'
import {Handle, Route, router} from 'alinea/backend'
import {Auth, Entry, Hub} from 'alinea/core'
import {Logger, LoggerResult, Report} from 'alinea/core/util/Logger'
import {Api} from './Api.js'
import {Server, ServerOptions} from './Server.js'

function respond<T>({result, logger}: LoggerResult<T>) {
  return router.jsonResponse(result, {
    headers: {'server-timing': Report.toServerTiming(logger.report())}
  })
}

function createRouter(
  auth: Auth.Server,
  createApi: (context: Hub.Context) => Api
): Route<Request, Response | undefined> {
  const matcher = router.startAt(Hub.routes.base)
  async function context<T extends {request: Request; url: URL}>(
    input: T
  ): Promise<T & {ctx: Hub.Context; logger: Logger}> {
    const logger = new Logger(`${input.request.method} ${input.url.pathname}`)
    return {
      ...input,
      ctx: {...(await auth.contextFor(input.request)), logger},
      logger
    }
  }
  return router(
    matcher
      .get(Api.routes.updates())
      .map(context)
      .map(({ctx, url}) => {
        const api = createApi(ctx)
        const contentHash = url.searchParams.get('contentHash')!
        const modifiedAt = Number(url.searchParams.get('modifiedAt'))!
        return ctx.logger.result(api.updates({contentHash, modifiedAt}))
      })
      .map(respond),

    matcher
      .get(Api.routes.ids())
      .map(context)
      .map(({ctx}) => {
        const api = createApi(ctx)
        return ctx.logger.result(api.ids())
      })
      .map(respond),

    matcher
      .post(Hub.routes.publish())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        const api = createApi(ctx)
        return ctx.logger.result(
          api.publishEntries({entries: body as Array<Entry>})
        )
      })
      .map(respond),

    matcher
      .post(Hub.routes.upload())
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
