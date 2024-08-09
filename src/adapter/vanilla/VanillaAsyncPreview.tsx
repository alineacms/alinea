import {JWTPreviews} from 'alinea/backend/util/JWTPreviews'
import {ConnectionContext} from 'alinea/core/CMS'
import {alineaCookies} from 'alinea/preview/AlineaCookies'
import {parseChunkedCookies} from 'alinea/preview/ChunkCookieValue'
import {parse} from 'cookie-es'
import {VanillaCMS} from './VanillaCMS.js'
import {previewStore} from './VanillaPreview.js'

export async function preview<T>(
  cms: VanillaCMS,
  request: Request,
  run: () => Promise<T>
): Promise<T> {
  const {AsyncLocalStorage} = await import('node:async_hooks')
  const storage = previewStore.get(cms) ?? new AsyncLocalStorage()
  previewStore.set(cms, storage)
  const context: ConnectionContext = {}
  const searchParams = new URL(request.url).searchParams
  const previewToken = searchParams.get('preview')
  const cookieHeader = request.headers.get('cookie')
  if (previewToken && cookieHeader) {
    const cookies = parse(cookieHeader)
    const update = parseChunkedCookies(
      alineaCookies.update,
      Object.entries(cookies).map(([name, value]) => ({name, value}))
    )
    const previews = new JWTPreviews('dev')
    const info = await previews.verify(previewToken)
    context.preview = {...info, update}
  }
  return storage.run(context, run)
}
