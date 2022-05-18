import type {Pages} from '@alinea/backend'
import {Field, Label, SchemaConfig, TextDoc, Value} from '@alinea/core'
import {Expr, SelectionInput} from '@alinea/store'

/** Optional settings to configure a rich text field */
export type RichTextOptions<T, Q> = {
  /** Allow these blocks to be created between text fragments */
  blocks?: SchemaConfig<T>
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: string
  /** Modify value returned when queried through `Pages` */
  query?: <P>(field: Expr<TextDoc<T>>, pages: Pages<P>) => Expr<Q> | undefined
}

/** Internal representation of a rich text field */
export interface RichTextField<T, Q = TextDoc<T>> extends Field.Text<T, Q> {
  label: Label
  options: RichTextOptions<T, Q>
}

function query<T, Q>(schema: SchemaConfig<T>) {
  return (field: Expr<TextDoc<T>>, pages: Pages<any>): Expr<Q> | undefined => {
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

/** Create a rich text field configuration */
export function createRichText<T, Q = TextDoc<T>>(
  label: Label,
  options: RichTextOptions<T, Q> = {}
): RichTextField<T, Q> {
  return {
    type: Value.RichText(label, options.blocks?.shape),
    label,
    options,
    query: options.query || (options.blocks && query<T, Q>(options.blocks))
  }
}
