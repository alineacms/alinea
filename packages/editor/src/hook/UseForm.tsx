import {ROOT_KEY} from '@alinea/core/Doc'
import {RecordShape} from '@alinea/core/shape/RecordShape'
import {TypeConfig} from '@alinea/core/Type'
import {useForceUpdate} from '@alinea/ui'
import {ComponentType, memo, useEffect, useMemo} from 'react'
import * as Y from 'yjs'
import {InputState} from '../InputState'
import {InputForm} from '../view/InputForm'
import {FieldState} from './UseField'

export class FormState<V extends Record<string, any>, M>
  implements InputState<readonly [V, M]>
{
  constructor(
    private shape: RecordShape<V>,
    private root: Y.Map<any>,
    private key: string
  ) {}

  parent() {
    return undefined
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
      const mutator = this.shape.mutator(this.root, this.key) as any
      const observe = (fun: () => void) => {
        const record = this.root.get(this.key)
        record.observeDeep(fun)
        return () => record.unobserveDeep(fun)
      }
      return {current, mutator, observe}
    }, [])
    const redraw = useForceUpdate()
    useEffect(() => {
      return observe(redraw)
    }, [observe, redraw])
    return [current(), mutator] as const
  }
}

export type UseFormOptions<T> = {
  type: TypeConfig<T, any>
  initialValue?: Partial<T>
}

export function useForm<T>(
  options: UseFormOptions<T>,
  deps: ReadonlyArray<unknown> = []
): readonly [ComponentType, () => T] {
  const {type, initialValue = {}} = options
  const initial: Record<string, any> = initialValue
  const redraw = useForceUpdate()
  const {input, current, watch} = useMemo(() => {
    const doc = new Y.Doc()
    const root = doc.getMap(ROOT_KEY)
    for (const [key, field] of type) {
      root.set(key, field.shape.toY(initial[key] || field.initialValue!))
    }
    const state = new FormState(type.shape, doc as any, ROOT_KEY)
    function input() {
      return <InputForm state={state} type={type} />
    }
    return {
      input: memo(input),
      current() {
        return type.shape.fromY(root)
      },
      watch() {
        root.observeDeep(redraw)
        return () => root.unobserveDeep(redraw)
      }
    }
  }, deps)
  useEffect(watch, deps)
  return [input, current()] as const
}
