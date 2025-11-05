import {assign} from 'alinea/core/util/Objects'
import {type Atom, atom} from 'jotai'

interface KeepDataOptions<Value> {
  initialValue?: Value
  compare?: (a: Value, b: Value) => boolean
}

// Suspend if we have no data, but keep previous data while loading new data
export function keepPreviousData<Value>(
  asyncAtom: Atom<Promise<Value>>,
  options: KeepDataOptions<Value> = {}
): Atom<Promise<Value>> & {current: Atom<Value | undefined>} {
  let expected: Promise<Value> | undefined
  const currentAtom = atom<Value | undefined>(options.initialValue)
  return assign(
    atom(
      (get, {setSelf}) => {
        const next = get(asyncAtom)
        const current = get(currentAtom)
        expected = next.then(value => {
          const isSame =
            options.compare && current !== undefined
              ? options.compare(value, current)
              : value === current
          if (!isSame) setSelf(expected, value)
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
