import type {Schema} from '../Schema.js'
import {Node} from '../TextDoc.js'
import {Type} from '../Type.js'
import {entries, fromEntries, isRecord, keys} from '../util/Objects.js'
import {slugify} from '../util/Slugs.js'
import {stableId} from '../util/StableId.js'
import {typedToYaml} from '../util/TypedYaml.js'
import {fromMarkdown, isMarkdownInline, toMarkdown} from './InlineMarkdown.js'

// Rich text is written as a sequence of one-key maps: `- p: inline markdown`,
// `- h2: …`, `- ul: [items]`, `- Block: {fields}`. Strings in a sequence are
// runs of inline content. Elements that do not fit their short form use a map
// (`- p: {align: center, text: …}`) or, for unknown types and attributes that
// clash with the short form, `- elementType: {…attributes, content: […]}`.

const tags = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'ul',
  'ol',
  'li',
  'blockquote',
  'img',
  'table',
  'tr',
  'th',
  'td'
])

const cellDefaults = {colspan: 1, rowspan: 1, colwidth: null}
const defaults = new Map<unknown, Record<string, unknown>>([
  ['paragraph', {textAlign: 'left'}],
  ['heading', {textAlign: 'left'}],
  ['orderedList', {start: 1}],
  ['tableCell', cellDefaults],
  ['tableHeader', cellDefaults]
])

export function richTextToYaml(
  schema: Schema | undefined,
  value: unknown
): unknown {
  return Array.isArray(value) ? encodeNodes(schema, value) : value
}

export function richTextFromYaml(
  schema: Schema | undefined,
  value: unknown,
  path: Array<string>
): unknown {
  return Array.isArray(value) ? decodeNodes(schema, value, path) : value
}

function encodeNodes(
  schema: Schema | undefined,
  nodes: Array<unknown>
): Array<unknown> {
  const result: Array<unknown> = []
  let inline: Array<unknown> = []
  const flush = () => {
    const markdown = toMarkdown(inline)
    if (markdown) result.push(markdown)
    inline = []
  }
  for (const node of nodes) {
    if (isMarkdownInline(node)) {
      inline.push(node)
      continue
    }
    flush()
    result.push(encodeNode(schema, node))
  }
  flush()
  return result
}

function encodeNode(schema: Schema | undefined, node: unknown): unknown {
  if (!isRecord(node) || typeof node._type !== 'string') return node
  if (Node.isBlock(node)) {
    const {_type, _id, ...fields} = node
    const type = schema?.[_type]
    return typedToYaml(_type, type ? Type.toYaml(type, fields) : fields)
  }
  const element = withoutDefaults(node)
  const encoded = encodeElement(schema, element)
  if (encoded !== undefined) return encoded
  // The generic form would read back as a tag, keep the node as is
  if (tags.has(node._type)) return node
  const {_type, content, ...attributes} = element
  return orNull(_type as string, {
    ...attributes,
    ...(content === undefined
      ? {}
      : {
          content: Array.isArray(content)
            ? encodeNodes(schema, content)
            : content
        })
  })
}

// Short and map forms of known elements, undefined if they do not fit
function encodeElement(
  schema: Schema | undefined,
  node: Record<string, unknown>
): unknown {
  const {_type, content, ...attributes} = node
  if (content !== undefined && !Array.isArray(content)) return
  switch (_type) {
    case 'paragraph':
      return encodeText(schema, 'p', content, attributes)
    case 'heading': {
      const {level, _anchor, ...rest} = attributes
      if (typeof level !== 'number' || !/^[1-6]$/.test(String(level))) return
      const text = textOf(content)
      const slug = slugify(text)
      const anchor = _anchor === undefined ? slug : _anchor
      const implied = _anchor === undefined || _anchor === (slug || undefined)
      return encodeText(
        schema,
        `h${level}`,
        content?.map(child => withoutAnchor(child, anchor)),
        rest,
        implied ? {} : {anchor: _anchor}
      )
    }
    case 'horizontalRule':
      if (content !== undefined) return
      return orNull('hr', attributes)
    case 'bulletList':
    case 'orderedList':
      return encodeSequence(
        _type === 'bulletList' ? 'ul' : 'ol',
        'items',
        content?.map(item => encodeListItem(schema, item)),
        attributes
      )
    case 'table':
      return encodeSequence(
        'table',
        'content',
        content?.map(row => encodeTableRow(schema, row)),
        attributes
      )
    case 'tableRow':
      return encodeSequence(
        'tr',
        'content',
        content && encodeNodes(schema, content),
        attributes
      )
    case 'listItem':
      return encodeContainer(
        schema,
        'li',
        content && wrapInline(content),
        attributes
      )
    case 'blockquote':
      return encodeContainer(schema, 'blockquote', content, attributes)
    case 'tableHeader':
      return encodeContainer(schema, 'th', content, attributes)
    case 'tableCell':
      return encodeContainer(schema, 'td', content, attributes)
    case 'image': {
      if (content !== undefined || 'entry' in attributes) return
      const {_id, _entry, _link, ...rest} = attributes
      if (typeof _entry === 'string' && _link === 'image')
        return orNull('img', {entry: _entry, ...rest})
      return orNull('img', {
        ...(_entry === undefined ? {} : {_entry}),
        ...(_link === undefined ? {} : {_link}),
        ...rest
      })
    }
  }
}

