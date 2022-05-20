import {ROOT_KEY} from '@alinea/core/Doc'
import {RecordShape} from '@alinea/core/shape/RecordShape'
import {TypeConfig} from '@alinea/core/Type'
import {useForceUpdate} from '@alinea/ui'
import {memo, useEffect, useMemo} from 'react'
import * as Y from 'yjs'
import {InputState} from '../InputState'
import {InputForm} from '../view/InputForm'
import {FieldState} from './UseField'

export class FormState<V, M> implements InputState<readonly [V, M]> {
  constructor(
    private shape: RecordShape<V>,
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
      const current = (): V => this.shape.fromY(this.root.get(this.key))
      const mutator = this.shape.mutator(this.root, this.key) as any
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

export function useForm<T>(
  type: TypeConfig<T>,
  deps: ReadonlyArray<unknown> = []
) {
  const {input, state} = useMemo(() => {
    const doc = new Y.Doc()
    const root = doc.getMap(ROOT_KEY)
    for (const [key, field] of type) {
      root.set(key, field.shape.toY(field.initialValue!))
    }
    const state = new FormState(type.shape, root, ROOT_KEY)
    function input() {
      return <InputForm state={state} type={type} />
    }
    return {
      input: memo(input),
      state
    }
  }, deps)
  const [value, mutator] = state.use()
  return [input, value, mutator] as const
}
