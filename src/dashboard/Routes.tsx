import {Entry} from 'alinea/core/Entry'
import {EntryLocation} from 'alinea/dashboard/DashboardNav'
import {graphAtom} from 'alinea/dashboard/atoms/DbAtoms'
import {locationAtom, useNavigate} from 'alinea/dashboard/atoms/LocationAtoms'
import {useNav} from 'alinea/dashboard/hook/UseNav'
import {Loader} from 'alinea/ui'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {useLayoutEffect} from 'react'
import {entryEditorAtoms} from './atoms/EntryEditorAtoms.js'
import {entryLocationAtom, localeAtom} from './atoms/NavigationAtoms.js'
import {Route, Router} from './atoms/RouterAtoms.js'
import {ContentView} from './pages/ContentView.js'

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

const editLoader = atomFamily(() => {
  return atom(async get => {
    const location = get(locationAtom)
    const searchParams = new URLSearchParams(location.search)
    const url = searchParams.get('url')!
    const workspace = searchParams.get('workspace') ?? undefined
    const root = searchParams.get('root') ?? undefined
    const graph = await get(graphAtom)
    const entry = await graph.first({
      select: {
        entryId: Entry.entryId,
        locale: Entry.locale,
        i18nId: Entry.i18nId,
        root: Entry.root,
        workspace: Entry.workspace
      },
      filter: {
        _url: url,
        _workspace: workspace,
        _root: root
      },
      status: 'preferDraft'
    })
    if (!entry) return null
    return {...entry, locale: entry.locale || undefined}
  })
})

export const editRoute = new Route({
  path: '/edit',
  loader: editLoader,
  component: EditRoute
})

function EditRoute(location: EntryLocation | null) {
  const nav = useNav()
  const navigate = useNavigate()
  useLayoutEffect(() => {
    if (location) navigate(nav.entry(location))
  }, [location])
  return <Loader absolute />
}

const routes = [editRoute, entryRoute]

export const router = new Router({routes})
