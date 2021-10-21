import {Field, Label, Type} from '@alinea/core'

export type RichTextOptions = {
  help?: Label
  optional?: boolean
  inline?: boolean
  initialValue?: string
}

export type RichTextField = Field<string> & {
  label: Label
  options: RichTextOptions
}

export function createRichText(
  label: Label,
  options: RichTextOptions = {}
): RichTextField {
  return {
    type: Type.XmlFragment,
    label,
    options
  }
}
