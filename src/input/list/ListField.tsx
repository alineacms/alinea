import {Field, FieldOptions, Label, Schema} from 'alinea/core'
import {listHint} from 'alinea/core/util/Hints'

/** Optional settings to configure a list field */
export interface ListOptions<Row> extends FieldOptions {
  /** Allow these types of blocks to be created */
  schema: Schema<Row>
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** Hide this list field */
  hidden?: boolean
}

export interface ListRow {
  id: string
  index: string
  type: string
}

/** Internal representation of a list field */
export class ListField<Row> extends Field.List<
  Row & ListRow,
  ListOptions<Row>
> {}

/*function query<T, Q>(schema: Schema<T>) {
  return (field: Expr<Array<T>>, pages: Pages<any>): Expr<Q> | undefined => {
    const row = field.each()
    const cases: Record<string, SelectionInput> = {}
    let isComputed = false
    for (const [key, type] of schema.configEntries()) {
      const selection = type.selection(row, pages)
      if (!selection) continue
      cases[key] = selection
      isComputed = true
    }
    if (!isComputed) return
    return row.select(row.get('type').case(cases, row.fields)).toExpr()
  }
}*/

/** Create a list field configuration */
export function list<Row>(
  label: Label,
  options: ListOptions<Row>
): ListField<Row> {
  return new ListField(Schema.shapes(options.schema), {
    hint: listHint(options.schema),
    label,
    options
  })
}
