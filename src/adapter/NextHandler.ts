import {Request} from '@alinea/iso'
import {Database, JWTPreviews} from 'alinea/backend'
import {generatedStore} from 'alinea/backend/Store'
import {Entry} from 'alinea/core/Entry'
import {createSelection} from 'alinea/core/pages/CreateSelection'
import PLazy from 'p-lazy'
import {createCloudHandler} from '../cloud/server/CloudHandler.js'
import {alineaCookies} from './AlineaCookies.js'
import {NextCMS} from './NextCMS.js'

const handlers = new WeakMap<NextCMS, (request: Request) => Promise<Response>>()

async function handlePreview(
  cms: NextCMS,
  request: Request
): Promise<Response> {
  const {draftMode, cookies} = await import('next/headers.js')
  const context = await cms.getContext()
  const {searchParams} = new URL(request.url)
  const previewToken = searchParams.get('preview')
  if (!previewToken) return new Response('Not found', {status: 404})
  const previews = new JWTPreviews(context.apiKey ?? 'dev')
  const info = await previews.verify(previewToken)
  const cookie = cookies()
  cookie.set(alineaCookies.previewToken, previewToken)
  const cnx = await cms.connection
  const url = (await cnx.resolve({
    preview: context.preview,
    selection: createSelection(
      Entry({entryId: info.entryId}).select(Entry.url).first()
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
    headers: {location: String(location)}
  })
}

export function createHandler(cms: NextCMS) {
  if (handlers.has(cms)) return handlers.get(cms)!
  const apiKey = process.env.ALINEA_API_KEY
  const cloudHandler = PLazy.from(async () => {
    const db = new Database(cms.config, await generatedStore)
    return createCloudHandler(cms.config, db, apiKey)
  })
  const handle = async (request: Request): Promise<Response> => {
    const {searchParams} = new URL(request.url)
    const previewToken = searchParams.get('preview')
    if (previewToken) return handlePreview(cms, request)
    const {router} = await cloudHandler
    const response = await router.handle(request)
    if (response) return response
    return new Response('Not found', {status: 404})
  }
  handlers.set(cms, handle)
  return handle
}
