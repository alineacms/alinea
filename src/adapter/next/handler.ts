import {Backend} from 'alinea/backend/Backend'
import {
  createHandler as createCoreHandler,
  Handler
} from 'alinea/backend/Handler'
import {cloudBackend} from 'alinea/cloud/CloudBackend'
import {Entry} from 'alinea/core/Entry'
import {createSelection} from 'alinea/core/pages/CreateSelection'
import {alineaCookies} from 'alinea/preview/AlineaCookies'
import {NextCMS} from './cms.js'

const handlers = new WeakMap<NextCMS, Handler>()

export function createHandler(
  cms: NextCMS,
  backend: Backend = cloudBackend(cms.config)
) {
  if (handlers.has(cms)) return handlers.get(cms)!
  const handleCloud = createCoreHandler(cms, backend)
  const handle: Handler = async (
    request,
    context = {
      apiKey: process.env.ALINEA_API_KEY ?? 'dev'
    }
  ) => {
    const {searchParams} = new URL(request.url)
    const previewToken = searchParams.get('preview')
    if (previewToken) {
      const {draftMode, cookies} = await import('next/headers.js')
      const {searchParams} = new URL(request.url)
      const previewToken = searchParams.get('preview')
      if (!previewToken) return new Response('Not found', {status: 404})
      const info = await cms.jwt.verify(previewToken)
      const cookie = cookies()
      cookie.set(alineaCookies.previewToken, previewToken)
      const connection = handleCloud.connect(context)
      const url = (await connection.resolve({
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
    return handleCloud(request, context)
  }
  handlers.set(cms, handle)
  return handle
}
