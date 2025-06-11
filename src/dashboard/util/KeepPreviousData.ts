import {assign} from 'alinea/core/util/Objects'
import {type Atom, atom} from 'jotai'

// Suspend if we have no data, but keep previous data while loading new data
export function keepPreviousData<Value>(
  asyncAtom: Atom<Promise<Value>>
): Atom<Promise<Value>> & {current: Atom<Value | undefined>}
export function keepPreviousData<Value>(
  asyncAtom: Atom<Promise<Value>>,
  initialValue: Value
): Atom<Promise<Value>> & {current: Atom<Value>}
export function keepPreviousData<Value>(
  asyncAtom: Atom<Promise<Value>>,
  initialValue?: Value
): Atom<Promise<Value>> & {current: Atom<Value | undefined>} {
  let expected: Promise<Value> | undefined
  const currentAtom = atom<Value | undefined>(initialValue)
  return assign(
    atom(
      (get, {setSelf}) => {
        const next = get(asyncAtom)
        const current = get(currentAtom)
        expected = next.then(value => {
          setSelf(expected, value)
          return value
        })
        return current ?? expected
      },
      (get, set, forPromise: Promise<Value>, value: Value) => {
        if (forPromise === expected) set(currentAtom, value)
      }
    ) as any,
    {current: currentAtom}
  )
}
