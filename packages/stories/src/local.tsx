import {Backend} from '@alinea/backend/Backend'
import {Cache} from '@alinea/backend/Cache'
import {IndexedDBData} from '@alinea/backend/data/IndexedDBData.js'
import {IndexedDBDrafts} from '@alinea/backend/drafts/IndexedDBDrafts.js'
import {accumulate} from '@alinea/core/'
import '@alinea/css/global.css'
import {renderDashboard} from '@alinea/dashboard'
import {config} from '../../website/.alinea/config'

const data = new IndexedDBData()

const backend = new Backend({
  config,
  createStore: async () => {
    const {createStore} = await import('../../website/.alinea')
    const store = await createStore()
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
