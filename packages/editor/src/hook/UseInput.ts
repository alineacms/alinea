import {InputPath} from '@alinea/core'
import {useEffect, useMemo} from 'react'
import {FieldMutator} from '../EntryDraft'
import {useCurrentDraft} from './UseCurrentDraft'
import {useForceUpdate} from './UseForceUpdate'

export type InputPair<T> = readonly [T, FieldMutator<T>]

export function useInput<T>(path: InputPath<T>): InputPair<T> {
  const draft = useCurrentDraft()
  if (!draft) throw 'Could not load draft'
  const redraw = useForceUpdate()
  const input = useMemo(
    () => draft.getInput<T>(path),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, ...path]
  )
  useEffect(() => {
    return input.observe(redraw)
  }, [input, redraw])
  return [input.value, input.mutator]
}
