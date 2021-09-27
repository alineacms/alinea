import {InputPath} from '@alinea/core'
import {useEffect, useMemo, useReducer} from 'react'
import {useCurrentDraft} from './UseCurrentDraft'

export function useInput<T>(path: InputPath<T>): [T, (value: T) => void] {
  const draft = useCurrentDraft()
  if (!draft) throw 'Could not load draft'
  // https://reactjs.org/docs/hooks-faq.html#is-there-something-like-forceupdate
  const [, redraw] = useReducer(x => x + 1, 0)
  const input = useMemo(
    () => draft.getInput<T>(path),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, ...path]
  )
  useEffect(() => {
    return input.observe(redraw)
  }, [input, draft])
  return [input.value, input.setValue]
}
