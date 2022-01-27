import {InputPath} from '@alinea/editor'
import type {ComponentType} from 'react'
import {Value} from './Value'

export type FieldRenderer<T, F> = ComponentType<{
  path: InputPath<T>
  field: F
}>

export function renderer<T, K extends keyof T>(
  name: K,
  loader: () => Promise<T>
): () => Promise<T[K]> {
  return () => loader().then(res => res[name])
}

export function withView<
  T,
  F extends Field<T>,
  C extends (...args: Array<any>) => F
>(create: C, view: FieldRenderer<T, F>) {
  return ((...args: Parameters<C>) => {
    return {...create(...args), view}
  }) as C
}

export interface Field<T = any> {
  type: Value
  view?: FieldRenderer<T, Field<T>>
}
