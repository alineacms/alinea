import {Atom, atom, Getter} from 'jotai'
import {atomWithLocation} from 'jotai-location'
import {getRoot} from '#/core/Internal.js'
import type {OverviewSort} from '#/core/Overview.js'
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
  page?: 'splash' | 'entry' | 'users'
  workspace?: string
  root?: string
  entry?: string
  locale?: string
  view?: EntryDefaultView
  /** The column an overview is sorted by, eg. `price` or `-price` */
  sort?: string
  /** Replace the current history entry instead of adding one */
  replace?: boolean
}

interface ResolvedDashboardRoute extends DashboardRoute {
  page: 'splash' | 'entry' | 'users'
}

export const nav = {
  splash() {
    return '/'
  },
  users() {
    return '/users'
  },
  entry(
    workspace?: string,
    root?: string,
    entryId?: string,
    locale?: string | null,
    view?: EntryDefaultView,
    sort?: string
  ) {
    const rootPart = root ? `${root}${locale ? `:${locale}` : ''}` : ''
    const path = `/entry/${[workspace, rootPart, entryId].filter(Boolean).join('/')}`
    const params = new URLSearchParams()
    if (view) params.set('view', view)
    if (sort) params.set('sort', sort)
    const search = params.toString()
    return search ? `${path}?${search}` : path
  }
}

/** The url parameter of an overview sort: the column, prefixed with - when descending */
export function formatOverviewSort(sort?: OverviewSort): string | undefined {
  if (!sort) return undefined
  return sort.direction === 'desc' ? `-${sort.column}` : sort.column
}

export function parseOverviewSort(
  value: string | undefined
): OverviewSort | undefined {
  if (!value) return undefined
  const desc = value.startsWith('-')
  const column = desc ? value.slice(1) : value
  if (!column) return undefined
  return {column, direction: desc ? 'desc' : 'asc'}
}

function listKey(
  workspace: string | undefined,
  root: string | undefined,
  entry: string | undefined
) {
  return `${workspace ?? ''}/${root ?? ''}/${entry ?? ''}`
}

/**
 * The sort of each overview visited in this session, so an overview keeps
 * its sort when the editor returns to it
 */
const overviewSortMemoryAtom = atom(new Map<string, string>())

function routeFromHash(hash: string): ResolvedDashboardRoute {
  const [path, search = ''] = hash.slice(1).split('?')
  const [action, workspace, rootPart = '', entry] = path
    .split('/')
    .slice(1) as Array<string | undefined>
  const page =
    action === 'users' ? 'users' : action === 'entry' ? 'entry' : 'splash'
  const [root, locale] = rootPart.split(':')
  const params = new URLSearchParams(search)
  const view = params.get('view')
  const sort = params.get('sort')
  return {
    page,
    workspace: page === 'entry' ? workspace : undefined,
    root: page === 'entry' ? root : undefined,
    entry: page === 'entry' ? entry : undefined,
    locale: page === 'entry' ? locale : undefined,
    view:
      page === 'entry' && (view === 'edit' || view === 'overview')
        ? view
        : undefined,
    sort: page === 'entry' && sort ? sort : undefined
  }
}

function routeFromUpdate(update: DashboardRoute): ResolvedDashboardRoute {
  if (update.page === 'users') return {page: 'users'}
  if (update.page === 'splash') return {page: 'splash'}
  return {
    page: 'entry',
    workspace: update.workspace,
    root: update.root,
    entry: update.entry,
    locale: update.locale,
    view: update.view,
    sort: update.sort
  }
}

