import {nav, type Route} from '../../DashboardNav.js'

export interface RouteHistory {
  read(): Route
  push(route: Route): void
  replace(route: Route): void
  subscribe(listener: (route: Route) => void): () => void
}

export function routeFromHash(hash: string): Route {
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

export function routeHash(route: Route): string {
  if (route.page === 'users') return `#${nav.users()}`
  return `#${nav.entry(route.workspace, route.root, route.entry, route.locale)}`
}

export function createBrowserHistory(): RouteHistory {
  function read(): Route {
    if (typeof window === 'undefined') return {page: 'entry'}
    return routeFromHash(window.location.hash)
  }

  function apply(route: Route, replace: boolean) {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.hash = routeHash(route)
    if (replace) window.history.replaceState(window.history.state, '', url)
    else window.history.pushState(null, '', url)
  }

  return {
    read,
    push(route) {
      apply(route, false)
    },
    replace(route) {
      apply(route, true)
    },
    subscribe(listener) {
      if (typeof window === 'undefined') return () => {}
      const onPopState = () => listener(read())
      window.addEventListener('popstate', onPopState)
      return () => window.removeEventListener('popstate', onPopState)
    }
  }
}
