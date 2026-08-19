import {bootProd} from 'alinea/dashboard/boot/BootProd'
// These are aliased during build
import {cms} from '#alinea/config'
import {views} from '#alinea/views'

const params = new URL(import.meta.url).searchParams
const handlerUrl = params.get('handlerUrl')
const cacheKey = params.get('cacheKey')

export function startDashboard(url = handlerUrl, key = cacheKey, user) {
  if (!url) throw new Error('Missing Alinea handler URL')
  if (!key) throw new Error('Missing Alinea dashboard cache key')
  return bootProd(url, cms, views, key, user)
}

if (
  typeof WorkerGlobalScope !== 'undefined' &&
  globalThis instanceof WorkerGlobalScope
)
  startDashboard()
