import {atom} from 'jotai'
import type * as Y from 'yjs'

export function yAtom<T>(yType: Y.AbstractType<any>, get: () => T) {
  const revision = atom(0)
  revision.onMount = setAtom => {
    const onChange = (events: Array<Y.YEvent<any>>, tx: Y.Transaction) => {
      if (tx.origin === 'self') return
      setAtom(x => x + 1)
    }
    yType.observeDeep(onChange)
    return () => yType.unobserveDeep(onChange)
  }
  return atom(g => {
    g(revision)
    return get()
  })
}
