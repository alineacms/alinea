import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {AuthenticateRequest, Client} from 'alinea/core/Client'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {outcome} from 'alinea/core/Outcome'
import {ResolveDefaults} from 'alinea/core/Resolver'
import {alineaCookies} from 'alinea/preview/AlineaCookies'
import {parseChunkedCookies} from 'alinea/preview/ChunkCookieValue'
import {createHandler} from './handler.js'

export interface PreviewProps {
  widget?: boolean
  workspace?: string
  root?: string
}

const devUrl = process.env.ALINEA_DEV_SERVER
const apiKey = process.env.ALINEA_API_KEY ?? 'dev'

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  jwt = new JWTPreviews(apiKey)

  constructor(config: Definition, public baseUrl?: string) {
    super(config, async () => {
      const resolveDefaults: ResolveDefaults = {}
      const {cookies, headers, draftMode} = await import('next/headers.js')
      const [isDraft] = outcome(() => draftMode().isEnabled)
      const origin = () => {
        const host = headers().get('x-forwarded-host') ?? headers().get('host')
        const proto = headers().get('x-forwarded-proto') ?? 'https'
        const protocol = proto.endsWith(':') ? proto : proto + ':'
        return `${protocol}//${host}`
      }
      const applyAuth: AuthenticateRequest = init => {
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${apiKey}`)
        return {...init, headers}
      }
      const clientUrl =
        devUrl ??
        new URL(
          config.apiUrl ?? config.dashboard?.handlerUrl ?? '/api/cms',
          baseUrl ?? origin()
        ).href
      if (!isDraft) return new Client({url: clientUrl, applyAuth})
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
        applyAuth,
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
    const NextPreviews = dynamic(() => import('./previews.js'), {
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
  const baseUrl =
    process.env.ALINEA_BASE_URL ??
    (typeof config.baseUrl === 'object'
      ? config.baseUrl[process.env.NODE_ENV as 'development' | 'production']
      : config.baseUrl)
  return new NextCMS(config, baseUrl)
}
