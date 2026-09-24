import {requestContext} from '#/adapter/core/context.js'
import {type OpenBundledDatabase, ServerCMS} from '#/adapter/core/ServerCMS.js'
import {Config} from '#/core/Config.js'
import {nextHost} from './host.js'

export type {SyncStatus} from '#/adapter/core/ServerCMS.js'

export interface PreviewProps {
  widget?: boolean
  /** Show the queries and syncs of each draft render in the widget */
  stats?: boolean
  workspace?: string
  root?: string
}

export class NextCMS<
  Definition extends Config = Config
> extends ServerCMS<Definition> {
  constructor(config: Definition, openBundledDatabase?: OpenBundledDatabase) {
    super(config, nextHost, openBundledDatabase)
  }

  previews = async ({
    widget,
    stats: showStats,
    workspace,
    root
  }: PreviewProps) => {
    const stats = await this.renderStats()
    if (!stats) return null
    const {default: dynamic} = await import('next/dynamic.js')
    const {isDev, handlerUrl} = await requestContext(this.config)
    let file = `${Config.adminPath(this.config)}.html`
    if (!file.startsWith('/')) file = `/${file}`
    const dashboardUrl = isDev
      ? new URL('/', handlerUrl)
      : new URL(file, handlerUrl)
    const NextPreviews = dynamic(() => import('./previews.js'), {
      ssr: false
    })
    return (
      <NextPreviews
        dashboardUrl={dashboardUrl.href}
        widget={widget}
        stats={widget && showStats ? stats.settled() : undefined}
        workspace={workspace}
        root={root}
      />
    )
  }
}

export function createCMS<Definition extends Config>(
  config: Definition
): NextCMS<Definition> {
  return new NextCMS(config)
}
