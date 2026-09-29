import {
  applyPreview as applyPreviewUpdate,
  type DecodedPreviewRequest,
  decodePreviewRequest
} from '#/backend/resolver/ParsePreview.js'
import {createThrottledSync} from '#/backend/util/Syncable.js'
import {Client} from '#/core/Client.js'
import {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import type {
  RequestContext,
  UploadMetadata,
  UploadResponse
} from '#/core/Connection.js'
import type {LocalStore, SyncOptions} from '#/core/db/LocalStore.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {GraphQuery} from '#/core/Graph.js'
import {outcome} from '#/core/Outcome.js'
import type {PreviewRequest} from '#/core/Preview.js'
import {getScope} from '#/core/Scope.js'
import {trace} from '#/core/Trace.js'
import type {User} from '#/core/User.js'
import type {PreviewStat} from '#/preview/widget.js'
import {getPreviewPayloadFromCookies} from '#/preview/PreviewCookies.js'
import {Headers} from '@alinea/iso'
import PLazy from 'p-lazy'
import type {DatabaseOptions} from 'rado'
import {cache} from 'react'
import {requestContext} from './context.js'
import {cachedResolve, developmentRevision} from './devCache.js'
import {RenderStats, summarizeQuery, timed} from './renderStats.js'
import {syncIfStale} from './syncCheck.js'

export interface PreviewProps {
  widget?: boolean
  /** Show the queries and syncs of each draft render in the widget */
  stats?: boolean
  workspace?: string
  root?: string
}

export type OpenBundledDatabase = (
  config: Config,
  options?: DatabaseOptions
) => Promise<LocalStore>

export interface SyncStatus {
  /** Whether queries are answered from the bundled database or the handler. */
  source: 'database' | 'handler'
  /** The content revision the answering side is at. */
  sha: string | undefined
  /** When this isolate last synced its bundled database with the handler. */
  syncedAt: Date | undefined
}

// The handler answers from a database that validated this content already.
const preValidatedRemote: SyncOptions = {validate: false}

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  bundledDb: PLazy<LocalStore>
  #syncedAt: number | undefined
  /** How the bundled database opened, once it did. */
  #opened?: {driver?: string; openMs: number; readyAt: number}

  constructor(config: Definition, openBundledDatabase?: OpenBundledDatabase) {
    super(config)
    this.bundledDb = PLazy.from(async () => {
      if (process.env.NEXT_RUNTIME === 'edge')
        throw new Error(
          'Local DB is not supported in Edge runtime environments.'
        )
      if (!openBundledDatabase)
        throw new Error(
          "A bundled database loader is required. Import createCMS from 'alinea/next'."
        )
      const span = trace(this.config, 'alinea.next.cms.db')
      const start = performance.now()
      const db = await span(() =>
        openBundledDatabase(this.config, {
          // Statements run in the async context of the query that caused
          // them, which carries the React request of the render.
          logQuery: (query, durationMs) =>
            this.#render().stats?.statement(durationMs, query.sql)
        })
      )
      this.#opened = {
        driver: db.driver,
        openMs: performance.now() - start,
        readyAt: Date.now()
      }
      return db
    })
  }

  throttle = createThrottledSync()

  /**
   * Per React request; outside a request (build, route handlers) every call
   * returns a fresh holder, so nothing is recorded there.
   */
  #render = cache((): {stats?: RenderStats} => ({}))

  /** One content revision per render, see `developmentRevision`. */
  #devRevision = cache(() => developmentRevision())

  #isDraft = cache(async () => {
    const {cookies, draftMode} = await import('next/headers.js')
    const [isDraft] = await outcome(async () => (await draftMode()).isEnabled)
    // Draft renders read the preview cookie and the clock for their stats.
    // With Cache Components Next.js only allows the clock after request data,
    // so read the cookies before any stats are taken.
    if (isDraft) await outcome(cookies)
    return Boolean(isDraft)
  })

  /** Draft renders collect their queries and syncs for the preview widget. */
  async #renderStats(): Promise<RenderStats | undefined> {
    if (!(await this.#isDraft())) return undefined
    const render = this.#render()
    return (render.stats ??= new RenderStats())
  }

  /** The bundled database answers outside Edge, except during development. */
  async #environment(context: RequestContext) {
    const isEdge = process.env.NEXT_RUNTIME === 'edge'
    const {PHASE_PRODUCTION_BUILD} = await import('next/constants.js')
    const isBuild = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
    return {isBuild, useLocalDb: !isEdge && (!context.isDev || isBuild)}
  }

  /** Renders keep serving the current content when the handler is unreachable. */
  async #syncDb(
    db: LocalStore,
    client: Client,
    stats: RenderStats | undefined
  ): Promise<string> {
    if (stats)
      return stats.track({kind: 'sync', summary: 'sync'}, row =>
        timed(row, () => this.#syncDb(db, client, undefined))
      )
    try {
      const sha = await db.syncWith(client, preValidatedRemote)
      this.#syncedAt = Date.now()
      return sha
    } catch (error) {
      console.warn(
        `Alinea could not sync with the handler, serving current content: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      return db.sha
    }
  }

  #applyPreview = cache(async () => {
    const context = await requestContext(this.config)
    const {isBuild, useLocalDb} = await this.#environment(context)
    const isDraft = await this.#isDraft()
    if (!isDraft)
      return {context, hasPreview: false, isDraft, isBuild, useLocalDb}

    const {cookies} = await import('next/headers.js')
    const cookie = await cookies()
    const payload = getPreviewPayloadFromCookies(cookie.getAll())
    if (!payload)
      return {
        context,
        hasPreview: false,
        isDraft,
        isBuild,
        preview: undefined,
        useLocalDb
      }

    let preview: PreviewRequest | undefined = {payload}
    if (useLocalDb) {
      const db = await this.bundledDb
      const decoded = await decodePreviewRequest(preview)
      preview = await this.#prepareLocalPreview(db, decoded, context)
    }
    return {context, hasPreview: true, isDraft, isBuild, preview, useLocalDb}
  })

  /**
   * The preview cookie carries the content hash the dashboard rendered
   * against, which is the freshness signal in draft mode: Next bypasses the
   * `unstable_cache` that `syncIfStale` shares between renders there, so the
   * cookie hash replaces the uncached lookup of the latest sha. A mismatch
   * means this isolate is behind (or ahead of) the previewed content, and one
   * sync brings it to the handler revision before the patch is applied.
   */
  async #prepareLocalPreview(
    db: LocalStore,
    decoded: DecodedPreviewRequest,
    context: RequestContext
  ): Promise<PreviewRequest | undefined> {
    if ('entry' in decoded) return decoded
    if ((await db.sha) !== decoded.contentHash)
      await this.#syncDb(
        db,
        createClient(this.config, context),
        this.#render().stats
      )
    return applyPreviewUpdate(db, decoded)
  }

  /** Where queries are answered from and how fresh that side is. */
  async status(): Promise<SyncStatus> {
    const context = await requestContext(this.config)
    const {useLocalDb} = await this.#environment(context)
    if (useLocalDb) {
      const db = await this.bundledDb
      return {
        source: 'database',
        sha: await db.sha,
        syncedAt: this.#syncedAt ? new Date(this.#syncedAt) : undefined
      }
    }
    const client = createClient(this.config, context)
    const sha = await client.getSha().catch(() => undefined)
    return {source: 'handler', sha, syncedAt: undefined}
  }

  async resolve<Query extends GraphQuery>(query: Query): Promise<any> {
    const stats = await this.#renderStats()
    if (!stats) return this.#resolve(query, undefined)
    return stats.track({kind: 'query', summary: summarizeQuery(query)}, row =>
      this.#resolve(query, row)
    )
  }

  async #resolve(query: GraphQuery, row: PreviewStat | undefined) {
    let status = query.status
    const {context, hasPreview, isDraft, isBuild, preview, useLocalDb} =
      await this.#applyPreview()
    if (isDraft && !status) status = 'preferDraft'
    const request = {...query, preview, status}
    const client = createClient(this.config, context)
    if (row) row.source = useLocalDb ? 'database' : 'handler'
    if (!useLocalDb) {
      const span = trace(this.config, 'alinea.cms.resolve.client')
      const answer = () => client.resolve(request)
      // Draft renders are dynamic and answered fresh, the data cache would
      // be bypassed in draft mode regardless.
      const revision = context.isDev && !isDraft && this.#devRevision()
      if (!revision) return timed(row, () => span(answer))
      const key = [context.handlerUrl.href, revision]
      const body = getScope(this.config).stringify(request)
      return span(() => cachedResolve(key, body, answer))
    }
    const db = await this.bundledDb
    const stats = this.#render().stats
    const opened = this.#opened
    if (stats && opened)
      stats.database ??= {
        driver: opened.driver,
        openMs: opened.openMs,
        cold: opened.readyAt >= stats.startedAt
      }
    // Time the answer only: a sync it waited for has a row of its own.
    const answer = () =>
      stats && row
        ? stats.executed(row, () => db.resolve(request))
        : db.resolve(request)
    const syncInterval = request.disableSync
      ? Number.POSITIVE_INFINITY
      : (request.syncInterval ?? this.config.syncInterval)
    // A preview cookie already settled freshness through its content hash.
    if (hasPreview) return answer()
    if (!isBuild) {
      // In draft mode Next bypasses the `unstable_cache` behind `syncIfStale`,
      // so asking for the shared sha would cost an uncached request on every
      // render. Without a preview cookie there is no hash to compare against,
      // and the throttled sync keeps drafts fresh instead.
      // Route the sync syncIfStale may trigger through #syncDb so it counts
      // as this isolate's last sync.
      const tracked = {
        sha: db.sha,
        syncWith: () => this.#syncDb(db, client, stats)
      }
      const settled =
        !isDraft && (await syncIfStale(tracked, client, syncInterval))
      if (!settled)
        await this.throttle(() => this.#syncDb(db, client, stats), syncInterval)
    }
    return answer()
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

  async prepareUpload(
    file: string,
    metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    const client = await this.#authenticatedClient()
    return client.prepareUpload(file, metadata)
  }

  previews = async ({
    widget,
    stats: showStats,
    workspace,
    root
  }: PreviewProps) => {
    const stats = await this.#renderStats()
    if (!stats) return null
    const {default: dynamic} = await import('next/dynamic.js')
    const {isDev, handlerUrl} = await requestContext(this.config)
    let adminPath = Config.adminPath(this.config)
    if (!adminPath.startsWith('/')) adminPath = `/${adminPath}`
    // In development the site proxies the admin path to the dev server, link
    // to the dashboard as the site serves it, resolved against its origin
    const dashboardUrl = isDev
      ? adminPath
      : new URL(`${adminPath}.html`, handlerUrl).href
    const NextPreviews = dynamic(() => import('./previews.js'), {
      ssr: false
    })
    return (
      <NextPreviews
        dashboardUrl={dashboardUrl}
        widget={widget}
        stats={widget && showStats ? stats.settled() : undefined}
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
