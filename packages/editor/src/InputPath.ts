import {Value} from '@alinea/core'
import {useForceUpdate} from '@alinea/ui'
import {useEffect, useMemo} from 'react'
import {useCurrentDraft} from './hook/UseCurrentDraft'

export type InputPair<T> = readonly [T, Value.Mutator<T>]

export interface InputPath<T> {
  child<T>(field: string): InputPath<T>
  use(): InputPair<T>
}

/* eslint-disable */
export namespace InputPath {
  export class EntryProperty<T> implements InputPath<T> {
    constructor(public readonly location: Array<string>) {}

    child<T>(field: string): InputPath<T> {
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
      return [input.value, input.mutator as Value.Mutator<T>] as const
    }
  }

  export class StatePair<T> implements InputPath<T> {
    constructor(public state: T, public setState: (state: T) => void) {}

    child<T>(field: string) {
      const record = this.state as unknown as Record<string, T>
      return new StatePair(record[field], state => {
        this.setState({...this.state, [field]: state})
      })
    }

    use() {
      return [this.state, this.setState] as const
    }
  }

  export const root = new EntryProperty([])
}
