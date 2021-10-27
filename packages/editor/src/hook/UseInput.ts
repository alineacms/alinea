import {InputPath, Value} from '@alinea/core'
import {useForceUpdate} from '@alinea/ui'
import {useEffect, useMemo} from 'react'
import {useCurrentDraft} from './UseCurrentDraft'

export type InputPair<T> = readonly [T, Value.Mutator<T>]

export function useInput<T>(path: InputPath<T>): InputPair<T> {
  const [draft] = useCurrentDraft()
  if (!draft) throw 'Could not load draft'
  const redraw = useForceUpdate()
  const input = useMemo(
    () => draft.getInput<T>(path),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, path.type, ...path.location]
  )
  useEffect(() => {
    return input.observe(redraw)
  }, [input, redraw])
  return [input.value, input.mutator as Value.Mutator<T>]
}
