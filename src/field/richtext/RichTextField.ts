import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {Schema} from 'alinea/core/Schema'
import type {TextDoc} from 'alinea/core/TextDoc'
import {RichTextField} from 'alinea/core/field/RichTextField'
import {ReactNode} from 'react'

/** Optional settings to configure a rich text field */
export interface RichTextOptions<Blocks extends Schema>
  extends FieldOptions<TextDoc<Blocks>> {
  /** Allow these blocks to be created between text fragments */
  schema?: Blocks
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
  /** Index the text value of this field */
  searchable?: boolean
  /** Enable inserting and editing tables */
  enableTables?: boolean
}

/** Create a rich text field configuration */
export function richText<Blocks extends Schema = {}>(
  label: string,
  options: WithoutLabel<RichTextOptions<Blocks>> = {}
): RichTextField<Blocks, RichTextOptions<Blocks>> {
  return new RichTextField(options.schema, {
    options: {label, ...options},
    view: 'alinea/field/richtext/RichTextField.view#RichTextInput'
  })
}
