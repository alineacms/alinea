import {Field, Label, Schema, TextDoc} from 'alinea/core'
import {richTextHint} from 'alinea/core/util/Hints'

/** Optional settings to configure a rich text field */
export interface RichTextOptions<Blocks extends Schema> {
  /** Allow these blocks to be created between text fragments */
  schema?: Blocks
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: TextDoc<Blocks>
  /** Hide this rich text field */
  hidden?: boolean
  /** Make this rich text field read-only */
  readOnly?: boolean
}

/** Internal representation of a rich text field */
export class RichTextField<Blocks extends Schema> extends Field.RichText<
  Blocks,
  RichTextOptions<Blocks>
> {}

/** Create a rich text field configuration */
export function richText<Blocks extends Schema = {}>(
  label: Label,
  options: RichTextOptions<Blocks> = {}
): RichTextField<Blocks> {
  const shapes = options.schema && Schema.shapes(options.schema)
  return new RichTextField(shapes, {
    hint: richTextHint(options.schema),
    label,
    options,
    initialValue: options.initialValue ?? []
  })
}
