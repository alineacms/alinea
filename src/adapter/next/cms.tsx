import {Headers} from '@alinea/iso'
import {Database} from 'alinea/backend/Database'
import {createPreviewParser} from 'alinea/backend/resolver/ParsePreview'
import {generatedStore} from 'alinea/backend/store/GeneratedStore'
import {Client} from 'alinea/core/Client'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {outcome} from 'alinea/core/Outcome'
import {PreviewRequest, ResolveParams} from 'alinea/core/Resolver'
import {User} from 'alinea/core/User'
import {assign} from 'alinea/core/util/Objects'
import {getPreviewPayloadFromCookies} from 'alinea/preview/PreviewCookies'
import PLazy from 'p-lazy'
import {devUrl, requestContext} from './context.js'

export interface PreviewProps {
  widget?: boolean
  workspace?: string
  root?: string
}

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  constructor(config: Definition, public baseUrl?: string) {
    let lastSync = 0
    const database = PLazy.from(() =>
      generatedStore.then(store => new Database(this.config, store))
    )
    const previewParser = PLazy.from(() => database.then(createPreviewParser))
    super(config, async () => {
      const context = await requestContext(config)
      const client = new Client({
        url: context.handlerUrl.href,
        applyAuth(init) {
          const headers = new Headers(init?.headers)
          headers.set('Authorization', `Bearer ${context.apiKey}`)
          return {...init, headers}
        }
      })
      const clientResolve = client.resolve.bind(client)
      const sync = () => database.then(db => db.syncWith(client))
      return assign(client, {
        async resolve(params: ResolveParams) {
          const isDev = Boolean(devUrl())
          let preview: PreviewRequest | undefined
          const {cookies, draftMode} = await import('next/headers.js')
          const [isDraft] = outcome(() => draftMode().isEnabled)
          if (isDraft) {
            const cookie = cookies()
            const payload = getPreviewPayloadFromCookies(cookie.getAll())
            if (payload) preview = {payload}
          }
          if (isDev) return clientResolve({preview, ...params})
          const {PHASE_PRODUCTION_BUILD} = await import('next/constants.js')
          const isBuild = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
          const db = await database
          if (!isBuild) {
            if (preview) {
              const previews = await previewParser
              preview = await previews.parse(
                preview,
                sync,
                client.getDraft.bind(client)
              )
            } else {
              const syncInterval = params.syncInterval ?? 60
              const now = Date.now()
              if (now - lastSync >= syncInterval * 1000) {
                lastSync = now
                await sync()
              }
            }
          }
          return db.resolver.resolve({preview, ...params})
        }
      })
    })
  }

  async user(): Promise<User | undefined> {
    const {cookies} = await import('next/headers.js')
    const context = await requestContext(this.config)
    const client = new Client({
      url: context.handlerUrl.href,
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
    const context = await requestContext(this.config)
    let file = this.config.dashboardFile ?? '/admin.html'
    if (!file.startsWith('/')) file = `/${file}`
    const dashboardUrl = devUrl() ?? new URL(file, context.handlerUrl).href
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
