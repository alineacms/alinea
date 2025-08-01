import {Headers} from '@alinea/iso'
import {Client} from 'alinea/core/Client'
import {CMS} from 'alinea/core/CMS'
import type {Config} from 'alinea/core/Config'
import type {UploadResponse} from 'alinea/core/Connection'
import type {Mutation} from 'alinea/core/db/Mutation'
import type {GraphQuery} from 'alinea/core/Graph'
import {outcome} from 'alinea/core/Outcome'
import type {PreviewRequest} from 'alinea/core/Preview'
import type {User} from 'alinea/core/User'
import {getPreviewPayloadFromCookies} from 'alinea/preview/PreviewCookies'
import {requestContext} from './context.js'

export interface PreviewProps {
  widget?: boolean
  workspace?: string
  root?: string
}

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  constructor(config: Definition) {
    super(config)
  }

  async resolve<Query extends GraphQuery>(query: Query): Promise<any> {
    let status = query.status
    const {handlerUrl, apiKey} = await requestContext(this.config)
    const client = new Client({
      config: this.config,
      url: handlerUrl.href,
      applyAuth: init => {
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${apiKey}`)
        return {...init, headers}
      }
    })
    let preview: PreviewRequest | undefined
    const {cookies, draftMode} = await import('next/headers')
    const [isDraft] = await outcome(async () => (await draftMode()).isEnabled)
    if (isDraft) {
      if (!status) status = 'preferDraft'
      const cookie = await cookies()
      const payload = getPreviewPayloadFromCookies(cookie.getAll())
      if (payload) preview = {payload}
    }
    return client.resolve({preview, ...query, status})
  }

  async #authenticatedClient() {
    const {handlerUrl, apiKey} = await requestContext(this.config)
    const authCookies: Array<[name: string, value: string]> = []
    try {
      const {cookies} = await import('next/headers')
      const cookie = await cookies()
      for (const {name, value} of cookie.getAll()) {
        if (name.startsWith('alinea.')) {
          authCookies.push([name, value])
        }
      }
    } catch {}
    return new Client({
      config: this.config,
      url: handlerUrl.href,
      applyAuth: init => {
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${apiKey}`)
        if (authCookies.length) {
          for (const [name, value] of authCookies) {
            headers.append('Cookie', `${name}=${value}`)
          }
        }
        return {...init, headers}
      }
    })
  }

  async user(): Promise<User | undefined> {
    const client = await this.#authenticatedClient()
    return client.user()
  }

  async mutate(mutations: Array<Mutation>): Promise<{sha: string}> {
    const client = await this.#authenticatedClient()
    return client.mutate(mutations)
  }

  async prepareUpload(file: string): Promise<UploadResponse> {
    const client = await this.#authenticatedClient()
    return client.prepareUpload(file)
  }

  previews = async ({widget, workspace, root}: PreviewProps) => {
    const {draftMode} = await import('next/headers')
    const {default: dynamic} = await import('next/dynamic')
    const [isDraft] = await outcome(async () => (await draftMode()).isEnabled)
    if (!isDraft) return null
    const {isDev, handlerUrl} = await requestContext(this.config)
    let file = this.config.dashboardFile ?? '/admin.html'
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
