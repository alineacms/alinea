import {Headers} from '@alinea/iso'
import {Database} from 'alinea/backend/Database'
import {EntryResolver} from 'alinea/backend/resolver/EntryResolver'
import {generatedStore} from 'alinea/backend/store/GeneratedStore'
import {AuthenticateRequest, Client, ClientOptions} from 'alinea/core/Client'
import {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {EntryRow} from 'alinea/core/EntryRow'
import {outcome} from 'alinea/core/Outcome'
import {
  PreviewPayload,
  ResolveDefaults,
  ResolveParams
} from 'alinea/core/Resolver'
import {User} from 'alinea/core/User'
import {getPreviewPayloadFromCookies} from 'alinea/preview/PreviewCookies'
import {decodePreviewPayload} from 'alinea/preview/PreviewPayload'
import * as Y from 'yjs'
import {devUrl, requestContext} from './context.js'

class NextClient extends Client {
  resolver: EntryResolver

  constructor(private db: Database, options: ClientOptions) {
    super(options)
    this.resolver = new EntryResolver(db, db.config.schema)
  }

  async resolve(params: ResolveParams): Promise<unknown> {
    const {PHASE_PRODUCTION_BUILD} = await import('next/constants.js')
    const isBuild = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
    if (!params.preview && !isBuild) {
      const syncInterval = params.syncInterval ?? 60
      const now = Date.now()
      if (now - lastSync >= syncInterval * 1000) {
        lastSync = now
        const db = await database
        await db.syncWith(client).catch(() => {})
      }
    }
    return this.resolver.resolve({...resolveDefaults, ...params})
  }

  async parsePreview(preview: PreviewPayload): Promise<EntryRow | undefined> {
    const update = await decodePreviewPayload(preview.payload)
    let meta = await db.meta()
    if (update.contentHash !== meta.contentHash) {
      await syncPending(ctx)
      meta = await db.meta()
    }
    const entry = await resolver.resolve<EntryRow>({
      selection: createSelection(Entry({entryId: update.entryId}).maybeFirst()),
      realm: Realm.PreferDraft
    })
    if (!entry) return
    const cachedDraft = await drafts.get(update.entryId)
    let currentDraft: Draft | undefined
    if (cachedDraft?.contentHash === meta.contentHash) {
      currentDraft = cachedDraft.draft
    } else {
      try {
        const pending = backend.drafts.get(ctx, update.entryId)
        drafts.set(
          update.entryId,
          pending.then(draft => ({contentHash: meta.contentHash, draft}))
        )
        currentDraft = await pending
      } catch (error) {
        console.warn('> could not fetch draft', error)
      }
    }
    const apply = currentDraft
      ? mergeUpdatesV2([currentDraft.draft, update.update])
      : update.update
    const type = cms.config.schema[entry.type]
    if (!type) return
    const doc = new Y.Doc()
    Y.applyUpdateV2(doc, apply)
    const entryData = parseYDoc(type, doc)
    return {...entry, ...entryData, path: entry.path}
  }
}

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
    const database = generatedStore.then(
      store => new Database(this.config, store)
    )
    const dbResolver = database.then(
      db => new EntryResolver(db, this.config.schema)
    )
    super(config, async () => {
      const context = await requestContext(config)
      const resolveDefaults: ResolveDefaults = {}
      const {PHASE_PRODUCTION_BUILD} = await import('next/constants.js')
      const isBuild = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
      const {cookies, draftMode} = await import('next/headers.js')
      const [isDraft] = outcome(() => draftMode().isEnabled)
      const applyAuth: AuthenticateRequest = init => {
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${context.apiKey}`)
        return {...init, headers}
      }
      const url = context.handlerUrl.href
      if (isDraft) {
        const cookie = cookies()
        const payload = getPreviewPayloadFromCookies(cookie.getAll())
        const update = payload && (await decodePreviewPayload(payload))
        if (payload) resolveDefaults.preview = {payload}
      }
      if (devUrl()) return new Client({url, applyAuth, resolveDefaults})
      const client = new NextClient(
        {
          async resolve(params) {
            const resolver = await dbResolver
            if (!resolveDefaults.preview && !isBuild) {
              const syncInterval = params.syncInterval ?? 60
              const now = Date.now()
              if (now - lastSync >= syncInterval * 1000) {
                lastSync = now
                const db = await database
                await db.syncWith(client).catch(() => {})
              }
            }
            return resolver.resolve({...resolveDefaults, ...params})
          }
        },
        {
          url,
          applyAuth
        }
      )
      return client
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
