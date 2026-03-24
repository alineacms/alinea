import {atom} from 'jotai'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from './src/v2/App.js'
import {views} from './src/v2/app/fields/views.js'
import {cms, db} from './src/v2/fixture/cms.ts?alinea'

const elem = document.getElementById('root')!
const config = atom(cms.config)
const dbAtom = atom(db)
const viewsAtom = atom(views)

const app = (
  <StrictMode>
    <App config={config} db={dbAtom} views={viewsAtom} />
  </StrictMode>
)

createRoot(elem).render(app)
