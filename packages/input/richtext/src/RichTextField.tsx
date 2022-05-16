import {Field, Label, Schema, SchemaConfig, Value} from '@alinea/core'

/** Optional settings to configure a rich text field */
export type RichTextOptions<T> = {
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
}

/** Internal representation of a rich text field */
export interface RichTextField<T> extends Field.Text<T> {
  label: Label
  options: RichTextOptions<T>
}

/** Create a rich text field configuration */
export function createRichText<T>(
  label: Label,
  options: RichTextOptions<T> = {}
): RichTextField<T> {
  return {
    type: Value.RichText(label, options.blocks && Schema.shape(options.blocks)),
    label,
    options
  }
}
