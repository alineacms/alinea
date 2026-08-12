import {assertUploadSize} from '#/core/media/UploadLimits.js'
import {DeepMap} from '#/core/util/DeepMap.js'
import type {DragItem, DragTypes} from '@react-types/shared'
import {atom, type WritableAtom} from 'jotai'
import type {Key} from 'react-aria-components'

type RequiredAtom<Value> = WritableAtom<Value, [Value], void>

const missing = Symbol('required atom missing')

export function requiredAtom<Value>(name: string): RequiredAtom<Value> {
  const valueAtom = atom<Value | typeof missing>(missing)
  const result = atom(
    get => {
      const value = get(valueAtom)
      if (value === missing)
        throw new Error(`Required atom "${name}" was not initialized`)
      return value
    },
    (_get, set, value: Value) => set(valueAtom, value)
  )
  result.debugLabel = name
  return result
}

export function dispense<Keys extends ReadonlyArray<unknown>, Value>(
  fn: (...keys: Keys) => Value
): (...keys: Keys) => Value {
  const values = new DeepMap<Keys, Value>()
  return function dispenseValue(...keys: Keys) {
    if (!values.has(keys)) values.set(keys, fn(...keys))
    return values.get(keys)!
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

export const dashboardEntryDragType = 'application/x-alinea-entry-id'

export const dashboardEntryDragTypes = [
  dashboardEntryDragType,
  'text/plain'
] as const

export function acceptsDashboardEntryDrag(types: DragTypes): boolean {
  return dashboardEntryDragTypes.some(type => types.has(type))
}

export function dashboardEntryDragItem(id: Key): DragItem {
  const key = String(id)
  return {
    'text/plain': key,
    [dashboardEntryDragType]: key
  }
}

export function uploadSizeError(
  file: File,
  maxUploadSize: number | undefined
): string | undefined {
  try {
    assertUploadSize(file.name, file.size, maxUploadSize)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
