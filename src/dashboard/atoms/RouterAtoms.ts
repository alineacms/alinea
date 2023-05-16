import {values} from 'alinea/core/util/Objects'
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

export function useMatch(route: string, loose?: boolean) {
  return useAtom(matchAtoms({route, loose}))
}

export const useHash = () => useAtom(hashAtom)