function hashFromRoute(route: ResolvedDashboardRoute) {
  return route.page === 'splash'
    ? `#${nav.splash()}`
    : route.page === 'users'
      ? `#${nav.users()}`
      : `#${nav.entry(
          route.workspace,
          route.root,
          route.entry,
          route.locale,
          route.view,
          route.sort
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

const initialRoute = routeFromHash(
  typeof window === 'undefined' ? '' : window.location.hash
)
const currentRouteAtom = atom(initialRoute)
let ignoredBrowserHash: string | undefined

interface NavigationRequest {
  browser?: boolean
  replace?: boolean
  route: ResolvedDashboardRoute
}

/** @internal */
export const routeAtom = Object.assign(
  atom(
    get => get(currentRouteAtom),
    (get, set, update: DashboardRoute | NavigationRequest) => {
      const request =
        'route' in update
          ? update
          : ({
              route: routeFromUpdate(update),
              replace: update.replace
            } satisfies NavigationRequest)
      let {route} = request
      const memory = get(overviewSortMemoryAtom)
      const key = listKey(route.workspace, route.root, route.entry)
      if (route.page === 'entry') {
        if (request.browser) {
          // The url is the source of truth for the sort of an overview
          if (route.sort || memory.has(key))
            set(overviewSortMemoryAtom, remember(memory, key, route.sort))
        } else if ('sort' in route && route.sort !== undefined) {
          set(overviewSortMemoryAtom, remember(memory, key, route.sort))
        } else if (update !== request && 'sort' in update) {
          // An explicit undefined sort resets the overview
          set(overviewSortMemoryAtom, remember(memory, key, undefined))
        } else if (memory.has(key)) {
          route = {...route, sort: memory.get(key)}
        }
      }
      const previous = get(currentRouteAtom)
      const commit = (
        replace = request.replace ?? false,
        syncLocation = !request.browser
      ) => {
        set(currentRouteAtom, route)
        if (!syncLocation) return
        set(
          locationAtom,
          location => ({...location, hash: hashFromRoute(route)}),
          {replace}
        )
      }
      const guard = get(routeGuardAtom)
      if (guard && get(guard)) {
        if (request.browser) {
          ignoredBrowserHash = hashFromRoute(previous)
          set(
            locationAtom,
            location => ({...location, hash: hashFromRoute(previous)}),
            {replace: true}
          )
        }
        set(routeBlockAtom, {
          confirm() {
            set(routeBlockAtom, null)
            commit(request.browser, true)
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
      const onNavigation = () => {
        if (window.location.hash === ignoredBrowserHash) {
          ignoredBrowserHash = undefined
          return
        }
        navigate({browser: true, route: routeFromHash(window.location.hash)})
      }
      window.addEventListener('hashchange', onNavigation)
      window.addEventListener('popstate', onNavigation)
      onNavigation()
      return () => {
        window.removeEventListener('hashchange', onNavigation)
        window.removeEventListener('popstate', onNavigation)
      }
    }
  }
)

function remember(
  memory: Map<string, string>,
  key: string,
  sort: string | undefined
) {
  const next = new Map(memory)
  if (sort) next.set(key, sort)
  else next.delete(key)
  return next
}

export interface Page {
  type: 'splash' | 'users' | 'entry'
  workspace: string | undefined
  root: string | undefined
  requestedRoot?: string
  entry: string | undefined
  locale: string | null
  view: EntryDefaultView | undefined
  /** The column the overview on this page is sorted by */
  sort?: OverviewSort
}

export const pageAtom = atom((get): Page => {
  const route = get(routeAtom)
  const config = get(configAtom)
  const policy = get(policyAtom)
  const workspaces = get(workspacesAtom)
  const pageType =
    route.page === 'splash' && workspaces.length === 1 ? 'entry' : route.page
  const workspace =
    pageType === 'splash'
      ? undefined
      : route.workspace && workspaces.includes(route.workspace)
        ? route.workspace
        : workspaces[0]
  const workspaceConfig = workspace ? get(workspaceAtom(workspace)) : undefined
  const roots = workspaceConfig
    ? Object.keys(workspaceConfig.roots).filter(root =>
        policy.canRead({workspace, root})
      )
    : []
  // Without a requested root, open the first root marked openByDefault
  const defaultRoot =
    roots.find(key => getRoot(workspaceConfig!.roots[key]).openByDefault) ??
    roots[0]
  const root =
    route.root && roots.includes(route.root) ? route.root : defaultRoot
  const rootConfig = workspaceConfig?.roots[root]
  const i18n = rootConfig ? getRoot(rootConfig).i18n : undefined
  const locale =
    route.locale && i18n?.locales.includes(route.locale)
      ? route.locale
      : (i18n?.locales[0] ?? null)
  return {
    type: pageType,
    workspace,
    root,
    requestedRoot: route.root,
    entry: route.entry,
    locale,
    view: route.view,
    sort: parseOverviewSort(route.sort)
  }
})

/**
 * Sorts the overview of the current page, reflected in the url. Pass
 * undefined to return to the default order.
 */
export const sortPageOverviewAtom = atom(
  null,
  (get, set, sort: OverviewSort | undefined) => {
    const page = get(pageAtom)
    set(routeAtom, {
      workspace: page.workspace,
      root: page.root,
      entry: page.entry,
      locale: page.locale ?? undefined,
      view: page.view,
      sort: formatOverviewSort(sort),
      replace: true
    })
  }
)

export function page(
  render: (page: Page, get: Getter) => ReactNode | Promise<ReactNode>
) {
  return render
}
