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
import {outcome} from '#/core/Outcome.js'
import type {PreviewRequest} from '#/core/Preview.js'
import {trace} from '#/core/Trace.js'
import type {User} from '#/core/User.js'
import {getPreviewPayloadFromCookies} from '#/preview/PreviewCookies.js'
import {Headers} from '@alinea/iso'
import PLazy from 'p-lazy'
import {cache} from 'react'
import {requestContext} from './context.js'
import {syncIfStale} from './syncCheck.js'

export interface PreviewProps {
  widget?: boolean
  workspace?: string
  root?: string
}

export type OpenBundledDatabase = (config: Config) => Promise<LocalStore>

// The handler answers from a database that validated this content already.
const preValidatedRemote: SyncOptions = {validate: false}

export class NextCMS<
  Definition extends Config = Config
> extends CMS<Definition> {
  bundledDb: PLazy<LocalStore>

  constructor(config: Definition, openBundledDatabase?: OpenBundledDatabase) {
    super(config)
    this.bundledDb = PLazy.from(async () => {
      if (!openBundledDatabase)
        throw new Error(
          'A bundled database loader is required. Import createCMS from ' +
            "'alinea/next' for Node or 'alinea/next.edge' for Edge."
        )
      const span = trace(this.config, 'alinea.next.cms.db')
      return span(() => openBundledDatabase(this.config))
    })
  }

  throttle = createThrottledSync()
  #applyPreview = cache(async () => {
    const context = await requestContext(this.config)
    const isEdge = process.env.NEXT_RUNTIME === 'edge'
    const {PHASE_PRODUCTION_BUILD} = await import('next/constants.js')
    const isBuild = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
    const useLocalDb = !isEdge && (!context.isDev || isBuild)
    const {cookies, draftMode} = await import('next/headers.js')
    const [isDraft] = await outcome(async () => (await draftMode()).isEnabled)
    if (!isDraft)
      return {context, hasPreview: false, isDraft, isBuild, useLocalDb}

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
      await db.syncWith(createClient(this.config, context), preValidatedRemote)
    return applyPreviewUpdate(db, decoded)
  }

  async resolve<Query extends GraphQuery>(query: Query): Promise<any> {
    let status = query.status
    const {context, hasPreview, isDraft, isBuild, preview, useLocalDb} =
      await this.#applyPreview()
    if (isDraft && !status) status = 'preferDraft'
    const request = {...query, preview, status}
    const client = createClient(this.config, context)
    if (!useLocalDb) {
      const span = trace(this.config, 'alinea.cms.resolve.client')
      return span(() => client.resolve(request))
    }
    const db = await this.bundledDb
    const syncInterval = request.disableSync
      ? Number.POSITIVE_INFINITY
      : (request.syncInterval ?? this.config.syncInterval)
    // A preview cookie already settled freshness through its content hash.
    if (hasPreview) return db.resolve(request)
    if (!isBuild) {
      // In draft mode Next bypasses the `unstable_cache` behind `syncIfStale`,
      // so asking for the shared sha would cost an uncached request on every
      // render. Without a preview cookie there is no hash to compare against,
      // and the throttled sync keeps drafts fresh instead.
      const settled =
        !isDraft &&
        (await syncIfStale(db, client, syncInterval, preValidatedRemote))
      if (!settled)
        await this.throttle(
          () => db.syncWith(client, preValidatedRemote),
          syncInterval
        )
    }
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
