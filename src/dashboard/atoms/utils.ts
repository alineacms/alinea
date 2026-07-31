import {Atom, atom, type WritableAtom} from 'jotai'
import {unwrap} from 'jotai/utils'

type RequiredAtom<Value> = WritableAtom<Value, [Value], void>

const missing = Symbol('required atom missing')

export function requiredAtom<Value>(name: string): RequiredAtom<Value> {
  const valueAtom = atom<{value: Value | typeof missing}>({value: missing})
  const result = atom(
    get => {
      const {value} = get(valueAtom)
      if (value === missing)
        throw new Error(`Required atom "${name}" was not initialized`)
      return value
    },
    (get, set, value: Value) => {
      set(valueAtom, {value})
    }
  )
  result.debugLabel = name
  return result
}

export function atomWithPending<Value>(
  asyncAtom: Atom<Promise<Value> | Value>
) {
  const wrappedAtom = atom(async get => {
    const data = await get(asyncAtom)
    return [false, data] as const
  })
  return unwrap(wrappedAtom, prev => [true, prev?.[1]] as const)
}

export function dispense<Key = string, Value = unknown>(
  fn: (key: Key) => Value
): (key: Key) => Value {
  const values = new Map<Key, Value>()
  return function dispenseValue(key: Key) {
    if (!values.has(key)) values.set(key, fn(key))
    return values.get(key)!
  }
}

type Result<Value> = [value: Value, error: null] | [value: null, error: Error]
type BatchLoadFn<V> = (
  keys: ReadonlyArray<string>
) => Promise<ReadonlyArray<Result<V>>>
export function loader<Value>(fn: BatchLoadFn<Value>) {
  let batch: {key: string; resolve: (v: Result<Value>) => void}[] = []
  return (key: string): Promise<Result<Value>> => {
    return new Promise(resolve => {
      if (batch.push({key, resolve}) === 1) {
        queueMicrotask(async () => {
          const current = batch
          batch = []
          try {
            const result = await fn(current.map(i => i.key))
            for (const [index, item] of current.entries())
              item.resolve(
                result[index] ?? [
                  null,
                  new Error(`Missing result for ${item.key}`)
                ]
              )
          } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e))
            for (const item of current) item.resolve([null, err])
          }
        })
      }
    })
  }
}
