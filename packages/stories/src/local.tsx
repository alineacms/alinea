import {accumulate} from '@alinea/core/'
import '@alinea/css/global.css'
import {renderDashboard} from '@alinea/dashboard'
import {Backend} from '@alinea/server/Backend'
import {Cache} from '@alinea/server/Cache'
import {IndexedDBData} from '@alinea/server/data/IndexedDBData.js'
import {IndexedDBDrafts} from '@alinea/server/drafts/IndexedDBDrafts.js'
import {config} from '../../website/alinea.config'

const data = new IndexedDBData()

const backend = new Backend({
  config,
  createStore: async () => {
    const {createCache} = await import('../../website/.alinea/cache')
    const store = await createCache()
    const entries = await accumulate(data.entries())
    Cache.applyPublish(store, config, entries)
    return store
  },
  drafts: new IndexedDBDrafts(),
  target: data,
  media: data,
  previews: {
    sign: JSON.stringify,
    verify: JSON.parse
  }
})

renderDashboard({
  config,
  client: backend
})
