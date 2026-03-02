import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {cms, db} from '../fixture/cms.ts?alinea'
import {App} from './App'

const elem = document.getElementById('root')!

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
