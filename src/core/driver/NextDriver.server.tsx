import {JWTPreviews} from 'alinea/backend'
import {createCloudHandler} from 'alinea/cloud/server/CloudHandler'
import {parseChunkedCookies} from 'alinea/preview/ChunkCookieValue'
import {
  PREVIEW_ENTRYID_NAME,
  PREVIEW_PHASE_NAME,
  PREVIEW_UPDATE_NAME
} from 'alinea/preview/PreviewConstants'
import {enums, object, string} from 'cito'
import dynamic from 'next/dynamic.js'
import PLazy from 'p-lazy'
import {Suspense} from 'react'
import {Client} from '../Client.js'
import {Config} from '../Config.js'
import {Entry} from '../Entry.js'
import {EntryPhase} from '../EntryRow.js'
import {outcome} from '../Outcome.js'
import {ResolveDefaults, Resolver} from '../Resolver.js'
import {User} from '../User.js'
import {createSelection} from '../pages/CreateSelection.js'
import {Realm} from '../pages/Realm.js'
import {DefaultDriver} from './DefaultDriver.server.js'
import {NextApi, PreviewProps} from './NextDriver.js'

const SearchParams = object({
  token: string,
  entryId: string,
  realm: enums(Realm)
})

const PREVIEW_TOKEN = 'alinea-preview-token'

class NextDriver extends DefaultDriver implements NextApi {
  apiKey = process.env.ALINEA_API_KEY
  jwtSecret = this.apiKey || 'dev'

  async user(): Promise<User | null> {
    const {cookies, draftMode} = await import('next/headers.js')
    const [draftStatus] = outcome(() => draftMode())
    const isDraft = draftStatus?.isEnabled
    // We exit early if we're not in draft mode to avoid marking every page
    // as dynamic
    if (!isDraft) return null
    const token = cookies().get(PREVIEW_TOKEN)?.value
    if (!token) return null
    const previews = new JWTPreviews(this.jwtSecret)
    const payload = await previews.verify(token)
    if (!payload) return null
    return payload
  }

  async getDefaults(): Promise<ResolveDefaults> {
    const {cookies, draftMode} = await import('next/headers.js')
    const [draftStatus] = outcome(() => draftMode())
    const isDraft = draftStatus?.isEnabled
    const resolveDefaults: ResolveDefaults = {
      syncInterval: this.config.syncInterval ?? 60,
      realm: Realm.Published
    }
    if (isDraft) {
      resolveDefaults.realm = Realm.PreferDraft
      const update = parseChunkedCookies(
        PREVIEW_UPDATE_NAME,
        cookies().getAll()
      )
      if (update) {
        const entryIdCookie = cookies().get(PREVIEW_ENTRYID_NAME)
        const phaseCookie = cookies().get(PREVIEW_PHASE_NAME)
        const entryId = entryIdCookie?.value
        const phase = phaseCookie?.value as EntryPhase
        if (entryId && phase) resolveDefaults.preview = {entryId, phase, update}
      }
    }
    return resolveDefaults
  }

  async resolver(): Promise<Resolver> {
    const resolveDefaults = await this.getDefaults()
    const devUrl = process.env.ALINEA_DEV_SERVER
    if (devUrl)
      return new Client({
        config: this.config,
        url: devUrl,
        resolveDefaults
      })
    const handler = await this.cloudHandler
    return {
      resolve(params) {
        return handler.resolve({...resolveDefaults, ...params})
      }
    }
  }

  backendHandler = async (request: Request) => {
    const handler = await this.cloudHandler
    const response = await handler.router.handle(request)
    return response ?? new Response('Not found', {status: 404})
  }

  cloudHandler = PLazy.from(async () => {
    const db = await this.db
    return createCloudHandler(this.config, db, this.apiKey)
  })

  previewHandler = async (request: Request) => {
    const {draftMode, cookies} = await import('next/headers.js')
    const {searchParams} = new URL(request.url)
    const params = SearchParams({
      token: searchParams.get('token'),
      entryId: searchParams.get('entryId'),
      realm: searchParams.get('realm')
    })
    const previews = new JWTPreviews(this.jwtSecret)
    await previews.verify(params.token)
    cookies().set(PREVIEW_TOKEN, params.token)
    if (!searchParams.has('full')) {
      // Clear preview cookies
      cookies().delete(PREVIEW_UPDATE_NAME)
      cookies().delete(PREVIEW_ENTRYID_NAME)
      cookies().delete(PREVIEW_PHASE_NAME)
    }
    const cnx = (await this.resolver()) as Client
    const resolveDefaults = await this.getDefaults()
    const url = (await cnx.resolve({
      ...resolveDefaults,
      selection: createSelection(
        Entry({entryId: params.entryId}).select(Entry.url).first()
      )
    })) as string | null
    if (!url) return new Response('Not found', {status: 404})
    const source = new URL(request.url)
    // Next.js incorrectly reports 0.0.0.0 as the hostname if the server is
    // listening on all interfaces
    if (source.hostname === '0.0.0.0') source.hostname = 'localhost'
    const location = new URL(url, source.origin)
    draftMode().enable()
    return new Response(`Redirecting...`, {
      status: 302,
      headers: {location: location.toString()}
    })
  }

  previews = async ({
    widget,
    workspace,
    root
  }: PreviewProps): Promise<JSX.Element | null> => {
    const {draftMode} = await import('next/headers.js')
    const [draftStatus] = outcome(() => draftMode())
    const isDraft = draftStatus?.isEnabled
    if (!isDraft) return null
    const user = await this.user()
    const NextPreviews = dynamic(
      () => import('alinea/core/driver/NextPreviews'),
      {ssr: false}
    )
    const devUrl = process.env.ALINEA_DEV_SERVER
    const dashboardUrl =
      devUrl ?? this.config.dashboard?.dashboardUrl ?? '/admin.html'
    return (
      <Suspense>
        {user && (
          <NextPreviews
            widget={widget}
            user={user}
            dashboardUrl={dashboardUrl}
            workspace={workspace}
            root={root}
          />
        )}
      </Suspense>
    )
  }
}

export function createNextCMS<Definition extends Config>(
  config: Definition
): Definition & NextApi {
  return new NextDriver(config) as any
}
