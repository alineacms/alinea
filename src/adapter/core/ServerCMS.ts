import {HandleAction} from '#/backend/HandleAction.js'
import {
  applyPreview as applyPreviewUpdate,
  type DecodedPreviewRequest,
  decodePreviewRequest
} from '#/backend/resolver/ParsePreview.js'
import {createThrottledSync} from '#/backend/util/Syncable.js'
import {Client} from '#/core/Client.js'
import {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import type {RequestContext, UploadResponse} from '#/core/Connection.js'
import type {LocalStore, SyncOptions} from '#/core/db/LocalStore.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {GraphQuery} from '#/core/Graph.js'
import type {PreviewRequest} from '#/core/Preview.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {trace} from '#/core/Trace.js'
import type {User} from '#/core/User.js'
import type {PreviewStat} from '#/preview/widget.js'
import {getPreviewPayloadFromCookies} from '#/preview/PreviewCookies.js'
import {Headers} from '@alinea/iso'
import PLazy from 'p-lazy'
import type {DatabaseOptions} from 'rado'
import {requestContext} from './context.js'
import {RenderStats, summarizeQuery, timed} from './renderStats.js'
import type {HostRequest, ServerHost} from './ServerHost.js'
import {syncIfStale} from './syncCheck.js'

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

/** A handler in this process and the database it answers from. */
export interface LocalHandler {
  handle(request: Request): Promise<Response>
  db: Promise<LocalStore>
}

/** What the previews client of a draft render needs. */
export interface PreviewInfo {
  /** The dashboard the preview widget links to. */
  dashboardUrl: string
  /** The queries and syncs of this render. */
  stats: RenderStats
}

interface AppliedPreview {
  context: RequestContext
  hasPreview: boolean
  isDraft: boolean
  isBuild: boolean
  preview?: PreviewRequest
  useLocalDb: boolean
}

interface RequestState {
  applied?: Promise<AppliedPreview>
  stats?: RenderStats
}

// The handler answers from a database that validated this content already.
const preValidatedRemote: SyncOptions = {validate: false}

// A sha that only matches an empty tree, so the handler answers with the
// current tree (metadata only, no blobs) whenever there is any content and
// we can read its sha. On an empty tree the answer is undefined, which the
// caller treats as unknown and falls back to its throttled sync.
const SENTINEL_SHA = ReadonlyTree.EMPTY.sha

export class ServerCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  bundledDb: PLazy<LocalStore>
  #host: ServerHost
  #syncedAt: number | undefined
  #handler: LocalHandler | undefined
  /**
   * Per request; outside a request (build, scripts) nothing is memoized or
   * recorded.
   */
  #requests = new WeakMap<HostRequest, RequestState>()

  constructor(
    config: Definition,
    host: ServerHost,
    openGeneratedDatabase?: OpenBundledDatabase
  ) {
    super(config)
    this.#host = host
    this.bundledDb = PLazy.from(async () => {
      if (host.isEdge())
        throw new Error(
          'Local DB is not supported in Edge runtime environments.'
        )
      if (!openGeneratedDatabase)
        throw new Error(
          'The generated database is not available here. Import createCMS from the Node entry of your adapter.'
        )
      const span = trace(this.config, 'alinea.cms.db')
      return span(() =>
        openGeneratedDatabase(this.config, {
          // Statements run in the async context of the query that caused
          // them, which carries the request of the render.
          logQuery: (_query, durationMs) =>
            this.#currentStats()?.statement(durationMs)
        })
      )
    })
  }

  throttle = createThrottledSync()

  /**
   * A handler serving this CMS from the same process, as in servers that
   * bundle pages and handler together. When it answers from the same
   * database, syncing with it over HTTP would wait for that database while
   * the handler waits to sync it too: queries have it sync in process instead.
   */
  attachHandler(handler: LocalHandler): void {
    this.#handler = handler
  }

  async #syncWith(db: LocalStore, client: Client): Promise<string> {
    const handler = this.#handler
    const shared = handler && (await handler.db.catch(() => undefined)) === db
    if (!shared) return db.syncWith(client, preValidatedRemote)
    const context = await requestContext(this.config)
    const url = new URL(context.handlerUrl)
    url.searchParams.set('action', HandleAction.Tree)
    url.searchParams.set('sha', await db.sha)
    const init = applyContextAuth(context, {
      headers: {accept: 'application/json'}
    })
    const response = await handler.handle(new Request(url, init))
    if (!response.ok) throw new Error(`Handler answered ${response.status}`)
    return db.sha
  }

  #state(request: HostRequest): RequestState {
    let state = this.#requests.get(request)
    if (!state) this.#requests.set(request, (state = {}))
    return state
  }

  #currentStats(): RenderStats | undefined {
    const request = this.#host.current()
    return request && this.#requests.get(request)?.stats
  }

  /** Draft renders collect their queries and syncs for the preview widget. */
  async renderStats(): Promise<RenderStats | undefined> {
    const request = this.#host.current()
    if (!request || !(await request.isDraft())) return undefined
    const state = this.#state(request)
    return (state.stats ??= new RenderStats())
  }

  /** Previews only render for drafts, undefined otherwise. */
  async previewInfo(): Promise<PreviewInfo | undefined> {
    const stats = await this.renderStats()
    if (!stats) return undefined
    const {isDev, handlerUrl} = await requestContext(this.config)
    let file = `${Config.adminPath(this.config)}.html`
    if (!file.startsWith('/')) file = `/${file}`
    const dashboardUrl = isDev
      ? new URL('/', handlerUrl)
      : new URL(file, handlerUrl)
    return {dashboardUrl: dashboardUrl.href, stats}
  }

  /** The bundled database answers outside Edge, except during development. */
  async #environment(context: RequestContext) {
    const isEdge = this.#host.isEdge()
    const isBuild = await this.#host.isBuild()
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
      const sha = await this.#syncWith(db, client)
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

  #applyPreview(): Promise<AppliedPreview> {
    const request = this.#host.current()
    if (!request) return this.#loadPreview(undefined)
    const state = this.#state(request)
    return (state.applied ??= this.#loadPreview(request))
  }

  async #loadPreview(
    request: HostRequest | undefined
  ): Promise<AppliedPreview> {
    const context = await requestContext(this.config)
    const {isBuild, useLocalDb} = await this.#environment(context)
    const isDraft = Boolean(await request?.isDraft())
    if (!request || !isDraft)
      return {context, hasPreview: false, isDraft, isBuild, useLocalDb}

    const payload = getPreviewPayloadFromCookies(await request.cookies())
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
  }

  /**
   * The preview cookie carries the content hash the dashboard rendered
   * against, which is the freshness signal in draft mode: Next bypasses the
   * `unstable_cache` that its host shares the latest sha through there, so
   * the cookie hash replaces the uncached lookup of the latest sha. A
   * mismatch means this isolate is behind (or ahead of) the previewed
   * content, and one sync brings it to the handler revision before the patch
   * is applied.
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
        this.#currentStats()
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
    const tree = await client
      .getTreeIfDifferent(ReadonlyTree.EMPTY.sha)
      .catch(() => undefined)
    return {source: 'handler', sha: tree?.sha, syncedAt: undefined}
  }

  async resolve<Query extends GraphQuery>(query: Query): Promise<any> {
    const stats = await this.renderStats()
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
      return timed(row, () => span(() => client.resolve(request)))
    }
    const db = await this.bundledDb
    const syncInterval = request.disableSync
      ? Number.POSITIVE_INFINITY
      : (request.syncInterval ?? this.config.syncInterval)
    // A preview cookie already settled freshness through its content hash.
    if (hasPreview) return timed(row, () => db.resolve(request))
    if (!isBuild) {
      // In draft mode Next bypasses the `unstable_cache` behind its host's
      // latest sha, so asking for the shared sha would cost an uncached
      // request on every render. Without a preview cookie there is no hash to
      // compare against, and the throttled sync keeps drafts fresh instead.
      // Route the sync syncIfStale may trigger through #syncDb so it counts
      // as this isolate's last sync.
      const stats = this.#currentStats()
      const tracked = {
        sha: db.sha,
        syncWith: () => this.#syncDb(db, client, stats)
      }
      const settled =
        !isDraft &&
        (await syncIfStale(
          tracked,
          () => this.#latestSha(client),
          syncInterval
        ))
      if (!settled)
        await this.throttle(() => this.#syncDb(db, client, stats), syncInterval)
    }
    // Time the answer only: a sync it waited for has a row of its own.
    return timed(row, () => db.resolve(request))
  }

  /** The latest content sha, when the host shares it between requests. */
  async #latestSha(client: Client): Promise<string | undefined> {
    if (!this.#host.latestSha) return undefined
    const load = async () => {
      const tree = await client.getTreeIfDifferent(SENTINEL_SHA)
      return tree?.sha
    }
    return this.#host.latestSha(load).catch(() => undefined)
  }

  async #authenticatedClient() {
    const context = await requestContext(this.config)
    const authCookies: Array<[name: string, value: string]> = []
    const cookies = (await this.#host.current()?.cookies()) ?? []
    for (const {name, value} of cookies) {
      if (name.startsWith('alinea.')) {
        authCookies.push([name, value])
      }
    }
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
