import {Field, FieldOptions, Label, Schema} from 'alinea/core'
import {listHint} from 'alinea/core/util/Hints'

/** Optional settings to configure a list field */
export interface ListOptions<Definitions extends Schema> extends FieldOptions {
  /** Allow these types of blocks to be created */
  schema: Definitions
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
export class ListField<Definitions extends Schema> extends Field.List<
  Schema.InferListRow<Definitions>,
  ListOptions<Definitions>
> {}

/** Create a list field configuration */
export function list<Definitions extends Schema>(
  label: Label,
  options: ListOptions<Definitions>
): ListField<Definitions> {
  return new ListField(Schema.shapes(options.schema), {
    hint: listHint(options.schema),
    label,
    options
  })
}
