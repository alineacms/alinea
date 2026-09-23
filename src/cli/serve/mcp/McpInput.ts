import type {Field} from '#/core/Field.js'
import {createId} from '#/core/Id.js'
import {
  type CodeBlockAttributes,
  markdownToTextDoc
} from '#/core/text/MarkdownToTextDoc.js'
import type {Mark, Node, TextDoc} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
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

export interface EntryInputOptions {
  /** Locale of the entry being written, recorded on new entry links */
  locale?: string | null
}

type Row = Record<string, unknown>

const listRowMeta = new Set(['_id', '_index', '_type', '_anchor', '_label'])
const listOperations = new Set(['update', 'insert', 'remove', 'order'])
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

function rowId(row: unknown): string | undefined {
  return isRecord(row) && typeof row._id === 'string' && row._id
    ? row._id
    : undefined
}

/**
 * Converts the convenient input an agent sends into stored field values,
 * validating against the schema. Values merge into the current data: fields,
 * rows and links that are not mentioned keep their stored value exactly, so a
 * write only changes what was asked. Entry references are collected so they
 * can be checked against the content afterwards.
 */
export class EntryInput {
  references: Array<InputReference> = []
  #locale: string | null

  constructor(options: EntryInputOptions = {}) {
    this.#locale = options.locale ?? null
  }

  fail(path: string, message: string): never {
    throw new McpToolError(`${path || 'data'}: ${message}`)
  }

  /**
   * Convert the fields of a type, rejecting unknown keys. Given the current
   * value the result is the current value with the given fields replaced in
   * place, other keys keep their value and order.
   */
  typeData(
    type: Type,
    input: unknown,
    path: string,
    current?: Row,
    allowedMeta: Set<string> = new Set()
  ): Row {
    if (!isRecord(input))
      this.fail(path, `expected an object with fields, got ${describe(input)}`)
    const fields = Type.fields(type)
    const result: Row = {...current}
    for (const [key, value] of entries(input)) {
      if (allowedMeta.has(key)) continue
      const field = fields[key]
      if (!field)
        this.fail(
          childPath(path, key),
          `unknown field, "${String(Type.label(type))}" has fields: ${keys(fields).join(', ')}`
        )
      if (value === undefined) continue
      result[key] = this.value(
        field,
        value,
        childPath(path, key),
        current?.[key]
      )
    }
    return result
  }

