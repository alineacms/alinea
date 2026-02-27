import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from './App'

const Page = Config.document('Page', {
  fields: {
    link: Field.entry('Link')
  }
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages', {
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
    })
  }
})
const cms = createCMS({
  schema: {Page},
  workspaces: {main}
})

const elem = document.getElementById('root')!
const app = (
  <StrictMode>
    <App config={cms.config} client={undefined!} views={{}} />
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