function encodeText(
  schema: Schema | undefined,
  tag: string,
  content: Array<unknown> | undefined,
  attributes: Record<string, unknown>,
  extra: Record<string, unknown> = {}
): unknown {
  const {textAlign, ...rest} = attributes
  if ('align' in rest || 'anchor' in rest || 'text' in rest) return
  const map = {
    ...(textAlign === undefined ? {} : {align: textAlign}),
    ...extra,
    ...rest
  }
  const inline = !content || content.every(isMarkdownInline)
  const text = inline
    ? toMarkdown(content ?? [], {sentences: tag === 'p'})
    : undefined
  if (keys(map).length === 0 && text !== undefined) return {[tag]: text || null}
  if (text) return {[tag]: {...map, text}}
  if (content && !inline)
    return {[tag]: {...map, content: encodeNodes(schema, content)}}
  return orNull(tag, map)
}

function encodeSequence(
  tag: string,
  key: string,
  items: Array<unknown> | undefined,
  attributes: Record<string, unknown>
): unknown {
  if (key in attributes) return
  if (keys(attributes).length === 0) return {[tag]: items ?? null}
  return {[tag]: {...attributes, ...(items ? {[key]: items} : {})}}
}

function encodeContainer(
  schema: Schema | undefined,
  tag: string,
  content: Array<unknown> | undefined,
  attributes: Record<string, unknown>
): unknown {
  const value = content && encodeContent(schema, content)
  if (keys(attributes).length === 0) return {[tag]: value ?? null}
  return {
    [tag]: {...attributes, ...(value === undefined ? {} : {content: value})}
  }
}

// A single plain paragraph is written as a string
function encodeContent(
  schema: Schema | undefined,
  content: Array<unknown>
): unknown {
  const text =
    content.length === 1 ? plainParagraph(content[0], true) : undefined
  return text ?? encodeNodes(schema, content)
}

function encodeListItem(schema: Schema | undefined, node: unknown): unknown {
  if (isPlain(node, 'listItem') && Array.isArray(node.content))
    return encodeContent(schema, wrapInline(node.content))
  if (isPlain(node, 'listItem') && node.content === undefined) return null
  return encodeNode(schema, node)
}

// List items hold paragraphs, the editor wraps inline content in them on the
// first edit, so we do too
function wrapInline(content: Array<unknown>): Array<unknown> {
  const result: Array<unknown> = []
  let run: Array<unknown> | undefined
  for (const node of content) {
    const type = isRecord(node) ? node._type : undefined
    if (type !== 'text' && type !== 'hardBreak') {
      run = undefined
      result.push(node)
    } else if (run) {
      run.push(node)
    } else {
      run = [node]
      result.push({_type: 'paragraph', content: run})
    }
  }
  return result
}

function encodeTableRow(schema: Schema | undefined, row: unknown): unknown {
  if (!isPlain(row, 'tableRow') || !Array.isArray(row.content))
    return encodeNode(schema, row)
  const cells = row.content
  const cellType = isRecord(cells[0]) ? cells[0]._type : undefined
  const tag = cellType === 'tableHeader' ? 'th' : 'td'
  const texts = cells.map(cell =>
    isPlain(cell, cellType) &&
    Array.isArray(cell.content) &&
    cell.content.length === 1
      ? plainParagraph(cell.content[0])
      : undefined
  )
  const isShort =
    (cellType === 'tableHeader' || cellType === 'tableCell') &&
    texts.every(text => text !== undefined)
  return isShort ? {[tag]: texts} : encodeNode(schema, row)
}

