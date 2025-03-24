import type {ConnectionContext} from 'alinea/core/CMS'
import {getPreviewPayloadFromCookies} from 'alinea/preview/PreviewCookies'
import {parse} from 'cookie-es'
import type {VanillaCMS} from './cms.js'
import {previewStore} from './previewContext.js'

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
    const payload = getPreviewPayloadFromCookies(
      Object.entries(cookies).map(([name, value]) => ({name, value}))
    )
    if (payload) context.preview = {payload}
  }
  return storage.run(context, run)
}
