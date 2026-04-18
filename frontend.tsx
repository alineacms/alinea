import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from './src/dashboard/App.js'
import {views} from './src/dashboard/app/field/views.js'
import {cms, db} from './src/dashboard/fixture/cms.ts?alinea'

const elem = document.getElementById('root')!

const app = (
  <StrictMode>
    <App graph={db} events={db.index} config={cms.config} views={views} />
  </StrictMode>
)

createRoot(elem).render(app)
