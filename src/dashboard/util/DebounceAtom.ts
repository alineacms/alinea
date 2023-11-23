import {Atom, WritableAtom, atom} from 'jotai'

export function debounceAtom<Value>(
  readable: Atom<Value>,
  delay: number
): Atom<Value> {
  const current = atom(undefined as Value | undefined)
  let timeout: ReturnType<typeof setTimeout> | undefined
  const result: WritableAtom<Value, [Value], void> = atom(
    (get, options): Value => {
      const next = get(readable)
      const update = () => options.setSelf(next)
      clearTimeout(timeout)
      timeout = setTimeout(update, delay)
      return get(current) ?? next
    },
    (get, set, value: Value) => {
      set(current, value)
    }
  )
  return result
}
