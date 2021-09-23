import type {ComponentType} from 'react'
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

export type FieldRenderer<Type = any, Options = any> = ComponentType<{
  field: Field<Type, Options>
}>

export function renderer<T, K extends keyof T>(
  name: K,
  loader: () => Promise<T>
): () => Promise<T[K]> {
  return () => loader().then(res => res[name])
}

export function withView<T, O, C extends (...args: Array<any>) => Field<T, O>>(
  create: C,
  view: FieldRenderer<T, O>
) {
  return (...args: Parameters<C>) => {
    return {...create(...args), view}
  }
}

export interface Field<Type = any, Options = any> {
  label: Label
  options: Options
  view?: FieldRenderer<Type, Options>
}
