import {createError, Field, ROOT_KEY, Shape} from '@alinea/core'
import {useForceUpdate} from '@alinea/ui'
import {useEffect, useMemo} from 'react'
import * as Y from 'yjs'
import {InputState} from '../InputState'

const FIELD_KEY = '#field'

export class FieldState<V, M> implements InputState<readonly [V, M]> {
  constructor(
    private shape: Shape<V>,
    private root: Y.Map<any>,
    private key: string
  ) {}

  child(field: string) {
    const current = this.root.get(this.key)
    return new FieldState(
      this.shape.typeOfChild(current, field),
      current,
      field
    )
  }

  use(): readonly [V, M] {
    const {current, mutator, observe} = useMemo(() => {
      const current = (): V => this.root.get(this.key)
      const mutator = this.shape.mutator(this.root, FIELD_KEY) as M
      const observe = this.shape.watch(this.root, FIELD_KEY)
      return {current, mutator, observe}
    }, [])
    const redraw = useForceUpdate()
    useEffect(() => {
      return observe(redraw)
    }, [observe, redraw])
    return [current(), mutator] as const
  }
}

export function useField<V, M>(field: Field<V, M>, initialValue?: V) {
  const {input, state} = useMemo(() => {
    const doc = new Y.Doc()
    const root = doc.getMap(ROOT_KEY)
    root.set(FIELD_KEY, initialValue)
    if (!field.shape) throw createError('Cannot use field without type')
    const state = new FieldState<V, M>(field.shape, root, FIELD_KEY)
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
