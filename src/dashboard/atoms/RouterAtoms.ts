import {values} from 'alinea/core/util/Objects'
import {PrimitiveAtom, atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {FunctionComponent, useEffect, useState} from 'react'
import {parse} from 'regexparam'

export const hashAtom = atom(location.hash, (get, set, hash: string) => {
  if (get(hashAtom) !== hash) location.hash = hash
  set(hashAtom, hash)
})
hashAtom.onMount = set => {
  const listener = () => set(location.hash)
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export const locationAtom = atom(
  get => {
    const hash = get(hashAtom)
    const path = hash.slice(1) || '/'
    return new URL(path, location.href)
  },
  (get, set, url: string) => {
    const hash = `#${url}`
    set(hashAtom, hash)
  }
)

interface Matcher {
  keys: Array<string>
  pattern: RegExp
}

export function createParams(matcher: Matcher, match: RegExpExecArray) {
  const params: Record<string, string> = {}
  if (matcher.keys)
    for (let i = 0; i < matcher.keys.length; i++)
      params[matcher.keys[i]] = match[i + 1]
  return params
}

function paramsEqual(a: Record<string, string>, b: Record<string, string>) {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  for (const key of keys) if (a[key] !== b[key]) return false
  return true
}

interface MatchOptions {
  route: string
  loose?: boolean
}

export const matchAtoms = atomFamily(
  ({route, loose}: MatchOptions) => {
    let current: Record<string, string> | undefined
    const matcher = parse(route, loose)
    return atom(get => {
      const location = get(locationAtom)
      const match = matcher.pattern.exec(location.pathname)
      if (match === null) return undefined
      const result = createParams(matcher, match)
      if (current) {
        const resultValues = values(result)
        const currentValues = values(current)
        if (resultValues.every((v, i) => v === currentValues[i])) return current
      }
      return (current = result)
    })
  },
  (a, b) => a.route === b.route && a.loose === b.loose
)

export interface Route<T> {
  path: string
  loader: (params: Record<string, string>) => Promise<T>
  component: FunctionComponent<T>
}

export interface RouteMatch<T = any> {
  route: Route<T>
  data: T
  params: Record<string, string>
}

type Match = RouteMatch | undefined

export function createRouter(...routes: Array<Route<any>>) {
  const matchers = routes.map(route => ({
    ...route,
    matcher: matchAtoms({route: route.path})
  }))
  const matchingRoute = atom(get => {
    for (const route of matchers) {
      const params = get(route.matcher)
      if (params) return {route, params}
    }
  })
  const routeMatchAtom = atom(async (get): Promise<Match> => {
    const match = get(matchingRoute)
    if (!match) return undefined
    const data = await match.route.loader(match.params)
    return {route: match.route, data, params: match.params}
  })
  const currentRouteMatchAtom = atom<Match>(undefined)
  const blockersAtom = atom(new Set<PrimitiveAtom<{unblock?: () => void}>>())
  let expected: Promise<Match> | undefined
  const match = atom<Match | Promise<Match>, [Promise<Match>, Match], void>(
    (get, {setSelf}) => {
      const next = get(routeMatchAtom)
      const current = get(currentRouteMatchAtom)
      expected = next.then(value => {
        setSelf(expected!, value)
        return value
      })
      return current ?? expected
    },
    (get, set, forPromise: Promise<Match>, value: Match) => {
      if (forPromise !== expected) return
      const current = get(currentRouteMatchAtom)
      const blockers = get(blockersAtom)
      const unblock = () => set(currentRouteMatchAtom, value)
      if (blockers.size) {
        for (const block of blockers) set(block, {unblock})
      } else {
        unblock()
      }
    }
  )
  function useBlocker(
    message: string,
    when = true
  ): [false] | [true, () => void] {
    const [blockingAtom] = useState(() => atom({} as {unblock?: () => void}))
    const setBlockers = useSetAtom(blockersAtom)
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
    const {unblock} = useAtomValue(blockingAtom)
    return [Boolean(unblock), unblock] as any
  }
  function useMatch() {
    return useAtomValue(match)
  }
  return {useMatch, useBlocker}
}

export function useMatch(route: string, loose?: boolean) {
  return useAtom(matchAtoms({route, loose}))
}

export const useHash = () => useAtom(hashAtom)
