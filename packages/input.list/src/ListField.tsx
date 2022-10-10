import type {Pages} from '@alinea/backend'
import {Field, Label, Schema, Shape} from '@alinea/core'
import {listHint} from '@alinea/core/util/Hints'
import {Expr, SelectionInput} from '@alinea/store'

/** Optional settings to configure a list field */
export type ListOptions<T, Q> = {
  /** Allow these types of blocks to be created */
  schema: Schema<T>
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
export interface ListField<T, Q = Array<T & ListRow>>
  extends Field.List<T & ListRow, Q> {
  label: Label
  options: ListOptions<T, Q>
}

function query<T, Q>(schema: Schema<T>) {
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
}

/** Create a list field configuration */
export function createList<T, Q = Array<T & ListRow>>(
  label: Label,
  options: ListOptions<T, Q>
): ListField<T, Q> {
  const {schema} = options
  return {
    shape: Shape.List(label, schema.shape),
    hint: listHint(schema),
    label,
    options,
    transform: query<T & ListRow, Q>(schema),
    hidden: options.hidden
  }
}
