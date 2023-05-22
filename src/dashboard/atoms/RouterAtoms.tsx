import {Atom, PrimitiveAtom, atom, useAtomValue, useSetAtom} from 'jotai'
import {
  FunctionComponent,
  PropsWithChildren,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState
} from 'react'
import {locationAtom, matchAtoms} from './LocationAtoms.js'

export interface RouteData<T> {
  path: string
  loader: (params: Record<string, string>) => Atom<Promise<T>>
  component: FunctionComponent<T>
}

export class Route<T = any> {
  constructor(public data: RouteData<T>) {}
  get component() {
    return this.data.component
  }
}

export interface RouterData {
  routes: Array<Route>
}

export class Router {
  matchers: Array<{
    route: Route
    matcher: Atom<Record<string, string> | undefined>
  }>

  constructor(public data: RouterData) {
    this.matchers = this.data.routes.map(route => ({
      route,
      matcher: matchAtoms({route: route.data.path})
    }))
  }

  matchingRoute = atom(get => {
    for (const {route, matcher} of this.matchers) {
      const params = get(matcher)
      if (params) return {route, params}
    }
  })

  matchingRouteWithData = atom(async (get): Promise<Match> => {
    const match = get(this.matchingRoute)
    if (!match) return undefined
    const data = await get(match.route.data.loader(match.params))
    return {route: match.route, data, params: match.params}
  })

  currentRoute = atom<Match>(undefined)
  prevLocation = atom<URL | undefined>(undefined)

  blockers = atom(new Set<PrimitiveAtom<BlockingResponse>>())

  expected: Promise<Match> | undefined
  cancelled = atom(false)
  match = atom<Match | Promise<Match>, [Promise<Match>, Match], void>(
    (get, {setSelf}) => {
      const current = get(this.currentRoute)
      const next = get(this.matchingRouteWithData)
      this.expected = next.then(value => {
        setSelf(this.expected!, value)
        return value
      })
      return current ?? this.expected
    },
    (get, set, forPromise: Promise<Match>, value: Match) => {
      const cancelled = get(this.cancelled)
      if (cancelled) {
        set(this.cancelled, false)
        return
      }
      const blockers = get(this.blockers)
      if (forPromise !== this.expected) return
      const currentLocation = get(locationAtom)
      const prevLocation = get(this.prevLocation)
      const confirm = () => {
        for (const block of blockers) set(block, undefined)
        set(this.currentRoute, value)
        set(this.prevLocation, currentLocation)
      }
      const cancel = () => {
        set(this.cancelled, true)
        for (const block of blockers) set(block, undefined)
        if (prevLocation) {
          const returnTo = prevLocation.pathname + prevLocation.search
          set(locationAtom, returnTo)
        }
      }
      if (blockers.size) {
        for (const block of blockers)
          set(block, {
            nextRoute: value,
            confirm,
            cancel
          })
      } else {
        confirm()
      }
    }
  )
}

export interface RouterProviderProps {
  router: Router
}

const RouterContext = createContext<Router | undefined>(undefined)

export function RouterProvider({
  children,
  router
}: PropsWithChildren<RouterProviderProps>) {
  return (
    <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
  )
}

export function useRouter() {
  const router = useContext(RouterContext)
  if (!router) throw new Error('No router context found')
  return router
}

export interface RouteMatch<T = any> {
  route: Route<T>
  data: T
  params: Record<string, string>
}

type Match = RouteMatch | undefined
type BlockingResponse =
  | {
      nextRoute: Match
      confirm(): void
      cancel(): void
    }
  | undefined
export type UseBlockerData =
  | {
      isBlocking: true
      nextRoute?: Match
      confirm(): void
      cancel(): void
    }
  | {
      isBlocking: false
      nextRoute: undefined
      confirm: undefined
      cancel: undefined
    }

export function useRouteBlocker(
  message: string,
  when: boolean
): UseBlockerData {
  const router = useRouter()
  const [blockingAtom] = useState(() => atom(undefined as BlockingResponse))
  const setBlockers = useSetAtom(router.blockers)
  useEffect(() => {
    if (!when) return
    setBlockers(blockers => new Set(blockers).add(blockingAtom))
    return () => {
      setBlockers(blockers => {
        const res = new Set(blockers)
        res.delete(blockingAtom)
        return res
      })
    }
  }, [message, when])
  const block = useAtomValue(blockingAtom)
  return {
    isBlocking: Boolean(block),
    ...block
  } as UseBlockerData
}

export function useRouteMatch() {
  const router = useRouter()
  return useAtomValue(router.match)
}

export function useRouteParams(): Record<string, string> {
  const match = useRouteMatch()
  return match?.params ?? {}
}

export function useRouteRender(): ReactNode {
  const match = useRouteMatch()
  return match ? <match.route.component {...match.data} /> : null
}

export interface RouteViewProps {
  fallback?: ReactNode
}

export function RouteView({fallback}: RouteViewProps) {
  const view = useRouteRender()
  return <>{view ?? fallback ?? null}</>
}
