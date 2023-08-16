import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {entryEditorAtoms} from './atoms/EntryEditorAtoms.js'
import {entryLocationAtom, localeAtom} from './atoms/NavigationAtoms.js'
import {Route, Router} from './atoms/RouterAtoms.js'
import {ContentView} from './pages/ContentView.js'
import {DraftsOverview} from './pages/DraftsOverview.js'

const editorLoader = atomFamily(() => {
  return atom(async get => {
    const entryLocation = get(entryLocationAtom)
    const locale = get(localeAtom) ?? null
    return {
      editor: await get(
        entryEditorAtoms({locale, i18nId: entryLocation?.entryId})
      )
    }
  })
})

export const entryRoute = new Route({
  path: '*',
  loader: editorLoader,
  component: ContentView
})

export const draftRoute = new Route({
  path: '/draft/:workspace?/:root?/:id?',
  loader: editorLoader,
  component: DraftsOverview
})

const routes = [draftRoute, entryRoute]

export const router = new Router({routes})
