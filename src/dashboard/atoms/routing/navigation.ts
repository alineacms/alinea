import type {Atom, Getter, Setter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import type {Route, RouteUpdate} from '../../DashboardNav.js'
import type {RouteHistory} from './history.js'

export interface PendingNavigation {
  id: number
  route: Route
}

export interface Navigation<Prepared = void> {
  route: WritableAtom<Route, [update: RouteUpdate], Promise<boolean>>
  prepared: WritableAtom<Prepared | undefined, [prepared: Prepared], void>
  refresh: WritableAtom<null, [route: Route, prepared: Prepared], boolean>
  pending: Atom<PendingNavigation | undefined>
  error: Atom<Error | undefined>
}

export interface NavigationContext {
  get: Getter
  set: Setter
  signal: AbortSignal
}

export interface NavigationOptions<Prepared> {
  history: RouteHistory
  allow?(route: Route, context: NavigationContext): boolean | Promise<boolean>
  prepare(route: Route, context: NavigationContext): Promise<Prepared>
}

interface CurrentNavigation<Prepared> {
  route: Route
  prepared: Prepared | undefined
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

export function createNavigation<Prepared = void>(
  options: NavigationOptions<Prepared>
): Navigation<Prepared> {
  const current = atom<CurrentNavigation<Prepared>>({
    route: options.history.read(),
    prepared: undefined
  })
  const pending = atom<PendingNavigation>()
  const error = atom<Error>()
  let sequence = 0
  let active: AbortController | undefined

  const request = Object.assign(
    atom(
      get => get(current).route,
      async (get, set, navigation: NavigationRequest): Promise<boolean> => {
        const id = ++sequence
        active?.abort()
        const controller = new AbortController()
        active = controller
        const route =
          navigation.type === 'pop'
            ? navigation.route
            : routeFromUpdate(navigation.update)
        const context = {
          get,
          set,
          signal: controller.signal
        } satisfies NavigationContext

        set(pending, undefined)
        set(error, undefined)
        try {
          const allowed = (await options.allow?.(route, context)) ?? true
          if (controller.signal.aborted || id !== sequence) return false
          if (!allowed) {
            if (navigation.type === 'pop')
              options.history.replace(get(current).route)
            return false
          }

          set(pending, {id, route})
          const prepared = await options.prepare(route, context)
          if (controller.signal.aborted || id !== sequence) return false
          if (navigation.type === 'push') options.history.push(route)
          set(current, {route, prepared})
          set(pending, undefined)
          return true
        } catch (cause) {
          if (controller.signal.aborted || id !== sequence) return false
          const navigationError =
            cause instanceof Error ? cause : new Error(String(cause))
          if (navigation.type === 'pop')
            options.history.replace(get(current).route)
          set(error, navigationError)
          set(pending, undefined)
          return false
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

  const prepared = atom(
    get => get(current).prepared,
    (get, set, prepared: Prepared) => {
      set(current, {...get(current), prepared})
    }
  )

  const refresh = atom(
    null,
    (get, set, route: Route, prepared: Prepared): boolean => {
      const currentNavigation = get(current)
      if (currentNavigation.route !== route) return false
      set(current, {...currentNavigation, prepared})
      return true
    }
  )

  return {route, prepared, refresh, pending, error}
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
