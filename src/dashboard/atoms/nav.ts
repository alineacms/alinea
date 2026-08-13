import {Atom, atom, Getter} from 'jotai'
import {atomWithLocation} from 'jotai-location'
import {getRoot} from '#/core/Internal.js'
import type {EntryDefaultView} from '#/core/Type.js'
import {ReactNode} from 'react'
import {workspaceAtom, workspacesAtom} from './config.js'
import {configAtom} from './core.js'
import {policyAtom} from './user.js'

export interface RouteBlock {
  confirm: () => void | Promise<void>
}

export const routeGuardAtom = atom<Atom<boolean> | null>(null)
export const routeBlockAtom = atom<RouteBlock | null>(null)

export interface DashboardRoute {
  page?: 'entry' | 'users'
  workspace?: string
  root?: string
  entry?: string
  locale?: string
  view?: EntryDefaultView
}

interface ResolvedDashboardRoute extends DashboardRoute {
  page: 'entry' | 'users'
}

export const nav = {
  users() {
    return '/users'
  },
  entry(
    workspace?: string,
    root?: string,
    entryId?: string,
    locale?: string | null,
    view?: EntryDefaultView
  ) {
    const rootPart = root ? `${root}${locale ? `:${locale}` : ''}` : ''
    const path = `/entry/${[workspace, rootPart, entryId].filter(Boolean).join('/')}`
    return view ? `${path}?view=${view}` : path
  }
}

function routeFromHash(hash: string): ResolvedDashboardRoute {
  const [path, search = ''] = hash.slice(1).split('?')
  const [action, workspace, rootPart = '', entry] = path
    .split('/')
    .slice(1) as Array<string | undefined>
  const page = action === 'users' ? 'users' : 'entry'
  const [root, locale] = rootPart.split(':')
  const view = new URLSearchParams(search).get('view')
  return {
    page,
    workspace: page === 'entry' ? workspace : undefined,
    root: page === 'entry' ? root : undefined,
    entry: page === 'entry' ? entry : undefined,
    locale: page === 'entry' ? locale : undefined,
    view:
      page === 'entry' && (view === 'edit' || view === 'overview')
        ? view
        : undefined
  }
}

function routeFromUpdate(update: DashboardRoute): ResolvedDashboardRoute {
  if (update.page === 'users') return {page: 'users'}
  return {
    page: 'entry',
    workspace: update.workspace,
    root: update.root,
    entry: update.entry,
    locale: update.locale,
    view: update.view
  }
}

function hashFromRoute(route: ResolvedDashboardRoute) {
  return route.page === 'users'
    ? `#${nav.users()}`
    : `#${nav.entry(
        route.workspace,
        route.root,
        route.entry,
        route.locale,
        route.view
      )}`
}

const locationAtom = atomWithLocation({
  subscribe(callback) {
    if (typeof window === 'undefined') return () => {}
    window.addEventListener('hashchange', callback)
    window.addEventListener('popstate', callback)
    return () => {
      window.removeEventListener('hashchange', callback)
      window.removeEventListener('popstate', callback)
    }
  }
})

const browserRouteAtom = atom(get =>
  routeFromHash(get(locationAtom).hash ?? '')
)

/** @internal */
export const routeAtom = atom(
  get => get(browserRouteAtom),
  (get, set, update: DashboardRoute) => {
    const route = routeFromUpdate(update)
    const commit = () =>
      set(locationAtom, location => ({
        ...location,
        hash: hashFromRoute(route)
      }))
    const guard = get(routeGuardAtom)
    if (guard && get(guard)) {
      set(routeBlockAtom, {
        confirm() {
          set(routeBlockAtom, null)
          commit()
        }
      })
      return
    }
    commit()
  }
)

export interface Page {
  type: 'users' | 'entry'
  workspace: string | undefined
  root: string | undefined
  requestedRoot?: string
  entry: string | undefined
  locale: string | null
  view: EntryDefaultView | undefined
}

export const pageAtom = atom((get): Page => {
  const route = get(routeAtom)
  const config = get(configAtom)
  const policy = get(policyAtom)
  const workspaces = get(workspacesAtom)
  const workspace =
    route.workspace && workspaces.includes(route.workspace)
      ? route.workspace
      : workspaces[0]
  const workspaceConfig = workspace ? get(workspaceAtom(workspace)) : undefined
  const roots = workspaceConfig
    ? Object.keys(workspaceConfig.roots).filter(root =>
        policy.canRead({workspace, root})
      )
    : []
  const root = route.root && roots.includes(route.root) ? route.root : roots[0]
  const rootConfig = workspaceConfig?.roots[root]
  const i18n = rootConfig ? getRoot(rootConfig).i18n : undefined
  const locale =
    route.locale && i18n?.locales.includes(route.locale)
      ? route.locale
      : (i18n?.locales[0] ?? null)
  return {
    type: route.page,
    workspace,
    root,
    requestedRoot: route.root,
    entry: route.entry,
    locale,
    view: route.view
  }
})

export function page(
  render: (page: Page, get: Getter) => ReactNode | Promise<ReactNode>
) {
  return render
}
