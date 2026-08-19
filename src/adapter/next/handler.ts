import {
  type BackendFactory,
  type BackendOptions,
  backendFromOptions
} from '#/backend/api/CreateBackend.js'
import {
  createHandler as createCoreHandler,
  type HandlerHooks
} from '#/backend/Handler.js'
import {fetchGeneratedSource} from '#/backend/store/GeneratedSource.js'
import {JWTPreviews} from '#/backend/util/JWTPreviews.js'
import {CloudRemote} from '#/cloud/CloudRemote.js'
import type {RequestContext} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import PLazy from 'p-lazy'
import {NextCMS} from './cms.js'
import {requestContext} from './context.js'

type Handler = (request: Request) => Promise<Response>
const handlers = new WeakMap<NextCMS, Handler>()

export interface NextHandlerOptions extends HandlerHooks {
  cms: NextCMS
  backend?: BackendFactory | BackendOptions
}

export function createHandler(input: NextCMS | NextHandlerOptions): Handler {
  const options = input instanceof NextCMS ? {cms: input} : input
  if (handlers.has(options.cms)) return handlers.get(options.cms)!
  const config = options.cms.config
  const backend: BackendFactory =
    typeof options.backend === 'function'
      ? options.backend
      : options.backend
        ? backendFromOptions(options.backend)
        : (context: RequestContext) => new CloudRemote(context, config)
  const remote = (context: RequestContext) => backend(context, config)
  const db = PLazy.from(async () => {
    const {handlerUrl} = await requestContext(config)
    const source = await fetchGeneratedSource(handlerUrl)
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
    const context = await requestContext(config)
    const handlerPath = config.handlerUrl ?? '/api/cms'
    if (!url.pathname.startsWith(handlerPath))
      return new Response(`Expected handler to be served on ${handlerPath}`, {
        status: 400
      })
    try {
      const previews = new JWTPreviews(context.apiKey)
      const previewToken = searchParams.get('preview')
      if (previewToken) {
        const {draftMode} = await import('next/headers')
        await previews.verify(previewToken)
        const source = new URL(request.url)
        // Next.js incorrectly reports 0.0.0.0 as the hostname if the server is
        // listening on all interfaces
        if (source.hostname === '0.0.0.0') source.hostname = 'localhost'
        const returnTo = searchParams.get('returnTo') ?? '/'
        if (!returnTo.startsWith('/') || returnTo.startsWith('//'))
          throw new Error('Invalid preview return URL')
        const location = new URL(returnTo, source.origin)
        if (location.origin !== source.origin)
          throw new Error('Invalid preview return origin')
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
