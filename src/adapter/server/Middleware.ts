import {devProxy} from '#/adapter/core/DevProxy.js'
import {type PreviewInfo, ServerCMS} from '#/adapter/core/ServerCMS.js'
import {
  isAlineaRoute,
  type ServerHandlerOptions
} from '#/adapter/core/ServerHandler.js'
import {Config} from '#/core/Config.js'
import escapeHtml from 'escape-html'
import {createHandler} from './node.js'
import {withRequest} from './RequestHost.js'

/**
 * Handles a request, or passes it on to the framework with `next`. This is
 * the shape of most framework middleware (Astro, Hono, SvelteKit's handle).
 */
export type Middleware = (
  request: Request,
  next: () => Response | Promise<Response>
) => Promise<Response>

export interface PreviewsOptions {
  /** Show the preview widget on draft pages, defaults to false. */
  widget?: boolean
  /** Show the queries and syncs of each draft render in the widget. */
  stats?: boolean
  workspace?: string
  root?: string
}

export interface MiddlewareOptions extends ServerHandlerOptions {
  /** Live previews on draft pages, enabled by default. */
  previews?: PreviewsOptions | false
}

/**
 * Serves the Alinea handler, dashboard and files, and runs every other
 * request inside `withRequest` so queries see its drafts. Draft pages get
 * the previews client, which refreshes them while content is edited.
 */
export function createMiddleware(
  input: ServerCMS | MiddlewareOptions
): Middleware {
  const {previews = {}, ...options}: MiddlewareOptions =
    input instanceof ServerCMS ? {cms: input} : input
  const {cms} = options
  const handle = createHandler(options)
  return async (request, next) => {
    const proxied = devProxy(request)
    if (proxied) return proxied
    if (isAlineaRoute(cms.config, request)) return handle(request)
    return withRequest(request, async () => {
      const response = await next()
      if (!previews) return response
      const type = response.headers.get('content-type')
      if (!type?.startsWith('text/html')) return response
      if (response.headers.has('content-encoding')) return response
      const info = await cms.previewInfo()
      if (!info) return response
      // Read the page first: stats settle once its render finished
      const html = await response.text()
      const script = await previewsScript(cms.config, info, previews)
      return replaceBody(response, insertBeforeBodyEnd(html, script))
    })
  }
}

async function previewsScript(
  config: Config,
  info: PreviewInfo,
  {widget, stats, workspace, root}: PreviewsOptions
): Promise<string> {
  const attributes: Record<string, string | undefined> = {
    src: `${Config.adminPath(config)}/previews.js`,
    'data-dashboard-url': info.dashboardUrl,
    'data-widget': widget ? '' : undefined,
    'data-stats':
      widget && stats ? JSON.stringify(await info.stats.settled()) : undefined,
    'data-workspace': workspace,
    'data-root': root
  }
  let tag = '<script'
  for (const [name, value] of Object.entries(attributes))
    if (value !== undefined) tag += ` ${name}="${escapeHtml(value)}"`
  return `${tag} defer></script>`
}

function insertBeforeBodyEnd(html: string, script: string): string {
  const index = html.lastIndexOf('</body>')
  if (index === -1) return html + script
  return html.slice(0, index) + script + html.slice(index)
}

function replaceBody(response: Response, body: string): Response {
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
