import {atom, type WritableAtom} from 'jotai'

const missing = Symbol('required atom missing')

export type RequiredAtom<Value> = WritableAtom<Value, [Value], void>

export function requiredAtom<Value>(name: string): RequiredAtom<Value> {
  const valueAtom = atom<Value | typeof missing>(missing)
  const result = atom(
    get => {
      const value = get(valueAtom)
      if (value === missing)
        throw new Error(`Required atom "${name}" was not initialized`)
      return value
    },
    (_get, set, value: Value) => {
      set(valueAtom, value)
    }
  )
  result.debugLabel = name
  return result
}