function plainParagraph(node: unknown, sentences = false): string | undefined {
  if (!isPlain(node, 'paragraph')) return
  const content = node.content
  if (content === undefined) return ''
  if (!Array.isArray(content) || !content.every(isMarkdownInline)) return
  return toMarkdown(content, {sentences})
}

// A node of the given type with no attributes besides defaults
function isPlain(
  node: unknown,
  type: unknown
): node is Record<string, unknown> {
  if (!isRecord(node) || node._type !== type) return false
  return keys(withoutDefaults(node)).every(
    key => key === '_type' || key === 'content'
  )
}

function withoutDefaults(
  node: Record<string, unknown>
): Record<string, unknown> {
  const values = defaults.get(node._type)
  if (!values) return node
  return fromEntries(
    entries(node).filter(
      ([key, value]) => !(Object.hasOwn(values, key) && values[key] === value)
    )
  )
}

// Heading anchors are stored on the heading, drop anchor marks repeating it
function withoutAnchor(node: unknown, anchor: unknown): unknown {
  if (!isRecord(node) || !Array.isArray(node.marks)) return node
  const marks = node.marks.filter(
    mark => !(isRecord(mark) && mark._type === 'anchor' && mark.id === anchor)
  )
  if (marks.length === node.marks.length) return node
  const {marks: _, ...rest} = node
  return marks.length ? {...rest, marks} : rest
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map(node => {
      if (!isRecord(node)) return ''
      if (node._type === 'text')
        return typeof node.text === 'string' ? node.text : ''
      return textOf(node.content)
    })
    .join('')
}

function orNull(
  tag: string,
  value: Record<string, unknown>
): Record<string, unknown> {
  return {[tag]: keys(value).length ? value : null}
}

function decodeNodes(
  schema: Schema | undefined,
  items: Array<unknown>,
  path: Array<string>
): Array<unknown> {
  return items.flatMap((item, index) => {
    const itemPath = [...path, String(index)]
    const source = inlineSource(item)
    if (source !== undefined) return fromMarkdown(source, itemPath)
    return [decodeNode(schema, item, itemPath)]
  })
}

function decodeNode(
  schema: Schema | undefined,
  item: unknown,
  path: Array<string>
): unknown {
  if (!isRecord(item) || '_type' in item) return item
  const pairs = entries(item)
  if (pairs.length !== 1) return item
  const [[tag, value]] = pairs
  return decodeElement(schema, tag, value, path) ?? item
}

function decodeElement(
  schema: Schema | undefined,
  tag: string,
  value: unknown,
  path: Array<string>
): unknown {
  const heading = /^h([1-6])$/.exec(tag)
  if (heading) {
    const level = Number(heading[1])
    if (isRecord(value) && 'anchor' in value) {
      const {anchor, ...rest} = value
      const node = decodeText(schema, 'heading', rest, path, {level})
      return node && {...node, _anchor: anchor}
    }
    const node = decodeText(schema, 'heading', value, path, {level})
    const slug = node && slugify(textOf(node.content))
    return slug ? {...node, _anchor: slug} : node
  }
  switch (tag) {
    case 'p':
      return decodeText(schema, 'paragraph', value, path)
    case 'hr':
      return decodeMap('horizontalRule', value)
    case 'ul':
    case 'ol':
      return decodeSequence(
        tag === 'ul' ? 'bulletList' : 'orderedList',
        'items',
        value,
        items =>
          items.map((item, index) => {
            const itemPath = [...path, String(index)]
            if (item === null) return {_type: 'listItem'}
            const content = decodeContent(schema, item, itemPath)
            if (content) return {_type: 'listItem', content}
            return decodeNode(schema, item, itemPath)
          })
      )
    case 'table':
      return decodeSequence('table', 'content', value, rows =>
        rows.map((row, index) =>
          decodeTableRow(schema, row, [...path, String(index)])
        )
      )
    case 'tr':
      return decodeSequence('tableRow', 'content', value, cells =>
        decodeNodes(schema, cells, path)
      )
    case 'li':
      return decodeContainer(schema, 'listItem', value, path)
    case 'blockquote':
      return decodeContainer(schema, 'blockquote', value, path)
    case 'th':
      return decodeContainer(schema, 'tableHeader', value, path)
    case 'td':
      return decodeContainer(schema, 'tableCell', value, path)
    case 'img': {
      const node = decodeMap('image', value)
      if (!node || node.entry === undefined) return node
      const {entry, ...rest} = node
      return {...rest, _id: stableId(path), _link: 'image', _entry: entry}
    }
  }
  if (Node.isBlock({_type: tag})) {
    if (value !== null && !isRecord(value)) return
    const fields = value ?? {}
    const type = schema?.[tag]
    return {
      _type: tag,
      _id: stableId(path),
      ...(type ? Type.fromYaml(type, fields, path) : fields)
    }
  }
  const node = decodeMap(tag, value)
  if (!node || !Array.isArray(node.content)) return node
  return {...node, content: decodeNodes(schema, node.content, path)}
}

