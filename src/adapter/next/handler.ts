import {Request} from '@alinea/iso'
import {Backend} from 'alinea/backend/Backend'
import {createHandle, Handle} from 'alinea/backend/Handle'
import {cloudBackend} from 'alinea/cloud/CloudBackend'
import {Entry} from 'alinea/core/Entry'
import {createSelection} from 'alinea/core/pages/CreateSelection'
import {alineaCookies} from 'alinea/preview/AlineaCookies'
import {NextCMS} from './cms.js'

const handlers = new WeakMap<NextCMS, (request: Request) => Promise<Response>>()

async function handlePreview(
  cms: NextCMS,
  request: Request
): Promise<Response> {
  const {draftMode, cookies} = await import('next/headers.js')
  const connection = await cms.connect()
  const {searchParams} = new URL(request.url)
  const previewToken = searchParams.get('preview')
  if (!previewToken) return new Response('Not found', {status: 404})
  const info = await cms.jwt.verify(previewToken)
  const cookie = cookies()
  cookie.set(alineaCookies.previewToken, previewToken)
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

export function createHandler(
  cms: NextCMS,
  backend: Backend = cloudBackend(cms.config)
) {
  if (handlers.has(cms)) return handlers.get(cms)!
  const handleCloud = createHandle(cms, backend)
  const handle: Handle = async (request, context) => {
    const {searchParams} = new URL(request.url)
    const previewToken = searchParams.get('preview')
    if (previewToken) return handlePreview(cms, request)
    return handleCloud(request, context)
  }
  handlers.set(cms, handle)
  return handle
}
