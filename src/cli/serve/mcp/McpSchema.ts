import type {Config} from '#/core/Config.js'
import type {Field} from '#/core/Field.js'
import {getField, getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {Page} from '#/core/Page.js'
import type {Picker} from '#/core/Picker.js'
import {Root} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
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

export interface FieldDescription {
  kind: FieldKind
  label: string
  [detail: string]: unknown
}

/**
 * Field descriptions keyed by field key, in field order. A field without
 * details is written as "kind Label" (just "kind" when the label is the key).
 */
export type FieldDescriptions = Record<
  string,
  Omit<FieldDescription, 'label'> | string
>

function sameWords(label: string, key: string) {
  return label.replace(/[\s_-]/g, '').toLowerCase() === key.toLowerCase()
}

const fieldFlags = ['required', 'shared', 'readOnly', 'hidden', 'multiline']

/**
 * Leave out what the key already says, a field with only flags is written as
 * "kind Label (flag, flag)"
 */
function compactField(key: string, field: FieldDescription) {
  const {kind, label, ...details} = field
  const redundant = sameWords(label, key)
  // Link types and block names fit in the kind: link[image], list[Row]
  const listed = kind === 'link' ? 'linkTypes' : 'blocks'
  const types = details[listed]
  const flags = keys(details).filter(name => name !== listed)
  const simple =
    flags.every(
      flag =>
        (fieldFlags.includes(flag) || flag === 'multiple') &&
        details[flag] === true
    ) &&
    (types === undefined || Array.isArray(types))
  if (simple) {
    const kindWithTypes = Array.isArray(types)
      ? `${kind}[${types.join('|')}]`
      : kind
    const head = redundant ? kindWithTypes : `${kindWithTypes} ${label}`
    return flags.length ? `${head} (${flags.join(', ')})` : head
  }
  return redundant ? {kind, ...details} : field
}

const definitionPrefix = '#/definitions/'

/**
 * Describe fields repeated across types (the same key and options) once in
 * definitions and refer to them by "#/definitions/name".
 */
function shareRepeatedFields(
  containers: Array<unknown>,
  definitions: Record<string, unknown>
) {
  const fieldMaps: Array<Record<string, unknown>> = []
  const collect = (value: unknown) => {
    if (!isRecord(value)) return
    if (isRecord(value.fields)) {
      fieldMaps.push(value.fields)
      for (const field of Object.values(value.fields)) collect(field)
    }
    for (const [key, inner] of entries(value))
      if (key !== 'fields' && isRecord(inner)) collect(inner)
  }
  for (const container of containers) collect(container)
  const counts = new Map<string, number>()
  const signature = (key: string, field: unknown) =>
    `${key}:${JSON.stringify(field)}`
  for (const fields of fieldMaps)
    for (const [key, field] of entries(fields))
      if (isRecord(field)) {
        const id = signature(key, field)
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
  const names = new Map<string, string>()
  for (const fields of fieldMaps)
    for (const [key, field] of entries(fields)) {
      if (!isRecord(field)) continue
      const id = signature(key, field)
      if ((counts.get(id) ?? 0) < 2 || id.length < 48) continue
      let name = names.get(id)
      if (!name) {
        name = key
        for (let index = 2; name in definitions; index++)
          name = `${key}${index}`
        definitions[name] = field
        names.set(id, name)
      }
      fields[key] = `${definitionPrefix}${name}`
    }
}

/** Field groups smaller than this are described in place */
const inlineLimit = 240

/**
 * Describes types in a form an agent can use to write valid entry data.
 * Types used as list or rich text blocks, and larger field groups (object
 * fields, link fields), are described once in `definitions` and referred to
 * by name, so a group repeated in every type does not repeat its fields.
 */
export class SchemaDescriber {
  #names = new Map<Type, string>()
  #described = new Map<string, Record<string, unknown>>()
  #bySignature = new Map<string, string>()
  #config: Config

  constructor(config: Config) {
    this.#config = config
  }

  #name(key: string) {
    const taken = new Set([...this.#names.values(), ...this.#described.keys()])
    let name = key
    for (let index = 2; taken.has(name); index++) name = `${key}${index}`
    return name
  }

  /**
   * Name a block type and describe it. Structurally identical block types,
   * such as the ones created per field by a factory function, share a name.
   */
  blockRef(key: string, type: Type): string {
    const existing = this.#names.get(type)
    if (existing) return existing
    const name = this.#name(key)
    // Reserve the name first, a block may contain itself
    this.#names.set(type, name)
    const label = String(Type.label(type))
    return this.#define(type, name, {
      ...(sameWords(label, key) ? {} : {label}),
      fields: this.fields(type)
    })
  }

  #define(type: Type, name: string, description: Record<string, unknown>) {
    const signature = JSON.stringify(description)
    const same = this.#bySignature.get(signature)
    if (same) {
      this.#names.set(type, same)
      return same
    }
    this.#names.set(type, name)
    this.#bySignature.set(signature, name)
    this.#described.set(name, description)
    return name
  }

  /**
   * The fields of a nested type (object field, link fields), in place when
   * small, otherwise the name of their definition.
   */
  groupRef(
    key: string,
    type: Type,
    filter: (field: FieldDescription) => boolean = () => true
  ): FieldDescriptions | string {
    const fields: FieldDescriptions = {}
    for (const [name, field] of entries(Type.fields(type))) {
      const description = this.field(name, field)
      if (filter(description)) fields[name] = compactField(name, description)
    }
    const signature = JSON.stringify({fields})
    const same = this.#bySignature.get(signature)
    if (same) return `${definitionPrefix}${same}`
    if (signature.length < inlineLimit) return fields
    return `${definitionPrefix}${this.#define(type, this.#name(key), {fields})}`
  }

  /** The block types and field groups referenced so far */
  describeDefinitions(): Record<string, unknown> {
    return Object.fromEntries(this.#described)
  }

  type(name: string, type: Type): Record<string, unknown> {
    const data = getType(type)
    const contains = data.contains
      ? Schema.contained(this.#config.schema, data.contains)
      : undefined
    const fields = this.fields(type)
    // Internal types (media files) keep their computed fields to themselves
    if (data.hidden)
      for (const [key, field] of entries(Type.fields(type)))
        if (fieldKind(field) === 'hidden') delete fields[key]
    const label = String(data.label)
    return {
      name,
      ...(sameWords(label, name) ? {} : {label}),
      ...(data.hidden ? {hidden: true} : {}),
      ...(contains ? {contains} : {}),
      ...(data.insertOrder && data.insertOrder !== 'free'
        ? {insertOrder: data.insertOrder}
        : {}),
      fields
    }
  }

  fields(type: Type): FieldDescriptions {
    const result: FieldDescriptions = {}
    for (const [key, field] of entries(Type.fields(type)))
      result[key] = compactField(key, this.field(key, field))
    return result
  }

  field(key: string, field: Field): FieldDescription {
    const kind = fieldKind(field)
    const options = fieldOptions(field)
    const result: FieldDescription = {
      kind,
      label: String(options.label)
    }
    for (const flag of fieldFlags)
      if (options[flag] === true) result[flag] = true
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
          result.fields = this.groupRef(
            key,
            type,
            field => kind === 'object' || !field.readOnly
          )
        break
      }
      case 'link': {
        const pickers = linkPickers(field)
        result.linkTypes = keys(pickers)
        if (isMultipleLink(field)) result.multiple = true
        if (typeof options.max === 'number') result.max = options.max
        const linkFields: Record<string, unknown> = {}
        for (const [type, picker] of entries(pickers)) {
          const pickerOptions = picker.options ?? {}
          const condition = pickerOptions.condition
          if (type === 'entry' && isRecord(condition))
            result.condition = condition
          if (picker.fields)
            linkFields[type] = this.groupRef(`${key}LinkFields`, picker.fields)
        }
        // Link types usually share their extra fields
        const distinct = new Set(
          Object.values(linkFields).map(value => JSON.stringify(value))
        )
        if (
          distinct.size === 1 &&
          keys(linkFields).length === keys(pickers).length
        )
          result.linkFields = Object.values(linkFields)[0]
        else
          for (const [type, value] of entries(linkFields))
            result[`${type}Fields`] = value
        break
      }
      case 'localised': {
        const localisation = fieldLocalisation(field)
        if (localisation) {
          result.locales = [...localisation.locales]
          // The inner field shares the label and flags of the localised one
          const inner: Record<string, unknown> = this.field(
            key,
            localisation.inner
          )
          for (const name of keys(inner))
            if (name !== 'kind' && inner[name] === result[name])
              delete inner[name]
          result.inner = keys(inner).length === 1 ? inner.kind : inner
        }
        break
      }
    }
    return result
  }

  /** Block names, as a list when each is described under its own key */
  #blockRefs(
    blocks: Record<string, Type>
  ): Record<string, string> | Array<string> {
    const result: Record<string, string> = {}
    for (const [key, type] of entries(blocks))
      result[key] = this.blockRef(key, type)
    return entries(result).every(([key, name]) => key === name)
      ? keys(result)
      : result
  }
}

