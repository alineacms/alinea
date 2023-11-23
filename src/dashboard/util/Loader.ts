import {Atom, atom} from 'jotai'
import {loadable} from 'jotai/utils'

export interface LoaderState<T> {
  data?: T
  error?: Error
  isError: boolean
  isLoading: boolean
  isSuccess: boolean
}

// Like loadable but keep previous data while loading new data
export function loader<Value>(asynAtom: Atom<Promise<Value>>) {
  const currentAtom = atom<Value | undefined>(undefined)
  return atom(
    (get, {setSelf}): LoaderState<Value> => {
      const next = get(loadable(asynAtom))
      if (next.state === 'hasData') setSelf(next.data)
      return {
        data: next.state === 'hasData' ? next.data : get(currentAtom),
        error: next.state === 'hasError' ? (next.error as Error) : undefined,
        isError: next.state === 'hasError',
        isLoading: next.state === 'loading',
        isSuccess: next.state === 'hasData'
      }
    },
    (get, set, value: Value) => {
      set(currentAtom, value)
    }
  )
}
