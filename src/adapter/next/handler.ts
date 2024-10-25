import {
  AvailableDrivers,
  BackendOptions,
  createBackend
} from 'alinea/backend/api/CreateBackend'
import {Backend} from 'alinea/backend/Backend'
import {createHandler as createCoreHandler} from 'alinea/backend/Handler'
import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {cloudBackend} from 'alinea/cloud/CloudBackend'
import {Entry} from 'alinea/core/Entry'
import {getPreviewPayloadFromCookies} from 'alinea/preview/PreviewCookies'
import {NextCMS} from './cms.js'
import {devUrl, requestContext} from './context.js'

type Handler = (request: Request) => Promise<Response>
const handlers = new WeakMap<NextCMS, Handler>()

export function createHandler<Driver extends AvailableDrivers>(
  cms: NextCMS,
  backend: BackendOptions<Driver> | Backend = cloudBackend(cms.config)
) {
  if (handlers.has(cms)) return handlers.get(cms)!
  const api = 'database' in backend ? createBackend(backend) : backend
  const handleBackend = createCoreHandler(cms, api)
  const handle: Handler = async request => {
    try {
      const context = await requestContext(cms.config)
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
          ? await cms.connect()
          : handleBackend.connect(context)
        const payload = getPreviewPayloadFromCookies(cookie.getAll())
        const url = await connection.resolve({
          first: true,
          select: Entry.url,
          id: info.entryId,
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
  handlers.set(cms, handle)
  return handle
}
