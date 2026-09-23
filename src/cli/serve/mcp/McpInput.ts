import type {Field} from '#/core/Field.js'
import {createId} from '#/core/Id.js'
import {markdownToTextDoc} from '#/core/text/MarkdownToTextDoc.js'
import type {Mark, Node, TextDoc} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {
  generateNKeysBetween,
  isValidOrderKey
} from '#/core/util/FractionalIndexing.js'
import {entries, isRecord, keys} from '#/core/util/Objects.js'
import {McpToolError} from './McpServer.js'
import {
  fieldBlocks,
  fieldKind,
  fieldLocalisation,
  fieldObjectType,
  fieldOptions,
  isMultipleLink,
  linkPickers
} from './McpSchema.js'

export interface InputReference {
  id: string
  path: string
  linkType: 'entry' | 'image' | 'file'
}

const listRowMeta = new Set(['_id', '_index', '_type', '_anchor', '_label'])
const urlPattern = /^(?:[a-z][a-z0-9+.-]*:|\/|#|\?)/i

function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'object') return 'an object'
  return `${typeof value} ${JSON.stringify(value).slice(0, 40)}`
}

function childPath(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`
  return path ? `${path}.${key}` : key
}

/**
 * Converts the convenient input an agent sends into stored field values,
 * validating against the schema. Entry references are collected so they can
 * be checked against the content afterwards.
 */
export class EntryInput {
  references: Array<InputReference> = []

  fail(path: string, message: string): never {
    throw new McpToolError(`${path || 'data'}: ${message}`)
  }

  /** Convert the fields of a type, rejecting unknown keys */
  typeData(
    type: Type,
    input: unknown,
    path: string,
    allowedMeta: Set<string> = new Set()
  ): Record<string, unknown> {
    if (!isRecord(input))
      this.fail(path, `expected an object with fields, got ${describe(input)}`)
    const fields = Type.fields(type)
    const result: Record<string, unknown> = {}
    for (const [key, value] of entries(input)) {
      if (allowedMeta.has(key)) continue
      const field = fields[key]
      if (!field)
        this.fail(
          childPath(path, key),
          `unknown field, "${String(Type.label(type))}" has fields: ${keys(fields).join(', ')}`
        )
      if (value === undefined) continue
      result[key] = this.value(field, value, childPath(path, key))
    }
    return result
  }

  value(field: Field, input: unknown, path: string): unknown {
    const kind = fieldKind(field)
    const options = fieldOptions(field)
    const label = String(options.label)
    const expected = (what: string): never =>
      this.fail(
        path,
        `expected ${what} for ${kind} field "${label}", got ${describe(input)}`
      )
    switch (kind) {
      case 'text':
      case 'code':
      case 'path':
        if (input === null) return ''
        if (typeof input !== 'string') return expected('a string')
        return input
      case 'date':
        if (input === null || input === '') return ''
        if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input))
          return expected('an ISO date string like "2026-09-23"')
        return input
      case 'time':
        if (input === null || input === '') return ''
        if (typeof input !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(input))
          return expected('a time string like "14:30"')
        return input
      case 'number':
        if (input === null) return null
        if (typeof input !== 'number' || !Number.isFinite(input))
          return expected('a number')
        return input
      case 'check':
        if (typeof input !== 'boolean') return expected('a boolean')
        return input
      case 'select':
        if (input === null) return null
        return this.#selectKey(options, input, path, label)
      case 'multipleSelect':
        if (!Array.isArray(input)) return expected('an array of option keys')
        return input.map((item, index) =>
          this.#selectKey(options, item, childPath(path, index), label)
        )
      case 'richText':
        return this.richText(field, input, path)
      case 'list':
        return this.list(field, input, path)
      case 'object':
      case 'metadata': {
        const type = fieldObjectType(field)
        if (!type) return input
        return this.typeData(type, input, path)
      }
      case 'link':
        return this.link(field, input, path)
      case 'localised': {
        const localisation = fieldLocalisation(field)
        if (!localisation) return input
        if (!isRecord(input))
          return expected(
            `an object keyed by locale (${localisation.locales.join(', ')})`
          )
        const result: Record<string, unknown> = {}
        for (const [locale, value] of entries(input)) {
          if (!localisation.locales.includes(locale))
            this.fail(
              childPath(path, locale),
              `unknown locale, expected one of: ${localisation.locales.join(', ')}`
            )
          result[locale] = this.value(
            localisation.inner,
            value,
            childPath(path, locale)
          )
        }
        return result
      }
      case 'mediaAlt':
        if (typeof input === 'string') return input
        if (
          isRecord(input) &&
          Object.values(input).every(v => typeof v === 'string')
        )
          return input
        return expected('a string or an object of strings keyed by locale')
      default:
        return input
    }
  }

  #selectKey(
    options: Record<string, unknown>,
    input: unknown,
    path: string,
    label: string
  ): string {
    const items = isRecord(options.options)
      ? (options.options as Record<string, string>)
      : {}
    if (typeof input === 'string') {
      if (input in items) return input
      // Accept the label of an option as well
      const byLabel = entries(items).find(
        ([, itemLabel]) => itemLabel === input
      )
      if (byLabel) return byLabel[0]
    }
    return this.fail(
      path,
      `expected one of the option keys of "${label}": ${keys(items)
        .map(key => JSON.stringify(key))
        .join(', ')}, got ${describe(input)}`
    )
  }

  richText(field: Field, input: unknown, path: string): TextDoc {
    const blocks = fieldBlocks(field)
    let doc: unknown = input
    if (input === null) return []
    if (typeof input === 'string') {
      doc = markdownToTextDoc(input, {
        link: href => linkMarkFromHref(href),
        image: (src, alt, title) => imageFromSrc(src, alt, title),
        codeBlock: (code, language) => {
          const codeBlock = codeBlockType(blocks)
          if (!codeBlock) return codeParagraph(code)
          const [key, type] = codeBlock
          const node: Record<string, unknown> = {
            _id: createId(),
            _type: key,
            code
          }
          if (language && Type.field(type, 'language')) node.language = language
          return node as unknown as Node
        }
      })
    }
    if (!Array.isArray(doc))
      this.fail(
        path,
        `expected a Markdown string or a TextDoc array for rich text field "${String(fieldOptions(field).label)}", got ${describe(input)}`
      )
    return this.#nodes(blocks, doc, path)
  }

  #nodes(blocks: Record<string, Type>, nodes: Array<unknown>, path: string) {
    return nodes.map((node, index) =>
      this.#node(blocks, node, childPath(path, index))
    )
  }

  #node(blocks: Record<string, Type>, input: unknown, path: string): Node {
    if (!isRecord(input) || typeof input._type !== 'string' || !input._type)
      this.fail(
        path,
        `expected a rich text node with a "_type", got ${describe(input)}`
      )
    const type = input._type
    const isBlock = type[0] === type[0].toUpperCase()
    if (isBlock) {
      const blockType = blocks[type]
      if (!blockType)
        this.fail(
          path,
          keys(blocks).length
            ? `unknown block "${type}", this field accepts: ${keys(blocks).join(', ')}`
            : `unknown block "${type}", this field has no blocks`
        )
      const data = this.typeData(
        blockType,
        input,
        path,
        new Set(['_id', '_type'])
      )
      return {
        _id: typeof input._id === 'string' ? input._id : createId(),
        _type: type,
        ...data
      } as Node
    }
    const node: Record<string, unknown> = {...input}
    if (
      type === 'text' &&
      node.text !== undefined &&
      typeof node.text !== 'string'
    )
      this.fail(
        path,
        `text nodes need a string "text", got ${describe(node.text)}`
      )
    if (node.content !== undefined) {
      if (!Array.isArray(node.content))
        this.fail(childPath(path, 'content'), `expected an array of nodes`)
      node.content = this.#nodes(
        blocks,
        node.content,
        childPath(path, 'content')
      )
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks))
        this.fail(childPath(path, 'marks'), `expected an array of marks`)
      node.marks = node.marks.map((mark, index) =>
        this.#mark(mark, childPath(childPath(path, 'marks'), index))
      )
    }
    if (type === 'image' && typeof node._entry === 'string') {
      node._id ??= createId()
      node._link = 'image'
      this.references.push({id: node._entry, path, linkType: 'image'})
    }
    return node as unknown as Node
  }

  #mark(input: unknown, path: string): Mark {
    if (!isRecord(input) || typeof input._type !== 'string')
      this.fail(path, `expected a mark with a "_type", got ${describe(input)}`)
    const mark = {...input} as Mark
    if (mark._type !== 'link') return mark
    mark._id ??= createId()
    if (typeof mark._entry === 'string') {
      const linkType = mark._link === 'file' ? 'file' : 'entry'
      mark._link = linkType
      this.references.push({id: mark._entry, path, linkType})
    }
    return mark
  }

  list(
    field: Field,
    input: unknown,
    path: string
  ): Array<Record<string, unknown>> {
    if (input === null) return []
    const blocks = fieldBlocks(field)
    const blockKeys = keys(blocks)
    if (!Array.isArray(input))
      this.fail(
        path,
        `expected an array of rows for list field "${String(fieldOptions(field).label)}", got ${describe(input)}`
      )
    const rows = input.map((row, index) => {
      const rowPath = childPath(path, index)
      if (!isRecord(row))
        this.fail(rowPath, `expected a row object, got ${describe(row)}`)
      const type =
        typeof row._type === 'string'
          ? row._type
          : blockKeys.length === 1
            ? blockKeys[0]
            : this.fail(
                rowPath,
                `rows need a "_type", one of: ${blockKeys.join(', ')}`
              )
      const blockType = blocks[type]
      if (!blockType)
        this.fail(
          rowPath,
          `unknown row type "${type}", expected one of: ${blockKeys.join(', ')}`
        )
      const data = this.typeData(blockType, row, rowPath, listRowMeta)
      const result: Record<string, unknown> = {
        _id: typeof row._id === 'string' && row._id ? row._id : createId(),
        _index: row._index,
        _type: type,
        ...data
      }
      if (typeof row._anchor === 'string') result._anchor = row._anchor
      if (typeof row._label === 'string') result._label = row._label
      return result
    })
    return withIndexes(rows)
  }

  link(field: Field, input: unknown, path: string): unknown {
    const multiple = isMultipleLink(field)
    if (!multiple) {
      if (input === null) return null
      return this.#reference(field, input, path)
    }
    if (input === null) return []
    if (!Array.isArray(input))
      this.fail(
        path,
        `expected an array of links for "${String(fieldOptions(field).label)}", got ${describe(input)}`
      )
    const rows = input.map((item, index) => ({
      _index: isRecord(item) ? item._index : undefined,
      ...this.#reference(field, item, childPath(path, index))
    }))
    return withIndexes(rows)
  }

  #reference(
    field: Field,
    input: unknown,
    path: string
  ): Record<string, unknown> {
    const pickers = linkPickers(field)
    const types = keys(pickers)
    const entryType = (['entry', 'image', 'file'] as const).find(
      type => type in pickers
    )
    const accepts = [
      entryType && 'an entry id string or {"id": "..."}',
      'url' in pickers && 'a url string or {"url": "...", "title": "..."}'
    ]
      .filter(Boolean)
      .join(' or ')
    const fail = (): never =>
      this.fail(
        path,
        `expected ${accepts} (link types: ${types.join(', ')}), got ${describe(input)}`
      )
    const extraFields = (type: string, data: Record<string, unknown>) => {
      const fieldsType = pickers[type]?.fields
      if (!fieldsType) {
        const extra = keys(data)
        if (extra.length)
          this.fail(childPath(path, extra[0]), `unknown link property`)
        return {}
      }
      return this.typeData(fieldsType, data, path)
    }
    const entryReference = (
      id: string,
      type: 'entry' | 'image' | 'file',
      rest: Record<string, unknown>,
      rowId?: unknown
    ) => {
      this.references.push({id, path, linkType: type})
      const {fields, ...others} = rest
      return {
        _id: typeof rowId === 'string' && rowId ? rowId : createId(),
        _type: type,
        _entry: id,
        ...extraFields(type, {...(isRecord(fields) ? fields : {}), ...others})
      }
    }
    const urlReference = (
      url: string,
      title: string,
      target: string,
      rest: Record<string, unknown>,
      rowId?: unknown
    ) => {
      const {fields, ...others} = rest
      return {
        _id: typeof rowId === 'string' && rowId ? rowId : createId(),
        _type: 'url',
        _url: url,
        _title: title,
        _target: target,
        ...extraFields('url', {...(isRecord(fields) ? fields : {}), ...others})
      }
    }
    if (typeof input === 'string') {
      if ('url' in pickers && (!entryType || urlPattern.test(input)))
        return urlReference(input, '', '_blank', {})
      if (!entryType) return fail()
      return entryReference(input, entryType, {})
    }
    if (!isRecord(input)) return fail()
    // The stored shape, eg. copied from get_entry
    const {_id, _type, _index, _entry, _url, _title, _target, ...stored} = input
    if (typeof _type === 'string') {
      if (!(_type in pickers))
        this.fail(
          path,
          `link type "${_type}" is not allowed, expected: ${types.join(', ')}`
        )
      if (_type === 'url') {
        if (typeof _url !== 'string') return fail()
        return urlReference(
          _url,
          typeof _title === 'string' ? _title : '',
          typeof _target === 'string' ? _target : '_blank',
          stored,
          _id
        )
      }
      if (typeof _entry !== 'string') return fail()
      return entryReference(
        _entry,
        _type as 'entry' | 'image' | 'file',
        stored,
        _id
      )
    }
    const {id, entry, url, title, target, type, ...rest} = stored
    const entryId =
      typeof id === 'string'
        ? id
        : typeof entry === 'string'
          ? entry
          : undefined
    if (entryId) {
      const linkType =
        typeof type === 'string' && type in pickers && type !== 'url'
          ? (type as 'entry' | 'image' | 'file')
          : entryType
      if (!linkType) return fail()
      return entryReference(entryId, linkType, rest, _id)
    }
    if (typeof url === 'string' && 'url' in pickers)
      return urlReference(
        url,
        typeof title === 'string' ? title : '',
        typeof target === 'string' ? target : '_blank',
        rest,
        _id
      )
    return fail()
  }
}

/** Keep valid row order keys, or number all rows in their given order */
function withIndexes<Row extends {_index?: unknown}>(rows: Array<Row>) {
  const valid = rows.every(
    row => typeof row._index === 'string' && isValidOrderKey(row._index)
  )
  const sorted =
    valid &&
    rows.every(
      (row, index) =>
        index === 0 || String(rows[index - 1]._index) < String(row._index)
    )
  if (valid && sorted) return rows
  const indexes = generateNKeysBetween(null, null, rows.length)
  return rows.map((row, index) => ({...row, _index: indexes[index]}))
}

function linkMarkFromHref(href: string): Mark {
  const entry = /^entry:([^#?]+)(?:#(.+))?$/.exec(href)
  if (entry) {
    const mark: Mark = {
      _type: 'link',
      _id: createId(),
      _link: 'entry',
      _entry: entry[1]
    }
    if (entry[2]) mark._anchor = entry[2]
    return mark
  }
  return {_type: 'link', _id: createId(), _link: 'url', href}
}

function imageFromSrc(
  src: string,
  alt: string,
  title: string | undefined
): Node {
  const entry = /^entry:(.+)$/.exec(src)
  const node: Record<string, unknown> = entry
    ? {_type: 'image', _id: createId(), _link: 'image', _entry: entry[1]}
    : {_type: 'image', src}
  if (alt) node.alt = alt
  if (title) node.title = title
  return node as unknown as Node
}

function codeParagraph(code: string): Node {
  const content: TextDoc = []
  code.split('\n').forEach((line, index) => {
    if (index > 0) content.push({_type: 'hardBreak'})
    if (line) content.push({_type: 'text', text: line})
  })
  return {_type: 'paragraph', content}
}

/** The block type which looks like a code block: it has a `code` field */
function codeBlockType(
  blocks: Record<string, Type>
): [string, Type] | undefined {
  return entries(blocks).find(([, type]) => {
    const code = Type.field(type, 'code')
    if (!code) return false
    const kind = fieldKind(code)
    return kind === 'code' || kind === 'text'
  })
}

/** Merge a partial update into the current value of a field */
export function mergeValue(
  field: Field,
  current: unknown,
  next: unknown
): unknown {
  const kind = fieldKind(field)
  if (!isRecord(current) || !isRecord(next)) return next
  if (kind === 'object' || kind === 'metadata') {
    const type = fieldObjectType(field)
    if (!type) return next
    return mergeTypeData(type, current, next)
  }
  if (kind === 'localised') {
    const localisation = fieldLocalisation(field)
    if (!localisation) return next
    const result: Record<string, unknown> = {...current}
    for (const [locale, value] of entries(next))
      result[locale] = mergeValue(localisation.inner, current[locale], value)
    return result
  }
  return next
}

export function mergeTypeData(
  type: Type,
  current: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {...current}
  for (const [key, value] of entries(next)) {
    const field = Type.field(type, key)
    result[key] = field ? mergeValue(field, current[key], value) : value
  }
  return result
}
