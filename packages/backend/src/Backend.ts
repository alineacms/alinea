import {Auth, Workspaces} from '@alinea/core'
import {Entry} from '@alinea/core/Entry'
import {Hub} from '@alinea/core/Hub'
import {Cursor, CursorData} from '@alinea/store'
import {decode} from 'base64-arraybuffer'
import {Handle, router} from './router/Router'
import {Server, ServerOptions} from './Server'

export type BackendOptions<T extends Workspaces> = {
  auth?: Auth.Server
  dashboardUrl: string
} & ServerOptions<T>

function anonymous(): Auth.Server {
  return {
    async contextFor() {
      return {}
    },
    handler() {
      return undefined
    }
  }
}

function createRouter(hub: Server, auth: Auth.Server) {
  const matcher = router.startAt(Hub.routes.base)
  async function context<T extends {request: Request}>(
    input: T
  ): Promise<T & {ctx: Hub.Context}> {
    return {...input, ctx: await auth.contextFor(input.request)}
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
            ? new Uint8Array(decode(svParam))
            : undefined
        return hub.entry({id, stateVector}, ctx)
      })
      .map(router.jsonResponse),

    matcher
      .post(Hub.routes.query())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, url, body}) => {
        const fromSource = url.searchParams.has('source')
        return hub.query(
          {
            cursor: new Cursor(body as CursorData),
            source: fromSource
          },
          ctx
        )
      })
      .map(router.jsonResponse),

    matcher
      .get(Hub.routes.drafts())
      .map(context)
      .map(({ctx, url}) => {
        const workspace = url.searchParams.get('workspace')
        if (!workspace) return undefined
        return hub.listDrafts({workspace}, ctx)
      })
      .map(router.jsonResponse),

    matcher
      .put(Hub.routes.draft(':id'))
      .map(context)
      .map(router.parseBuffer)
      .map(({ctx, params, body}) => {
        const id = params.id as string
        return hub.updateDraft({id, update: new Uint8Array(body)}, ctx)
      })
      .map(router.jsonResponse),

    matcher
      .delete(Hub.routes.draft(':id'))
      .map(context)
      .map(({ctx, params}) => {
        const id = params.id as string
        return hub.deleteDraft({id}, ctx)
      })
      .map(router.jsonResponse),

    matcher
      .post(Hub.routes.publish())
      .map(context)
      .map(router.parseJson)
      .map(({ctx, body}) => {
        return hub.publishEntries({entries: body as Array<Entry>}, ctx)
      })
      .map(router.jsonResponse),

    matcher
      .post(Hub.routes.upload())
      .map(context)
      .map(router.parseFormData)
      .map(async ({ctx, body}) => {
        const workspace = String(body.get('workspace'))
        const root = String(body.get('root'))
        return hub.uploadFile(
          {
            workspace,
            root,
            buffer: await (body.get('buffer') as File).arrayBuffer(),
            path: String(body.get('path')),
            preview: String(body.get('preview')),
            averageColor: String(body.get('averageColor')),
            blurHash: String(body.get('blurHash')),
            width: Number(body.get('width')),
            height: Number(body.get('height'))
          },
          ctx
        )
      })
      .map(router.jsonResponse)
  ).recover(router.reportError)
}

export class Backend<T extends Workspaces = Workspaces> extends Server<T> {
  handle: Handle<Request, Response>

  constructor(public options: BackendOptions<T>) {
    super(options)
    const auth = options.auth || anonymous()
    const api = createRouter(this, auth)
    const {handle} = options.auth ? router(options.auth.handler, api) : api
    this.handle = handle
  }
}
