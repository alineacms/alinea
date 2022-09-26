import {useHash} from '@alinea/ui/hook/UseHash'
import {
  createContext,
  memo,
  PropsWithChildren,
  useContext,
  useMemo
} from 'react'
import {parse} from 'regexparam'

export function useLocation() {
  const [hash] = useHash()
  const path = hash.slice(1) || '/'
  const url = useMemo(() => new URL(path, location.href), [hash])
  return url
}

interface Matcher {
  keys: Array<string>
  pattern: RegExp
}

function createParams(matcher: Matcher, match: RegExpExecArray) {
  const params: Record<string, string> = {}
  if (matcher.keys)
    for (let i = 0; i < matcher.keys.length; i++)
      params[matcher.keys[i]] = match[i + 1]
  return params
}

export function useMatch(route: string): Record<string, string> | undefined {
  const location = useLocation()
  const matcher = useMemo<Matcher>(() => parse(route), [route])
  const match = matcher.pattern.exec(location.pathname)
  if (match === null) return undefined
  return createParams(matcher, match)
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

export const Routes = memo(function Routes({
  routes
}: PropsWithChildren<RoutesProps>) {
  const matchers = useMemo(() => {
    return Object.entries(routes).map(([key, element]) => ({
      path: key,
      matcher: parse(key),
      element
    }))
  }, [routes])
  const location = useLocation()
  const match = useMemo(() => {
    for (const {path, matcher, element} of matchers) {
      const match = matcher.pattern.exec(location.pathname)
      if (match === null) continue
      return {path, element, params: createParams(matcher, match)}
    }
  }, [location, matchers])
  if (!match) return null
  return <route.Provider value={match}>{match.element}</route.Provider>
})
