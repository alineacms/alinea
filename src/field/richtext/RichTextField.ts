import type {FieldOptions, WithoutLabel} from '#/core/Field.js'
import {RichTextField} from '#/core/field/RichTextField.js'
import type {Schema} from '#/core/Schema.js'
import type {TextDoc} from '#/core/TextDoc.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import type {AnyExtension} from '@tiptap/core'
import type {ReactNode} from 'react'
import type {ToolbarConfig} from './Toolbar.js'

export interface RichTextExtensionConfig {
  [name: string]: AnyExtension
}

export interface ConfigureRichTextExtensions {
  (defaults: RichTextExtensionConfig): RichTextExtensionConfig
}

export function configureRichTextExtensions(
  configure: ConfigureRichTextExtensions | undefined,
  defaults: RichTextExtensionConfig
): RichTextExtensionConfig {
  if (configure === undefined) return defaults
  if (typeof configure !== 'function')
    throw new TypeError(
      'Rich text extensions must be configured with a function, for example: extensions: defaults => ({...defaults})'
    )
  return configure(defaults)
}

/** Optional settings to configure a rich text field */
export interface RichTextOptions<Blocks extends Schema> extends FieldOptions<
  TextDoc<Blocks>
> {
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
  /** Enable inserting and editing images */
  enableImages?: boolean
  /** Configure the toolbar layout and items */
  toolbar?: ToolbarConfig
  /** Configure tiptap extensions */
  extensions?: ConfigureRichTextExtensions
}

/** Create a rich text field configuration */
export function richText<Blocks extends Schema = {}>(
  label: string,
  options: WithoutLabel<RichTextOptions<Blocks>> = {}
): RichTextField<Blocks, RichTextOptions<Blocks>> {
  return new RichTextField(options.schema, {
    options: {label, ...options},
    view: viewKeys.RichTextInput,
    compactView: viewKeys.RichTextCompact
  })
}
