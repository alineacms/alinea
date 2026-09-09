import {expose, proxy} from 'comlink'
import {QueryWorker} from '#/database/browser/QueryWorker.js'
import {config, replicaIdentity} from './config.js'

const ready = QueryWorker.connect({
  config,
  url: new URL('/replica', location.href).href,
  expected: {
    project: replicaIdentity.project,
    namespace: replicaIdentity.namespace,
    principal: replicaIdentity.principal
  },
  indexedDB,
  applyAuth(init) {
    const headers = new Headers(init.headers)
    headers.set('authorization', 'Bearer fixture')
    return {...init, headers}
  }
})

export const api = {
  async queries() {
    return proxy(await ready)
  }
}
expose(api)
