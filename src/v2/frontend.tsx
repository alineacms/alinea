import {viewKeys} from 'alinea/dashboard/editor/ViewKeys.js'
import {TabsView} from 'alinea/field/tabs/Tabs.view.js'
import {atom} from 'jotai'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from './App.js'
import {cms, db} from './fixture/cms.ts?alinea'

const elem = document.getElementById('root')!
const config = atom(cms.config)
const dbAtom = atom(db)
const views = atom({
  [viewKeys.TabsView]: TabsView
})

const app = (
  <StrictMode>
    <App config={config} db={dbAtom} views={views} />
  </StrictMode>
)

createRoot(elem).render(app)
