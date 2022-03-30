import {Backend} from '@alinea/backend/Backend'
import {Cache} from '@alinea/backend/Cache'
import {IndexedDBData} from '@alinea/backend/data/IndexedDBData.js'
import {IndexedDBDrafts} from '@alinea/backend/drafts/IndexedDBDrafts.js'
import {accumulate, createConfig, workspace} from '@alinea/core'
import {Dashboard, FieldsPreview} from '@alinea/dashboard'
import {useMemo} from 'react'
import {config} from '../../.alinea/config'

const demoConfig = createConfig({
  workspaces: {
    web: workspace('Demo', {
      ...config.workspaces.web,
      preview({entry}) {
        return <FieldsPreview entry={entry} />
      }
    })
  }
})

function createLocalClient() {
  const data = new IndexedDBData()
  return new Backend({
    config: demoConfig,
    createStore: async () => {
      const {createStore} = await import('../../.alinea/store')
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
}

export default function Demo() {
  const client = useMemo(createLocalClient, [])
  return <Dashboard config={demoConfig} client={client} />
}