function decodeText(
  schema: Schema | undefined,
  type: string,
  value: unknown,
  path: Array<string>,
  extra: Record<string, unknown> = {}
): Record<string, unknown> | undefined {
  const source = inlineSource(value)
  if (value !== null && source === undefined && !isRecord(value)) return
  const {align, text, content, ...rest} = isRecord(value) ? value : {}
  const node: Record<string, unknown> = {
    _type: type,
    ...extra,
    ...(align === undefined ? {} : {textAlign: align}),
    ...rest
  }
  const markdown = source ?? inlineSource(text)
  if (markdown !== undefined) {
    const nodes = fromMarkdown(markdown, path)
    if (nodes.length) node.content = nodes
  } else if (Array.isArray(content)) {
    node.content = decodeNodes(schema, content, path)
  } else if (content !== undefined) {
    node.content = content
  }
  return node
}

function decodeMap(
  type: string,
  value: unknown
): Record<string, unknown> | undefined {
  if (value === null) return {_type: type}
  if (isRecord(value)) return {_type: type, ...value}
}

function decodeSequence(
  type: string,
  key: string,
  value: unknown,
  decodeItems: (items: Array<unknown>) => Array<unknown>
): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return {_type: type, content: decodeItems(value)}
  const node = decodeMap(type, value)
  if (!node || !(key in node)) return node
  const {[key]: items, ...rest} = node
  return Array.isArray(items) ? {...rest, content: decodeItems(items)} : node
}

function decodeContainer(
  schema: Schema | undefined,
  type: string,
  value: unknown,
  path: Array<string>
): Record<string, unknown> | undefined {
  const content = decodeContent(schema, value, path)
  if (content) return {_type: type, content}
  const node = decodeMap(type, value)
  if (!node || node.content === undefined) return node
  const decoded = decodeContent(schema, node.content, path)
  return decoded ? {...node, content: decoded} : node
}

// Content of a container: a string is a single paragraph
function decodeContent(
  schema: Schema | undefined,
  value: unknown,
  path: Array<string>
): Array<unknown> | undefined {
  const source = inlineSource(value)
  if (source !== undefined) {
    const content = fromMarkdown(source, [...path, '0'])
    return [{_type: 'paragraph', ...(content.length ? {content} : {})}]
  }
  if (Array.isArray(value)) return decodeNodes(schema, value, path)
}

function decodeTableRow(
  schema: Schema | undefined,
  row: unknown,
  path: Array<string>
): unknown {
  if (isRecord(row) && keys(row).length === 1) {
    const [[tag, cells]] = entries(row)
    if ((tag === 'th' || tag === 'td') && Array.isArray(cells)) {
      const type = tag === 'th' ? 'tableHeader' : 'tableCell'
      return {
        _type: 'tableRow',
        content: cells.map((cell, index) => {
          const content = decodeContent(schema, cell, [...path, String(index)])
          return {_type: type, ...(content ? {content} : {})}
        })
      }
    }
  }
  return decodeNode(schema, row, path)
}

// Scalars read as inline markdown, YAML may have typed them as numbers
function inlineSource(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
}
