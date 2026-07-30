import type {Config} from '#/core/Config.js'
import {getWorkspace} from '#/core/Internal.js'
import type {Policy} from '#/core/Role.js'
import {assert} from '#/core/util/Assert.js'
import {atom, type Atom, type Getter, type Setter} from 'jotai'
import type {Route} from '../DashboardNav.js'
import {type EntryDataAtoms, type EntryAtoms, entryAtoms} from './entry.js'
import {
  loadEntryPage,
  type EntryPageData,
  MissingEntryError
} from './entry/load.js'
import {
  type ExplorerAtoms,
  type ExplorerPageData,
  loadEntryData,
  loadExplorerPage
} from './explorer.js'
import {canManageMembersAtom, optionsAtom, policyResourceAtom} from './user.js'
import {
  configAtom,
  type RootAtoms,
  type WorkspaceAtoms,
  workspaceAtoms,
  workspacesAtom
} from './config.js'
import {createBrowserHistory} from './routing/history.js'
import {createNavigation, type Navigation} from './routing/navigation.js'

export const navigationAtom = atom(get => {
  const history = get(optionsAtom).history ?? createBrowserHistory()
  return createNavigation<PreparedRoute>({
    history,
    allow: async (_route, {get, set, signal}) => {
      const page = get(pageAtom)
      if (signal.aborted) return false
      if (page.type !== 'entry') return true
      return set(page.entry.needsBlock, signal)
    },
    prepare: (route, {get, set, signal}) =>
      prepareDashboardRoute(get, set, route, signal)
  })
})

export const navigationAtoms: Navigation<PreparedRoute> = {
  route: atom(
    get => get(get(navigationAtom).route),
    (get, set, update) => set(get(navigationAtom).route, update)
  ),
  requestedRoute: atom(get => get(get(navigationAtom).requestedRoute)),
  prepared: atom(
    get => get(get(navigationAtom).prepared),
    (get, set, prepared) => set(get(navigationAtom).prepared, prepared)
  ),
  refresh: atom(null, (get, set) => set(get(navigationAtom).refresh)),
  pending: atom(get => get(get(navigationAtom).pending)),
  error: atom(get => get(get(navigationAtom).error))
}

export const routeAtom = navigationAtoms.route

function routeLocale(
  get: Getter,
  root: RootAtoms,
  requestedLocale: string | undefined
) {
  const i18n = get(root.settings).i18n
  if (requestedLocale && i18n?.locales.includes(requestedLocale))
    return requestedLocale
  return i18n?.locales[0] ?? null
}

function loadRoute(get: Getter, route: Route, signal: AbortSignal) {
  return createRouteLoader({
    config: configAtom,
    policy: policyResourceAtom,
    canManageMembers: canManageMembersAtom,
    workspace: workspaceAtoms,
    entry: entryAtoms
  })(get, route, signal)
}

async function prepareDashboardRoute(
  get: Getter,
  set: Setter,
  route: Route,
  signal: AbortSignal
): Promise<PreparedRoute> {
  const page = await loadRoute(get, route, signal)
  signal.throwIfAborted()
  let treeRoot = 'root' in page ? page.root : undefined
  let reveal: Array<string> = []
  if (route.entry) {
    const {data} = get(entryAtoms(route.entry).data)
    if (data) {
      const entryData = get(data.entryData)
      treeRoot = get(data.root)
      reveal = entryData.parents.map(parent => parent.id)
    }
  }
  if (treeRoot) {
    await treeRoot.workspace.tree.prepare(
      get,
      set,
      treeRoot,
      routeLocale(get, treeRoot, route.locale),
      reveal
    )
    signal.throwIfAborted()
  }
  return page
}

export const pageAtom = atom(get => {
  const page = get(navigationAtoms.prepared)
  assert(page, 'Dashboard page was read before it was prepared')
  return page
})

export const currentEntryAtom = atom(get => {
  const page = get(pageAtom)
  return page.type === 'entry' ? page.currentEntry : null
})

export const refreshCurrentRouteAtom = navigationAtoms.refresh

export const refreshPageForAtom = atom(
  null,
  async (get, set, explorer: ExplorerAtoms) => {
    const page = get(pageAtom)
    if (page.type !== 'explorer') return
    if (page.root.explorer !== explorer) return
    await set(refreshCurrentRouteAtom)
  }
)

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
  (get, set, workspace: string) => set(routeAtom, {workspace})
)

