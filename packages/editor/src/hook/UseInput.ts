import {InputPath} from '@alinea/core'
import {useEffect, useState} from 'react'
import {useEntryDraft} from './UseEntryDraft'

export function useInput<T>(path: InputPath<T>) {
  const draft = useEntryDraft()
  if (!draft) throw 'Could not load draft'
  const [, redraw] = useState(0)
  const input = draft.getInput<T>(path)
  useEffect(() => {
    return input.observe(() => {
      redraw(i => i + 1)
    })
  }, [draft])
  return input
}
