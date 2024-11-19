import {Headers} from '@alinea/iso'
import {Database} from 'alinea/backend/Database'
import {createPreviewParser} from 'alinea/backend/resolver/ParsePreview'
import {Client} from 'alinea/core/Client'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {GraphQuery} from 'alinea/core/Graph'
import {outcome} from 'alinea/core/Outcome'
import {PreviewRequest} from 'alinea/core/Preview'
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
  constructor(rawConfig: Definition, public baseUrl?: string) {
    let lastSync = 0
    const init = PLazy.from(async () => {
      if (process.env.NEXT_RUNTIME === 'edge') throw 'assert'
      const {generatedStore} = await import(
        'alinea/backend/store/GeneratedStore'
      )
      const store = await generatedStore
      const db = new Database(this.config, store)
      const previews = createPreviewParser(db)
      return {db, previews}
    })
    super(rawConfig, async () => {
      const context = await requestContext(this.config)
      const client = new Client({
        config: this.config,
        url: context.handlerUrl.href,
        applyAuth(init) {
          const headers = new Headers(init?.headers)
          headers.set('Authorization', `Bearer ${context.apiKey}`)
          return {...init, headers}
        }
      })
      const clientResolve = client.resolve.bind(client)
      return assign(client, {
        async resolve(params: GraphQuery) {
          const isDev = Boolean(devUrl())
          let preview: PreviewRequest | undefined
          const {cookies, draftMode} = await import('next/headers')
          const [isDraft] = await outcome(
            async () => (await draftMode()).isEnabled
          )
          if (isDraft) {
            const cookie = await cookies()
            const payload = getPreviewPayloadFromCookies(cookie.getAll())
            if (payload) preview = {payload}
          }
          if (process.env.NEXT_RUNTIME === 'edge' || isDev)
            return clientResolve({preview, ...params})
          const {PHASE_PRODUCTION_BUILD} = await import('next/constants')
          const isBuild = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
          const {db, previews} = await init
          const sync = () => db.syncWith(client)
          if (!isBuild) {
            if (preview) {
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
    const {cookies} = await import('next/headers')
    const context = await requestContext(this.config)
    const cookie = await cookies()
    const client = new Client({
      config: this.config,
      url: context.handlerUrl.href,
      applyAuth: init => {
        const headers = new Headers(init?.headers)
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
    const {draftMode} = await import('next/headers')
    const {default: dynamic} = await import('next/dynamic')
    const [isDraft] = await outcome(async () => (await draftMode()).isEnabled)
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
