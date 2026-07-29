import {getWorkspace} from '#/core/Internal.js'
import {assert} from '#/core/util/Assert.js'
import {atom, type Getter} from 'jotai'
import {dispense, requiredAtom} from './AtomUtils.js'
import {MissingEntryError} from './Contracts.js'
import {type EntryDataAtoms, entryAtoms} from './EntryAtoms.js'
import type {ExplorerAtoms} from './ExplorerAtoms.js'
import type {PreparedRoute, RouteLoader} from './loaders/Route.js'
import type {RouteHistory} from './navigation/History.js'
import {createNavigation, type Navigation} from './navigation/Navigation.js'
import type {RootAtoms} from './RootAtoms.js'
import {policyAtom} from './UserAtoms.js'
import {
  configAtom,
  currentWorkspaceAtom,
  workspaceAtoms
} from './WorkspaceAtoms.js'

export const routeLoaderAtom = requiredAtom<RouteLoader>(
  'dashboard.routeLoader'
)

export const navigationAtom = requiredAtom<Navigation<PreparedRoute>>(
  'dashboard.navigation'
)

export const navigationAtoms: Navigation<PreparedRoute> = {
  route: atom(
    get => get(get(navigationAtom).route),
    (get, set, update) => set(get(navigationAtom).route, update)
  ),
  prepared: atom(
    get => get(get(navigationAtom).prepared),
    (get, set, prepared) => set(get(navigationAtom).prepared, prepared)
  ),
  refresh: atom(null, (get, set, route, prepared) =>
    set(get(navigationAtom).refresh, route, prepared)
  ),
  pending: atom(get => get(get(navigationAtom).pending)),
  error: atom(get => get(get(navigationAtom).error))
}

export const routeAtom = navigationAtoms.route

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
  async (get, set, explorer: ExplorerAtoms) => {
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

export const workspaceSettingsAtom = dispense((key: string) =>
  atom(get => {
    const workspace = get(configAtom).workspaces[key]
    assert(workspace, `Workspace "${key}" not found in config`)
    return getWorkspace(workspace)
  })
)

export const workspaceRootsAtom = dispense((key: string) =>
  atom(get => {
    const configuredRoots = get(workspaceSettingsAtom(key)).roots
    const policy = get(policyAtom)
    return Object.keys(configuredRoots).filter(root =>
      policy.canRead({workspace: key, root})
    )
  })
)

export const workspacesAtom = atom(get => {
  const config = get(configAtom)
  const policy = get(policyAtom)
  return Object.keys(config.workspaces).filter(workspace =>
    policy.canRead({workspace})
  )
})

export const selectedWorkspaceAtom = atom(
  get => {
    const {workspace} = get(routeAtom)
    const config = get(configAtom)
    const workspaceKeys = get(workspacesAtom)
    if (
      workspace &&
      config.workspaces[workspace] &&
      workspaceKeys.includes(workspace)
    )
      return workspace
    return workspaceKeys[0] ?? null
  },
  (_get, set, workspace: string) => set(routeAtom, {workspace})
)

export const selectedRootAtom = atom<string | null>(get => {
  const workspace = get(selectedWorkspaceAtom)
  const roots = workspace ? get(workspaceRootsAtom(workspace)) : []
  const {root} = get(routeAtom)
  if (root && roots.includes(root)) return root
  return roots[0] ?? null
})

export type FocusedItem =
  | {entry: EntryDataAtoms}
  | {root: RootAtoms}
  | {missingEntry: string; root: RootAtoms}
  | {missingRoot: string; root: RootAtoms}
  | null

const initialContentLoadedAtom = atom(false)

const initialContentResourceAtom = atom<Promise<PreparedRoute>>(async get => {
  if (get(initialContentLoadedAtom)) return get(pageAtom)
  const page = await get(initialPageAtom)
  const workspace = get(currentWorkspaceAtom)
  if (!workspace) return page
  const roots = get(workspace.roots)
  if (roots.length === 0) return page
  await get(workspace.tree.items)
  return page
})

export const prepareInitialContentAtom = atom(null, async (get, set) => {
  const page = await get(initialContentResourceAtom)
  set(navigationAtoms.prepared, page)
  set(initialContentLoadedAtom, true)
})

export const focusedAtom = atom((get): FocusedItem | Promise<FocusedItem> => {
  const {page} = get(routeAtom)
  if (page === 'users') return null
  const workspace = get(selectedWorkspaceAtom)
  const root = get(selectedRootAtom)
  const {root: routeRoot, entry} = get(routeAtom)
  const focusedRoot = (): FocusedItem => {
    if (!workspace) return null
    if (root) return {root: workspaceAtoms(workspace).root(root)}
    return null
  }
  const missingEntry = (error: unknown): FocusedItem => {
    if (!(error instanceof MissingEntryError)) throw error
    if (workspace && root) {
      return {
        missingEntry: entry!,
        root: workspaceAtoms(workspace).root(root)
      }
    }
    throw new Error(`Entry "${entry}" not found`)
  }
  const focusedEntry = (data: EntryDataAtoms): FocusedItem => {
    return get(data.view) === 'edit' ? {entry: data} : focusedRoot()
  }
  if (workspace && routeRoot && routeRoot !== root) {
    if (!root) return null
    return {
      missingRoot: routeRoot,
      root: workspaceAtoms(workspace).root(root)
    }
  }
  if (entry)
    try {
      const {data, error} = get(entryAtoms(entry).data)
      if (error) return missingEntry(error)
      if (data) return focusedEntry(data)
      return null
    } catch (error) {
      return missingEntry(error)
    }
  return focusedRoot()
})

export {themeAtom} from './UserAtoms.js'
