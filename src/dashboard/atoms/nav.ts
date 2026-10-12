import {Atom, atom, type Getter, type Setter} from 'jotai'
import {atomWithLocation} from 'jotai-location'
import {Entry} from '#/core/Entry.js'
import {getRoot} from '#/core/Internal.js'
import type {OverviewSort} from '#/core/Overview.js'
import type {EntryDefaultView} from '#/core/Type.js'
import {ReactNode} from 'react'
import {workspaceAtom, workspacesAtom} from './config.js'
import {configAtom, graphAtom} from './core.js'
import {policyAtom} from './user.js'
import {dispense} from './utils.js'

export interface RouteBlock {
  confirm: () => void | Promise<void>
}

export const routeGuardAtom = atom<Atom<boolean> | null>(null)
export const routeBlockAtom = atom<RouteBlock | null>(null)

export interface DashboardRoute {
  /** An edit link names an entry by its url, until it is looked up */
  page?: 'splash' | 'entry' | 'users' | 'edit'
  url?: string
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
  page: 'splash' | 'entry' | 'users' | 'edit'
}

export const nav = {
  splash() {
    return '/'
  },
  users() {
    return '/users'
  },
  /** The editor of the entry at `url`, as linked from a page of the site */
  edit(url: string, workspace?: string, root?: string) {
    const params = new URLSearchParams({url})
    if (workspace) params.set('workspace', workspace)
    if (root) params.set('root', root)
    return `/edit?${params}`
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
const overviewSortMemoryAtom = atom(new Map<string, OverviewSort>())

function routeFromHash(hash: string): ResolvedDashboardRoute {
  const [path, search = ''] = hash.slice(1).split('?')
  const [action, workspace, rootPart = '', entry] = path
    .split('/')
    .slice(1) as Array<string | undefined>
  const params = new URLSearchParams(search)
  const url = params.get('url')
  if (action === 'edit' && url)
    return {
      page: 'edit',
      url,
      workspace: params.get('workspace') ?? undefined,
      root: params.get('root') ?? undefined
    }
  const page =
    action === 'users' ? 'users' : action === 'entry' ? 'entry' : 'splash'
  const [root, locale] = rootPart.split(':')
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
  if (update.page === 'edit')
    return update.url
      ? {
          page: 'edit',
          url: update.url,
          workspace: update.workspace,
          root: update.root
        }
      : {page: 'splash'}
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
  if (route.page === 'edit')
    return `#${nav.edit(route.url ?? '/', route.workspace, route.root)}`
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
/** Counts the lookups of edit links, of which the last one navigates */
let linkLookups = 0

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
      if (request.route.page !== 'edit')
        return navigate(get, set, request, 'sort' in update)
      // The current page stays, also in the address bar, until the linked
      // entry is found; a navigation meanwhile wins
      const current = get(currentRouteAtom)
      const lookup = ++linkLookups
      set(
        locationAtom,
        location => ({...location, hash: hashFromRoute(current)}),
        {replace: true}
      )
      return linkedRoute(get, request.route)
        .catch(() => ({page: 'splash'}) as ResolvedDashboardRoute)
        .then(route => {
          if (lookup !== linkLookups || get(currentRouteAtom) !== current)
            return
          navigate(get, set, {route, replace: true}, true)
        })
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

function navigate(
  get: Getter,
  set: Setter,
  request: NavigationRequest,
  sortGiven: boolean
) {
  let {route} = request
  const key = sortKey(get, request)
  // The url is the source of truth for the sort of an overview, an
  // explicit undefined sort resets it
  const explicit = request.browser || route.sort !== undefined || sortGiven
  if (key && !explicit) {
    const sort = get(overviewSortMemoryAtom).get(key)
    if (sort) route = {...route, sort: formatOverviewSort(sort)}
  }
  const previous = get(currentRouteAtom)
  const commit = (
    replace = request.replace ?? false,
    syncLocation = !request.browser
  ) => {
    set(currentRouteAtom, route)
    if (key)
      set(overviewSortMemoryAtom, memory => remember(memory, key, route.sort))
    if (!syncLocation) return
    set(locationAtom, location => ({...location, hash: hashFromRoute(route)}), {
      replace
    })
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

/** The route of the entry an edit link names by url, or the splash page */
async function linkedRoute(
  get: Getter,
  {url = '/', workspace, root}: ResolvedDashboardRoute
): Promise<ResolvedDashboardRoute> {
  const graph = get(graphAtom)
  const query = {
    workspace,
    root,
    status: 'preferDraft' as const,
    select: {
      entry: Entry.id,
      locale: Entry.locale,
      workspace: Entry.workspace,
      root: Entry.root
    }
  }
  // The pathname of a page may be encoded, stored urls are not
  const urls = [...new Set([withoutSlash(url), withoutSlash(decoded(url))])]
  // A live page that took over the url as an alias wins over the archived
  // page that had it
  const live = {...query, filter: {_status: {isNot: 'archived' as const}}}
  const found =
    (await graph.first({...live, url: {in: urls}})) ??
    (await graph.first({...live, alias: {in: urls}})) ??
    (await graph.first({...query, url: {in: urls}}))
  if (!found) return {page: 'splash'}
  return {page: 'entry', ...found, locale: found.locale ?? undefined}
}

function decoded(url: string): string {
  try {
    return decodeURI(url)
  } catch {
    return url
  }
}

/** Entry urls are stored without a trailing slash */
function withoutSlash(url: string): string {
  return url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url
}

/** The overview whose sort a navigation shows */
function sortKey(get: Getter, {browser, route}: NavigationRequest) {
  if (route.page !== 'entry') return undefined
  if (route.workspace && route.root)
    return listKey(route.workspace, route.root, route.entry)
  // The browser can navigate before the dashboard is ready to resolve a page
  if (browser) return undefined
  const page = resolvePage(get, route)
  return listKey(page.workspace, page.root, page.entry)
}

function remember(
  memory: Map<string, OverviewSort>,
  key: string,
  value: string | undefined
) {
  if (formatOverviewSort(memory.get(key)) === value) return memory
  const next = new Map(memory)
  const sort = parseOverviewSort(value)
  if (sort) next.set(key, sort)
  else next.delete(key)
  return next
}

export interface Page {
  type: 'splash' | 'users' | 'entry' | 'edit'
  workspace: string | undefined
  root: string | undefined
  requestedRoot?: string
  entry: string | undefined
  locale: string | null
  view: EntryDefaultView | undefined
}

export const pageAtom = atom(get => resolvePage(get, get(routeAtom)))

function resolvePage(get: Getter, route: ResolvedDashboardRoute): Page {
  if (route.page === 'edit')
    return {
      type: 'edit',
      workspace: undefined,
      root: undefined,
      entry: undefined,
      locale: null,
      view: undefined
    }
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
    view: route.view
  }
}

/**
 * The sort of the overview listing the children of an entry, or of a root
 * when `entry` is null. The overview of the current page keeps it in the url.
 */
export const overviewSortAtom = dispense(
  (workspace: string, root: string, entry: string | null) => {
    const key = listKey(workspace, root, entry ?? undefined)
    return atom(
      get => get(overviewSortMemoryAtom).get(key),
      (get, set, sort: OverviewSort | undefined) => {
        const page = get(pageAtom)
        const value = formatOverviewSort(sort)
        if (
          page.type !== 'entry' ||
          listKey(page.workspace, page.root, page.entry) !== key
        ) {
          set(overviewSortMemoryAtom, memory => remember(memory, key, value))
          return
        }
        set(routeAtom, {
          workspace,
          root,
          entry: page.entry,
          locale: page.locale ?? undefined,
          view: page.view,
          sort: value,
          replace: true
        })
      }
    )
  }
)

export function page(
  render: (page: Page, get: Getter) => ReactNode | Promise<ReactNode>
) {
  return render
}
