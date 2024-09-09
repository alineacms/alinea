import {Headers} from '@alinea/iso'
import {AuthenticateRequest, Client} from 'alinea/core/Client'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {outcome} from 'alinea/core/Outcome'
import {ResolveDefaults} from 'alinea/core/Resolver'
import {User} from 'alinea/core/User'
import {getPreviewPayloadFromCookies} from 'alinea/preview/PreviewCookies'
import {defaultContext} from './context.js'

export interface PreviewProps {
  widget?: boolean
  workspace?: string
  root?: string
}

const devUrl = process.env.ALINEA_DEV_SERVER

async function requestHeaders(): Promise<Headers> {
  try {
    const {getExpectedRequestStore} = await import(
      'next/dist/client/components/request-async-storage.external.js'
    )
    return getExpectedRequestStore('headers').headers
  } catch {
    return new Headers()
  }
}

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  constructor(config: Definition, public baseUrl?: string) {
    super(config, async () => {
      const context = await defaultContext
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
      const payload = getPreviewPayloadFromCookies(cookie.getAll())
      if (payload) resolveDefaults.preview = {payload}
      return new Client({
        url: clientUrl.href,
        applyAuth,
        resolveDefaults
      })
    })
  }

  async #clientUrl() {
    const origin = async () => {
      const headers = await requestHeaders()
      const host = headers.get('x-forwarded-host') ?? headers.get('host')
      const proto = headers.get('x-forwarded-proto') ?? 'https'
      const protocol = proto.endsWith(':') ? proto : proto + ':'
      return `${protocol}//${host}`
    }
    return devUrl
      ? new URL('/api', devUrl)
      : new URL(
          this.config.handlerUrl ?? '/api/cms',
          this.baseUrl ?? (await origin())
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
    const clientUrl = await this.#clientUrl()
    const dashboardUrl =
      devUrl ??
      new URL(this.config.dashboardFile ?? '/admin.html', clientUrl).href
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
  const baseUrl = process.env.ALINEA_BASE_URL ?? Config.baseUrl(config)
  return new NextCMS(config, baseUrl)
}
