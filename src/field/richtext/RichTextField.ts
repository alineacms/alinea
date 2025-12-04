import type {FieldOptions, WithoutLabel} from 'alinea/core/Field'
import {RichTextField} from 'alinea/core/field/RichTextField'
import type {Schema} from 'alinea/core/Schema'
import type {TextDoc} from 'alinea/core/TextDoc'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import type {ReactNode} from 'react'
import type {ToolbarConfig} from './RichTextToolbar.js'

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
  /** Configure the toolbar layout and items */
  toolbar?: ToolbarConfig
}

/** Create a rich text field configuration */
export function richText<Blocks extends Schema = {}>(
  label: string,
  options: WithoutLabel<RichTextOptions<Blocks>> = {}
): RichTextField<Blocks, RichTextOptions<Blocks>> {
  const referencedViews: Array<string> = []
  return new RichTextField(options.schema, {
    options: {label, ...options},
    view: viewKeys.RichTextInput,
    referencedViews: referencedViews
  })
}
