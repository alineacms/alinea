import {createError, Field, ROOT_KEY, Shape} from '@alinea/core'
import {useForceUpdate} from '@alinea/ui'
import {memo, useEffect, useMemo} from 'react'
import * as Y from 'yjs'
import {InputState} from '../InputState'

const FIELD_KEY = '#field'

export class FieldState<V, M> implements InputState<readonly [V, M]> {
  constructor(
    private shape: Shape<V>,
    private root: Y.Map<any>,
    private key: string,
    private _parent?: InputState<any>
  ) {}

  parent() {
    return this._parent
  }

  child(field: string): InputState<any> {
    const current = this.root.get(this.key)
    return new FieldState(
      this.shape.typeOfChild(current, field),
      current,
      field,
      this
    )
  }

  use(): readonly [V, M] {
    const {current, mutator, observe} = useMemo(() => {
      const current = (): V => this.shape.fromY(this.root.get(this.key))
      const mutator = this.shape.mutator(this.root, this.key) as M
      const observe = this.shape.watch(this.root, this.key)
      return {current, mutator, observe}
    }, [])
    const redraw = useForceUpdate()
    useEffect(() => {
      return observe(redraw)
    }, [observe, redraw])
    return [current(), mutator] as const
  }
}

type InputProps<V, M> = {
  value?: V
  onChange?: M
}

export function useField<V, M, Q>(
  field: Field<V, M, Q>,
  deps: ReadonlyArray<unknown> = []
) {
  const {input, state} = useMemo(() => {
    const doc = new Y.Doc()
    const root = doc.getMap(ROOT_KEY)
    if (!field.shape) throw createError('Cannot use field without type')
    root.set(FIELD_KEY, field.shape.toY(field.initialValue!))
    const state = new FieldState<V, M>(field.shape, root, FIELD_KEY)
    const Input = field.view!
    function input(props: InputProps<V, M>) {
      const inputState =
        'value' in props
          ? new InputState.StatePair(props.value!, props.onChange!)
          : state
      return <Input state={inputState} field={field} />
    }
    return {
      input: memo(input),
      state
    }
  }, deps)
  const [value, mutator] = state.use()
  return [input, value, mutator] as const
}
