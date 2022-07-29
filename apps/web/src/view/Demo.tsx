import {JWTPreviews} from '@alinea/backend'
import {IndexedDBData} from '@alinea/backend.indexeddb/IndexedDBData'
import {IndexedDBDrafts} from '@alinea/backend.indexeddb/IndexedDBDrafts'
import {Cache} from '@alinea/backend/Cache'
import {Server} from '@alinea/backend/Server'
import {accumulate, createConfig, workspace} from '@alinea/core'
import {Dashboard, Preview} from '@alinea/dashboard'
import {px, Typo} from '@alinea/ui'
import {useMemo} from 'react'
import {config} from '../../../demo/.alinea/config.js'

const demoConfig = createConfig({
  workspaces: {
    demo: workspace('Demo', {
      ...config.workspaces.demo.config.options,
      preview({entry}) {
        return (
          <Preview>
            <div style={{padding: px(20)}}>
              <Typo.H2>Preview</Typo.H2>
              <Typo.P>
                This pane will show a live preview of the current page. It is
                currently not enabled as we don't have any suitable demo content
                yet.
              </Typo.P>
            </div>
          </Preview>
        )
      }
    })
  }
})

function createLocalClient() {
  const data = new IndexedDBData()
  return new Server({
    config: demoConfig,
    createStore: async () => {
      const {createStore} = await import('../../../demo/.alinea/store.js')
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

export type DemoProps = {
  fullPage?: boolean
}

export default function Demo({fullPage}: DemoProps) {
  const {client, config} = useMemo(createDemo, [])
  return <Dashboard fullPage={fullPage} config={demoConfig} client={client} />
}
