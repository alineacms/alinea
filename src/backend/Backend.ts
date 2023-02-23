import type {Request, Response} from '@alinea/iso'
import {Auth} from 'alinea/core'
import {Entry} from 'alinea/core/Entry'
import {Hub} from 'alinea/core/Hub'
import {base64url} from 'alinea/core/util/Encoding'
import {Logger, LoggerResult, Report} from 'alinea/core/util/Logger'
import {Cursor, CursorData} from 'alinea/store'
import {Handle, Route, router} from './router/Router'
import {Server, ServerOptions} from './Server'

export type BackendOptions<T> = {
  auth?: Auth.Server
  dashboardUrl: string
} & ServerOptions<T>

export function anonymousAuth(): Auth.Server {
  return {
    async contextFor() {
      return {}
    },
    handler() {
      return undefined
    }
  }
}

function respond<T>({result, logger}: LoggerResult<T>) {
  return router.jsonResponse(result, {
    headers: {'server-timing': Report.toServerTiming(logger.report())}
  })
}

export function createRouter<T>(
  hub: Hub<T>,
  auth: Auth.Server
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
      .get(Hub.routes.entry(':id'))
      .map(context)
      .map(({ctx, url, params}) => {
        const id = params.id as string
        const svParam = url.searchParams.get('stateVector')!
        const stateVector =
          typeof svParam === 'string'
            ? new Uint8Array(base64url.parse(svParam))
            : undefined
        return ctx.logger.result(hub.entry({id, stateVector}, ctx))
      })
      .map(respond),

    matcher
      .post(Hub.routes.query())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, url, body}) => {
        const fromSource = url.searchParams.has('source')
        return ctx.logger.result(
          hub.query(
            {
              cursor: new Cursor(body as CursorData),
              source: fromSource
            },
            ctx
          )
        )
      })
      .map(respond),

    matcher
      .get(Hub.routes.drafts())
      .map(context)
      .map(({ctx, url}) => {
        const workspace = url.searchParams.get('workspace')
        if (!workspace) return undefined
        return ctx.logger.result(hub.listDrafts({workspace}, ctx))
      })
      .map(respond),

    matcher
      .put(Hub.routes.draft(':id'))
      .map(context)
      .map(router.parseBuffer)
      .map(({ctx, params, body}) => {
        const id = params.id as string
        return ctx.logger.result(
          hub.updateDraft({id, update: new Uint8Array(body)}, ctx)
        )
      })
      .map(respond),

    matcher
      .delete(Hub.routes.draft(':id'))
      .map(context)
      .map(({ctx, params}) => {
        const id = params.id as string
        return ctx.logger.result(hub.deleteDraft({id}, ctx))
      })
      .map(respond),

    matcher
      .post(Hub.routes.publish())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        return ctx.logger.result(
          hub.publishEntries({entries: body as Array<Entry>}, ctx)
        )
      })
      .map(respond),

    matcher
      .post(Hub.routes.upload())
      .map(context)
      .map(router.parseFormData)
      .map(async ({ctx, body}) => {
        const workspace = String(body.get('workspace'))
        const root = String(body.get('root'))
        return ctx.logger.result(
          hub.uploadFile(
            {
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
            },
            ctx
          )
        )
      })
      .map(respond)
  ).recover(router.reportError)
}

export class Backend<T = any> extends Server<T> {
  handle: Handle<Request, Response | undefined>

  constructor(public options: BackendOptions<T>) {
    super(options)
    const auth: Auth.Server = options.auth || anonymousAuth()
    const api = createRouter<T>(this, auth)
    const {handle} = options.auth ? router(options.auth.handler, api) : api
    this.handle = handle
  }
}
