import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {Client} from 'alinea/core/Client'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {outcome} from 'alinea/core/Outcome'
import {ResolveDefaults} from 'alinea/core/Resolver'
import {alineaCookies} from 'alinea/preview/AlineaCookies'
import {parseChunkedCookies} from 'alinea/preview/ChunkCookieValue'
import {createHandler} from './NextHandler.js'

export interface PreviewProps {
  widget?: boolean
  workspace?: string
  root?: string
}

const devUrl = process.env.ALINEA_DEV_SERVER

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  jwt = new JWTPreviews(process.env.ALINEA_API_KEY ?? 'dev')

  constructor(config: Definition, public baseUrl: string) {
    const clientUrl =
      devUrl ??
      new URL(
        config.apiUrl ?? config.dashboard?.handlerUrl ?? '/api/cms',
        baseUrl
      ).href
    const client = new Client({url: clientUrl})
    super(config, async () => {
      const resolveDefaults: ResolveDefaults = {}
      const {cookies, draftMode} = await import('next/headers.js')
      const [isDraft] = outcome(() => draftMode().isEnabled)
      if (!isDraft) return client
      const cookie = cookies()
      const previewToken = cookie.get(alineaCookies.previewToken)?.value
      if (previewToken) {
        const update = parseChunkedCookies(
          alineaCookies.update,
          cookie.getAll()
        )
        const info = await this.jwt.verify(previewToken)
        resolveDefaults.preview = {...info, update}
      }
      return new Client({
        url: clientUrl,
        resolveDefaults
      })
    })
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
    const dashboardUrl =
      devUrl ??
      new URL(
        this.config.dashboardFile ??
          this.config.dashboard?.dashboardUrl ??
          '/admin.html',
        this.baseUrl
      ).href
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
  return new NextCMS(
    config,
    process.env.ALINEA_BASE_URL ?? config.baseUrl ?? 'http://localhost:3000'
  )
}
