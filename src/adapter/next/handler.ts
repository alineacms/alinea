import {
  type BackendOptions,
  createBackend
} from 'alinea/backend/api/CreateBackend'
import {
  createHandler as createCoreHandler,
  type HandlerHooks
} from 'alinea/backend/Handler'
import {proxy} from 'alinea/backend/router/Proxy'
import {generatedSource} from 'alinea/backend/store/GeneratedSource'
import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {CloudRemote} from 'alinea/cloud/CloudRemote'
import {Config} from 'alinea/core/Config'
import type {RemoteConnection, RequestContext} from 'alinea/core/Connection'
import {LocalDB} from 'alinea/core/db/LocalDB'
import PLazy from 'p-lazy'
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
      ? createBackend(options.cms.config, options.backend)
      : context => new CloudRemote(context, options.cms))
  if (handlers.has(options.cms)) return handlers.get(options.cms)!
  const config = options.cms.config
  const db = PLazy.from(async () => {
    const source = await generatedSource
    const db = new LocalDB(config, source)
    await db.sync()
    return db
  })
  const handleBackend = createCoreHandler({
    ...options,
    remote,
    db
  })
  const handle: Handler = async request => {
    const url = new URL(request.url)
    const {searchParams} = url
    const dev = process.env.ALINEA_DEV_SERVER
    const context = await requestContext(config)
    const handlerPath = config.handlerUrl ?? '/admin'
    if (!url.pathname.startsWith(handlerPath))
      return new Response(`Expected handler to be served on ${handlerPath}`, {
        status: 400
      })
    if (dev) {
      // proxy to dev server, strip handler path
      console.log({handlerPath})
      const requestedPath = url.pathname.slice(handlerPath.length)
      const proxyTo = `${dev}${requestedPath}`
      console.log(proxyTo)
      return await proxy(dev)
    }
    try {
      const previews = new JWTPreviews(context.apiKey)
      const previewToken = searchParams.get('preview')
      if (previewToken) {
        const {draftMode} = await import('next/headers')
        const {url} = await previews.verify(previewToken)
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
      return await handleBackend(request, context)
    } catch (error) {
      console.error(error)
      return new Response('Internal server error', {status: 500})
    }
  }
  handlers.set(options.cms, handle)
  return handle
}
