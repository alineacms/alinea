import {Config} from '#/core/Config.js'

/**
 * The dashboard as the site serves it: in development the site proxies the
 * admin path to the dev server, in production it serves the generated file.
 */
export function dashboardUrl(
  config: Config,
  isDev: boolean,
  handlerUrl: URL | string
): string {
  if (!isDev)
    return new URL(`/${Config.dashboardFile(config)}`, handlerUrl).href
  const adminPath = Config.adminPath(config)
  return adminPath.startsWith('/') ? adminPath : `/${adminPath}`
}
