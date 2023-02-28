import {createError, createId, Field, Shape} from 'alinea/core'
import {Observable, observable, useForceUpdate} from 'alinea/ui'
import {useEffect, useMemo} from 'react'
import * as Y from 'yjs'
import {InputState} from '../InputState.js'

const FIELD_KEY = '#field'

interface FieldStateOptions<V, M> {
  shape: Shape<V>
  root: Y.Map<any>
  key: string
  attach?: (v: V) => void
  parent?: InputState<any>
}

export class FieldState<V, M> implements InputState<readonly [V, M]> {
  constructor(private options: FieldStateOptions<V, M>) {}

  parent() {
    return this.options.parent
  }

  child(field: string): InputState<any> {
    const {key, root, shape} = this.options
    const current = root.get(key)
    return new FieldState({
      shape: shape.typeOfChild(current, field),
      root: current,
      key: field,
      parent: this
    })
  }

  use(): readonly [V, M] {
    const {key, root, shape, attach} = this.options
    const {current, mutator, observe} = useMemo(() => {
      const current = (): V => shape.fromY(root.get(key))
      const mutator = shape.mutator(root, key) as M
      const observe = shape.watch(root, key)
      return {current, mutator, observe}
    }, [])
    const update = useForceUpdate()
    const redraw = () => {
      if (attach) attach(current())
      update()
    }
    useEffect(() => {
      return observe(redraw)
    }, [observe, redraw])
    return [current(), mutator] as const
  }
}

export interface ObservableField<V, M> extends Observable.Writable<V> {
  field: Field<V, M>
  state: FieldState<V, M>
}

export function createFieldInput<V, M, Q>(
  field: Field<V, M, Q>
): ObservableField<V, M> {
  if (!field.shape) throw createError('Cannot use field without shape')
  const doc = new Y.Doc()
  const rootKey = createId()
  const root = doc.getMap(rootKey)
  const initial = field.shape.create()
  root.set(FIELD_KEY, field.shape.toY(initial))
  const input = observable<V>(initial)
  const state = new FieldState<V, M>({
    shape: field.shape,
    root,
    key: FIELD_KEY,
    attach: input
  })
  return Object.assign(input, {field, state}) as ObservableField<V, M>
}

export function useField<V, M, Q>(
  field: Field<V, M, Q>,
  deps: ReadonlyArray<unknown> = []
): ObservableField<V, M> {
  return useMemo(() => createFieldInput(field), deps)
}
