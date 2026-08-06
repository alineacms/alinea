import type {Atom} from 'jotai'

declare const asyncAtomReadError: unique symbol

interface AsyncAtomReadError {
  readonly [asyncAtomReadError]: 'Async atoms must be resolved before rendering'
}

declare module 'jotai' {
  export function useAtomValue<Value>(
    atom: Atom<Value>
  ): Extract<Value, PromiseLike<unknown>> extends never
    ? Awaited<Value>
    : AsyncAtomReadError
}
