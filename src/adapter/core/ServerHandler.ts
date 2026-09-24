import {
  backendFromOptions,
  type BackendFactory,
  type BackendOptions
} from '#/backend/api/CreateBackend.js'
import {
  createHandler as createCoreHandler,
  type HandlerHooks
} from '#/backend/Handler.js'
import {JWTPreviews} from '#/backend/util/JWTPreviews.js'
import {CloudRemote} from '#/cloud/CloudRemote.js'
import {Config} from '#/core/Config.js'
import type {RequestContext} from '#/core/Connection.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import {trace} from '#/core/Trace.js'
import PLazy from 'p-lazy'
import {requestContext} from './context.js'
import {createDevRemote} from './DevRemote.js'
import {ServerCMS} from './ServerCMS.js'
import type {ServerHost} from './ServerHost.js'

export type Handler = (request: Request) => Promise<Response>

export interface ServerHandlerOptions extends HandlerHooks {
  cms: ServerCMS
  backend?: BackendFactory | BackendOptions
}

export type OpenGeneratedDatabase = (config: Config) => Promise<LocalStore>

export function createServerHandler(
  input: ServerCMS | ServerHandlerOptions,
  host: ServerHost,
  openGeneratedDatabase?: OpenGeneratedDatabase
): Handler {
  const options = input instanceof ServerCMS ? {cms: input} : input
  const config = options.cms.config
  const backend: BackendFactory =
    typeof options.backend === 'function'
      ? options.backend
      : options.backend
        ? backendFromOptions(options.backend)
        : (context: RequestContext) => new CloudRemote(context, config)
  const remote = (context: RequestContext) =>
    context.isDev ? createDevRemote(context, config) : backend(context, config)
  const span = trace(config, 'alinea.handler.db')
  const db = PLazy.from(() =>
    span(async () => {
      if (host.isEdge())
        throw new Error(
          'The Alinea handler is not supported in Edge runtime environments.'
        )
      if (!openGeneratedDatabase)
        throw new Error(
          'The generated database is not available here. Import createHandler from the Node entry of your adapter.'
        )
      return openGeneratedDatabase(config)
    })
  )
  const handleBackend = createCoreHandler({
    ...options,
    remote,
    db,
    // Revalidate the shared content sha before the user-provided hook so
    // page revalidation triggered there already sees the fresh sha when
    // renders resolve. Invalidation never throws (hosts swallow failures).
    afterCommit: async context => {
      await host.revalidate?.()
      await options.afterCommit?.(context)
    }
  })
  const handle: Handler = async request => {
    const url = new URL(request.url)
    const context = await requestContext(config, request)
    const handlerPath = handlerPathname(config, url)
    const rewrittenFile = rewrittenFilePath(config, request)
    try {
      if (rewrittenFile !== undefined) {
        const backendUrl = new URL(url)
        backendUrl.pathname = handlerPath
        backendUrl.searchParams.set('file', rewrittenFile)
        backendUrl.searchParams.set('delivery', 'proxy')
        return await handleBackend(new Request(backendUrl, request), context)
      }
      // Frameworks without a rewrite for the dashboard land here
      if (url.pathname === Config.adminPath(config))
        return new Response('Redirecting...', {
          status: 302,
          headers: {location: `/${Config.dashboardFile(config)}${url.search}`}
        })
      if (url.pathname !== handlerPath)
        return new Response(`Expected handler to be served on ${handlerPath}`, {
          status: 400
        })
      const {searchParams} = url
      const previews = new JWTPreviews(context.apiKey)
      const previewToken = searchParams.get('preview')
      if (previewToken) {
        const draft = host.forRequest(request)
        // The token bootstraps draft mode. Once its cookie is present, the
        // browser session no longer depends on the short-lived token.
        if (!(await draft.isDraft())) await previews.verify(previewToken)
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
        const response = new Response('Redirecting...', {
          status: 302,
          headers: {location: String(location)}
        })
        await draft.enableDraft(response.headers)
        return response
      }
      return await handleBackend(request, context)
    } catch (error) {
      console.error(error)
      return new Response('Internal server error', {status: 500})
    }
  }
  return handle
}

/** Whether the handler answers this request: the API, files or dashboard. */
export function isAlineaRoute(config: Config, request: Request): boolean {
  const url = new URL(request.url)
  return (
    url.pathname === handlerPathname(config, url) ||
    url.pathname === Config.adminPath(config) ||
    rewrittenFilePath(config, request) !== undefined
  )
}

export function handlerPathname(config: Config, requestUrl: URL): string {
  return new URL(Config.handlerUrl(config), requestUrl).pathname
}

export function rewrittenFilePath(
  config: Config,
  request: Request
): string | undefined {
  if (request.method !== 'GET' && request.method !== 'HEAD') return
  const url = new URL(request.url)
  const fileRoot = new URL(Config.filePathname(config, ''), url).pathname
  const prefix = `${fileRoot}/`
  if (!url.pathname.startsWith(prefix)) return
  try {
    return decodeURIComponent(url.pathname.slice(prefix.length))
  } catch {
    return
  }
}
