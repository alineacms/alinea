import {atom} from 'jotai'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from './App.js'
import {views} from './app/fields/views.js'
import {cms, db} from './fixture/cms.ts?alinea'

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
