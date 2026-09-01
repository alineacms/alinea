import {
  backendFromOptions,
  type BackendFactory,
  type BackendOptions
} from '#/backend/api/CreateBackend.js'
import {
  createHandler as createCoreHandler,
  type HandlerHooks
} from '#/backend/Handler.js'
import {generatedSource} from '#/backend/store/GeneratedSource.js'
import {JWTPreviews} from '#/backend/util/JWTPreviews.js'
import {CloudRemote} from '#/cloud/CloudRemote.js'
import {Config} from '#/core/Config.js'
import type {RequestContext} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import PLazy from 'p-lazy'
import {NextCMS} from './cms.js'
import {requestContext} from './context.js'
import {createDevRemote} from './DevRemote.js'

type Handler = (request: Request) => Promise<Response>

export interface NextHandlerOptions extends HandlerHooks {
  cms: NextCMS
  backend?: BackendFactory | BackendOptions
}

export function createHandler(input: NextCMS | NextHandlerOptions): Handler {
  const options = input instanceof NextCMS ? {cms: input} : input
  const config = options.cms.config
  const backend: BackendFactory =
    typeof options.backend === 'function'
      ? options.backend
      : options.backend
        ? backendFromOptions(options.backend)
        : (context: RequestContext) => new CloudRemote(context, config)
  const remote = (context: RequestContext) =>
    context.isDev ? createDevRemote(context, config) : backend(context, config)
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
    const context = await requestContext(config, request)
    const handlerPath = handlerPathname(config, url)
    if (url.pathname !== handlerPath)
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
  return handle
}

export function handlerPathname(config: Config, requestUrl: URL): string {
  return new URL(Config.handlerUrl(config), requestUrl).pathname
}
