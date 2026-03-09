import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {cms, db} from './fixture/cms.ts?alinea'
import {App} from './App.js'
import {v2Views} from './fields/views.js'

const elem = document.getElementById('root')!

const app = (
  <StrictMode>
    <App config={cms.config} db={db} views={v2Views} />
  </StrictMode>
)

createRoot(elem).render(app)