  value(
    field: Field,
    input: unknown,
    path: string,
    current?: unknown
  ): unknown {
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
        return this.richText(field, input, path, current)
      case 'list':
        return this.list(field, input, path, current)
      case 'object':
      case 'metadata': {
        const type = fieldObjectType(field)
        if (!type) return input
        // A new object starts from its initial value, like in the dashboard
        const base = isRecord(current) ? current : Type.initialValue(type)
        return this.typeData(type, input, path, base)
      }
      case 'link':
        return this.link(field, input, path, current)
      case 'localised': {
        const localisation = fieldLocalisation(field)
        if (!localisation) return input
        if (!isRecord(input))
          return expected(
            `an object keyed by locale (${localisation.locales.join(', ')})`
          )
        const base = isRecord(current) ? current : {}
        const result: Row = {...base}
        for (const [locale, value] of entries(input)) {
          if (!localisation.locales.includes(locale))
            this.fail(
              childPath(path, locale),
              `unknown locale, expected one of: ${localisation.locales.join(', ')}`
            )
          result[locale] = this.value(
            localisation.inner,
            value,
            childPath(path, locale),
            base[locale]
          )
        }
        return result
      }
      case 'mediaAlt':
        if (input === null) return ''
        if (typeof input === 'string') return input
        if (
          isRecord(input) &&
          Object.values(input).every(v => typeof v === 'string')
        )
          return isRecord(current) ? {...current, ...input} : input
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

  richText(field: Field, input: unknown, path: string, current?: unknown) {
    const blocks = fieldBlocks(field)
    let doc: unknown = input
    if (input === null) return []
    if (typeof input === 'string') {
      doc = markdownToTextDoc(input, {
        link: href => linkMarkFromHref(href),
        image: (src, alt, title) => imageFromSrc(src, alt, title),
        codeBlock: (code, language, attributes) =>
          codeBlockNode(blocks, code, language, attributes)
      })
    }
    if (!Array.isArray(doc))
      this.fail(
        path,
        `expected a Markdown string or a TextDoc array for rich text field "${String(fieldOptions(field).label)}", got ${describe(input)}`
      )
    return reconcileDoc(
      this.#nodes(blocks, doc, path),
      current,
      typeof input === 'string'
    )
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
      const id = rowId(input)
      // New blocks start from their initial value, like in the dashboard
      const base: Row = id
        ? {_type: type, _id: id}
        : {_type: type, _id: createId(), ...Type.initialValue(blockType)}
      return this.typeData(
        blockType,
        input,
        path,
        base,
        new Set(['_id', '_type'])
      ) as unknown as Node
    }
    const node: Row = {...input}
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

  /**
   * A list takes an array of rows, which replaces the list, or an object of
   * operations applied to the current rows. Rows carrying the `_id` of a
   * current row are merged into that row.
   */
  list(field: Field, input: unknown, path: string, current?: unknown) {
    if (input === null) return []
    const blocks = fieldBlocks(field)
    const currentRows = Array.isArray(current) ? current.filter(isRecord) : []
    const byId = new Map(
      currentRows.flatMap(row => {
        const id = rowId(row)
        return id ? [[id, row] as const] : []
      })
    )
    if (Array.isArray(input))
      return input.map((row, index) => {
        const id = rowId(row)
        return this.#row(blocks, row, childPath(path, index), byId.get(id!))
      })
    if (!isRecord(input) || !keys(input).some(key => listOperations.has(key)))
      this.fail(
        path,
        `expected an array of rows or an object of operations ({update, insert, remove, order}) for list field "${String(fieldOptions(field).label)}", got ${describe(input)}`
      )
    return this.#listOperations(blocks, input, path, currentRows)
  }

  #listOperations(
    blocks: Record<string, Type>,
    input: Row,
    path: string,
    currentRows: Array<Row>
  ): Array<Row> {
    for (const key of keys(input))
      if (!listOperations.has(key))
        this.fail(
          childPath(path, key),
          `unknown list operation, expected: ${[...listOperations].join(', ')}`
        )
    let rows = [...currentRows]
    const available = () => rows.map(row => rowId(row)).join(', ')
    const indexOf = (id: unknown, at: string) => {
      const index =
        typeof id === 'string' ? rows.findIndex(row => rowId(row) === id) : -1
      if (index === -1)
        this.fail(
          at,
          `no row with _id ${JSON.stringify(id)}, current rows: ${available() || 'none'}`
        )
      return index
    }
    const list = (key: string): Array<unknown> => {
      const value = input[key]
      if (value === undefined) return []
      if (!Array.isArray(value))
        this.fail(childPath(path, key), `expected an array`)
      return value
    }
    list('remove').forEach((id, index) => {
      const at = indexOf(id, childPath(childPath(path, 'remove'), index))
      rows.splice(at, 1)
    })
    list('update').forEach((row, index) => {
      const rowPath = childPath(childPath(path, 'update'), index)
      if (!rowId(row))
        this.fail(rowPath, 'rows to update need the "_id" of an existing row')
      const at = indexOf(rowId(row), rowPath)
      rows[at] = this.#row(blocks, row, rowPath, rows[at])
    })
    list('insert').forEach((item, index) => {
      const itemPath = childPath(childPath(path, 'insert'), index)
      if (!isRecord(item) || !isRecord(item.row))
        this.fail(
          itemPath,
          'expected {"row": {...fields}, "after"?: "_id", "before"?: "_id"}'
        )
      for (const key of keys(item))
        if (key !== 'row' && key !== 'after' && key !== 'before')
          this.fail(childPath(itemPath, key), 'unknown insert property')
      if (item.after !== undefined && item.before !== undefined)
        this.fail(itemPath, 'pass either after or before')
      if (rowId(item.row) && rows.some(row => rowId(row) === rowId(item.row)))
        this.fail(
          childPath(itemPath, 'row._id'),
          'a row with this _id exists, use update'
        )
      const row = this.#row(blocks, item.row, childPath(itemPath, 'row'))
      const position =
        item.after !== undefined
          ? indexOf(item.after, childPath(itemPath, 'after')) + 1
          : item.before !== undefined
            ? indexOf(item.before, childPath(itemPath, 'before'))
            : rows.length
      rows.splice(position, 0, row)
    })
    if (input.order !== undefined) {
      const order = list('order')
      const orderPath = childPath(path, 'order')
      const ids = rows.map(row => rowId(row))
      const complete =
        order.length === ids.length &&
        new Set(order).size === order.length &&
        order.every(id => ids.includes(id as string))
      if (!complete)
        this.fail(
          orderPath,
          `expected every row _id exactly once: ${ids.join(', ')}`
        )
      rows = order.map(id => rows[ids.indexOf(id as string)])
    }
    return rows
  }

