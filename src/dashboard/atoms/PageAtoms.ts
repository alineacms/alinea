import {assert} from '#/core/util/Assert.js'
import type {Getter} from 'jotai'
import {atom} from 'jotai'
import type {EntrySidebarTab} from './Contracts.js'
import {entryAtoms} from './EntryAtoms.js'
import type {Explorer} from './ExplorerAtoms.js'
import {loadEntrySidebar} from './loaders/Entry.js'
import {createRouteLoader, type PreparedRoute} from './loaders/Route.js'
import {navigationAtoms, routeAtom} from './NavigationAtoms.js'
import type {RouteHistory} from './navigation/History.js'
import {createNavigation, type Navigation} from './navigation/Navigation.js'
import {canManageMembersAtom, policyResourceAtom} from './PolicyAtoms.js'
import {workspacesAtom} from './SelectionAtoms.js'
import {workspaceAtoms} from './WorkspaceAtoms.js'

let routeLoader: ReturnType<typeof createRouteLoader> | undefined

function loadRoute(
  get: Getter,
  route: Parameters<ReturnType<typeof createRouteLoader>>[1],
  signal: AbortSignal
) {
  routeLoader ??= createRouteLoader({
    policy: policyResourceAtom,
    canManageMembers: canManageMembersAtom,
    workspaces: workspacesAtom,
    workspace: workspaceAtoms,
    entry: entryAtoms
  })
  return routeLoader(get, route, signal)
}

export const initialPageAtom = atom(async get =>
  loadRoute(get, get(routeAtom), new AbortController().signal)
)

export const pageAtom = atom(get => {
  const page = get(navigationAtoms.prepared)
  assert(page, 'Dashboard page was read before it was prepared')
  return page
})

export const currentEntryAtom = atom(get => {
  const page = get(pageAtom)
  return page.type === 'entry' ? page.currentEntry : null
})

const routeLoadSequenceAtom = atom(0)
const routeLoadControllerAtom = atom<AbortController>()

export const reloadPageAtom = atom(null, async (get, set) => {
  const sequence = get(routeLoadSequenceAtom) + 1
  set(routeLoadSequenceAtom, sequence)
  get(routeLoadControllerAtom)?.abort()
  const controller = new AbortController()
  set(routeLoadControllerAtom, controller)
  try {
    const page = await loadRoute(get, get(routeAtom), controller.signal)
    if (sequence === get(routeLoadSequenceAtom))
      set(navigationAtoms.prepared, page)
  } catch (error) {
    if (!controller.signal.aborted) throw error
  } finally {
    if (get(routeLoadControllerAtom) === controller)
      set(routeLoadControllerAtom, undefined)
  }
})

export const refreshPageForAtom = atom(
  null,
  async (get, set, explorer: Explorer) => {
    const page = get(pageAtom)
    if (page.type !== 'explorer') return
    if (page.root.explorer !== explorer) return
    await set(reloadPageAtom)
  }
)

const entrySidebarTabStateAtom = atom<EntrySidebarTab>('preview')

export const entrySidebarTabAtom = atom(
  get => get(entrySidebarTabStateAtom),
  async (get, set, tab: EntrySidebarTab) => {
    const page = get(pageAtom)
    if (page.type === 'entry') {
      const sidebar = await loadEntrySidebar(get, page.entry, page.locale, tab)
      set(navigationAtoms.prepared, {...page, sidebar})
    }
    set(entrySidebarTabStateAtom, tab)
  }
)

const entrySidebarOpenStateAtom = atom(true)

export const entrySidebarOpenAtom = atom(
  get => get(entrySidebarOpenStateAtom),
  async (get, set, open: boolean) => {
    const page = get(pageAtom)
    if (open) {
      if (page.type === 'entry') {
        const sidebar = await loadEntrySidebar(
          get,
          page.entry,
          page.locale,
          get(entrySidebarTabAtom)
        )
        set(navigationAtoms.prepared, {...page, sidebar})
      }
    } else if (page.type === 'entry') {
      set(navigationAtoms.prepared, {
        ...page,
        sidebar: {type: 'closed'}
      })
    }
    set(entrySidebarOpenStateAtom, open)
  }
)

export function createDashboardNavigation(
  history: RouteHistory
): Navigation<PreparedRoute> {
  return createNavigation<PreparedRoute>({
    history,
    allow: async (_route, {get, set, signal}) => {
      const page = get(pageAtom)
      if (signal.aborted) return false
      if (page.type !== 'entry') return true
      return set(page.entry.needsBlock, signal)
    },
    prepare: async (route, {get, signal}) => {
      return loadRoute(get, route, signal)
    }
  })
}
