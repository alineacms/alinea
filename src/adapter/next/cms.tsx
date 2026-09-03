import {
  applyPreview,
  decodePreviewRequest
} from '#/backend/resolver/ParsePreview.js'
import {createThrottledSync} from '#/backend/util/Syncable.js'
import {Client} from '#/core/Client.js'
import {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import type {RequestContext, UploadResponse} from '#/core/Connection.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {GraphQuery} from '#/core/Graph.js'
import {outcome} from '#/core/Outcome.js'
import type {PreviewRequest} from '#/core/Preview.js'
import {trace} from '#/core/Trace.js'
import type {User} from '#/core/User.js'
import {getPreviewPayloadFromCookies} from '#/preview/PreviewCookies.js'
import {Headers} from '@alinea/iso'
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
  constructor(config: Definition) {
    super(config)
  }

  throttle = createThrottledSync()
  bundledDb = PLazy.from(async () => {
    if (process.env.NEXT_RUNTIME === 'edge')
      throw new Error('Local DB is not supported in Edge runtime environments.')
    const span = trace(this.config, 'alinea.next.cms.db')
    return span(async () => {
      const {generatedSource} =
        await import('#/backend/store/GeneratedSource.js')
      const source = await generatedSource
      const db = new LocalDB(this.config, source)
      await db.sync()
      return db
    })
  })

  async resolve<Query extends GraphQuery>(query: Query): Promise<any> {
    let status = query.status
    const context = await requestContext(this.config)
    const client = new Client({
      config: this.config,
      url: context.handlerUrl.href,
      applyAuth: init => applyContextAuth(context, init)
    })
    let preview: PreviewRequest | undefined
    const {cookies, draftMode} = await import('next/headers.js')
    const [isDraft] = await outcome(async () => (await draftMode()).isEnabled)
    if (isDraft) {
      if (!status) status = 'preferDraft'
      const cookie = await cookies()
      const payload = getPreviewPayloadFromCookies(cookie.getAll())
      if (payload) preview = {payload}
    }
    const isEdge = process.env.NEXT_RUNTIME === 'edge'
    const request = {preview, ...query, status}
    const useLocalDb = !isEdge && !context.isDev
    if (!useLocalDb) {
      const span = trace(this.config, 'alinea.cms.resolve.client')
      return span(() => client.resolve(request))
    }
    const db = await this.bundledDb
    const syncInterval = request.disableSync
      ? Number.POSITIVE_INFINITY
      : (request.syncInterval ?? this.config.syncInterval)
    if (request.preview) {
      const decoded = await decodePreviewRequest(request.preview)
      const mismatched =
        'contentHash' in decoded && db.sha !== decoded.contentHash
      if (mismatched) await db.syncWith(client)
      return db.resolve({
        ...request,
        preview: await applyPreview(db, decoded)
      })
    }
    await this.throttle(() => db.syncWith(client), syncInterval)
    return db.resolve(request)
  }

  async #authenticatedClient() {
    const context = await requestContext(this.config)
    const authCookies: Array<[name: string, value: string]> = []
    try {
      const {cookies} = await import('next/headers.js')
      const cookie = await cookies()
      for (const {name, value} of cookie.getAll()) {
        if (name.startsWith('alinea.')) {
          authCookies.push([name, value])
        }
      }
    } catch {}
    return new Client({
      config: this.config,
      url: context.handlerUrl.href,
      applyAuth: init => {
        const headers = new Headers(init?.headers)
        if (authCookies.length) {
          headers.set(
            'Cookie',
            authCookies.map(([name, value]) => `${name}=${value}`).join('; ')
          )
        }
        return applyContextAuth(context, {...init, headers})
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
    const {draftMode} = await import('next/headers.js')
    const {default: dynamic} = await import('next/dynamic.js')
    const [isDraft] = await outcome(async () => (await draftMode()).isEnabled)
    if (!isDraft) return null
    const {isDev, handlerUrl} = await requestContext(this.config)
    let file = `${Config.adminPath(this.config)}.html`
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

function applyContextAuth(
  context: RequestContext,
  init?: RequestInit
): RequestInit {
  if (context.applyAuth) return context.applyAuth(init)
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${context.apiKey}`)
  return {...init, headers}
}
