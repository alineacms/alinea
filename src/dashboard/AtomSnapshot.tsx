import type {Atom} from 'jotai'
import {loadable} from 'jotai/utils'
import {useMemo, type ReactNode} from 'react'
import {useAtomValue} from './AtomHooks.js'

export interface AtomSnapshotProps<Value> {
  atom: Atom<Value | Promise<Value>>
  children(value: Value): ReactNode
}

/**
 * The explicit boundary between asynchronously prepared atom state and
 * components, which only read synchronous atoms.
 */
export function AtomSnapshot<Value>({
  atom,
  children
}: AtomSnapshotProps<Value>) {
  const stateAtom = useMemo(
    () => loadable(atom as Atom<Promise<Value>>),
    [atom]
  )
  const state = useAtomValue(stateAtom)
  if (state.state === 'loading') return null
  if (state.state === 'hasError') throw state.error
  return children(state.data)
}
