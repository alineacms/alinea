import type {
  Atom,
  ExtractAtomArgs,
  ExtractAtomResult,
  WritableAtom
} from 'jotai'
import {useAtom as useJotaiAtom, useAtomValue as useJotaiAtomValue} from 'jotai'

type AtomValue<AtomType extends Atom<unknown>> =
  AtomType extends Atom<infer Value> ? Value : never

type SyncAtom<AtomType extends Atom<unknown>> =
  Extract<AtomValue<AtomType>, PromiseLike<unknown>> extends never
    ? AtomType
    : never

type AtomOptions = Parameters<typeof useJotaiAtomValue>[1]
type SetAtom<Args extends unknown[], Result> = (...args: Args) => Result

export function useAtomValue<AtomType extends Atom<unknown>>(
  atom: SyncAtom<AtomType>,
  options?: AtomOptions
): AtomValue<AtomType> {
  return useJotaiAtomValue(atom, options) as AtomValue<AtomType>
}

export function useAtom<
  AtomType extends WritableAtom<unknown, never[], unknown>
>(
  atom: SyncAtom<AtomType>,
  options?: AtomOptions
): [
  AtomValue<AtomType>,
  SetAtom<ExtractAtomArgs<AtomType>, ExtractAtomResult<AtomType>>
] {
  return useJotaiAtom(atom, options) as [
    AtomValue<AtomType>,
    SetAtom<ExtractAtomArgs<AtomType>, ExtractAtomResult<AtomType>>
  ]
}

export {useAtom as useAsyncAtom, useAtomValue as useAsyncAtomValue} from 'jotai'
