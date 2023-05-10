import {atom, useAtom} from 'jotai'
import {atomFamily} from 'jotai/utils'
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

export const useHash = () => useAtom(hashAtom)

export const locationAtom = atom(
  get => {
    const hash = get(hashAtom)
    const path = hash.slice(1) || '/'
    return new URL(path, location.href)
  },
  (get, set, url: URL) => {
    const hash = `#${url.pathname}`
    set(hashAtom, hash)
  }
)

export const useLocation = () => useAtom(locationAtom)

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

interface MatchOptions {
  route: string
  loose?: boolean
}

export const matchAtoms = atomFamily(
  ({route, loose}: MatchOptions) => {
    const matcher = parse(route, loose)
    return atom(get => {
      const location = get(locationAtom)
      const match = matcher.pattern.exec(location.pathname)
      if (match === null) return undefined
      return createParams(matcher, match)
    })
  },
  (a, b) => a.route === b.route && a.loose === b.loose
)

export function useMatch(route: string, loose?: boolean) {
  return useAtom(matchAtoms({route, loose}))
}
