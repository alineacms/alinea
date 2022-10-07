import {Pages} from '@alinea/backend/Pages'
import {Field, Label, TypeConfig} from '@alinea/core'
import {Expr} from '@alinea/store/Expr'
import {SelectionInput} from '@alinea/store/Selection'

export type ObjectOptions<T> = {
  /** The fields */
  fields: TypeConfig<any, T>
  width?: number
  help?: Label
  inline?: boolean
  /** Hide this object field */
  hidden?: boolean
}

export interface ObjectField<T> extends Field.Record<T> {
  label: Label
  options: ObjectOptions<T>
}

function query(type: TypeConfig) {
  return (expr: Expr<{}>, pages: Pages<any>): Expr<{}> | undefined => {
    const computed: Record<string, SelectionInput> = {}
    let isComputed = false
    for (const [key, field] of type) {
      if (!field.transform) continue
      const selection = field.transform(expr.get(key), pages)
      if (!selection) continue
      computed[key] = selection
      isComputed = true
    }
    if (type.options.transform)
      return type.options.transform(expr.with(computed).toExpr(), pages)
    if (!isComputed) return
    return expr.with(computed).toExpr()
  }
}

export function createObject<T>(
  label: Label,
  options: ObjectOptions<T>
): ObjectField<T> {
  const shape = options.fields.shape
  return {
    shape,
    hint: options.fields.hint,
    label,
    options,
    transform: query(options.fields),
    hidden: options.hidden
  }
}
