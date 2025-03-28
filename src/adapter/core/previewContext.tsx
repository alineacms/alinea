import type {AsyncLocalStorage} from 'node:async_hooks'
import type {ConnectionContext} from 'alinea/core/CMS'
import type {CoreCMS} from './cms.js'

export const previewStore = new WeakMap<
  CoreCMS,
  AsyncLocalStorage<ConnectionContext>
>()

export function previewContext(cms: CoreCMS) {
  return previewStore.get(cms)?.getStore() ?? {}
}
