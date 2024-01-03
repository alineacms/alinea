import {FieldOptions, Schema, WithoutLabel} from 'alinea/core'
import {Infer} from 'alinea/core/Infer'
import {ListField} from 'alinea/core/field/ListField'
import {listHint} from 'alinea/core/util/Hints'

/** Optional settings to configure a list field */
export interface ListOptions<Definitions extends Schema>
  extends FieldOptions<Array<any>> {
  /** Allow these types of blocks to be created */
  schema: Definitions
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: string
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

/** Create a list field configuration */
export function list<Definitions extends Schema>(
  label: string,
  options: WithoutLabel<ListOptions<Definitions>>
): ListField<Infer<Definitions>, ListOptions<Definitions>> {
  return new ListField(Schema.shapes(options.schema), {
    hint: listHint(options.schema),
    options: {label, ...options}
  })
}
