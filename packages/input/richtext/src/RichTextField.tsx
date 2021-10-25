import {Field, Label, Schema, Type} from '@alinea/core'
import {TextDoc} from '@alinea/core/type/RichTextType'

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
    type: Type.RichText(options.blocks?.types),
    label,
    options
  }
}
