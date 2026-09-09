import {createThrottledSync} from '#/backend/util/Syncable.js'
import {Client} from '#/core/Client.js'
import {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import type {RequestContext, UploadResponse} from '#/core/Connection.js'
import type {NodeReplica} from '#/database/driver/NodeReplica.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {Graph, GraphQuery, AnyQueryResult} from '#/core/Graph.js'
import {outcome} from '#/core/Outcome.js'
import type {PreviewRequest} from '#/core/Preview.js'
import {trace} from '#/core/Trace.js'
import type {User} from '#/core/User.js'
import {getPreviewPayloadFromCookies} from '#/preview/PreviewCookies.js'
import {Headers} from '@alinea/iso'
import PLazy from 'p-lazy'
import {cache} from 'react'
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
  buildDb: Promise<Graph> = PLazy.from(async () => {
    if (process.env.NEXT_RUNTIME === 'edge')
      throw new Error(
        'Bundled SQLite is not supported in Edge runtime environments.'
      )
    // The generated package's browser/edge conditions exclude its native driver.
    // @ts-ignore generated at build time
    const {openDatabase} = await import('@alinea/generated/database.js')
    return openDatabase(this.config)
  })
  bundledDb: Promise<NodeReplica> = PLazy.from(async () => {
    if (process.env.NEXT_RUNTIME === 'edge')
      throw new Error(
        'Bundled SQLite is not supported in Edge runtime environments.'
      )
    const span = trace(this.config, 'alinea.next.cms.db')
    return span(async () => {
      // @ts-ignore generated at build time, native implementation excluded on edge
      const {openReplica} = await import('@alinea/generated/database.js')
      return openReplica(this.config)
    })
  })
  #applyPreview = cache(async () => {
    const context = await requestContext(this.config)
    const isEdge = process.env.NEXT_RUNTIME === 'edge'
    const {PHASE_PRODUCTION_BUILD} = await import('next/constants.js')
    const isBuild = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
    const useLocalDb = !isEdge && (!context.isDev || isBuild)
    const {cookies, draftMode} = await import('next/headers.js')
    const [isDraft] = await outcome(async () => (await draftMode()).isEnabled)
    if (!isDraft)
      return {context, isDraft, isBuild, useLocalDb, preview: undefined}

    const cookie = await cookies()
    const payload = getPreviewPayloadFromCookies(cookie.getAll())
    const preview: PreviewRequest | undefined = payload ? {payload} : undefined
    return {context, isDraft, isBuild, preview, useLocalDb}
  })

  async resolve<Query extends GraphQuery>(
    query: Query
  ): Promise<AnyQueryResult<Query>> {
    let status = query.status
    const {context, isDraft, isBuild, preview, useLocalDb} =
      await this.#applyPreview()
    if (isDraft && !status) status = 'preferDraft'
    const request = {...query, preview: preview ?? query.preview, status}
    const client = createClient(this.config, context)
    if (!useLocalDb) {
      const span = trace(this.config, 'alinea.cms.resolve.client')
      return span(() => client.resolve<Query>(request))
    }
    if (isBuild && !request.preview)
      return (await this.buildDb).resolve<Query>(request)
    const db = await this.bundledDb
    const syncInterval = request.disableSync
      ? Number.POSITIVE_INFINITY
      : (request.syncInterval ?? this.config.syncInterval)
    if (request.preview) return db.resolvePreview<Query>(request, client)
    if (!isBuild) await this.throttle(() => db.sync(client), syncInterval)
    return db.resolve<Query>(request)
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

function createClient(config: Config, context: RequestContext) {
  return new Client({
    config,
    url: context.handlerUrl.href,
    applyAuth: init => applyContextAuth(context, init)
  })
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
