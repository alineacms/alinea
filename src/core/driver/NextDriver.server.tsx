import {JWTPreviews} from 'alinea/backend'
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
import {DefaultCMS} from '../CMS.js'
import {Client, ClientOptions} from '../Client.js'
import {Config} from '../Config.js'
import {EntryPhase} from '../Entry.js'
import {Page} from '../Page.js'
import {Realm} from '../pages/Realm.js'
import {Selection} from '../pages/Selection.js'
import {NextApi} from './NextDriver.js'

const SearchParams = object({
  token: string,
  entryId: string,
  realm: enums(Realm)
})

class NextDriver extends DefaultCMS implements NextApi {
  apiKey = process.env.ALINEA_API_KEY

  async connection() {
    const {cookies, draftMode} = await import('next/headers')
    const {isEnabled: isDraft} = draftMode()
    const devPort = process.env.ALINEA_PORT
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
    if (devPort)
      return new Client({
        config: this.config,
        url: `http://127.0.0.1:${devPort}`,
        resolveDefaults
      })
    return super.connection()
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
    const jwtSecret =
      process.env.NODE_ENV === 'development'
        ? 'dev'
        : process.env.ALINEA_API_KEY
    if (!jwtSecret) throw new Error('No JWT secret set')
    const previews = new JWTPreviews(jwtSecret)
    const payload = await previews.verify(params.token)
    const cnx = await this.connection()
    const url = (await cnx.resolve({
      selection: Selection.create(
        Page({entryId: params.entryId}).select(Page.url).first()
      ),
      realm: params.realm
    })) as string
    const source = new URL(request.url)
    const location = new URL(url, source.origin)
    draftMode().enable()
    return new Response(`Redirecting`, {
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
