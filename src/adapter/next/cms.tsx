import {Headers} from '@alinea/iso'
import {createPreviewParser} from 'alinea/backend/resolver/ParsePreview'
import {generatedSource} from 'alinea/backend/store/GeneratedSource.js'
import {COOKIE_NAME} from 'alinea/cloud/CloudBackend'
import {CMS} from 'alinea/core/CMS'
import {Client} from 'alinea/core/Client'
import type {Config} from 'alinea/core/Config'
import type {UploadResponse} from 'alinea/core/Connection.js'
import type {GraphQuery} from 'alinea/core/Graph'
import {outcome} from 'alinea/core/Outcome'
import type {PreviewRequest} from 'alinea/core/Preview'
import type {User} from 'alinea/core/User'
import {LocalDB} from 'alinea/core/db/LocalDB.js'
import type {Mutation} from 'alinea/core/db/Mutation.js'
import {getPreviewPayloadFromCookies} from 'alinea/preview/PreviewCookies'
import PLazy from 'p-lazy'
import {requestContext} from './context.js'

export interface PreviewProps {
  widget?: boolean
  workspace?: string
  root?: string
}

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  lastSync = 0

  db = PLazy.from(async () => {
    if (process.env.NEXT_RUNTIME === 'edge')
      throw new Error('Local db not availble in edge')
    const source = await generatedSource
    const db = new LocalDB(this.config, source)
    await db.sync()
    return db
  })

  init = PLazy.from(async () => {
    const db = await this.db
    const previews = createPreviewParser(db)
    return {db, previews}
  })

  constructor(config: Definition) {
    super(config)
  }

  async resolve<Query extends GraphQuery>(query: Query): Promise<any> {
    const {isDev, handlerUrl, apiKey} = await requestContext(this.config)
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
      const cookie = await cookies()
      const payload = getPreviewPayloadFromCookies(cookie.getAll())
      if (payload) preview = {payload}
    }
    if (process.env.NEXT_RUNTIME === 'edge' || isDev)
      return client.resolve({preview, ...query})
    const {PHASE_PRODUCTION_BUILD} = await import('next/constants')
    const isBuild = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
    const {db, previews} = await this.init
    const sync = () => db.syncWith(client).catch(console.error)
    if (!isBuild) {
      if (preview) {
        preview = await previews.parse(
          preview,
          sync,
          client.getDraft.bind(client)
        )
      } else {
        const syncInterval = query.syncInterval ?? 60
        const now = Date.now()
        if (now - this.lastSync >= syncInterval * 1000) {
          this.lastSync = now
          await sync()
        }
      }
    }
    return db.resolve({preview, ...query})
  }

  async #authenticatedClient() {
    const {handlerUrl} = await requestContext(this.config)
    const {cookies} = await import('next/headers')
    const cookie = await cookies()
    const accessToken = cookie.get(COOKIE_NAME)
    return new Client({
      config: this.config,
      url: handlerUrl.href,
      applyAuth: init => {
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${accessToken}`)
        return {...init, headers}
      }
    })
  }

  async user(): Promise<User | undefined> {
    const client = await this.#authenticatedClient()
    return client.user()
  }

  async mutate(mutations: Array<Mutation>): Promise<void> {
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
