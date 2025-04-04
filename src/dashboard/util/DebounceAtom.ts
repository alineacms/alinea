import {debounce} from 'alinea/core/util/Debounce'
import {type Atom, type WritableAtom, atom} from 'jotai'

export function debounceAtom<Value>(
  readable: Atom<Value>,
  delay: number
): Atom<Value> {
  const current = atom(undefined as Value | undefined)

  const result: WritableAtom<Value, [Value], void> = atom(
    (get, options): Value => {
      const next = get(readable)
      const debouncedUpdate = debounce(() => options.setSelf(next), delay)
      // Immediately set the current value if it exists, or return the new value.
      if (get(current) !== undefined) return get(current) as Value
      debouncedUpdate()
      return next
    },
    (get, set, value: Value) => {
      set(current, value)
    }
  )

  return result
}
