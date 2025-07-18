import {
  type BackendOptions,
  createBackend
} from 'alinea/backend/api/CreateBackend'
import {
  createHandler as createCoreHandler,
  type HandlerHooks
} from 'alinea/backend/Handler'
import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {localRemote} from 'alinea/cli/serve/LocalRemote'
import type {RemoteConnection, RequestContext} from 'alinea/core/Connection'
import {Entry} from 'alinea/core/Entry'
import type {Resolver} from 'alinea/core/Resolver'
import {getPreviewPayloadFromCookies} from 'alinea/preview/PreviewCookies'
import {NextCMS} from './cms.js'
import {requestContext} from './context.js'

type Handler = (request: Request) => Promise<Response>
const handlers = new WeakMap<NextCMS, Handler>()

export interface NextHandlerOptions extends HandlerHooks {
  cms: NextCMS
  backend?: BackendOptions
  remote?: (context: RequestContext) => RemoteConnection
}

export function createHandler(input: NextCMS | NextHandlerOptions): Handler {
  const options = input instanceof NextCMS ? {cms: input} : input
  const remote =
    options.remote ??
    (options.backend
      ? createBackend(options.backend)
      : localRemote(options.cms.config))
  if (handlers.has(options.cms)) return handlers.get(options.cms)!
  const handleBackend = createCoreHandler({
    ...options,
    remote,
    db: options.cms.db
  })
  const handle: Handler = async request => {
    try {
      const context = await requestContext(options.cms.config)
      const previews = new JWTPreviews(context.apiKey)
      const {searchParams} = new URL(request.url)
      const previewToken = searchParams.get('preview')
      if (previewToken) {
        const {draftMode, cookies} = await import('next/headers')
        const info = await previews.verify(previewToken)
        const cookie = await cookies()
        const resolver: Resolver = context.isDev
          ? options.cms
          : await options.cms.db
        const payload = getPreviewPayloadFromCookies(cookie.getAll())
        const url = await resolver.resolve({
          first: true,
          select: Entry.url,
          id: info.entryId,
          locale: info.locale,
          preview: payload ? {payload} : undefined,
          status: 'preferDraft'
        })
        if (!url) return new Response('Not found', {status: 404})
        const source = new URL(request.url)
        // Next.js incorrectly reports 0.0.0.0 as the hostname if the server is
        // listening on all interfaces
        if (source.hostname === '0.0.0.0') source.hostname = 'localhost'
        const location = new URL(url, source.origin)
        const dm = await draftMode()
        dm.enable()
        return new Response('Redirecting...', {
          status: 302,
          headers: {location: String(location)}
        })
      }
      return handleBackend(request, context)
    } catch (error) {
      console.error(error)
      return new Response('Internal server error', {status: 500})
    }
  }
  handlers.set(options.cms, handle)
  return handle
}
