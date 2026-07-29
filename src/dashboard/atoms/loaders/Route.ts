import type {Config} from '#/core/Config.js'
import {getWorkspace} from '#/core/Internal.js'
import type {Policy} from '#/core/Role.js'
import type {Atom, Getter} from 'jotai'
import type {Route} from '../../DashboardNav.js'
import type {EntryDataAtoms, EntryAtoms} from '../EntryAtoms.js'
import type {RootAtoms} from '../RootAtoms.js'
import type {WorkspaceAtoms} from '../WorkspaceAtoms.js'
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

export type PreparedRouteBlockingAsyncFields = AssertNoAsyncAtoms<
  Exclude<AsyncAtomKeys<PreparedRoute>, 'sidebarResource'>
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
    const i18n = get(root.i18n)
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

    if (!route.entry) {
      if (get(root.view)) return {type: 'root', root, canManageMembers}
    }

    const rootIds = await get(root.childrenFor(locale))
    await loadTree(get, options, workspace, rootIds, locale, [], signal)
    signal.throwIfAborted()

    const location = {workspace: workspaceKey, root: rootKey}
    if (!route.entry) {
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
