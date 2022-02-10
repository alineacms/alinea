import {ROOT_KEY} from '@alinea/core/Doc'
import {Field} from '@alinea/core/Field'
import {Value} from '@alinea/core/Value'
import {useForceUpdate} from '@alinea/ui'
import {useEffect, useMemo} from 'react'
import * as Y from 'yjs'
import {InputPair, InputState} from '../InputState'

const FIELD_KEY = '#field'

export class FieldState<T> implements InputState<T> {
  constructor(
    private value: Value<T>,
    private root: Y.Map<any>,
    private key: string
  ) {}

  child<T>(field: string): InputState<T> {
    const current = this.root.get(this.key)
    return new FieldState(
      this.value.typeOfChild(current, field),
      current,
      field
    )
  }

  use(): InputPair<T> {
    const {current, mutator, observe} = useMemo(() => {
      const current = (): T => this.root.get(this.key)
      const mutator = this.value.mutator(
        this.root,
        FIELD_KEY
      ) as Value.Mutator<T>
      const observe = this.value.watch(this.root, FIELD_KEY)
      return {current, mutator, observe}
    }, [])
    const redraw = useForceUpdate()
    useEffect(() => {
      return observe(redraw)
    }, [observe, redraw])
    return [current(), mutator] as const
  }
}

export function useField<T>(field: Field<T>, initialValue?: T) {
  const {input, state} = useMemo(() => {
    const doc = new Y.Doc()
    const root = doc.getMap(ROOT_KEY)
    root.set(FIELD_KEY, initialValue)
    const state = new FieldState<T>(field.type, root, FIELD_KEY)
    const Input = field.view!
    function input() {
      return <Input state={state} field={field} />
    }
    return {
      input,
      state
    }
  }, [])
  const [value] = state.use()
  return {value, input}
}