export const selectedRootAtom = atom<string | null>(get => {
  const workspace = get(selectedWorkspaceAtom)
  const roots = workspace ? get(workspaceAtoms(workspace).roots) : []
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

const initialContentResourceAtom = atom<Promise<PreparedRoute>>()

export const prepareInitialContentAtom = atom(null, async (get, set) => {
  if (get(navigationAtoms.prepared)) return
  const route = get(routeAtom)
  let resource = get(initialContentResourceAtom)
  if (!resource) {
    resource = prepareDashboardRoute(
      get,
      set,
      route,
      new AbortController().signal
    )
    set(initialContentResourceAtom, resource)
  }
  const page = await resource
  set(navigationAtoms.prepared, page)
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

export {themeAtom} from './user.js'

export interface EmptyPageData {
  type: 'empty'
}

export interface UsersPageData {
  type: 'users'
}

export interface RootPageData {
  type: 'root'
  root: RootAtoms
}

export interface MissingEntryPageData {
  type: 'missing-entry'
  entryId: string
  root: RootAtoms
}

export interface MissingRootPageData {
  type: 'missing-root'
  rootKey: string
  root: RootAtoms
}

export interface RouteShellData {
  canManageMembers: boolean
}

export type PreparedRoute = RouteShellData &
  (
    | EmptyPageData
    | UsersPageData
    | RootPageData
    | ExplorerPageData
    | EntryPageData
    | MissingEntryPageData
    | MissingRootPageData
  )

type AsyncAtomKeys<Value> = Value extends unknown
  ? {
      [Key in keyof Value]: Value[Key] extends Atom<Promise<unknown>>
        ? Key
        : never
    }[keyof Value]
  : never

type AssertNoAsyncAtoms<Value extends never> = Value

export type PreparedRouteAsyncFields = AssertNoAsyncAtoms<
  AsyncAtomKeys<PreparedRoute>
>

export interface RouteLoaderOptions {
  config: Atom<Config>
  policy: Atom<Promise<Policy>>
  canManageMembers: Atom<Promise<boolean>>
  workspace(key: string): WorkspaceAtoms
  entry(id: string): EntryAtoms
  loadEntry?(
    get: Getter,
    entry: EntryDataAtoms,
    locale: string | null
  ): Promise<EntryPageData>
}

export type RouteLoader = ReturnType<typeof createRouteLoader>

export function createRouteLoader(options: RouteLoaderOptions) {
  return async function loadRoute(
    get: Getter,
    route: Route,
    signal: AbortSignal
  ): Promise<PreparedRoute> {
    const [policy, canManageMembers] = await Promise.all([
      get(options.policy),
      get(options.canManageMembers)
    ])
    signal.throwIfAborted()
    if (route.page === 'users' && canManageMembers)
      return {type: 'users', canManageMembers}

    const config = get(options.config)
    const workspaceKeys = Object.keys(config.workspaces).filter(workspace =>
      policy.canRead({workspace})
    )
    const workspaceKey =
      route.workspace && workspaceKeys.includes(route.workspace)
        ? route.workspace
        : workspaceKeys[0]
    if (!workspaceKey) return {type: 'empty', canManageMembers}

    const workspace = options.workspace(workspaceKey)
    const settings = getWorkspace(config.workspaces[workspaceKey])
    const rootKeys = Object.keys(settings.roots).filter(root =>
      policy.canRead({workspace: workspaceKey, root})
    )
    const rootKey =
      route.root && rootKeys.includes(route.root) ? route.root : rootKeys[0]
    if (!rootKey) return {type: 'empty', canManageMembers}

    const root = workspace.root(rootKey)
    const i18n = get(root.settings).i18n
    const locale =
      route.locale && i18n?.locales.includes(route.locale)
        ? route.locale
        : (i18n?.locales[0] ?? null)

    if (route.root && route.root !== rootKey)
      return {
        type: 'missing-root',
        rootKey: route.root,
        root,
        canManageMembers
      }

    if (!route.entry && get(root.view))
      return {type: 'root', root, canManageMembers}

    await get(root.childrenFor(locale))
    signal.throwIfAborted()

    const location = {workspace: workspaceKey, root: rootKey}
    if (!route.entry)
      return {
        ...(await loadExplorerPage(get, root, location, locale, signal)),
        canManageMembers
      }

    const entry = options.entry(route.entry)
    const entryData = await loadEntryData(get, entry)
    signal.throwIfAborted()
    if (!entryData)
      return {
        type: 'missing-entry',
        entryId: route.entry,
        root,
        canManageMembers
      }

    if (get(entryData.view) === 'edit')
      return {
        ...(await (options.loadEntry ?? loadEntryPage)(get, entryData, locale)),
        canManageMembers
      }

    await get(entryData.childrenFor(locale))
    return {
      ...(await loadExplorerPage(
        get,
        root,
        {...location, parentId: route.entry},
        locale,
        signal
      )),
      canManageMembers
    }
  }
}
