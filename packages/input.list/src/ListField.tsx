import type {Pages} from '@alinea/backend'
import {Field, Label, SchemaConfig, Shape} from '@alinea/core'
import {Expr, SelectionInput} from '@alinea/store'

/** Optional settings to configure a list field */
export type ListOptions<T, Q> = {
  /** Allow these types of blocks to be created */
  schema: SchemaConfig<T>
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** Modify value returned when queried through `Pages` */
  transform?: (field: Expr<Array<T>>, pages: Pages<any>) => Expr<Q> | undefined
  /** Hide this list field */
  hidden?: boolean
}

export type ListRow = {
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

function query<T, Q>(schema: SchemaConfig<T>) {
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
    label,
    options,
    transform: options.transform || query<T, Q>(schema),
    hidden: options.hidden
  }
}
