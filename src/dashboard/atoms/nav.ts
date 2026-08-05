import {Atom, atom, Getter} from 'jotai'
import type {Policy} from '#/core/Role.js'
import type {User} from '#/core/User.js'
import {selectAtom} from 'jotai/utils'
import {ReactNode} from 'react'
import {workspaceAtoms} from './config.js'
import {configAtom} from './core.js'

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
}

interface ResolvedDashboardRoute extends DashboardRoute {
  page: 'entry' | 'users'
}

interface PushNavigation {
  type: 'push'
  route: ResolvedDashboardRoute
}

interface PopNavigation {
  type: 'pop'
  route: ResolvedDashboardRoute
}

type NavigationRequest = PushNavigation | PopNavigation

export const nav = {
  users() {
    return '/users'
  },
  entry(
    workspace?: string,
    root?: string,
    entryId?: string,
    locale?: string | null
  ) {
    const rootPart = root ? `${root}${locale ? `:${locale}` : ''}` : ''
    return `/entry/${[workspace, rootPart, entryId].filter(Boolean).join('/')}`
  }
}

function routeFromHash(hash: string): ResolvedDashboardRoute {
  const [action, workspace, rootPart = '', entry] = hash
    .slice(1)
    .split('/')
    .slice(1) as Array<string | undefined>
  const page = action === 'users' ? 'users' : 'entry'
  const [root, locale] = rootPart.split(':')
  return {
    page,
    workspace: page === 'entry' ? workspace : undefined,
    root: page === 'entry' ? root : undefined,
    entry: page === 'entry' ? entry : undefined,
    locale: page === 'entry' ? locale : undefined
  }
}

function routeFromUpdate(update: DashboardRoute): ResolvedDashboardRoute {
  if (update.page === 'users') return {page: 'users'}
  return {
    page: 'entry',
    workspace: update.workspace,
    root: update.root,
    entry: update.entry,
    locale: update.locale
  }
}

function readBrowserRoute(): ResolvedDashboardRoute {
  return routeFromHash(
    typeof window === 'undefined' ? '' : window.location.hash
  )
}

function applyBrowserRoute(route: ResolvedDashboardRoute, replace: boolean) {
  if (typeof window === 'undefined') return
  const hash =
    route.page === 'users'
      ? `#${nav.users()}`
      : `#${nav.entry(route.workspace, route.root, route.entry, route.locale)}`
  const url = new URL(window.location.href)
  url.hash = hash
  if (replace) window.history.replaceState(window.history.state, '', url)
  else window.history.pushState(null, '', url)
}

const currentRouteAtom = atom<ResolvedDashboardRoute>(readBrowserRoute())

const navigationAtom = Object.assign(
  atom(
    get => get(currentRouteAtom),
    (get, set, request: NavigationRequest) => {
      const previous = get(currentRouteAtom)
      const commit = () => {
        if (request.type === 'push') applyBrowserRoute(request.route, false)
        set(currentRouteAtom, request.route)
      }
      const guard = get(routeGuardAtom)
      if (guard && get(guard)) {
        if (request.type === 'pop') applyBrowserRoute(previous, true)
        set(routeBlockAtom, {
          confirm() {
            set(routeBlockAtom, null)
            if (request.type === 'pop') applyBrowserRoute(request.route, true)
            commit()
          }
        })
        return
      }
      commit()
    }
  ),
  {
    onMount(navigate: (request: NavigationRequest) => void) {
      if (typeof window === 'undefined') return
      const onPopState = () => {
        navigate({type: 'pop', route: readBrowserRoute()})
      }
      window.addEventListener('popstate', onPopState)
      onPopState()
      return () => window.removeEventListener('popstate', onPopState)
    }
  }
)

/** @internal */
export const routeAtom = atom(
  get => get(navigationAtom),
  (_get, set, update: DashboardRoute) =>
    set(navigationAtom, {type: 'push', route: routeFromUpdate(update)})
)

const pageTypeAtom = selectAtom(routeAtom, route => route.page)
const entryAtom = selectAtom(routeAtom, route => route.entry)

function resolveLocale(
  get: Getter,
  route: DashboardRoute,
  workspace: string | undefined,
  root: string | undefined
) {
  if (!workspace) return null
  if (!root) return null
  const {i18n, languagePreferenceAtom} = get(
    workspaceAtoms(workspace).rootsAtom(root)
  )
  if (route.locale && i18n?.locales.includes(route.locale)) return route.locale
  const preference = get(languagePreferenceAtom)
  if (preference) return preference
  return i18n?.locales[0] ?? null
}

function resolveWorkspace(
  get: Getter,
  route: DashboardRoute,
  policy: Policy
): string | undefined {
  const {workspace} = route
  const workspaces = Object.keys(get(configAtom).workspaces).filter(candidate =>
    policy.canRead({workspace: candidate})
  )
  return workspace && workspaces.includes(workspace) ? workspace : workspaces[0]
}

function resolveRoot(
  get: Getter,
  route: DashboardRoute,
  workspace: string | undefined,
  policy: Policy
) {
  const {root} = route
  if (!workspace) return undefined
  const workspaceConfig = get(workspaceAtoms(workspace).settingsAtom)
  const roots = Object.keys(workspaceConfig.roots).filter(candidate =>
    policy.canRead({workspace, root: candidate})
  )
  if (root && roots.includes(root)) {
    return root
  } else {
    return roots[0]
  }
}

export interface Page {
  type: 'users' | 'entry'
  workspace: string | undefined
  root: string | undefined
  requestedRoot?: string
  entry: string | undefined
  locale: string | null | undefined
  auth: PageAuth
}

export interface PageAuth {
  user: User
  policy: Policy
}

export function resolvePage(get: Getter, auth: PageAuth): Page {
  const route = get(routeAtom)
  const {policy} = auth
  const workspace = resolveWorkspace(get, route, policy)
  const root = resolveRoot(get, route, workspace, policy)
  return {
    type: get(pageTypeAtom),
    workspace,
    root,
    requestedRoot: route.root,
    entry: get(entryAtom),
    locale: resolveLocale(get, route, workspace, root),
    auth
  }
}

export function page(
  render: (page: Page, get: Getter) => ReactNode | Promise<ReactNode>
) {
  return render
}
