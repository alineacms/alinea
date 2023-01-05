import {Field, Hint, Label, Shape} from '@alinea/core'

import {Expr} from '@alinea/store'
import type {Pages} from '@alinea/backend/Pages'

export type CodeFieldOptions<Q> = {
  width?: number
  help?: Label
  optional?: boolean
  inline?: boolean
  initialValue?: string
  language?: string
  /** Modify value returned when queried through `Pages` */
  transform?: (field: Expr<string>, pages: Pages<any>) => Expr<Q> | undefined
  /** Hide this code field */
  hidden?: boolean
  /** Make this code field read-only*/
  readonly?: boolean
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
    shape: Shape.Scalar(label, options.initialValue),
    hint: Hint.String(),
    label,
    options,
    transform: options.transform,
    hidden: options.hidden
  }
}
