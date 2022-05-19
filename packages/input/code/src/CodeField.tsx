import {Expr} from '@alinea/alinea'
import type {Pages} from '@alinea/backend'
import {Field, Label, Shape} from '@alinea/core'

export type CodeFieldOptions<Q> = {
  width?: number
  help?: Label
  optional?: boolean
  inline?: boolean
  initialValue?: string
  language?: string
  /** Modify value returned when queried through `Pages` */
  transform?: <P>(field: Expr<string>, pages: Pages<P>) => Expr<Q> | undefined
}

export interface CodeField<Q = string> extends Field.Scalar<string, Q> {
  label: Label
  options: CodeFieldOptions<Q>
}

export function createCode<Q = string>(
  label: Label,
  options: CodeFieldOptions<Q> = {}
): CodeField<Q> {
  return {
    shape: Shape.Scalar(label),
    label,
    options,
    transform: options.transform
  }
}
