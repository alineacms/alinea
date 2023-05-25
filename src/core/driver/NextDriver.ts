import {JWTPreviews} from 'alinea/backend'
import {CMSApi, DefaultCMS} from '../CMS.js'
import {Client} from '../Client.js'
import {Config} from '../Config.js'
import {Page} from '../pages/Page.js'
import {Realm} from '../pages/Realm.js'
import {Selection} from '../pages/Selection.js'

export interface NextApi extends CMSApi {
  previewHandler(request: Request): Promise<Response>
}

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
    const previewToken = decodeURIComponent(
      new URL(request.url).search
    ).substring(1)
    const jwtSecret =
      process.env.NODE_ENV === 'development'
        ? 'dev'
        : process.env.ALINEA_API_KEY
    if (!jwtSecret) throw new Error('No JWT secret set')
    const previews = new JWTPreviews(jwtSecret)
    const {id} = await previews.verify(previewToken)
    const cnx = await this.connection()
    const url = await cnx.resolve(
      Selection(Page({entryId: id}).select(Page.url).first()),
      Realm.PreferDraft
    )
    const root = new URL('/', request.url)
    draftMode().enable()
    return new Response('', {
      status: 302,
      headers: {location: root.toString()}
    })
  }
}

export function createNextCMS<Definition extends Config>(
  config: Definition
): Definition & NextApi {
  return new NextDriver(config) as any
}
