import {Atom, atom, Getter} from 'jotai'
import {getRoot} from '#/core/Internal.js'
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

export interface Page {
  type: 'users' | 'entry'
  workspace: string | undefined
  root: string | undefined
  requestedRoot?: string
  entry: string | undefined
  locale: string | null
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
    locale
  }
})

export function page(
  render: (page: Page, get: Getter) => ReactNode | Promise<ReactNode>
) {
  return render
}
