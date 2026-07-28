import type {Atom, Getter} from 'jotai'
import type {Route} from '../../DashboardNav.js'
import type {EntryDataState, EntryState} from '../EntryAtoms.js'
import type {Root} from '../RootAtoms.js'
import type {Workspace} from '../WorkspaceAtoms.js'
import {loadEntryPage, type EntryPageData} from './Entry.js'
import {loadExplorerPage, loadTree, type ExplorerPageData} from './Explorer.js'

export interface EmptyPageData {
  type: 'empty'
}

export interface UsersPageData {
  type: 'users'
}

export interface RootPageData {
  type: 'root'
  root: Root
}

export interface MissingEntryPageData {
  type: 'missing-entry'
  entryId: string
  root: Root
}

export interface MissingRootPageData {
  type: 'missing-root'
  rootKey: string
  root: Root
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

export type LoadedRoute = PreparedRoute

type AsyncAtomKeys<Value> = Value extends unknown
  ? {
      [Key in keyof Value]: Value[Key] extends Atom<Promise<unknown>>
        ? Key
        : never
    }[keyof Value]
  : never

type AssertNoAsyncAtoms<Value extends never> = Value

export type PreparedRouteAsyncFields = AssertNoAsyncAtoms<
  Exclude<AsyncAtomKeys<PreparedRoute>, 'sidebar'>
>

export interface RouteLoaderOptions {
  policy: Atom<Promise<unknown>>
  canManageMembers: Atom<Promise<boolean>>
  workspaces: Atom<Array<string>>
  workspace(key: string): Workspace
  entry(id: string): EntryState
  loadEntry?(
    get: Getter,
    entry: EntryDataState,
    locale: string | null
  ): Promise<EntryPageData>
}

export function createRouteLoader(options: RouteLoaderOptions) {
  return async function loadRoute(
    get: Getter,
    route: Route,
    signal: AbortSignal
  ): Promise<PreparedRoute> {
    const [, canManageMembers] = await Promise.all([
      get(options.policy),
      get(options.canManageMembers)
    ])
    signal.throwIfAborted()
    if (route.page === 'users' && canManageMembers)
      return {type: 'users', canManageMembers}

    const workspaceKeys = get(options.workspaces)
    const workspaceKey =
      route.workspace && workspaceKeys.includes(route.workspace)
        ? route.workspace
        : workspaceKeys[0]
    if (!workspaceKey) return {type: 'empty', canManageMembers}

    const workspace = options.workspace(workspaceKey)
    const rootKeys = get(workspace.roots)
    const rootKey =
      route.root && rootKeys.includes(route.root) ? route.root : rootKeys[0]
    if (!rootKey) return {type: 'empty', canManageMembers}

    const root = workspace.root(rootKey)
    const i18n = get(root.i18n)
    const locale =
      route.locale && i18n?.locales.includes(route.locale)
        ? route.locale
        : (i18n?.locales[0] ?? null)
    const rootIds = await get(root.childrenFor(locale))
    await loadTree(get, options, workspace, rootIds, locale, [], signal)
    signal.throwIfAborted()

    if (route.root && route.root !== rootKey)
      return {
        type: 'missing-root',
        rootKey: route.root,
        root,
        canManageMembers
      }

    const location = {workspace: workspaceKey, root: rootKey}
    if (!route.entry) {
      if (get(root.view)) return {type: 'root', root, canManageMembers}
      return {
        ...(await loadExplorerPage(get, root, location, locale, signal)),
        canManageMembers
      }
    }

    const entry = options.entry(route.entry)
    const ready = await get(entry.readyState)
    signal.throwIfAborted()
    if (!ready.data)
      return {
        type: 'missing-entry',
        entryId: route.entry,
        root,
        canManageMembers
      }

    const parentIds = get(ready.data.parentIds)
    await loadTree(
      get,
      options,
      workspace,
      rootIds,
      locale,
      [...parentIds, route.entry],
      signal
    )
    if (get(ready.data.view) === 'edit')
      return {
        ...(await (options.loadEntry ?? loadEntryPage)(
          get,
          ready.data,
          locale
        )),
        canManageMembers
      }

    await get(ready.data.childrenFor(locale))
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
