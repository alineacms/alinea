import {Atom, atom} from 'jotai'

// Suspend if we have no data, but keep previous data while loading new data
export function keepPreviousData<Value, T extends Atom<Promise<Value>>>(
  asynAtom: T
): T {
  const currentAtom = atom<Value | undefined>(undefined)
  return atom(
    (get, {setSelf}) => {
      const next = get(asynAtom)
      const current = get(currentAtom)
      const promised = next.then(value => {
        setSelf(value)
        return value
      })
      return current ?? promised
    },
    (get, set, value: Value) => {
      set(currentAtom, value)
    }
  ) as any
}