  #row(
    blocks: Record<string, Type>,
    row: unknown,
    path: string,
    existing?: Row
  ): Row {
    const blockKeys = keys(blocks)
    if (!isRecord(row))
      this.fail(path, `expected a row object, got ${describe(row)}`)
    const given = typeof row._type === 'string' ? row._type : undefined
    if (existing && given && given !== existing._type)
      this.fail(
        childPath(path, '_type'),
        `row "${rowId(existing)}" is a ${String(existing._type)}, remove it and insert a new row to change its type`
      )
    const type =
      given ??
      (existing && typeof existing._type === 'string'
        ? existing._type
        : blockKeys.length === 1
          ? blockKeys[0]
          : this.fail(
              path,
              `rows need a "_type", one of: ${blockKeys.join(', ')}`
            ))
    const blockType = blocks[type]
    if (!blockType)
      this.fail(
        path,
        `unknown row type "${type}", expected one of: ${blockKeys.join(', ')}`
      )
    // New rows are shaped like the dashboard creates them
    const base: Row = existing ?? {
      _id: rowId(row) ?? createId(),
      _index: '',
      _type: type,
      ...Type.initialValue(blockType)
    }
    const result = this.typeData(blockType, row, path, base, listRowMeta)
    if (typeof row._anchor === 'string') result._anchor = row._anchor
    if (typeof row._label === 'string') result._label = row._label
    return result
  }

  link(field: Field, input: unknown, path: string, current?: unknown) {
    const multiple = isMultipleLink(field)
    if (!multiple) {
      if (input === null) return null
      return this.#reference(
        field,
        input,
        path,
        isRecord(current) ? [current] : []
      )
    }
    if (input === null) return []
    if (!Array.isArray(input))
      this.fail(
        path,
        `expected an array of links for "${String(fieldOptions(field).label)}", got ${describe(input)}`
      )
    const unused = Array.isArray(current) ? current.filter(isRecord) : []
    return input.map((item, index) => {
      const result = this.#reference(
        field,
        item,
        childPath(path, index),
        unused
      )
      const used = unused.indexOf(result)
      if (used === -1) {
        const same = unused.findIndex(row => row._id === result._id)
        if (same !== -1) unused.splice(same, 1)
      } else unused.splice(used, 1)
      return result
    })
  }

  /**
   * Convert a link. A link to the same target as one of the candidates (the
   * current value) keeps that stored link and only changes given fields.
   */
  #reference(
    field: Field,
    input: unknown,
    path: string,
    candidates: Array<Row>
  ): Row {
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
    const extraFields = (type: string, data: Row, base: Row) => {
      const fieldsType = pickers[type]?.fields
      if (!fieldsType) {
        const extra = keys(data)
        if (extra.length)
          this.fail(childPath(path, extra[0]), `unknown link property`)
        return base
      }
      return this.typeData(fieldsType, data, path, base)
    }
    const initialFields = (type: string): Row => {
      const fieldsType = pickers[type]?.fields
      return fieldsType ? Type.initialValue(fieldsType) : {}
    }
    const entryReference = (
      id: string,
      type: 'entry' | 'image' | 'file',
      rest: Row,
      givenId?: string
    ) => {
      this.references.push({id, path, linkType: type})
      const {fields, ...others} = rest
      const extra = {...(isRecord(fields) ? fields : {}), ...others}
      const existing = candidates.find(
        row =>
          (!givenId || row._id === givenId) &&
          row._type === type &&
          row._entry === id
      )
      // Shaped like the dashboard's entry picker creates links
      const base: Row = existing ?? {
        ...initialFields(type),
        _id: givenId ?? createId(),
        _type: type,
        _index: '',
        _entry: id,
        ...(type === 'entry' && this.#locale ? {_locale: this.#locale} : {})
      }
      return extraFields(type, extra, base)
    }
    const urlReference = (
      url: string,
      title: string | undefined,
      target: string | undefined,
      rest: Row,
      givenId?: string
    ) => {
      const {fields, ...others} = rest
      const extra = {...(isRecord(fields) ? fields : {}), ...others}
      const existing = candidates.find(
        row =>
          (!givenId || row._id === givenId) &&
          row._type === 'url' &&
          row._url === url
      )
      const base: Row = existing
        ? {
            ...existing,
            ...(title !== undefined ? {_title: title} : {}),
            ...(target !== undefined ? {_target: target} : {})
          }
        : {
            ...initialFields('url'),
            _id: givenId ?? createId(),
            _type: 'url',
            _index: '',
            _url: url,
            _title: title ?? '',
            _target: target ?? '_blank'
          }
      return extraFields('url', extra, base)
    }
    if (typeof input === 'string') {
      if ('url' in pickers && (!entryType || urlPattern.test(input)))
        return urlReference(input, undefined, undefined, {})
      if (!entryType) return fail()
      return entryReference(input, entryType, {})
    }
    if (!isRecord(input)) return fail()
    // The stored shape, eg. copied from get_entry
    const {
      _id,
      _type,
      _index,
      _entry,
      _url,
      _title,
      _target,
      _locale,
      ...stored
    } = input
    const givenId = typeof _id === 'string' && _id ? _id : undefined
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
          typeof _title === 'string' ? _title : undefined,
          typeof _target === 'string' ? _target : undefined,
          stored,
          givenId
        )
      }
      if (typeof _entry !== 'string') return fail()
      return entryReference(
        _entry,
        _type as 'entry' | 'image' | 'file',
        stored,
        givenId
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
      return entryReference(entryId, linkType, rest, givenId)
    }
    if (typeof url === 'string' && 'url' in pickers)
      return urlReference(
        url,
        typeof title === 'string' ? title : undefined,
        typeof target === 'string' ? target : undefined,
        rest,
        givenId
      )
    return fail()
  }
}

