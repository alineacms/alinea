import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {Client} from 'alinea/core/Client'
import {CMS, ConnectionContext} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {outcome} from 'alinea/core/Outcome'
import {alineaCookies} from 'alinea/preview/AlineaCookies'
import {parseChunkedCookies} from 'alinea/preview/ChunkCookieValue'
import {createHandler} from './NextHandler.js'

export interface PreviewProps {
  widget?: boolean
  workspace?: string
  root?: string
}

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  async getContext() {
    const apiKey = process.env.ALINEA_API_KEY
    const context: ConnectionContext = {apiKey}
    const {cookies, draftMode} = await import('next/headers.js')
    const [isDraft] = outcome(() => draftMode().isEnabled)
    if (!isDraft) return context
    const cookie = cookies()
    const previewToken = cookie.get(alineaCookies.previewToken)?.value
    if (previewToken) {
      const update = parseChunkedCookies(alineaCookies.update, cookie.getAll())
      const previews = new JWTPreviews(context.apiKey ?? 'dev')
      const info = await previews.verify(previewToken)
      context.preview = {...info, update}
    }
    return context
  }

  /** @deprecated Use the createHandler function from 'alinea/next' */
  get backendHandler() {
    return createHandler(this)
  }

  /** @deprecated Use the createHandler function from 'alinea/next' */
  get previewHandler() {
    return createHandler(this)
  }

  previews = async ({widget, workspace, root}: PreviewProps) => {
    const {draftMode} = await import('next/headers.js')
    const {default: dynamic} = await import('next/dynamic.js')
    const [isDraft] = outcome(() => draftMode().isEnabled)
    if (!isDraft) return null
    const devUrl = process.env.ALINEA_DEV_SERVER
    const dashboardUrl =
      devUrl ?? this.config.dashboard?.dashboardUrl ?? '/admin.html'
    const NextPreviews = dynamic(() => import('./NextPreviews.js'), {
      ssr: false
    })
    return (
      <NextPreviews
        dashboardUrl={dashboardUrl}
        widget={widget}
        workspace={workspace}
        root={root}
      />
    )
  }
}

export function createCMS<Definition extends Config>(
  config: Definition
): NextCMS<Definition> {
  const devUrl = process.env.ALINEA_DEV_SERVER
  const url = devUrl ?? config.dashboard?.handlerUrl ?? '/api/cms'
  return new NextCMS(config, new Client({url}))
}
