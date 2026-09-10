import {expose, proxy} from 'comlink'
import {QueryWorker} from '#/database/browser/QueryWorker.js'
import {PendingMutations} from '#/database/browser/PendingMutations.js'
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
  },
  async pending(action: 'save' | 'restore' | 'empty') {
    const view = (await ready).bootstrap()
    const store = await PendingMutations.open(indexedDB, {
      ...view.identity,
      endpoint: new URL('/replica', location.href).href
    })
    try {
      if (action === 'save') {
        const row = await store.enqueue({
          id: 'pending-test',
          baseRevision: view.revision,
          schemaId: view.identity.schemaId,
          configId: view.identity.configId,
          mutations: [
            {
              op: 'update',
              id: 'a',
              locale: null,
              status: 'draft',
              set: {title: 'Unsaved browser draft'}
            }
          ]
        })
        await store.accept(row.id, row.digest, 'accepted-revision')
      }
      const rows = await store.list()
      if (action === 'restore') await store.purge()
      return rows.map(row => ({
        id: row.id,
        acceptedSha: row.acceptedSha,
        mutations: row.mutations
      }))
    } finally {
      store.close()
    }
  },
  async close() {
    await (await ready).close()
  }
}
expose(api)
