import {InputPath, Value} from '@alinea/core'
import {useEffect, useMemo} from 'react'
import {useCurrentDraft} from './UseCurrentDraft'
import {useForceUpdate} from './UseForceUpdate'

export type InputPair<T> = readonly [T, Value.Mutator<T>]

export function useInput<T>(
  path: InputPath<T>,
  type = Value.Scalar
): InputPair<T> {
  const draft = useCurrentDraft()
  if (!draft) throw 'Could not load draft'
  const redraw = useForceUpdate()
  const input = useMemo(
    () => draft.getInput<T>(path, type),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, type, ...path]
  )
  useEffect(() => {
    return input.observe(redraw)
  }, [input, redraw])
  return [input.value, input.mutator as Value.Mutator<T>]
}
