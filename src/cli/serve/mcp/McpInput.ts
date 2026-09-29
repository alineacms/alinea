import type {Field} from '#/core/Field.js'
import {createId} from '#/core/Id.js'
import {markdownToTextDoc} from '#/core/text/MarkdownToTextDoc.js'
import {textDocToMarkdown} from '#/core/text/TextDocToMarkdown.js'
import type {Node, TextDoc} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {entries, isRecord, keys} from '#/core/util/Objects.js'
import {withOrderKeys} from '#/core/util/OrderKeys.js'
import {
  codeBlockType,
  fieldBlocks,
  fieldKind,
  fieldLocalisation,
  fieldObjectType,
  fieldOptions,
  linkPickers
} from './McpSchema.js'

type Row = Record<string, unknown>

const primitives: Record<string, string> = {
  text: 'string',
  code: 'string',
  path: 'string',
  date: 'string',
  time: 'string',
  number: 'number',
  check: 'boolean'
}

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`)
}

function isBlock(node: unknown): node is Row & {_type: string} {
  return (
    isRecord(node) &&
    typeof node._type === 'string' &&
    /^[A-Z]/.test(node._type)
  )
}

/**
 * Convert the field values an agent sends (Markdown, plain ids, rows without
 * ids) into stored values. Only the given fields are returned, converted
 * against their current value so objects and list rows merge into it.
 */
export function inputData(
  type: Type,
  input: unknown,
  current: Row = {},
  path = 'data'
): Row {
  if (!isRecord(input)) fail(path, 'expected an object of field values')
  const fields = Type.fields(type)
  const result: Row = {}
  for (const [key, value] of entries(input)) {
    const field = fields[key]
    if (!field)
      fail(
        `${path}.${key}`,
        `unknown field, expected: ${keys(fields).join(', ')}`
      )
    result[key] = inputValue(field, value, current[key], `${path}.${key}`)
  }
  return result
}

function inputValue(
  field: Field,
  value: unknown,
  current: unknown,
  path: string
): unknown {
  const kind = fieldKind(field)
  const options = fieldOptions(field)
  const expected = primitives[kind]
  if (expected && value !== null && typeof value !== expected)
    fail(path, `expected a ${expected}`)
  switch (kind) {
    case 'select':
    case 'multipleSelect': {
      const allowed = keys(options.options ?? {})
      const values = kind === 'select' ? [value] : value
      if (!Array.isArray(values)) fail(path, 'expected an array of option keys')
      for (const key of values)
        if (key !== null && !allowed.includes(key as string))
          fail(path, `expected one of: ${allowed.join(', ')}`)
      return value
    }
    case 'richText':
      if (typeof value === 'string') return fromMarkdown(field, value, path)
      if (!Array.isArray(value)) fail(path, 'expected Markdown')
      return blocks(fieldBlocks(field), value, path)
    case 'list': {
      if (!Array.isArray(value)) fail(path, 'expected an array of rows')
      const rows = Array.isArray(current) ? current : []
      return withOrderKeys(
        value.map((row, index) => {
          const existing = rows.find(
            stored => isRecord(row) && row._id && stored._id === row._id
          )
          return listRow(
            fieldBlocks(field),
            row,
            existing,
            `${path}[${index}]`,
            true
          )
        })
      )
    }
    case 'object': {
      const type = fieldObjectType(field)!
      const base = isRecord(current) ? current : Type.initialValue(type)
      return {...base, ...inputData(type, value, base, path)}
    }
    case 'link':
      return value === null ? null : link(field, value, [current], path)
    case 'links': {
      if (!Array.isArray(value)) fail(path, 'expected an array of links')
      const links = Array.isArray(current) ? current : []
      return withOrderKeys(
        value.map((item, index) => ({
          _index: '',
          ...link(field, item, links, `${path}[${index}]`)
        }))
      )
    }
    case 'localised': {
      const {locales, inner} = fieldLocalisation(field)!
      if (!isRecord(value)) fail(path, `expected {${locales.join(', ')}}`)
      const base = isRecord(current) ? current : {}
      const result: Row = {...base}
      for (const [locale, localValue] of entries(value)) {
        if (!locales.includes(locale))
          fail(`${path}.${locale}`, `expected one of: ${locales.join(', ')}`)
        result[locale] = inputValue(
          inner,
          localValue,
          base[locale],
          `${path}.${locale}`
        )
      }
      return result
    }
    default:
      return value
  }
}

/** A list row or rich text block, new ones are shaped like the dashboard's */
function listRow(
  blockTypes: Record<string, Type>,
  input: unknown,
  existing: Row | undefined,
  path: string,
  isListRow = false
): Row {
  if (!isRecord(input)) fail(path, 'expected a row object')
  const {_id, _type, _index, ...fields} = input
  const names = keys(blockTypes)
  const name =
    _type ?? existing?._type ?? (names.length === 1 ? names[0] : undefined)
  const type = blockTypes[name as string]
  if (!type) fail(path, `expected a _type, one of: ${names.join(', ')}`)
  const base = existing ?? {
    _id: _id ?? createId(),
    ...(isListRow ? {_index: typeof _index === 'string' ? _index : ''} : {}),
    _type: name,
    ...Type.initialValue(type)
  }
  return {...base, ...inputData(type, fields, base, path)}
}

function blocks(
  blockTypes: Record<string, Type>,
  doc: Array<unknown>,
  path: string
) {
  return doc.map((node, index) =>
    isBlock(node)
      ? listRow(blockTypes, node, undefined, `${path}[${index}]`)
      : node
  ) as TextDoc
}

function link(
  field: Field,
  input: unknown,
  current: Array<unknown>,
  path: string
) {
  const pickers = linkPickers(field)
  const types = keys(pickers)
  let value = isRecord(input) ? input : {}
  if (typeof input === 'string') {
    const isUrl = /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(input)
    if (input.startsWith('entry:')) value = {id: input.slice(6)}
    else value = isUrl && pickers.url ? {url: input} : {id: input}
  }
  // The stored shape, as read with get_entry
  if (typeof value._type === 'string') return {_id: createId(), ...value}
  const {id, url, title, target, ...fields} = value
  const type =
    typeof id === 'string'
      ? types.find(type => type !== 'url')
      : typeof url === 'string'
        ? 'url'
        : undefined
  if (!type || !pickers[type])
    fail(path, `expected an entry id or url (link types: ${types.join(', ')})`)
  const stored =
    type === 'url'
      ? {
          _type: 'url',
          _url: url,
          _title: title ?? '',
          _target: target ?? '_blank'
        }
      : {_type: type, _entry: id}
  // A link to the same target keeps its id and fields
  const existing = current.find(
    link =>
      isRecord(link) &&
      link._type === stored._type &&
      (link._entry ?? link._url) === (id ?? url)
  ) as Row | undefined
  const linkFields = pickers[type].fields
  const base = existing ?? {
    _id: createId(),
    ...(linkFields ? Type.initialValue(linkFields) : {})
  }
  const extra = linkFields ? inputData(linkFields, fields, base, path) : {}
  return {...base, ...stored, ...extra}
}

function fromMarkdown(field: Field, markdown: string, path: string): TextDoc {
  const blockTypes = fieldBlocks(field)
  const code = codeBlockType(blockTypes)
  const doc = markdownToTextDoc(markdown, {
    link(href, title) {
      const entry = /^entry:([^#?]+)(?:#(.+))?$/.exec(href)
      const mark = entry
        ? {_link: 'entry', _entry: entry[1], _anchor: entry[2]}
        : {_link: 'url', href, title}
      return {_type: 'link', _id: createId(), ...mark}
    },
    image(src, alt, title) {
      const entry = /^entry:(.+)$/.exec(src)
      const image = entry
        ? {_id: createId(), _link: 'image', _entry: entry[1]}
        : {src}
      return {_type: 'image', ...image, alt, title} as Node
    },
    codeBlock: code
      ? (source, language, attributes) => {
          const [name, type] = code
          const fields: Row = {code: source}
          if (language && Type.field(type, 'language'))
            fields.language = language
          for (const [key, value] of entries(attributes)) {
            const attribute = Type.field(type, key)
            if (!attribute || key === 'code') continue
            const kind = fieldKind(attribute)
            fields[key] =
              kind === 'check'
                ? value === true || value === 'true'
                : kind === 'number'
                  ? Number(value)
                  : value
          }
          const id =
            typeof attributes.id === 'string' ? attributes.id : undefined
          return {_type: name, _id: id, ...fields} as Node
        }
      : undefined
  })
  return blocks(blockTypes, doc, path)
}

/** Stored field values with rich text rendered as Markdown */
export function outputData(type: Type, data: Row): Row {
  const result: Row = {...data}
  for (const [key, field] of entries(Type.fields(type)))
    if (key in result) result[key] = outputValue(field, result[key])
  return result
}

function outputValue(field: Field, value: unknown): unknown {
  switch (fieldKind(field)) {
    case 'richText': {
      if (!Array.isArray(value)) return value
      const code = codeBlockType(fieldBlocks(field))?.[0]
      return textDocToMarkdown(value, {
        // The default renders blocks with a code field as a fence, only the
        // code block type reads back that way
        block: node =>
          node._type === code
            ? undefined
            : `\`\`\`alinea-block\n${JSON.stringify(node, null, 2)}\n\`\`\``
      })
    }
    case 'list': {
      if (!Array.isArray(value)) return value
      const blockTypes = fieldBlocks(field)
      return value.map(row => {
        const type = isRecord(row) && blockTypes[row._type as string]
        return type ? outputData(type, row) : row
      })
    }
    case 'object': {
      const type = fieldObjectType(field)
      return type && isRecord(value) ? outputData(type, value) : value
    }
    case 'localised': {
      const {inner} = fieldLocalisation(field)!
      if (!isRecord(value)) return value
      const result: Row = {}
      for (const [locale, localValue] of entries(value))
        result[locale] = outputValue(inner, localValue)
      return result
    }
    default:
      return value
  }
}
