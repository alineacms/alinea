import {JWTPreviews} from '@alinea/backend'
import {IndexedDBData} from '@alinea/backend.indexeddb/IndexedDBData'
import {IndexedDBDrafts} from '@alinea/backend.indexeddb/IndexedDBDrafts'
import {Cache} from '@alinea/backend/Cache'
import {Server} from '@alinea/backend/Server'
import {config} from '@alinea/content'
import {accumulate} from '@alinea/core'

function createLocalClient() {
  const data = new IndexedDBData()
  return new Server({
    config: demoConfig,
    createStore: async () => {
      const {createStore} = await import('@alinea/content/store.js')
      const store = await createStore()
      const entries = await accumulate(data.entries())
      Cache.applyPublish(store, config, entries)
      return store
    },
    drafts: new IndexedDBDrafts(),
    target: data,
    media: data,
    previews: new JWTPreviews('demo')
  })
}

export function createDemo() {
  const client = createLocalClient()
  return {
    config: demoConfig,
    client: client,
    session: {
      user: {sub: 'anonymous'},
      hub: client,
      end: async () => {}
    }
  }
}
