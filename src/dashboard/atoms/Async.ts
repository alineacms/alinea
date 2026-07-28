import type {Atom} from 'jotai'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'

export function keepPrevious<Value>(asyncAtom: Atom<Promise<Value>>) {
  const withPrevious = unwrap(asyncAtom, previous => previous)
  return atom(get => get(withPrevious) ?? get(asyncAtom))
}

export function withPending<Value>(
  asyncAtom: Atom<Promise<Value> | Value>
) {
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
