import {InputState} from '@alineacms/editor'
import {useForceUpdate} from '@alineacms/ui'
import {useEffect, useMemo} from 'react'
import {useCurrentDraft} from '../hook/UseCurrentDraft'

export class EntryProperty<V, M> implements InputState<readonly [V, M]> {
  constructor(public readonly location: Array<string>) {}

  child<V, M>(field: string) {
    return new EntryProperty<V, M>([...this.location, field])
  }

  use() {
    const draft = useCurrentDraft()
    if (!draft) throw 'Could not load draft'
    const redraw = useForceUpdate()
    const input = useMemo(() => draft.getInput<V, M>(this.location), [draft])
    useEffect(() => {
      return input.observe(redraw)
    }, [input, redraw])
    return [input.value, input.mutator] as const
  }

  static root = new EntryProperty([])
}
