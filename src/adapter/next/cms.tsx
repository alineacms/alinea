import {type OpenBundledDatabase, ServerCMS} from '#/adapter/core/ServerCMS.js'
import type {Config} from '#/core/Config.js'
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
    const info = await this.previewInfo()
    if (!info) return null
    const {default: dynamic} = await import('next/dynamic.js')
    const NextPreviews = dynamic(() => import('./previews.js'), {
      ssr: false
    })
    return (
      <NextPreviews
        dashboardUrl={info.dashboardUrl}
        widget={widget}
        stats={widget && showStats ? info.stats.settled() : undefined}
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
