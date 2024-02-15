import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {Infer} from 'alinea/core/Infer'
import {Schema} from 'alinea/core/Schema'
import {ListField} from 'alinea/core/field/ListField'
import type {ListRow} from 'alinea/core/shape/ListShape'
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
  /** Display a minimal version */
  inline?: boolean
  /** Hide this list field */
  hidden?: boolean
}

/** Create a list field configuration */
export function list<Definitions extends Schema>(
  label: string,
  options: WithoutLabel<ListOptions<Definitions>>
): ListField<Infer<Definitions> & ListRow, ListOptions<Definitions>> {
  return new ListField(Schema.shapes(options.schema), {
    hint: listHint(options.schema),
    options: {label, ...options}
  })
}
