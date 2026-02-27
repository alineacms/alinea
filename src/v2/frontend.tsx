import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import {LocalDB} from 'alinea/core/db/LocalDB.js'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from './App'

const Page = Config.document('Page', {
  fields: {
    link: Field.entry('Link')
  }
})
const main = Config.workspace('Main', {
  source: 'content/main',
  roots: {
    pages: Config.root('Pages 123', {
      i18n: {locales: ['en', 'de']},
      children: {
        welcome: Config.page({
          type: Page,
          children: {
            getStarted: Config.page({type: Page})
          }
        }),
        about: Config.page({
          type: Page,
          children: {
            team: Config.page({type: Page}),
            history: Config.page({type: Page})
          }
        }),
        blog: Config.page({
          type: Page,
          children: {
            firstPost: Config.page({type: Page}),
            secondPost: Config.page({type: Page})
          }
        })
      }
    }),
    media: Config.media()
  }
})
const secondary = Config.workspace('Secondary', {
  source: 'content/secondary',
  roots: {
    pages: Config.root('Secondary pages', {
      children: {
        home: Config.page({type: Page}),
        contact: Config.page({type: Page})
      }
    })
  }
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main, secondary}
})

const elem = document.getElementById('root')!
const db = new LocalDB(cms.config)
await db.sync()

const app = (
  <StrictMode>
    <App config={cms.config} db={db} views={{}} />
  </StrictMode>
)

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  const root = (import.meta.hot.data.root ??= createRoot(elem))
  root.render(app)
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app)
}
