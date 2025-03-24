import {type Atom, atom} from 'jotai'

// Suspend if we have no data, but keep previous data while loading new data
export function keepPreviousData<Value, T extends Atom<Promise<Value>>>(
  asynAtom: T,
  initalValue?: Value
): T {
  let expected: Promise<Value> | undefined
  const currentAtom = atom<Value | undefined>(initalValue)
  return atom(
    (get, {setSelf}) => {
      const next = get(asynAtom)
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
  ) as any
}
