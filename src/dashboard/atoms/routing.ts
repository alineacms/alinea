import type {Config} from '#/core/Config.js'
import {getWorkspace} from '#/core/Internal.js'
import type {Policy} from '#/core/Role.js'
import {atom, type Atom, type Getter} from 'jotai'
import type {ComponentType} from 'react'
import type {Route} from '../DashboardNav.js'
import {type EntryDataAtoms, type EntryAtoms, entryAtoms} from './entry.js'
import {
  entryRevisionAtom,
  loadEntryPage,
  type EntryPageData,
  MissingEntryError
} from './entry/load.js'
import {
  type ExplorerPageData,
  loadEntryData,
  loadExplorerPage
} from './explorer.js'
import {canManageMembersAtom, optionsAtom, policyResourceAtom} from './user.js'
import {
  configAtom,
  type PreparedTree,
  type RootAtoms,
  type WorkspaceAtoms,
  workspaceAtoms,
  workspacesAtom
} from './config.js'
import {createBrowserHistory} from './routing/history.js'
import {createNavigation, type Navigation} from './routing/navigation.js'
import {swr} from './utils.js'

export const navigationAtom = atom(get => {
  const history = get(optionsAtom).history ?? createBrowserHistory()
  return createNavigation({
    history,
    allow: (_route, {currentRoute, get, set, signal}) => {
      if (signal.aborted) return false
      if (!currentRoute.entry) return true
      const {data} = get(entryAtoms(currentRoute.entry).data)
      if (!data || get(data.view) !== 'edit') return true
      return set(data.needsBlock, signal)
    },
    prepare: async (_route, {get, set, signal}) => {
      const currentPage = await get(pageResourceAtom)
      const currentTree = currentPage.sidebar
      if (currentTree) {
        const expandedKeys = currentTree.root.workspace.tree.expandedKeys
        const current = get(expandedKeys)
        const combined = new Set(current)
        for (const key of currentTree.expandedKeys) combined.add(key)
        if (combined.size !== current.size) set(expandedKeys, combined)
      }
      await get(pageResourceAtom)
      signal.throwIfAborted()
    }
  })
})

export const navigationAtoms: Navigation = {
  route: atom(
    get => get(get(navigationAtom).route),
    (get, set, update) => set(get(navigationAtom).route, update)
  ),
  requestedRoute: atom(get => get(get(navigationAtom).requestedRoute)),
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

export const pageResourceAtom = atom(async (get, {signal}) => {
  const route = get(navigationAtoms.requestedRoute)
  const content = await createRouteLoader({
    config: configAtom,
    policy: policyResourceAtom,
    canManageMembers: canManageMembersAtom,
    workspace: workspaceAtoms,
    entry: entryAtoms
  })(get, route, signal)
  let treeRoot = 'root' in content ? content.root : undefined
  let reveal: Array<string> = []
  if (route.entry) {
    const {data} = get(entryAtoms(route.entry).data)
    if (data) {
      const entryData = get(data.entryData)
      treeRoot = get(data.root)
      reveal = entryData.parents.map(parent => parent.id)
    }
  }
  let sidebar: PreparedSidebar | undefined
  if (treeRoot) {
    const tree = await treeRoot.workspace.tree.prepare(
      get,
      treeRoot,
      routeLocale(get, treeRoot, route.locale),
      reveal,
      signal
    )
    sidebar = {root: treeRoot, ...tree}
  }
  const meta = preparePageMeta(get, route, content)
  return {route, sidebar, content, meta} satisfies PreparedPage
})

export const pageAtom = swr(pageResourceAtom)

export const currentEntryAtom = atom(get => {
  const {entry: entryId} = get(routeAtom)
  if (!entryId) return null
  const {data} = get(entryAtoms(entryId).data)
  if (!data || get(data.view) !== 'edit') return null
  const root = get(data.root)
  const current = get(data.currentEntryFor(get(root.selectedLocale)))
  return current instanceof Promise ? null : current
})

export const refreshCurrentRouteAtom = atom(null, async (get, set) => {
  const route = get(routeAtom)
  if (route.entry) set(entryRevisionAtom(route.entry), revision => revision + 1)
  await get(pageResourceAtom)
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

export interface PreparedPage {
  route: Route
  sidebar: PreparedSidebar | undefined
  content: LoadedRoute
  meta: PreparedPageMeta
}

export interface PreparedPageMeta {
  title: string
  favicon: {
    color: string
    icon?: ComponentType
  }
}

export interface PreparedSidebar extends PreparedTree {
  root: RootAtoms
}

export type LoadedRoute = RouteShellData &
  (
    | EmptyPageData
    | UsersPageData
    | RootPageData
    | ExplorerPageData
    | EntryPageData
    | MissingEntryPageData
    | MissingRootPageData
  )

function preparePageMeta(
  get: Getter,
  route: Route,
  content: LoadedRoute
): PreparedPageMeta {
  const root =
    content.type === 'entry'
      ? get(content.entry.root)
      : 'root' in content
        ? content.root
        : undefined
  const workspaceKeys = get(workspacesAtom)
  const workspaceKey =
    root?.workspace.key ??
    (route.workspace && workspaceKeys.includes(route.workspace)
      ? route.workspace
      : workspaceKeys[0])
  const workspace = workspaceKey ? workspaceAtoms(workspaceKey) : undefined
  const workspaceSettings = workspace ? get(workspace.settings) : undefined
  const workspaceLabel = workspaceSettings?.label ?? 'Alinea'
  let viewLabel = workspaceLabel
  if (content.type === 'users') {
    viewLabel = 'Users'
  } else if (content.type === 'entry') {
    viewLabel = get(content.entry.label)
  } else if (content.type === 'missing-entry') {
    viewLabel = 'Entry not found'
  } else if (content.type === 'missing-root') {
    viewLabel = 'Root not found'
  } else if (content.type === 'explorer' && route.entry) {
    const {data} = get(entryAtoms(route.entry).data)
    if (data) viewLabel = get(data.label)
  } else if (root) {
    viewLabel = get(root.settings).label
  }
  return {
    title:
      viewLabel === workspaceLabel
        ? workspaceLabel
        : `${workspaceLabel}: ${viewLabel}`,
    favicon: {
      color: workspaceSettings?.color ?? '#7c3aed',
      icon: workspaceSettings?.icon
    }
  }
}

type AsyncAtomKeys<Value> = Value extends unknown
  ? {
      [Key in keyof Value]: Value[Key] extends Atom<infer AtomValue>
        ? Extract<AtomValue, PromiseLike<unknown>> extends never
          ? never
          : Key
        : never
    }[keyof Value]
  : never

type AssertNoAsyncAtoms<Value extends never> = Value

export type PreparedPageAsyncFields = AssertNoAsyncAtoms<
  AsyncAtomKeys<PreparedPage> | AsyncAtomKeys<LoadedRoute>
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
  ): Promise<LoadedRoute> {
    const [policy, canManageMembers] = await Promise.all([
      get(options.policy),
      get(options.canManageMembers)
    ])
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

    const location = {workspace: workspaceKey, root: rootKey}
    if (!route.entry)
      return {
        ...(await loadExplorerPage(get, root, location, locale, signal)),
        canManageMembers
      }

    const entry = options.entry(route.entry)
    const entryData = await loadEntryData(get, entry)
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
