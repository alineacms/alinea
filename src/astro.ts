// Create the CMS with createCMS from alinea/server: the Alinea CLI bundles
// cms.ts for the dashboard and replaces that import with a browser build.
export {alinea, type AstroIntegration} from '#/adapter/astro/integration.js'
export {
  type AstroMiddleware,
  type AstroMiddlewareContext,
  createMiddleware
} from '#/adapter/astro/middleware.js'
export type {
  MiddlewareOptions,
  PreviewsOptions
} from '#/adapter/server/Middleware.js'
