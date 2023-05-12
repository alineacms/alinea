import {atom, useAtomValue, useSetAtom} from 'jotai'
import {createContext, useContext, useMemo} from 'react'
import {parse} from 'regexparam'
import {createParams, locationAtom, matchAtoms} from '../atoms/RouterAtoms.js'

export function useMatch(route: string, loose = false) {
  return useAtomValue(matchAtoms({route, loose}))
}

export function useLocation() {
  return useAtomValue(locationAtom)
}

export function useNavigate() {
  const setLocation = useSetAtom(locationAtom)
  return function navigate(url: string) {
    setLocation(url)
  }
}

interface RouteContext {
  path: string
  params: Record<string, string>
}

const route = createContext<RouteContext | undefined>(undefined)

export function useParams() {
  return useContext(route)?.params || {}
}

export function link(url: string | undefined) {
  return typeof url === 'string' ? {href: `#${url}`} : {}
}

type MatchingRoute = {
  path: string
  element: JSX.Element
  params: any
}

export const matchingRouteAtom = atom(undefined! as MatchingRoute)

export function useRoutes(routes: Record<string, JSX.Element>) {
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

  return match
    ? {
        ...match,
        element: <route.Provider value={match}>{match.element}</route.Provider>
      }
    : undefined
}
