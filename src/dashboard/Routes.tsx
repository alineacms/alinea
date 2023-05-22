import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {entryEditorAtoms} from './atoms/EntryEditor.js'
import {Route, Router} from './atoms/RouterAtoms.js'
import {ContentView} from './pages/ContentView.js'
import {DraftsOverview} from './pages/DraftsOverview.js'

const editorLoader = atomFamily(
  ({id}: Record<string, string>) => {
    return atom(async get => {
      return {editor: await get(entryEditorAtoms(id))}
    })
  },
  (a, b) => a.id === b.id
)

export const entryRoute = new Route({
  path: '/entry/:workspace?/:root?/:id?',
  loader: editorLoader,
  component: ContentView
})

export const draftRoute = new Route({
  path: '/draft/:workspace?/:root?/:id?',
  loader: editorLoader,
  component: DraftsOverview
})

const routes = [entryRoute, draftRoute]

export const router = new Router({routes})
