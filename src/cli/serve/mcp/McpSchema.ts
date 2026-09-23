import type {Config} from '#/core/Config.js'
import type {Field} from '#/core/Field.js'
import {getField, getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {Page} from '#/core/Page.js'
import type {Picker} from '#/core/Picker.js'
import {Root} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
import {Section} from '#/core/Section.js'
import {Type} from '#/core/Type.js'
import {entries, isRecord, keys} from '#/core/util/Objects.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'

export type FieldKind =
  | 'text'
  | 'richText'
  | 'list'
  | 'object'
  | 'metadata'
  | 'select'
  | 'multipleSelect'
  | 'link'
  | 'check'
  | 'number'
  | 'date'
  | 'time'
  | 'code'
  | 'json'
  | 'path'
  | 'hidden'
  | 'localised'
  | 'mediaAlt'
  | 'custom'

const kindByView = new Map<string, FieldKind>([
  [viewKeys.TextInput, 'text'],
  [viewKeys.RichTextInput, 'richText'],
  [viewKeys.ListInput, 'list'],
  [viewKeys.ObjectInput, 'object'],
  [viewKeys.MetadataInput, 'metadata'],
  [viewKeys.SelectInput, 'select'],
  [viewKeys.MultipleSelectInput, 'multipleSelect'],
  [viewKeys.SingleLinkInput, 'link'],
  [viewKeys.MultipleLinksInput, 'link'],
  [viewKeys.CheckInput, 'check'],
  [viewKeys.NumberInput, 'number'],
  [viewKeys.DateInput, 'date'],
  [viewKeys.TimeInput, 'time'],
  [viewKeys.CodeInput, 'code'],
  [viewKeys.JsonInput, 'json'],
  [viewKeys.PathInput, 'path'],
  [viewKeys.HiddenInput, 'hidden'],
  [viewKeys.LocalisedInput, 'localised'],
  [viewKeys.MediaAltInput, 'mediaAlt']
])

/** The kind of value a field holds, derived from its dashboard view */
export function fieldKind(field: Field): FieldKind {
  const view = getField(field).view
  if (typeof view !== 'string') return 'custom'
  return kindByView.get(view) ?? 'custom'
}

export function fieldOptions(field: Field): Record<string, unknown> {
  return getField(field).options as unknown as Record<string, unknown>
}

/** Block types of a list or rich text field, keyed by their `_type` */
export function fieldBlocks(field: Field): Record<string, Type> {
  const schema = fieldOptions(field).schema
  return isRecord(schema) ? (schema as Record<string, Type>) : {}
}

/** The nested type of an object or metadata field */
export function fieldObjectType(field: Field): Type | undefined {
  const fields = fieldOptions(field).fields
  return Type.isType(fields) ? fields : undefined
}

export type LinkType = 'entry' | 'image' | 'file' | 'url'

export function linkPickers(
  field: Field
): Record<string, Picker<never, Record<string, unknown>>> {
  const pickers = fieldOptions(field).pickers
  return isRecord(pickers)
    ? (pickers as Record<string, Picker<never, Record<string, unknown>>>)
    : {}
}

export function isMultipleLink(field: Field): boolean {
  return getField(field).view === viewKeys.MultipleLinksInput
}

export interface Localisation {
  locales: ReadonlyArray<string>
  inner: Field
}

export function fieldLocalisation(field: Field): Localisation | undefined {
  const localisation = (field as Field & {localisation?: Localisation})
    .localisation
  return localisation?.inner ? localisation : undefined
}

/** Maps field keys of a type to the tab they are shown in */
function tabsOf(type: Type): Map<string, string> {
  const result = new Map<string, string>()
  const visit = (sections: Array<Section>) => {
    for (const section of sections) {
      const data = section[Section.Data] as {types?: Array<Type>}
      if (Array.isArray(data.types)) {
        for (const tab of data.types) {
          const label = String(Type.label(tab))
          for (const key of keys(Type.fields(tab)))
            if (!result.has(key)) result.set(key, label)
          visit(Type.sections(tab))
        }
      }
      visit(section[Section.Data].sections)
    }
  }
  visit(Type.sections(type))
  return result
}

export interface FieldDescription {
  key: string
  kind: FieldKind
  label: string
  [detail: string]: unknown
}

/**
 * Describes types in a form an agent can use to write valid entry data.
 * Types used as list or rich text blocks are collected in `blocks`.
 */
export class SchemaDescriber {
  blocks = new Map<Type, string>()
  #described = new Map<string, Record<string, unknown>>()
  #bySignature = new Map<string, string>()
  #config: Config

  constructor(config: Config) {
    this.#config = config
  }

  /**
   * Name a block type and describe it. Structurally identical block types,
   * such as the ones created per field by a factory function, share a name.
   */
  blockRef(key: string, type: Type): string {
    const existing = this.blocks.get(type)
    if (existing) return existing
    const taken = new Set([...this.blocks.values(), ...this.#described.keys()])
    let name = key
    for (let index = 2; taken.has(name); index++) name = `${key}${index}`
    // Reserve the name first, a block may contain itself
    this.blocks.set(type, name)
    const description = {
      label: String(Type.label(type)),
      fields: this.fields(type)
    }
    const signature = JSON.stringify(description)
    const same = this.#bySignature.get(signature)
    if (same) {
      this.blocks.set(type, same)
      return same
    }
    this.#bySignature.set(signature, name)
    this.#described.set(name, description)
    return name
  }

  /** The block types referenced so far */
  describeBlocks(): Record<string, unknown> {
    return Object.fromEntries(this.#described)
  }

  type(name: string, type: Type): Record<string, unknown> {
    const data = getType(type)
    const contains = data.contains
      ? Schema.contained(this.#config.schema, data.contains)
      : undefined
    return {
      name,
      label: String(data.label),
      ...(data.hidden ? {hidden: true} : {}),
      ...(contains ? {contains} : {}),
      ...(data.insertOrder && data.insertOrder !== 'free'
        ? {insertOrder: data.insertOrder}
        : {}),
      ...(data.entryUrl ? {customEntryUrl: true} : {}),
      fields: this.fields(type)
    }
  }

  fields(type: Type): Array<FieldDescription> {
    const tabs = tabsOf(type)
    return entries(Type.fields(type)).map(([key, field]) => {
      const description = this.field(key, field)
      const tab = tabs.get(key)
      return tab ? {...description, tab} : description
    })
  }

  field(key: string, field: Field): FieldDescription {
    const kind = fieldKind(field)
    const options = fieldOptions(field)
    const result: FieldDescription = {
      key,
      kind,
      label: String(options.label)
    }
    for (const flag of [
      'required',
      'shared',
      'readOnly',
      'hidden',
      'multiline'
    ])
      if (options[flag] === true) result[flag] = true
    if (typeof options.width === 'number' && options.width !== 1)
      result.width = options.width
    if (typeof options.help === 'string') result.help = options.help
    if (typeof options.description === 'string')
      result.description = options.description
    if (typeof options.placeholder === 'string')
      result.placeholder = options.placeholder
    switch (kind) {
      case 'text':
        if (typeof options.type === 'string' && options.type !== 'text')
          result.inputType = options.type
        break
      case 'number':
        for (const limit of ['minValue', 'maxValue', 'step'])
          if (typeof options[limit] === 'number') result[limit] = options[limit]
        break
      case 'select':
      case 'multipleSelect':
        result.options = options.options
        if (options.initialValue !== undefined)
          result.initialValue = options.initialValue
        break
      case 'richText': {
        const blocks = fieldBlocks(field)
        if (keys(blocks).length) result.blocks = this.#blockRefs(blocks)
        if (options.enableTables) result.enableTables = true
        if (options.enableImages) result.enableImages = true
        break
      }
      case 'list':
        result.blocks = this.#blockRefs(fieldBlocks(field))
        if (typeof options.min === 'number') result.min = options.min
        if (typeof options.max === 'number') result.max = options.max
        break
      case 'object':
      case 'metadata': {
        // Audit fields are filled in automatically
        const type = fieldObjectType(field)
        if (type)
          result.fields = this.fields(type).filter(
            field => kind === 'object' || !field.readOnly
          )
        break
      }
      case 'link': {
        const pickers = linkPickers(field)
        result.linkTypes = keys(pickers)
        if (isMultipleLink(field)) result.multiple = true
        if (typeof options.max === 'number') result.max = options.max
        for (const [type, picker] of entries(pickers)) {
          const pickerOptions = picker.options ?? {}
          const condition = pickerOptions.condition
          if (type === 'entry' && isRecord(condition))
            result.condition = condition
          if (picker.fields)
            result[`${type}Fields`] = this.fields(picker.fields)
        }
        break
      }
      case 'localised': {
        const localisation = fieldLocalisation(field)
        if (localisation) {
          result.locales = [...localisation.locales]
          result.inner = this.field(key, localisation.inner)
        }
        break
      }
    }
    return result
  }

  #blockRefs(blocks: Record<string, Type>): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, type] of entries(blocks))
      result[key] = this.blockRef(key, type)
    return result
  }
}

export interface DescribeSchemaOptions {
  config: Config
  type?: string
}

/** How to write values for each field kind, shared by all tools */
export const valueFormats: Record<string, string> = {
  'text/code/path/date/time':
    'string (date: "2026-09-23", time: "14:30"); path is the url slug, it defaults to the slugified title',
  number: 'number or null',
  check: 'boolean',
  select: 'one of the option keys (not labels) or null',
  multipleSelect: 'array of option keys',
  richText:
    'a Markdown string (headings, **bold**, *italic*, ~~strike~~, links, lists, > quotes, ---, tables, images on their own line) or stored TextDoc JSON. Link to an entry with [text](entry:ENTRY_ID), place an image entry with ![alt](entry:MEDIA_ID). A fenced code block becomes the block type with a `code` field if the field has one. Other blocks: a fenced ```alinea-block containing the block JSON ({"_type": "BlockKey", ...fields}). Inline `code` is stored as plain text',
  list: 'array of rows {"_type": "BlockKey", ...fields}; `_type` may be left out when the list has a single block type. `_id` and `_index` are generated, pass the existing `_id` to keep a row identity',
  object: 'object with the nested fields',
  link: 'entry/image/file: an entry id string or {"id": "...", ...extra fields}; images and files must be media entries (see upload_file). url: a url string or {"url": "...", "title": "...", "target": "_blank"}. Fields that allow several link types take either form. Multiple links take an array. null clears a single link',
  localised: 'object keyed by locale, eg {"en": value, "nl": value}',
  'json/hidden/custom': 'any JSON value, stored as is'
}

export function describeSchema({
  config,
  type
}: DescribeSchemaOptions): Record<string, unknown> {
  const describer = new SchemaDescriber(config)
  if (type) {
    const instance = config.schema[type]
    if (!instance) return {error: `Type "${type}" not found`}
    return {
      type: describer.type(type, instance),
      blocks: describer.describeBlocks(),
      valueFormats
    }
  }
  const typeNames = Schema.typeNames(config.schema)
  const workspaces = entries(config.workspaces).map(([name, workspace]) => {
    const data = getWorkspace(workspace)
    return {
      name,
      label: data.label,
      source: data.source,
      ...(data.mediaDir ? {mediaDir: data.mediaDir} : {}),
      roots: entries(data.roots).map(([rootName, root]) => {
        const rootData = getRoot(root)
        const contains = Schema.contained(config.schema, Root.contains(root))
        const children = entries(root as Record<string, unknown>)
          .filter(([, page]) => Page.isPage(page))
          .map(([key, page]) => ({
            key,
            type: typeNames.get(Page.data(page as Page).type)
          }))
        return {
          name: rootName,
          label: rootData.label,
          ...(rootData.isMediaRoot ? {media: true} : {}),
          ...(rootData.i18n ? {locales: [...rootData.i18n.locales]} : {}),
          contains: rootData.isMediaRoot
            ? ['MediaLibrary', 'MediaFile']
            : contains,
          ...(children.length ? {seededChildren: children} : {})
        }
      })
    }
  })
  const types = entries(config.schema).map(([name, instance]) =>
    describer.type(name, instance)
  )
  return {
    enableDrafts: Boolean(config.enableDrafts),
    workspaces,
    types,
    blocks: describer.describeBlocks(),
    valueFormats
  }
}
