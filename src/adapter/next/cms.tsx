import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {AuthenticateRequest, Client} from 'alinea/core/Client'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {outcome} from 'alinea/core/Outcome'
import {ResolveDefaults} from 'alinea/core/Resolver'
import {User} from 'alinea/core/User'
import {alineaCookies} from 'alinea/preview/AlineaCookies'
import {parseChunkedCookies} from 'alinea/preview/ChunkCookieValue'
import {defaultContext} from './context.js'

export interface PreviewProps {
  widget?: boolean
  workspace?: string
  root?: string
}

const devUrl = process.env.ALINEA_DEV_SERVER

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  constructor(config: Definition, public baseUrl?: string) {
    super(config, async () => {
      const context = defaultContext
      const resolveDefaults: ResolveDefaults = {}
      const {cookies, draftMode} = await import('next/headers.js')
      const [isDraft] = outcome(() => draftMode().isEnabled)
      const applyAuth: AuthenticateRequest = init => {
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${context.apiKey}`)
        return {...init, headers}
      }
      const clientUrl = await this.#clientUrl()
      if (!isDraft) return new Client({url: clientUrl.href, applyAuth})
      const cookie = cookies()
      const previewToken = cookie.get(alineaCookies.previewToken)?.value
      if (previewToken) {
        const update = parseChunkedCookies(
          alineaCookies.update,
          cookie.getAll()
        )
        const previews = new JWTPreviews(context.apiKey)
        const info = await previews.verify(previewToken)
        resolveDefaults.preview = {...info, update}
      }
      return new Client({
        url: clientUrl.href,
        applyAuth,
        resolveDefaults
      })
    })
  }

  async #clientUrl() {
    const {headers} = await import('next/headers.js')
    const origin = () => {
      const host = headers().get('x-forwarded-host') ?? headers().get('host')
      const proto = headers().get('x-forwarded-proto') ?? 'https'
      const protocol = proto.endsWith(':') ? proto : proto + ':'
      return `${protocol}//${host}`
    }
    return devUrl
      ? new URL('/api', devUrl)
      : new URL(
          this.config.apiUrl ?? this.config.dashboard?.handlerUrl ?? '/api/cms',
          this.baseUrl ?? origin()
        )
  }

  async user(): Promise<User | undefined> {
    const {cookies} = await import('next/headers.js')
    const clientUrl = await this.#clientUrl()
    const client = new Client({
      url: clientUrl.href,
      applyAuth: init => {
        const headers = new Headers(init?.headers)
        const cookie = cookies()
        const alinea = cookie
          .getAll()
          .filter(({name}) => name.startsWith('alinea'))
        for (const {name, value} of alinea)
          headers.append('cookie', `${name}=${value}`)
        return {...init, headers}
      }
    })
    return client.user()
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
