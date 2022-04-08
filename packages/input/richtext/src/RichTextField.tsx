import {Field, Label, Schema, Value} from '@alineacms/core'

export type RichTextOptions<T> = {
  // Allow these blocks to be created between text fragments
  blocks?: Schema<T>
  help?: Label
  optional?: boolean
  inline?: boolean
  initialValue?: string
}

export interface RichTextField<T> extends Field.Text<T> {
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
