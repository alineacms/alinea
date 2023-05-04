import {Field, FieldOptions, Label, Type} from 'alinea/core'

export interface ObjectOptions<Row> extends FieldOptions {
  /** The fields */
  fields: Type<Row>
  width?: number
  help?: Label
  inline?: boolean
}

export class ObjectField<Row> extends Field.Record<Row, ObjectOptions<Row>> {}

/*function query(type: TypeConfig) {
  return (expr: Expr<any>, pages: Pages<any>): Expr<any> | undefined => {
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
}*/

export function object<T>(
  label: Label,
  options: ObjectOptions<T>
): ObjectField<T> {
  return new ObjectField(Type.shape(options.fields), {
    hint: Type.hint(options.fields),
    label,
    options
  })
}
