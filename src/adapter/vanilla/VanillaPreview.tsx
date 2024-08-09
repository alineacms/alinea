import {ConnectionContext} from 'alinea/core/CMS'
import type {AsyncLocalStorage} from 'node:async_hooks'
import {VanillaCMS} from './VanillaCMS.js'

export const previewStore = new WeakMap<
  VanillaCMS,
  AsyncLocalStorage<ConnectionContext>
>()

export function previewContext(cms: VanillaCMS) {
  return previewStore.get(cms)?.getStore() ?? {}
}
