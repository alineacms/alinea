import {atom} from 'jotai'
import * as Y from 'yjs'

export function yAtom<T>(yType: Y.AbstractType<any>, get: () => T) {
  const revision = atom(0)
  revision.onMount = setAtom => {
    const onChange = () => setAtom(x => x + 1)
    yType.observeDeep(onChange)
    return () => yType.unobserveDeep(onChange)
  }
  return atom(g => {
    g(revision)
    return get()
  })
}
