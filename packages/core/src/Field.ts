import type {ComponentType} from 'react'
import {InputPath} from './InputPath'
import {Label} from './Label'

export type FieldOptions = {
  hidden?: boolean | ((entry: any) => boolean)
  width?: number
  optional?: boolean
}

export type FieldShape<T = string | symbol, Options = {}> = {
  type: T
  label: Label
  options?: FieldOptions & Options
}

export type NumberField = FieldShape<
  'number',
  {
    optional?: boolean
    help?: Label
    inline?: boolean
    initialValue?: number
    min?: number
    max?: number
  }
>

export interface InputField extends FieldShape {}

export type LocalisedField = {type: 'localised'; field: InputField}

/*export type Field = LocalisedField | InputField

export function field<Shape extends FieldShape>(type: Shape['type']) {
  return (label: Label, options?: Shape['options']): Shape => {
    return {type, label, options} as Shape
  }
}*/

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
  return (...args: Parameters<C>) => {
    return {...create(...args), view}
  }
}

export interface Field<T = any> {
  view?: FieldRenderer<T, Field<T>>
}
