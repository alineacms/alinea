import {BackendOptions, createBackend} from 'alinea/backend/api/CreateBackend'
import {Backend} from 'alinea/backend/Backend'
import {
  createHandler as createCoreHandler,
  HandlerHooks
} from 'alinea/backend/Handler'
import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {cloudBackend} from 'alinea/cloud/CloudBackend'
import {Entry} from 'alinea/core/Entry'
import {getPreviewPayloadFromCookies} from 'alinea/preview/PreviewCookies'
import {NextCMS} from './cms.js'
import {devUrl, requestContext} from './context.js'

type Handler = (request: Request) => Promise<Response>
const handlers = new WeakMap<NextCMS, Handler>()

export interface NextHandlerOptions extends HandlerHooks {
  cms: NextCMS
  backend?: BackendOptions | Backend
}

export function createHandler(cms: NextCMS): Handler
export function createHandler(options: NextHandlerOptions): Handler
/** @deprecated */
export function createHandler(
  cms: NextCMS,
  backend: BackendOptions | Backend
): Handler
export function createHandler(
  input: NextCMS | NextHandlerOptions,
  backend?: BackendOptions | Backend
): Handler {
  const options = input instanceof NextCMS ? {cms: input, backend} : input
  const providedBackend = options.backend ?? cloudBackend(options.cms)
  if (handlers.has(options.cms)) return handlers.get(options.cms)!
  const api =
    'database' in providedBackend
      ? createBackend(providedBackend)
      : providedBackend
  const handleBackend = createCoreHandler({...options, backend: api})
  const handle: Handler = async request => {
    try {
      const context = await requestContext(options.cms.config)
      const previews = new JWTPreviews(context.apiKey)
      const {searchParams} = new URL(request.url)
      const previewToken = searchParams.get('preview')
      if (previewToken) {
        const {draftMode, cookies} = await import('next/headers.js')
        const {searchParams} = new URL(request.url)
        const previewToken = searchParams.get('preview')
        if (!previewToken) return new Response('Not found', {status: 404})
        const info = await previews.verify(previewToken)
        const cookie = await cookies()
        const connection = devUrl()
          ? await options.cms.connect()
          : handleBackend.connect(context)
        const payload = getPreviewPayloadFromCookies(cookie.getAll())
        const url = await connection.resolve({
          first: true,
          select: Entry.url,
          id: info.entryId,
          locale: info.locale,
          preview: payload ? {payload} : undefined
        })
        if (!url) return new Response('Not found', {status: 404})
        const source = new URL(request.url)
        // Next.js incorrectly reports 0.0.0.0 as the hostname if the server is
        // listening on all interfaces
        if (source.hostname === '0.0.0.0') source.hostname = 'localhost'
        const location = new URL(url, source.origin)
        const dm = await draftMode()
        dm.enable()
        return new Response(`Redirecting...`, {
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
