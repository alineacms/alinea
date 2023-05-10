import {
  createParams,
  locationAtom,
  matchAtoms
} from 'alinea/dashboard/atoms/HashAtoms'
import {Provider, atom, useAtomValue, useStore} from 'jotai'
import {
  PropsWithChildren,
  createContext,
  memo,
  useContext,
  useMemo
} from 'react'
import {parse} from 'regexparam'

export function useMatch(route: string, loose = false) {
  return useAtomValue(matchAtoms({route, loose}))
}

export function useLocation() {
  return useAtomValue(locationAtom)
}

export function useNavigate() {
  return function navigate(url: string) {
    const destination = '#' + url
    if (location.hash === destination) return
    location.hash = destination
  }
}

interface RouteContext {
  path: string
  params: Record<string, string>
}

const route = createContext<RouteContext | undefined>(undefined)

export function useParams() {
  return useContext(route)?.params!
}

export function link(url: string | undefined) {
  return typeof url === 'string' ? {href: `#${url}`} : {}
}

interface RoutesProps {
  routes: Record<string, JSX.Element>
}

type MatchingRoute = {
  path: string
  element: JSX.Element
  params: any
}

export const matchingRouteAtom = atom(undefined! as MatchingRoute)

export const Routes = memo(function Routes({
  routes
}: PropsWithChildren<RoutesProps>) {
  const store = useStore()
  const location = useAtomValue(locationAtom)
  const matchers = useMemo(() => {
    return Object.entries(routes).map(([key, element]) => ({
      path: key,
      matcher: parse(key),
      element
    }))
  }, [routes])
  const match = useMemo(() => {
    for (const {path, matcher, element} of matchers) {
      const match = matcher.pattern.exec(location.pathname)
      if (match === null) continue
      return {path, element, params: createParams(matcher, match)}
    }
  }, [location, matchers])
  if (!match) return null
  store.set(matchingRouteAtom, match)
  return <Provider store={store}>{match.element}</Provider>
})