/**
 * Move fields that were missing from the current data to their place in the
 * type's field order, where the dashboard's editor puts them.
 */
export function placeNewFields(type: Type, current: Row, merged: Row): Row {
  const added = keys(merged).filter(key => !(key in current))
  if (added.length === 0) return merged
  const order = keys(Type.fields(type))
  const result: Row = {}
  const pending = new Set(added)
  const flush = (until: number) => {
    for (const key of pending)
      if (order.indexOf(key) !== -1 && order.indexOf(key) < until) {
        result[key] = merged[key]
        pending.delete(key)
      }
  }
  for (const key of keys(merged)) {
    if (pending.has(key)) continue
    const position = order.indexOf(key)
    if (position !== -1) flush(position)
    result[key] = merged[key]
  }
  for (const key of pending) result[key] = merged[key]
  return result
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
  const node: Row = entry
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
export function codeBlockType(
  blocks: Record<string, Type>
): [string, Type] | undefined {
  return entries(blocks).find(([, type]) => {
    const code = Type.field(type, 'code')
    if (!code) return false
    const kind = fieldKind(code)
    return kind === 'code' || kind === 'text'
  })
}

/**
 * The block for a fenced code block. The info string holds the language
 * followed by the block id and other fields: ```ts id=abc fileName=app.ts
 */
export function codeBlockNode(
  blocks: Record<string, Type>,
  code: string,
  language: string | undefined,
  attributes: CodeBlockAttributes = {}
): Node {
  const codeBlock = codeBlockType(blocks)
  if (!codeBlock) return codeParagraph(code)
  const [key, type] = codeBlock
  const {id, ...fields} = attributes
  const node: Row = {
    _type: key,
    _id: typeof id === 'string' && id ? id : createId(),
    ...Type.initialValue(type),
    code
  }
  if (language && Type.field(type, 'language')) node.language = language
  for (const [name, value] of entries(fields)) {
    const field = Type.field(type, name)
    if (!field || name === 'code' || name === 'language') continue
    switch (fieldKind(field)) {
      case 'check':
        node[name] = value === true || value === 'true'
        break
      case 'number': {
        const number = Number(value)
        if (Number.isFinite(number)) node[name] = number
        break
      }
      case 'text':
      case 'code':
      case 'path':
      case 'select':
        if (typeof value === 'string') node[name] = value
        break
    }
  }
  return node as unknown as Node
}

const attributeValue = /^[^\s"`]*$/

/**
 * Render a code block as a fence, only when converting it back results in
 * exactly the same block.
 */
export function codeBlockMarkdown(
  blocks: Record<string, Type>,
  node: Row
): string | undefined {
  const codeBlock = codeBlockType(blocks)
  if (!codeBlock || codeBlock[0] !== node._type) return
  const [, type] = codeBlock
  const {_type, _id, code, language, ...rest} = node
  if (typeof code !== 'string' || typeof _id !== 'string') return
  const info: Array<string> = []
  if (language !== undefined && language !== '') {
    if (typeof language !== 'string' || !/^[^\s="`]+$/.test(language)) return
    info.push(language)
  }
  if (!attributeValue.test(_id)) return
  info.push(`id=${_id}`)
  const initial = Type.initialValue(type)
  for (const [name, value] of entries(rest)) {
    if (value === initial[name]) continue
    if (value === true) info.push(name)
    else if (typeof value === 'number' || value === false)
      info.push(`${name}=${value}`)
    else if (typeof value === 'string' && attributeValue.test(value))
      info.push(`${name}=${value}`)
    else if (typeof value === 'string' && !/["\n`]/.test(value))
      info.push(`${name}="${value}"`)
    else return
  }
  const longest = Math.max(
    0,
    ...(code.match(/`+/g) ?? []).map(run => run.length)
  )
  const fence = '`'.repeat(Math.max(3, longest + 1))
  const markdown = `${fence}${info.join(' ')}\n${code}\n${fence}`
  const [parsed] = markdownToTextDoc(markdown, {
    codeBlock: (code, language, attributes) =>
      codeBlockNode(blocks, code, language, attributes)
  })
  // Key order aside: converting back keeps the order of the stored block
  return canonical(parsed) === canonical(node) ? markdown : undefined
}

/** JSON with sorted keys, to compare values regardless of key order */
function canonical(value: unknown): string {
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort)
    if (!isRecord(value)) return value
    return Object.fromEntries(
      keys(value)
        .sort()
        .map(key => [key, sort(value[key])])
    )
  }
  return JSON.stringify(sort(value))
}

/** A changed block keeps the key order of its stored version */
function inStoredOrder(node: Row, stored: Row): Row {
  const result: Row = {}
  for (const key of keys(stored)) if (key in node) result[key] = node[key]
  for (const key of keys(node)) if (!(key in result)) result[key] = node[key]
  return result
}

function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds)
  if (!isRecord(value)) return value
  const result: Row = {}
  for (const [key, inner] of entries(value))
    if (key !== '_id') result[key] = withoutIds(inner)
  return result
}

function linkTarget(mark: Row): string {
  return JSON.stringify([mark._link, mark._entry, mark.href, mark._anchor])
}

function visitMarks(value: unknown, visit: (mark: Row) => void) {
  if (Array.isArray(value)) {
    for (const item of value) visitMarks(item, visit)
    return
  }
  if (!isRecord(value)) return
  if (Array.isArray(value.marks))
    for (const mark of value.marks)
      if (isRecord(mark) && mark._type === 'link') visit(mark)
  if (Array.isArray(value.content)) visitMarks(value.content, visit)
}

/** Node properties Markdown expresses, others are carried over on a change */
const markdownProperties = new Set([
  '_type',
  'content',
  'text',
  'marks',
  'level',
  'start',
  'src',
  'alt',
  'title'
])

/** Without the properties Markdown can not express, to compare nodes */
function markdownShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(markdownShape)
  if (!isRecord(value)) return value
  if (isBlockType(value._type)) return withoutIds(value)
  const result: Row = {}
  for (const [key, inner] of entries(value))
    if (markdownProperties.has(key)) result[key] = markdownShape(inner)
  return result
}

function isBlockType(type: unknown): boolean {
  return typeof type === 'string' && type[0] === type[0]?.toUpperCase()
}

/**
 * Keep the stored nodes of a rich text document that did not change, so
 * converting Markdown back does not generate new ids for them or drop
 * properties Markdown can not express (such as textAlign). A changed node
 * takes those properties, and its key order, from the stored node in its
 * place. Links in changed nodes keep the ids of links to the same target.
 */
function reconcileDoc(
  next: TextDoc,
  current: unknown,
  fromMarkdown: boolean
): TextDoc {
  if (!Array.isArray(current) || current.length === 0) return next
  const linkIds = new Map<string, Array<string>>()
  visitMarks(current, mark => {
    if (typeof mark._id !== 'string') return
    const key = linkTarget(mark)
    linkIds.set(key, [...(linkIds.get(key) ?? []), mark._id])
  })
  // Text nodes of one link share its id
  const assigned = new Map<unknown, string>()
  const reconciled = reconcileNodes(next, current, fromMarkdown)
  for (const node of reconciled.changed)
    visitMarks(node, mark => {
      const known = assigned.get(mark._id)
      if (known) {
        mark._id = known
        return
      }
      const reused = linkIds.get(linkTarget(mark))?.shift()
      if (!reused) return
      assigned.set(mark._id, reused)
      mark._id = reused
    })
  return reconciled.nodes
}

function reconcileNodes(
  next: TextDoc,
  current: Array<unknown>,
  fromMarkdown: boolean
): {nodes: TextDoc; changed: Array<Node>} {
  // Markdown can not express every property, given JSON can
  const shape = fromMarkdown ? markdownShape : withoutIds
  const stored = current.map(node => (isRecord(node) ? node : undefined))
  const used = stored.map(node => node === undefined)
  const exact = stored.map(node => JSON.stringify(node))
  const loose = stored.map(node => canonical(shape(node)))
  const changed: Array<Node> = []
  const find = (key: Array<string>, value: string) =>
    key.findIndex((candidate, index) => !used[index] && candidate === value)
  // Unchanged nodes first, they anchor the changed ones in between
  const matches = next.map(node => {
    let index = find(exact, JSON.stringify(node))
    if (index === -1) index = find(loose, canonical(shape(node)))
    if (index !== -1) used[index] = true
    return index
  })
  const nodes = next.map((node, at) => {
    if (matches[at] !== -1) return stored[matches[at]]! as unknown as Node
    const record = node as unknown as Row
    // A block keeps its place by id, other nodes pair with a stored node of
    // the same type between the unchanged nodes around them
    let pair = stored.findIndex(
      (candidate, index) =>
        !used[index] &&
        typeof record._id === 'string' &&
        candidate?._id === record._id &&
        candidate._type === record._type
    )
    if (pair === -1) {
      const before = matches.slice(0, at).filter(index => index !== -1)
      const after = matches.slice(at + 1).find(index => index !== -1)
      const from = Math.max(-1, ...before)
      const to = after ?? stored.length
      pair = stored.findIndex(
        (candidate, index) =>
          !used[index] &&
          index > from &&
          index < to &&
          candidate?._type === record._type
      )
    }
    if (pair === -1) {
      changed.push(node)
      return node
    }
    used[pair] = true
    matches[at] = pair
    const previous = stored[pair]!
    const merged: Row = {...record}
    if (fromMarkdown && !isBlockType(record._type))
      for (const [key, value] of entries(previous))
        if (!markdownProperties.has(key) && !(key in merged))
          merged[key] = value
    if (Array.isArray(record.content) && Array.isArray(previous.content)) {
      const inner = reconcileNodes(
        record.content as TextDoc,
        previous.content,
        fromMarkdown
      )
      merged.content = inner.nodes
      changed.push(...inner.changed)
    } else {
      changed.push(merged as unknown as Node)
    }
    return inStoredOrder(merged, previous) as unknown as Node
  })
  return {nodes, changed}
}
