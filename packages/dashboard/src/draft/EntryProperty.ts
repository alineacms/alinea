import {InputState} from '@alinea/editor'
import {useForceUpdate} from '@alinea/ui'
import {useEffect, useMemo} from 'react'
import {useCurrentDraft} from '../hook/UseCurrentDraft'

export class EntryProperty<T> implements InputState<T> {
  constructor(public readonly location: Array<string>) {}

  child<T>(field: string): InputState<T> {
    return new EntryProperty([...this.location, field])
  }

  use() {
    const draft = useCurrentDraft()
    if (!draft) throw 'Could not load draft'
    const redraw = useForceUpdate()
    const input = useMemo(() => draft.getInput<T>(this.location), [draft])
    useEffect(() => {
      return input.observe(redraw)
    }, [input, redraw])
    return [input.value, input.mutator] as const
  }

  static root = new EntryProperty([])
}