export interface DescribeSchemaOptions {
  config: Config
  type?: string
  /** summary: types with field keys, kinds and labels only */
  detail?: 'full' | 'summary'
}

const definitionsNote =
  'Fields by key: "kind[link types|block names] Label (flags)" or {kind, label, ...options}, a label matching the key is left out. Blocks, field groups and repeated fields are described once in definitions, "#/definitions/name" refers to one. linkFields are stored on each link, localised fields hold `inner` per locale.'

/** How to write values for each field kind, shared by all tools */
export const valueFormats: Record<string, string> = {
  'text/code/path/date/time':
    'string (date "2026-09-23", time "14:30"); path is the url slug, defaults to the slugified title',
  number: 'number or null',
  check: 'boolean',
  select: 'an option key (not the label) or null',
  multipleSelect: 'array of option keys',
  richText:
    'Markdown (headings, **bold**, *italic*, ~~strike~~, links, lists, > quotes, ---, tables, images on their own line) or TextDoc JSON. Entry links: [text](entry:ID), images: ![alt](entry:MEDIA_ID). A fenced code block becomes the block with a `code` field, other fields in the info string: ```ts id=BLOCK_ID fileName=app.tsx compact (keep the id to keep the block). Other blocks: ```alinea-block with the block JSON {"_type": "BlockKey", ...fields}. Inline `code` stays text with its backticks (there is no code mark)',
  list: 'array of rows {"_type": "BlockKey", ...fields} (_type optional with one block type; _id/_index are generated). An array replaces the list, rows with an existing _id merge into that row: [{"_id": "..."}, {"_id": "...", "title": "New"}]. Or patch with {"update": [{"_id", ...fields}], "insert": [{"row": {...}, "after"|"before": "_id"}], "remove": ["_id"], "order": [every _id]}, applied in that order. Nested lists take the same forms',
  'object/metadata':
    'object of nested fields, only given keys change (metadata audit fields are filled in)',
  link: 'entry/image/file: an entry id or {"id": "...", ...linkFields}, images and files are media entries (upload_file). url: a url or {"url": "...", "title": "...", "target": "_blank"}. Multiple links: an array. null clears a single link',
  localised: 'object keyed by locale {"en": value}, only given locales change',
  mediaAlt:
    'string, or strings keyed by locale when the media root is translated',
  'json/hidden/custom': 'any JSON value, stored as is'
}

