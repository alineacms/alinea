import type {Config} from '#/core/Config.js'
import type {Field} from '#/core/Field.js'
import {getField, getRoot} from '#/core/Internal.js'
import type {Picker} from '#/core/Picker.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {entries, isRecord, keys} from '#/core/util/Objects.js'
import {Workspace} from '#/core/Workspace.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'

const kindByView: Record<string, string> = {
  [viewKeys.TextInput]: 'text',
  [viewKeys.RichTextInput]: 'richText',
  [viewKeys.ListInput]: 'list',
  [viewKeys.ObjectInput]: 'object',
  [viewKeys.MetadataInput]: 'object',
  [viewKeys.SelectInput]: 'select',
  [viewKeys.MultipleSelectInput]: 'multipleSelect',
  [viewKeys.SingleLinkInput]: 'link',
  [viewKeys.MultipleLinksInput]: 'links',
  [viewKeys.CheckInput]: 'check',
  [viewKeys.NumberInput]: 'number',
  [viewKeys.DateInput]: 'date',
  [viewKeys.TimeInput]: 'time',
  [viewKeys.CodeInput]: 'code',
  [viewKeys.JsonInput]: 'json',
  [viewKeys.PathInput]: 'path',
  [viewKeys.HiddenInput]: 'hidden',
  [viewKeys.LocalisedInput]: 'localised'
}

/** The kind of value a field holds, derived from its dashboard view */
export function fieldKind(field: Field): string {
  const view = getField(field).view
  return (typeof view === 'string' && kindByView[view]) || 'json'
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

export function linkPickers(field: Field): Record<string, Picker<never>> {
  const pickers = fieldOptions(field).pickers
  return isRecord(pickers) ? (pickers as Record<string, Picker<never>>) : {}
}

export function fieldLocalisation(
  field: Field
): {locales: ReadonlyArray<string>; inner: Field} | undefined {
  return (field as Field & {localisation?: {locales: []; inner: Field}})
    .localisation
}

/** The block (or object field) type the dashboard creates with a code field */
export function codeBlockType(blocks: Record<string, Type>) {
  return entries(blocks).find(([, type]) => Type.field(type, 'code'))
}

export const valueFormats = `Fields are described as "kind[details] Label (flags)". list and richText details are row _types (Name=Definition when described under another name), object[Definition] and "fields: Definition" refer to definitions, select details are the option keys.
Values by field kind:
- text, code, path, date ("2026-09-23"), time ("14:30"): string. path is the url slug, it defaults to the slugified title
- number: number, check: boolean, select: an option key, multipleSelect: an array of option keys
- richText: Markdown. Link to an entry with [text](entry:ID) or [text](entry:ID#anchor), images: ![alt](entry:MEDIA_ID) on their own line. A fenced code block becomes the block type with a code field, other fields in the info string: \`\`\`ts id=BLOCK_ID fileName=app.ts. Other blocks: an \`\`\`alinea-block fence holding the block JSON {"_type": "Name", ...fields}. Stored TextDoc JSON is accepted as well
- list: an array of rows {"_type": "Name", ...fields}, _type can be left out when the list has one row type. The array replaces the list: a row with the _id of a current row updates that row, rows without _id are added
- link: an entry or media id, a url, or {"id": "...", ...fields} / {"url": "...", "title": "..."} when the link has fields. links: an array of those. null clears a link
- object: an object of nested fields, only given keys change
- localised[locales]: an object keyed by locale, only given locales change
- json, hidden: any JSON value`

/**
 * Describes the schema compactly. A field is "kind[details] Label (flags)":
 * block, object and link field types are named in details and described once
 * in `definitions`, select fields list their option keys.
 */
export function describeSchema(config: Config, only?: string) {
  const definitions: Record<string, unknown> = {}
  const names = new Map<Type, string>()

  /** Name and describe a nested type, types with the same fields share one */
  function define(key: string, type: Type): string {
    let name = names.get(type)
    if (name) return name
    name = key
    for (let i = 2; name in definitions; i++) name = `${key}${i}`
    // Reserve the name first, a block may contain itself
    names.set(type, name)
    definitions[name] = {}
    const fields = describeFields(type)
    const same = keys(definitions).find(
      other =>
        other.replace(/\d+$/, '') === key &&
        JSON.stringify(definitions[other]) === JSON.stringify(fields)
    )
    if (same && same !== name) {
      delete definitions[name]
      names.set(type, same)
      return same
    }
    definitions[name] = fields
    return name
  }

  function describeField(key: string, field: Field): string {
    const options = fieldOptions(field)
    const kind = fieldKind(field)
    let details: Array<string> = []
    const flags = ['required', 'shared', 'readOnly'].filter(
      flag => options[flag] === true
    )
    switch (kind) {
      case 'list':
      case 'richText':
        // The _type of a row, and its definition if named otherwise
        details = entries(fieldBlocks(field)).map(([name, type]) => {
          const definition = define(name, type)
          return definition === name ? name : `${name}=${definition}`
        })
        break
      case 'object': {
        const type = fieldObjectType(field)
        if (type) details = [define(key, type)]
        break
      }
      case 'select':
      case 'multipleSelect':
        details = keys(options.options ?? {})
        break
      case 'link':
      case 'links':
        for (const [linkType, picker] of entries(linkPickers(field))) {
          details.push(linkType)
          if (picker.fields)
            flags.push(
              `${linkType} fields: ${define(`${key}Link`, picker.fields)}`
            )
        }
        break
      case 'localised': {
        const localisation = fieldLocalisation(field)!
        return `localised[${localisation.locales.join('|')}] ${describeField(key, localisation.inner)}`
      }
    }
    const label = String(options.label)
    const sameAsKey =
      label.replace(/\W/g, '').toLowerCase() === key.toLowerCase()
    return [
      details.length ? `${kind}[${details.join('|')}]` : kind,
      sameAsKey ? '' : label,
      flags.length ? `(${flags.join(', ')})` : ''
    ]
      .filter(Boolean)
      .join(' ')
  }

  function describeFields(type: Type) {
    const result: Record<string, string> = {}
    for (const [key, field] of entries(Type.fields(type)))
      result[key] = describeField(key, field)
    return result
  }

  const types: Record<string, unknown> = {}
  for (const [name, type] of entries(config.schema)) {
    if (only && name !== only) continue
    const contains = Type.contains(type)
    types[name] = {
      ...(contains.length
        ? {contains: Schema.contained(config.schema, contains)}
        : {}),
      fields: describeFields(type)
    }
  }
  if (only && !types[only])
    throw new Error(
      `Type "${only}" not found, available: ${keys(config.schema).join(', ')}`
    )
  const workspaces: Record<string, unknown> = {}
  for (const [workspace, workspaceConfig] of entries(config.workspaces)) {
    const described: Record<string, unknown> = {}
    for (const [name, root] of entries(Workspace.roots(workspaceConfig))) {
      const {contains = [], i18n, isMediaRoot} = getRoot(root)
      described[name] = {
        ...(isMediaRoot ? {media: true} : {}),
        ...(i18n ? {locales: i18n.locales} : {}),
        contains: Schema.contained(config.schema, contains)
      }
    }
    workspaces[workspace] = described
  }
  return {
    enableDrafts: Boolean(config.enableDrafts),
    workspaces,
    types,
    definitions,
    valueFormats
  }
}
