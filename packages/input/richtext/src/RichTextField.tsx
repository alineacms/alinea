import {Field, Label, Schema, Type} from '@alinea/core'

export type RichTextOptions<T> = {
  help?: Label
  optional?: boolean
  inline?: boolean
  initialValue?: string
  // Allow these blocks to be created between text fragments
  schema?: Schema<T>
}

export type RichTextField<T> = Field<string> & {
  label: Label
  options: RichTextOptions<T>
}

export function createRichText<T>(
  label: Label,
  options: RichTextOptions<T> = {}
): RichTextField<T> {
  return {
    type: Type.XmlFragment,
    label,
    options
  }
}
