import type {Atom, Getter, Setter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import type {Route, RouteUpdate} from '../../DashboardNav.js'
import type {RouteHistory} from './history.js'

export interface PendingNavigation {
  id: number
  route: Route
}

export interface Navigation {
  route: WritableAtom<Route, [update: RouteUpdate], Promise<boolean>>
  requestedRoute: Atom<Route>
  pending: Atom<PendingNavigation | undefined>
  error: Atom<Error | undefined>
}

export interface NavigationContext {
  currentRoute: Route
  get: Getter
  set: Setter
  signal: AbortSignal
}

export interface NavigationOptions {
  history: RouteHistory
  allow?(route: Route, context: NavigationContext): boolean | Promise<boolean>
  prepare(route: Route, context: NavigationContext): Promise<void>
}

interface PushRequest {
  type: 'push'
  update: RouteUpdate
}

interface PopRequest {
  type: 'pop'
  route: Route
}

type NavigationRequest = PushRequest | PopRequest

export function createNavigation(options: NavigationOptions): Navigation {
  const current = atom(options.history.read())
  const requested = atom<PendingNavigation>()
  const pending = atom<PendingNavigation>()
  const error = atom<Error>()
  let sequence = 0
  let active: AbortController | undefined
  function start() {
    const id = ++sequence
    active?.abort()
    const controller = new AbortController()
    active = controller
    return {id, controller}
  }

  const request = Object.assign(
    atom(
      get => get(current),
      async (get, set, navigation: NavigationRequest): Promise<boolean> => {
        const {id, controller} = start()
        const route =
          navigation.type === 'pop'
            ? navigation.route
            : routeFromUpdate(navigation.update)
        const context = {
          currentRoute: get(current),
          get,
          set,
          signal: controller.signal
        } satisfies NavigationContext

        set(requested, undefined)
        set(pending, undefined)
        set(error, undefined)
        try {
          const allowed = (await options.allow?.(route, context)) ?? true
          if (controller.signal.aborted || id !== sequence) return false
          if (!allowed) {
            if (navigation.type === 'pop') options.history.replace(get(current))
            set(requested, undefined)
            return false
          }

          set(requested, {id, route})
          set(pending, {id, route})
          await options.prepare(route, context)
          if (controller.signal.aborted || id !== sequence) return false
          if (navigation.type === 'push') options.history.push(route)
          set(current, route)
          set(requested, undefined)
          set(pending, undefined)
          return true
        } catch (cause) {
          if (controller.signal.aborted || id !== sequence) return false
          const navigationError =
            cause instanceof Error ? cause : new Error(String(cause))
          if (navigation.type === 'pop') options.history.replace(get(current))
          set(error, navigationError)
          set(requested, undefined)
          set(pending, undefined)
          return false
        } finally {
          if (active === controller) active = undefined
        }
      }
    ),
    {
      onMount(navigate: (request: NavigationRequest) => void) {
        return options.history.subscribe(route => {
          void navigate({type: 'pop', route})
        })
      }
    }
  )

  const route = atom(
    get => get(request),
    (get, set, update: RouteUpdate) => {
      return set(request, {type: 'push', update})
    }
  )
  const requestedRoute = atom(get => get(requested)?.route ?? get(current))
  return {route, requestedRoute, pending, error}
}

function routeFromUpdate(update: RouteUpdate): Route {
  if (update.page === 'users') return {page: 'users'}
  return {
    page: 'entry',
    workspace: update.workspace,
    root: update.root,
    entry: update.entry,
    locale: update.locale
  }
}
