import {assertUploadSize} from '#/core/media/UploadLimits.js'
import type {DragItem, DragTypes} from '@react-types/shared'
import {atom, type Atom, type WritableAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {Key} from 'react-aria-components'

// Shared atom primitives and dashboard drag/upload helpers.

const missing = Symbol('required atom missing')

export type RequiredAtom<Value> = WritableAtom<Value, [Value], void>

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

export function dispense<Key = string, Value = unknown>(
  fn: (key: Key) => Value
): (key: Key) => Value
export function dispense<Key extends object, Value>(
  fn: (key: Key) => Value
): (key: Key) => Value
export function dispense<Key = string, Value = unknown>(
  fn: (key: Key) => Value
): (key: Key) => Value {
  const values = new Map<Key, Value>()
  const weakValues = new WeakMap<object, Value>()
  return function dispenseValue(key: Key) {
    if (
      (typeof key === 'object' && key !== null) ||
      typeof key === 'function'
    ) {
      const objectKey = key as object
      if (!weakValues.has(objectKey)) weakValues.set(objectKey, fn(key))
      return weakValues.get(objectKey)!
    }
    if (!values.has(key)) values.set(key, fn(key))
    return values.get(key)!
  }
}

export function swr<Value>(asyncAtom: Atom<Promise<Value>>) {
  const wrapped = atom(async get => ({value: await get(asyncAtom)}))
  const withPrevious = unwrap(wrapped, previous => previous)
  return atom(get => {
    const result = get(withPrevious)
    return result ? result.value : get(asyncAtom)
  })
}

export function withPending<Value>(asyncAtom: Atom<Promise<Value> | Value>) {
  const wrapped = atom(async get => {
    const data = await get(asyncAtom)
    return [false, data] as const
  })
  return unwrap(wrapped, previous => [true, previous?.[1]] as const)
}

export function debounce<Value>(
  source: Atom<Value>,
  delayMilliseconds: number
): Atom<Value | undefined> {
  const debounced = atom(async get => {
    const value = get(source)
    await new Promise(resolve => setTimeout(resolve, delayMilliseconds))
    return value
  })
  return unwrap(debounced)
}

export type LoadResult<Value> =
  | [value: Value, error: null]
  | [value: null, error: Error]

export type BatchLoad<Value> = (
  keys: ReadonlyArray<string>
) => Promise<ReadonlyArray<LoadResult<Value>>>

export function batchLoader<Value>(load: BatchLoad<Value>) {
  let batch: Array<{
    key: string
    resolve: (value: LoadResult<Value>) => void
  }> = []
  return (key: string): Promise<LoadResult<Value>> => {
    return new Promise(resolve => {
      if (batch.push({key, resolve}) === 1) {
        queueMicrotask(async () => {
          const current = batch
          batch = []
          try {
            const keys = [...new Set(current.map(item => item.key))]
            const result = await load(keys)
            const byKey = new Map(
              keys.map((key, index) => [key, result[index]] as const)
            )
            for (const item of current) {
              item.resolve(
                byKey.get(item.key) ?? [
                  null,
                  new Error(`Missing result for ${item.key}`)
                ]
              )
            }
          } catch (error) {
            const reason =
              error instanceof Error ? error : new Error(String(error))
            for (const item of current) item.resolve([null, reason])
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
