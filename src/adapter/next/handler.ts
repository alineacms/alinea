import {
  backendFromOptions,
  type BackendFactory,
  type BackendOptions
} from '#/backend/api/CreateBackend.js'
import {
  createHandler as createCoreHandler,
  type HandlerHooks
} from '#/backend/Handler.js'
import {HandleAction} from '#/backend/HandleAction.js'
import {JWTPreviews} from '#/backend/util/JWTPreviews.js'
import {CloudRemote} from '#/cloud/CloudRemote.js'
import {Client} from '#/core/Client.js'
import {Config} from '#/core/Config.js'
import {
  developmentKeyHeader,
  forwardedMutationHeader,
  type RequestContext
} from '#/core/Connection.js'
import {HttpError} from '#/core/HttpError.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {trace} from '#/core/Trace.js'
import PLazy from 'p-lazy'
import {NextCMS} from './cms.js'
import {requestContext} from './context.js'
import {revalidateContentSha} from './syncCheck.js'

type Handler = (request: Request) => Promise<Response>

export interface NextHandlerOptions extends HandlerHooks {
  cms: NextCMS
  backend?: BackendFactory | BackendOptions
}

export type OpenGeneratedDatabase = (config: Config) => Promise<LocalStore>

export function createHandlerWithDatabase(
  input: NextCMS | NextHandlerOptions,
  openGeneratedDatabase?: OpenGeneratedDatabase
): Handler {
  const options = input instanceof NextCMS ? {cms: input} : input
  const config = options.cms.config
  const backend: BackendFactory =
    typeof options.backend === 'function'
      ? options.backend
      : options.backend
        ? backendFromOptions(options.backend)
        : (context: RequestContext) => new CloudRemote(context, config)
  const remote = (context: RequestContext) => backend(context, config)
  const span = trace(config, 'alinea.next.handler.db')
  const db = PLazy.from(() =>
    span(async () => {
      if (process.env.NEXT_RUNTIME === 'edge')
        throw new Error(
          'The Alinea handler is not supported in Edge runtime environments.'
        )
      if (!openGeneratedDatabase)
        throw new Error(
          "A generated database loader is required. Import createHandler from 'alinea/next'."
        )
      return openGeneratedDatabase(config)
    })
  )
  // Revalidate the shared content sha before the user-provided hook so page
  // revalidation triggered there already sees the fresh sha when RSC renders
  // resolve. Invalidation never throws (failures are swallowed inside
  // revalidateContentSha).
  const afterCommit: NonNullable<
    HandlerHooks['afterCommit']
  > = async context => {
    await revalidateContentSha()
    await options.afterCommit?.(context)
  }
  const handleBackend = createCoreHandler({
    ...options,
    remote,
    db,
    afterCommit
  })

  /**
   * During development the dev server owns the database and answers the
   * dashboard. It forwards mutations here only to run this app's commit
   * hooks around them, and commits them itself.
   */
  async function handleDevelopment(
    request: Request,
    context: RequestContext
  ): Promise<Response> {
    const action = new URL(request.url).searchParams.get('action')
    if (action !== HandleAction.Mutate || request.method !== 'POST')
      return failure(404, 'Answered by the Alinea dev server')
    const developmentKey = request.headers.get(developmentKeyHeader)
    if (!context.apiKey || developmentKey !== context.apiKey)
      return failure(401, 'Invalid development credentials')
    let mutations: Array<Mutation>
    try {
      mutations = await request.json()
    } catch {
      return failure(400, 'Expected JSON')
    }
    if (!Array.isArray(mutations)) return failure(400, 'Expected mutations')
    const adjusted = await options.beforeCommit?.({mutations})
    if (adjusted) mutations = [...adjusted]
    const devServer = new Client({
      config,
      url: context.handlerUrl.href,
      applyAuth(init) {
        const authorized = context.applyAuth?.(init) ?? init ?? {}
        const headers = new Headers(authorized.headers)
        // The dev server commits these itself instead of forwarding them.
        headers.set(forwardedMutationHeader, 'true')
        return {...authorized, headers}
      }
    })
    let sha: string
    try {
      ;({sha} = await devServer.mutate(mutations))
    } catch (error) {
      // Report what the dev server rejected, such as a missing permission.
      if (error instanceof HttpError) return failure(error.code, error.message)
      throw error
    }
    try {
      await afterCommit({mutations, sha})
    } catch (error) {
      console.error('Alinea afterCommit hook failed', error)
    }
    return Response.json({sha})
  }
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
        if (context.isDev) {
          // The dev server serves media from the database it owns.
          const devUrl = new URL(context.handlerUrl)
          devUrl.search = backendUrl.search
          return Response.redirect(devUrl, 307)
        }
        return await handleBackend(new Request(backendUrl, request), context)
      }
      if (url.pathname !== handlerPath)
        return new Response(`Expected handler to be served on ${handlerPath}`, {
          status: 400
        })
      const {searchParams} = url
      const previews = new JWTPreviews(context.apiKey)
      const previewToken = searchParams.get('preview')
      if (previewToken) {
        const {draftMode} = await import('next/headers')
        const dm = await draftMode()
        // The token bootstraps draft mode. Once its cookie is present, the
        // browser session no longer depends on the short-lived token.
        if (!dm.isEnabled) await previews.verify(previewToken)
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
        dm.enable()
        return new Response('Redirecting...', {
          status: 302,
          headers: {location: String(location)}
        })
      }
      if (context.isDev) return await handleDevelopment(request, context)
      return await handleBackend(request, context)
    } catch (error) {
      console.error(error)
      return new Response('Internal server error', {status: 500})
    }
  }
  return handle
}

/** An error response in the shape the core handler answers with. */
function failure(status: number, error: string): Response {
  return Response.json({success: false, error}, {status})
}

export function handlerPathname(config: Config, requestUrl: URL): string {
  return new URL(Config.handlerUrl(config), requestUrl).pathname
}

function rewrittenFilePath(
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

/** A handler without a generated database, as used in the Edge runtime. */
export function createHandler(input: NextCMS | NextHandlerOptions): Handler {
  return createHandlerWithDatabase(input)
}
