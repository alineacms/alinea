import type {ServerCMS} from '#/adapter/core/ServerCMS.js'
import {
  createMiddleware as createServerMiddleware,
  type MiddlewareOptions
} from '#/adapter/server/Middleware.js'

/** The part of Astro's middleware context Alinea reads. */
export interface AstroMiddlewareContext {
  request: Request
  isPrerendered: boolean
}

/** An Astro `onRequest` handler, which can be combined with `sequence`. */
export type AstroMiddleware = (
  context: AstroMiddlewareContext,
  next: () => Promise<Response>
) => Promise<Response>

/**
 * Serves the Alinea handler, dashboard and files, and renders pages within
 * their request so queries see drafts. Export it as `onRequest` from
 * `src/middleware.ts`.
 */
export function createMiddleware(
  input: ServerCMS | MiddlewareOptions
): AstroMiddleware {
  const middleware = createServerMiddleware(input)
  return (context, next) => {
    // Prerendered pages have no request headers to find drafts in
    if (context.isPrerendered) return next()
    return middleware(context.request, () => next())
  }
}
