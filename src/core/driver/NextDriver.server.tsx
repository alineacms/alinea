import {JWTPreviews, Server} from 'alinea/backend'
import {Store} from 'alinea/backend/Store'
import {exportStore} from 'alinea/cli/util/ExportStore'
import {createCloudHandler} from 'alinea/cloud/server/CloudHandler'
import {parseChunkedCookies} from 'alinea/preview/ChunkCookieValue'
import {
  PREVIEW_ENTRYID_NAME,
  PREVIEW_PHASE_NAME,
  PREVIEW_UPDATE_NAME
} from 'alinea/preview/PreviewConstants'
import {enums, object, string} from 'cito'
import PLazy from 'p-lazy'
import {Suspense, lazy} from 'react'
import {CMS} from '../CMS.js'
import {Client, ClientOptions} from '../Client.js'
import {Config} from '../Config.js'
import {Entry} from '../Entry.js'
import {EntryPhase} from '../EntryRow.js'
import {Realm} from '../pages/Realm.js'
import {Selection} from '../pages/Selection.js'
import {Logger} from '../util/Logger.js'
import {join} from '../util/Paths.js'
import {NextApi} from './NextDriver.js'

const SearchParams = object({
  token: string,
  entryId: string,
  realm: enums(Realm)
})

class NextDriver extends CMS implements NextApi {
  apiKey = process.env.ALINEA_API_KEY
  jwtSecret = this.apiKey || 'dev'

  exportStore(outDir: string, data: Uint8Array): Promise<void> {
    return exportStore(data, join(outDir, 'store.js'))
  }

  async readStore(): Promise<Store> {
    // @ts-ignore
    const {createStore} = await import('@alinea/generated/store.js')
    return createStore()
  }

  async connection() {
    const {cookies, draftMode, headers} = await import('next/headers')
    const {isEnabled: isDraft} = draftMode()
    const devUrl = process.env.ALINEA_DEV_SERVER
    const resolveDefaults: ClientOptions['resolveDefaults'] = {
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
    if (devUrl)
      return new Client({
        config: this.config,
        url: devUrl,
        resolveDefaults
      })

    /*if (isDraft) {
      const host = headers().get('host')
      const handlerUrl = new URL(this.dashboard.handlerUrl, `https://${host}`)
      return new Client({
        config: this.config,
        url: handlerUrl.toString(),
        resolveDefaults
      })
    }*/

    const store = await this.readStore()
    return new Server(
      {
        config: this.config,
        store,
        media: undefined!,
        target: undefined!,
        previews: new JWTPreviews(this.jwtSecret),
        resolveDefaults
      },
      {logger: new Logger('CMSDriver')}
    )
  }

  backendHandler = async (request: Request) => {
    const handler = await this.cloudHandler
    return handler(request)
  }

  cloudHandler = PLazy.from(async () => {
    const store = await this.readStore()
    const handler = await createCloudHandler(this, store, this.apiKey)
    return async (request: Request) => {
      const response = await handler.handle(request)
      return response ?? new Response('Not found', {status: 404})
    }
  })

  previewHandler = async (request: Request) => {
    const {draftMode} = await import('next/headers')
    const {searchParams} = new URL(request.url)
    const params = SearchParams({
      token: searchParams.get('token'),
      entryId: searchParams.get('entryId'),
      realm: searchParams.get('realm')
    })
    const previews = new JWTPreviews(this.jwtSecret)
    const payload = await previews.verify(params.token)
    const cnx = await this.connection()
    const url = (await cnx.resolve({
      selection: Selection.create(
        Entry({entryId: params.entryId}).select(Entry.url).first()
      ),
      realm: params.realm
    })) as string
    const source = new URL(request.url)
    const location = new URL(url, source.origin)
    draftMode().enable()
    return new Response(`Redirecting...`, {
      status: 302,
      headers: {location: location.toString()}
    })
  }

  // Todo: update typescript to support async server components
  previews = (async (): Promise<JSX.Element | null> => {
    const {draftMode} = await import('next/headers')
    const {isEnabled: isDraft} = draftMode()
    if (!isDraft) return null
    const NextPreviews = lazy(() => import('alinea/core/driver/NextPreviews'))
    return (
      <Suspense>
        <NextPreviews />
      </Suspense>
    )
  }) as any
}

export function createNextCMS<Definition extends Config>(
  config: Definition
): Definition & NextApi {
  return new NextDriver(config) as any
}
