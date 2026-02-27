import {
  atom,
  type Getter,
  type Setter,
  useSetAtom,
  type WritableAtom
} from 'jotai'

export interface CommandWriter<Args extends Array<unknown>, Result> {
  (get: Getter, set: Setter, ...args: Args): Result
}

export type CommandAtom<
  Args extends Array<unknown> = [],
  Result = void
> = WritableAtom<null, Args, Result>

export function command<Args extends Array<unknown> = [], Result = void>(
  write: CommandWriter<Args, Result>
): CommandAtom<Args, Result> {
  return atom(null, write)
}

export function useCommand<Args extends Array<unknown>, Result>(
  commandAtom: CommandAtom<Args, Result>
) {
  return useSetAtom(commandAtom)
}
