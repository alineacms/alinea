import {JWTPreviews} from 'alinea/backend'
import {enums, object, string} from 'cito'
import {CMSApi, DefaultCMS} from '../CMS.js'
import {Client} from '../Client.js'
import {Config} from '../Config.js'
import {Page} from '../pages/Page.js'
import {Realm} from '../pages/Realm.js'
import {Selection} from '../pages/Selection.js'

export interface NextApi extends CMSApi {
  previewHandler(request: Request): Promise<Response>
}

const SearhParams = object({
  token: string,
  entryId: string,
  realm: enums(Realm)
})

class NextDriver extends DefaultCMS implements NextApi {
  connection = async () => {
    // @ts-ignore
    const {draftMode} = await import('next/headers')
    const {isEnabled: isDraft} = draftMode()
    const devPort = process.env.ALINEA_PORT || 4500
    const isDevelopment = process.env.NODE_ENV === 'development'
    if (isDevelopment)
      return new Client(this.config, `http://127.0.0.1:${devPort}`)
    throw new Error(`No CMS connection available`)
  }

  previewHandler = async (request: Request) => {
    // @ts-ignore
    const {draftMode} = await import('next/headers')
    const {searchParams} = new URL(request.url)
    const params = SearhParams({
      token: searchParams.get('token'),
      entryId: searchParams.get('entryId'),
      phase: searchParams.get('phase')
    })
    const jwtSecret =
      process.env.NODE_ENV === 'development'
        ? 'dev'
        : process.env.ALINEA_API_KEY
    if (!jwtSecret) throw new Error('No JWT secret set')
    const previews = new JWTPreviews(jwtSecret)
    const {sub} = await previews.verify(params.token)
    const cnx = await this.connection()
    const url = (await cnx.resolve(
      Selection(Page({entryId: params.entryId}).select(Page.url).first()),
      params.realm
    )) as string
    const location = new URL(url ?? '/', request.url)
    draftMode().enable()
    return new Response('', {
      status: 302,
      headers: {location: location.toString()}
    })
  }
}

export function createNextCMS<Definition extends Config>(
  config: Definition
): Definition & NextApi {
  return new NextDriver(config) as any
}
