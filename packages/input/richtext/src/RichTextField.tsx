import {Field, Label, Schema, Value} from '@alinea/core'
import {TextDoc} from '@alinea/core/type/RichTextValue'

export type RichTextOptions<T> = {
  help?: Label
  optional?: boolean
  inline?: boolean
  initialValue?: string
  // Allow these blocks to be created between text fragments
  blocks?: Schema<T>
}

export interface RichTextField<T> extends Field<TextDoc<T>> {
  label: Label
  options: RichTextOptions<T>
}

export function createRichText<T>(
  label: Label,
  options: RichTextOptions<T> = {}
): RichTextField<T> {
  return {
    type: Value.RichText(options.blocks?.valueTypes),
    label,
    options
  }
}
