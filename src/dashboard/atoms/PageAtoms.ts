import {assert} from '#/core/util/Assert.js'
import type {Getter} from 'jotai'
import {atom} from 'jotai'
import {routeLoaderAtom} from './CoreAtoms.js'
import type {Explorer} from './ExplorerAtoms.js'
import type {PreparedRoute, RouteLoader} from './loaders/Route.js'
import {navigationAtoms, routeAtom} from './NavigationAtoms.js'
import type {RouteHistory} from './navigation/History.js'
import {createNavigation, type Navigation} from './navigation/Navigation.js'

function loadRoute(
  get: Getter,
  route: Parameters<RouteLoader>[1],
  signal: AbortSignal
) {
  return get(routeLoaderAtom)(get, route, signal)
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
  const route = get(routeAtom)
  try {
    const page = await loadRoute(get, route, controller.signal)
    if (sequence === get(routeLoadSequenceAtom))
      set(navigationAtoms.refresh, route, page)
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
