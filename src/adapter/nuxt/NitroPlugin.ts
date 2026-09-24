import {devProxy} from '#/adapter/core/DevProxy.js'
import {ServerCMS} from '#/adapter/core/ServerCMS.js'
import {type Handler, isAlineaRoute} from '#/adapter/core/ServerHandler.js'
import {
  type MiddlewareOptions,
  type PreviewsOptions,
  previewsScript
} from '#/adapter/server/Middleware.js'
import {createHandler} from '#/adapter/server/node.js'
import {withRequest} from '#/adapter/server/RequestHost.js'
import {fromNodeRequest, respondTo} from '#/backend/router/NodeHandler.js'
import type {IncomingMessage, ServerResponse} from 'node:http'

/** The parts of an h3 event the plugin reads. */
export interface NitroEvent {
  node: {req: IncomingMessage; res: ServerResponse}
}

/** The html Nuxt renders, passed to its `render:html` hook. */
export interface NuxtRenderHtml {
  bodyAppend: Array<string>
}

/** The parts of the Nitro app the plugin uses. */
export interface NitroApp {
  h3App: {handler(event: NitroEvent): Promise<unknown>}
  hooks: {
    hook(
      name: 'render:html',
      callback: (html: NuxtRenderHtml) => Promise<void>
    ): unknown
  }
}

export type NitroPlugin = (nitroApp: NitroApp) => void

interface Alinea {
  cms: ServerCMS
  handle: Handler
  previews: PreviewsOptions | false
}

// The last plugin configures the app, so a plugin of the app itself
// replaces the one the Nuxt module adds.
const configured = new WeakMap<NitroApp, Alinea>()

/**
 * A Nitro plugin that serves the Alinea handler, dashboard and files, and
 * renders every other request inside `withRequest` so queries see its
 * drafts. Draft pages get the previews client. The `alinea/nuxt` module adds
 * it for the `cms` exported from `cms.ts`; add it as a server plugin of your
 * own to pass handler options such as a custom backend.
 */
export function createNitroPlugin(
  input: ServerCMS | MiddlewareOptions
): NitroPlugin {
  const {previews = {}, ...options}: MiddlewareOptions =
    input instanceof ServerCMS ? {cms: input} : input
  const alinea: Alinea = {
    cms: options.cms,
    handle: createHandler(options),
    previews
  }
  return nitroApp => {
    const isInstalled = configured.has(nitroApp)
    configured.set(nitroApp, alinea)
    if (isInstalled) return
    const current = () => configured.get(nitroApp) ?? alinea
    // Nitro has no middleware that wraps the render, so wrap the app the way
    // Nitro's own async context does.
    const {h3App} = nitroApp
    const render = h3App.handler
    h3App.handler = async event => {
      const {cms, handle} = current()
      const request = fromNodeRequest(event.node.req)
      const response =
        devProxy(request) ??
        (isAlineaRoute(cms.config, request) ? handle(request) : undefined)
      if (response) return respondTo(event.node.res, await response)
      return withRequest(request, () => render(event))
    }
    nitroApp.hooks.hook('render:html', async html => {
      const {cms, previews} = current()
      if (!previews) return
      const info = await cms.previewInfo()
      if (!info) return
      html.bodyAppend.push(await previewsScript(cms.config, info, previews))
    })
  }
}