function summaryField(key: string, field: Field): string {
  const kind = fieldKind(field)
  const label = String(fieldOptions(field).label)
  let detail = ''
  if (kind === 'list') detail = `[${keys(fieldBlocks(field)).join('|')}]`
  if (kind === 'link') detail = `[${keys(linkPickers(field)).join('|')}]`
  if (kind === 'localised') {
    const inner = fieldLocalisation(field)?.inner
    if (inner) detail = `(${fieldKind(inner)})`
  }
  return label && !sameWords(label, key)
    ? `${kind}${detail} ${label}`
    : `${kind}${detail}`
}

export function describeSchema({
  config,
  type,
  detail = 'full'
}: DescribeSchemaOptions): Record<string, unknown> {
  const describer = new SchemaDescriber(config)
  if (type) {
    const instance = config.schema[type]
    if (!instance) return {error: `Type "${type}" not found`}
    const described = describer.type(type, instance)
    const definitions = describer.describeDefinitions()
    shareRepeatedFields([described, ...Object.values(definitions)], definitions)
    return {
      type: described,
      definitions,
      notes: definitionsNote,
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
  if (detail === 'summary') {
    const types: Record<string, unknown> = {}
    for (const [name, instance] of entries(config.schema)) {
      const data = getType(instance)
      const contains = data.contains
        ? Schema.contained(config.schema, data.contains)
        : undefined
      const fields: Record<string, string> = {}
      for (const [key, field] of entries(Type.fields(instance)))
        fields[key] = summaryField(key, field)
      types[name] = {
        label: String(data.label),
        ...(contains ? {contains} : {}),
        fields
      }
    }
    return {
      detail: 'summary',
      enableDrafts: Boolean(config.enableDrafts),
      workspaces,
      types,
      notes:
        'Fields are "kind Label", list fields name their row types. Call describe_schema with a type for its full field details, row/block types and value formats before writing entries of that type.'
    }
  }
  const types = entries(config.schema).map(([name, instance]) =>
    describer.type(name, instance)
  )
  const definitions = describer.describeDefinitions()
  shareRepeatedFields([...types, ...Object.values(definitions)], definitions)
  return {
    enableDrafts: Boolean(config.enableDrafts),
    workspaces,
    types,
    definitions,
    notes: definitionsNote,
    valueFormats
  }
}
