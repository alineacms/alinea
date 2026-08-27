import {Parser} from 'htmlparser2'
import type {EntryReferenceTarget} from '../db/EntryReference.js'
import {referenceFieldPath} from '../db/EntryReference.js'
import {Entry} from '../Entry.js'
import {
  Field,
  type EntryAnchorTarget,
  type FieldMeta,
  type FieldOptions
} from '../Field.js'
import {createId} from '../Id.js'
import type {InferStoredValue} from '../Infer.js'
import {mediaAltText} from '../media/MediaAltField.js'
import {MediaFile} from '../media/MediaTypes.js'
import {Schema} from '../Schema.js'
import {
  type ImageNode,
  LinkMark,
  Mark,
  Node,
  type ElementNode,
  type TextDoc
} from '../TextDoc.js'
import {Type} from '../Type.js'
import {applyUrlSuffix, createUniqueAnchor} from '../util/Anchors.js'
import {entries} from '../util/Objects.js'
import {slugify} from '../util/Slugs.js'

export type RichTextMutator<R> = {
  insert: (id: string, block: string) => void
}

const linkInfoFields = {
  id: Entry.id,
  url: Entry.url,
  alt: MediaFile.alt
}

export class RichTextField<
  Blocks,
  Options extends FieldOptions<TextDoc<Blocks>> & {
    searchable?: boolean
  }
> extends Field<
  TextDoc<Blocks>,
  TextDoc<Blocks>,
  RichTextMutator<Blocks>,
  Options
> {
  constructor(
    schema: Schema | undefined,
    meta: FieldMeta<
      TextDoc<Blocks>,
      TextDoc<Blocks>,
      RichTextMutator<Blocks>,
      Options
    >
  ) {
    const customQueryValue = meta.queryValue
    const customReferences = meta.references
    super({
      referencedViews: schema ? Schema.referencedViews(schema) : [],
      ...meta,
      defaultValue() {
        return meta.options.initialValue ?? ([] as TextDoc<Blocks>)
      },
      withInitialValue(value) {
        if (!schema || !Array.isArray(value)) return value
        let next = value
        value.forEach((node, index) => {
          if (!Node.isBlock(node)) return
          const type = schema[node[Node.type]]
          if (!type) return
          const initialized = Type.withInitialValue(type, node)
          if (initialized === node) return
          if (next === value) next = [...value]
          next[index] = initialized as TextDoc<Blocks>[number]
        })
        return next
      },
      async applyLinks(value, loader) {
        const doc = Array.isArray(value) ? value : []
        const tasks: Array<Promise<unknown>> = [applyLinkMarks(doc, loader)]
        for (const row of doc) {
          if (!schema || !Node.isBlock(row)) continue
          const type = schema[row[Node.type]]
          if (type) tasks.push(Type.applyLinks(type, row, loader))
        }
        await Promise.all(tasks)
      },
      searchableText(value) {
        if (!meta.options.searchable) return ''
        return richTextSearchableText(schema, value)
      },
      references(value, context) {
        const doc = Array.isArray(value) ? value : []
        const result = customReferences?.(value, context) ?? []
        result.push(
          ...richTextReferences(schema, doc, context.path, context.label)
        )
        return result
      },
      anchors(value, context) {
        const doc = Array.isArray(value) ? value : []
        const result = []
        result.push(
          ...richTextAnchors(schema, doc, context.path, context.label)
        )
        return result
      },
      normalizeAnchors(value, context) {
        if (!Array.isArray(value)) return value
        return normalizeRichTextAnchors(schema, value, context.anchors)
      },
      async queryValue(value, loader) {
        const doc = Array.isArray(value) ? value : []
        const tasks: Array<Promise<unknown>> = [applyLinkMarks(doc, loader)]
        for (const row of doc) {
          if (!schema || !Node.isBlock(row)) continue
          const type = schema[row[Node.type]]
          if (!type) continue
          const record = row as Record<string, unknown>
          tasks.push(
            Promise.all(
              entries(Type.fields(type)).map(async ([key, field]) => {
                record[key] = await Field.queryValue(field, record[key], loader)
              })
            )
          )
        }
        await Promise.all(tasks)
        if (customQueryValue) return customQueryValue(doc, loader)
        return doc
      }
    })
  }
}

function normalizeRichTextAnchors<Blocks>(
  schema: Schema | undefined,
  doc: TextDoc<Blocks>,
  anchors: Set<string>
): TextDoc<Blocks> {
  function normalizeNode(
    node: Node,
    insideHeading: boolean,
    activeManualAnchors: Map<string, string>
  ): Node {
    if (Node.isBlock(node)) {
      activeManualAnchors.clear()
      const type = schema?.[node[Node.type]]
      return type
        ? (Type.normalizeAnchors(type, node, {anchors}) as Node)
        : node
    }
    if (Node.isText(node)) {
      const marks = node.marks
      if (!marks) {
        activeManualAnchors.clear()
        return node
      }
      if (insideHeading) {
        activeManualAnchors.clear()
        const nextMarks = marks.filter(mark => mark[Mark.type] !== 'anchor')
        return nextMarks.length === marks.length
          ? node
          : {...node, marks: nextMarks.length ? nextMarks : undefined}
      }
      let nextMarks = marks
      const nextActiveManualAnchors = new Map<string, string>()
      marks.forEach((mark, index) => {
        if (mark[Mark.type] !== 'anchor' || typeof mark.id !== 'string') return
        let unique = activeManualAnchors.get(mark.id)
        if (!unique) {
          unique = createUniqueAnchor(mark.id, anchors)
        }
        if (unique) nextActiveManualAnchors.set(mark.id, unique)
        if (!unique || unique === mark.id) return
        if (nextMarks === marks) nextMarks = [...marks]
        nextMarks[index] = {...mark, id: unique}
      })
      activeManualAnchors.clear()
      for (const [anchor, unique] of nextActiveManualAnchors)
        activeManualAnchors.set(anchor, unique)
      return nextMarks === marks ? node : {...node, marks: nextMarks}
    }

    activeManualAnchors.clear()
    const source =
      typeof node._anchor === 'string'
        ? node._anchor
        : node[Node.type] === 'heading'
          ? slugify(textContent(node))
          : undefined
    const unique = createUniqueAnchor(source, anchors)
    const nextInsideHeading = insideHeading || node[Node.type] === 'heading'
    const content = node.content
    let nextContent = content
    if (content) {
      let updated = content
      const activeManualAnchors = new Map<string, string>()
      content.forEach((child, index) => {
        const normalized = normalizeNode(
          child,
          nextInsideHeading,
          activeManualAnchors
        )
        if (normalized === child) return
        if (updated === content) updated = [...content]
        updated[index] = normalized
      })
      nextContent = updated
    }
    if (unique === node._anchor && nextContent === content) return node
    return unique === node._anchor
      ? {...node, content: nextContent}
      : {...node, _anchor: unique, content: nextContent}
  }

  let next = doc
  const activeManualAnchors = new Map<string, string>()
  doc.forEach((node, index) => {
    const normalized = normalizeNode(node, false, activeManualAnchors)
    if (normalized === node) return
    if (next === doc) next = [...doc]
    next[index] = normalized
  })
  return next
}

function textContent(node: Node): string {
  if (Node.isText(node)) return node.text ?? ''
  if (!Node.isElement(node) || !node.content) return ''
  return node.content.map(textContent).join('')
}

function richTextAnchors<Blocks>(
  schema: Schema | undefined,
  doc: TextDoc<Blocks>,
  path: Array<string>,
  label?: string
): Array<EntryAnchorTarget> {
  const result: Array<EntryAnchorTarget> = []
  const anchors = new Set<string>()
  iterNodes(doc, (node, nodePath) => {
    if (Node.isElement(node)) {
      const anchor = node._anchor
      if (typeof anchor === 'string' && !anchors.has(anchor)) {
        anchors.add(anchor)
        result.push({
          id: anchor,
          label: `#${anchor}`,
          fieldPath: referenceFieldPath([...path, ...nodePath, anchor]),
          fieldLabel: label
        })
      }
    }
    if (!Node.isText(node)) return
    for (const mark of node.marks ?? []) {
      if (mark[Mark.type] !== 'anchor') continue
      const anchor = mark.id
      if (typeof anchor !== 'string' || anchors.has(anchor)) continue
      anchors.add(anchor)
      result.push({
        id: anchor,
        label: `#${anchor}`,
        fieldPath: referenceFieldPath([...path, ...nodePath, anchor]),
        fieldLabel: label
      })
    }
  })
  doc.forEach((row, index) => {
    if (!schema || !Node.isBlock(row)) return
    const type = schema[row[Node.type]]
    if (!type) return
    result.push(
      ...Type.anchors(type, row as Record<string, unknown>, [
        ...path,
        row._id ?? String(index)
      ])
    )
  })
  return result
}

function richTextReferences<Blocks>(
  schema: Schema | undefined,
  doc: TextDoc<Blocks>,
  path: Array<string>,
  label?: string
): Array<EntryReferenceTarget> {
  const result: Array<EntryReferenceTarget> = []
  iterMarks(doc, mark => {
    if (mark[Mark.type] !== 'link') return
    const entryId = mark[LinkMark.entry]
    if (typeof entryId !== 'string') return
    const linkType = richTextLinkType(mark[LinkMark.link])
    if (linkType === 'url') return
    const linkId = mark[LinkMark.id]
    result.push({
      targetId: entryId,
      fieldPath: referenceFieldPath(
        typeof linkId === 'string' ? [...path, linkId] : path
      ),
      fieldLabel: label,
      linkId,
      linkType
    })
  })
  iterImageNodes(doc, (node, index) => {
    if (typeof node._entry !== 'string') return
    result.push({
      targetId: node._entry,
      fieldPath: referenceFieldPath(
        typeof node._id === 'string'
          ? [...path, node._id]
          : [...path, String(index)]
      ),
      fieldLabel: label,
      linkId: node._id,
      linkType: 'image'
    })
  })
  doc.forEach((row, index) => {
    if (!schema || !Node.isBlock(row)) return
    const type = schema[row[Node.type]]
    if (!type) return
    result.push(
      ...Type.references(type, row as Record<string, unknown>, [
        ...path,
        row._id ?? String(index)
      ])
    )
  })
  return result
}

function richTextLinkType(
  value: string | undefined
): 'entry' | 'file' | undefined | 'url' {
  if (value === 'entry' || value === 'file' || value === 'url') return value
  return undefined
}

async function applyLinkMarks(
  doc: TextDoc<unknown>,
  loader: import('../db/LinkResolver.js').LinkResolver
): Promise<void> {
  if (!Array.isArray(doc)) return
  const links = new Map<Mark, string>()
  iterMarks(doc, mark => {
    if (mark[Mark.type] !== 'link') return
    const entryId = mark[LinkMark.entry]
    if (typeof entryId === 'string') links.set(mark, entryId)
  })
  const images = new Map<ImageNode, string>()
  iterImageNodes(doc, node => {
    if (node._link === 'image' && typeof node._entry === 'string') {
      delete node.src
      delete node.alt
      images.set(node, node._entry)
    }
  })
  const linkIds = Array.from(new Set([...links.values(), ...images.values()]))
  const entries = await loader.resolveLinks(linkInfoFields, linkIds)
  const info = new Map(entries.map(entry => [entry.id, entry]))
  for (const [mark, entryId] of links) {
    const data = info.get(entryId)
    if (!data) continue
    const href = data.url
    mark.href = applyUrlSuffix(
      href,
      mark[LinkMark.suffix],
      mark[LinkMark.anchor]
    )
  }
  for (const [node, entryId] of images) {
    const data = info.get(entryId)
    if (!data) continue
    node.src = data.url
    node.alt = mediaAltText(data.alt, loader.locale ?? undefined)
  }
}

function richTextSearchableText<Blocks>(
  schema: Schema | undefined,
  value: TextDoc<Blocks>
): string {
  if (!Array.isArray(value)) return ''
  return value.reduce((acc, node) => {
    return acc + richTextNodeText(schema, node)
  }, '')
}

function richTextNodeText(schema: Schema | undefined, node: Node): string {
  if (Node.isText(node)) return node.text ? ` ${node.text}` : ''
  if (Node.isElement(node) && node.content) {
    return node.content.reduce((acc, node) => {
      return acc + richTextNodeText(schema, node)
    }, '')
  }
  if (Node.isBlock(node)) {
    const type = schema?.[node[Node.type]]
    if (type) {
      const text = Type.searchableText(type, node)
      return text ? ` ${text}` : ''
    }
  }
  return ''
}

function iterMarks(doc: TextDoc<unknown>, fn: (mark: Mark) => void) {
  for (const row of doc) {
    if (Node.isText(row)) row.marks?.forEach(fn)
    else if (Node.isElement(row) && row.content) iterMarks(row.content, fn)
  }
}

function iterImageNodes(
  doc: TextDoc<unknown>,
  fn: (node: ImageNode, index: number) => void
) {
  doc.forEach((node, index) => {
    if (!Node.isElement(node)) return
    if (node._type === 'image') fn(node as ImageNode, index)
    if (node.content) iterImageNodes(node.content, fn)
  })
}

function iterNodes(
  doc: TextDoc<unknown>,
  fn: (node: Node, path: Array<string>) => void,
  path: Array<string> = []
) {
  doc.forEach((row, index) => {
    const rowPath = [...path, String(index)]
    fn(row, rowPath)
    if (Node.isElement(row) && row.content) {
      iterNodes(row.content, fn, [...rowPath, 'content'])
    }
  })
}

export type RichTextBlockInput<Blocks, Key extends keyof Blocks> = Omit<
  InferStoredValue<Blocks[Key]>,
  '_type' | '_id'
>

export class RichTextEditor<Blocks = Schema> {
  constructor(private doc: TextDoc<Blocks> = []) {}

  add<Key extends keyof Blocks>(
    type: Key,
    block: RichTextBlockInput<Blocks, Key>
  ) {
    this.doc.push({_id: createId(), _type: type as string, ...block})
    return this
  }

  addHtml(html: string, options?: ParseHTMLSyncOptions) {
    this.doc.push(...parseHTMLSync(html.trim(), options))
    return this
  }

  async addHtmlAsync(html: string, options?: ParseHTMLOptions) {
    this.doc.push(...(await parseHTML(html.trim(), options)))
    return this
  }

  value() {
    return this.doc
  }
}

function mapNode(
  name: string,
  attributes: Record<string, string>
): ElementNode | undefined {
  switch (name) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const type = 'heading'
      const level = Number(name.slice(1))
      return {_type: type, level, content: []}
    }
    case 'p':
      return {_type: 'paragraph', content: []}
    case 'ul':
      return {_type: 'bulletList', content: []}
    case 'ol':
      return {_type: 'orderedList', content: []}
    case 'li':
      return {_type: 'listItem', content: []}
    case 'blockquote':
      return {_type: 'blockquote', content: []}
    case 'hr':
      return {_type: 'horizontalRule'}
    case 'br':
      return {_type: 'hardBreak'}
    case 'table':
      return {_type: 'table', content: []}
    case 'tbody':
      return {_type: 'tableBody', content: []}
    case 'td':
      return {_type: 'tableCell', content: []}
    case 'th':
      return {_type: 'tableHeader', content: []}
    case 'tr':
      return {_type: 'tableRow', content: []}
  }
}

function mapMark(
  name: string,
  attributes: Record<string, string>
): Mark | undefined {
  switch (name) {
    case 'b':
    case 'strong':
      return {_type: 'bold'}
    case 'i':
    case 'em':
      return {_type: 'italic'}
    case 'u':
      return {_type: 'underline'}
    case 's':
    case 'strike':
      return {_type: 'strike'}
    case 'a':
      return {_type: 'link', ...attributes}
  }
}

export interface ParseHTMLTagHandler {
  (attributes: Record<string, string>): ElementNode | undefined
}

export interface ParseHTMLMarkHandler {
  (attributes: Record<string, string>): Mark | undefined
}

export interface ParseHTMLAsyncTagHandler {
  (
    attributes: Record<string, string>
  ): ElementNode | undefined | PromiseLike<ElementNode | undefined>
}

export interface ParseHTMLAsyncMarkHandler {
  (
    attributes: Record<string, string>
  ): Mark | undefined | PromiseLike<Mark | undefined>
}

export interface ParseHTMLSyncOptions {
  tags?: Record<string, ParseHTMLTagHandler>
  marks?: Record<string, ParseHTMLMarkHandler>
}

export interface ParseHTMLOptions {
  tags?: Record<string, ParseHTMLAsyncTagHandler>
  marks?: Record<string, ParseHTMLAsyncMarkHandler>
}

interface OpenTagToken {
  type: 'openTag'
  name: string
  attributes: Record<string, string>
}

interface TextToken {
  type: 'text'
  text: string
}

interface CloseTagToken {
  type: 'closeTag'
  name: string
}

type HTMLToken = OpenTagToken | TextToken | CloseTagToken

interface HTMLParent {
  tag?: string
  doc?: TextDoc
}

interface HTMLMarkRange {
  tag: string
  mark: Mark
  doc: TextDoc
  start: number
}

interface ParseHTMLState {
  doc: TextDoc
  parents: Array<HTMLParent>
  markStack: Array<HTMLMarkRange>
}

/**
 * Parse HTML using handlers that may perform asynchronous work, such as
 * importing remote images into a media directory.
 */
export async function parseHTML(
  html: string,
  options: ParseHTMLOptions = {}
): Promise<TextDoc> {
  const state = createParseHTMLState()
  if (typeof html !== 'string') return state.doc

  for (const token of tokenizeHTML(html)) {
    if (token.type === 'text') {
      processText(state, token.text)
    } else if (token.type === 'closeTag') {
      processCloseTag(state, token.name)
    } else {
      const tagHandler = options.tags?.[token.name]
      const markHandler = options.marks?.[token.name]
      const node = tagHandler
        ? await tagHandler(token.attributes)
        : mapNode(token.name, token.attributes)
      const mark = markHandler
        ? await markHandler(token.attributes)
        : mapMark(token.name, token.attributes)
      processOpenTag(state, token.name, node, mark)
    }
  }

  concatTextNodes(state.doc)
  return state.doc
}

/** Parse HTML synchronously. Async handlers are only supported by parseHTML. */
export function parseHTMLSync(
  html: string,
  options: ParseHTMLSyncOptions = {}
): TextDoc {
  const state = createParseHTMLState()
  if (typeof html !== 'string') return state.doc

  for (const token of tokenizeHTML(html)) {
    if (token.type === 'text') {
      processText(state, token.text)
    } else if (token.type === 'closeTag') {
      processCloseTag(state, token.name)
    } else {
      const tagHandler = options.tags?.[token.name]
      const markHandler = options.marks?.[token.name]
      const node = tagHandler
        ? tagHandler(token.attributes)
        : mapNode(token.name, token.attributes)
      const mark = markHandler
        ? markHandler(token.attributes)
        : mapMark(token.name, token.attributes)
      processOpenTag(state, token.name, node, mark)
    }
  }

  concatTextNodes(state.doc)
  return state.doc
}

function tokenizeHTML(html: string): Array<HTMLToken> {
  const tokens: Array<HTMLToken> = []
  const parser = new Parser({
    onopentag(name, attributes) {
      tokens.push({type: 'openTag', name, attributes})
    },
    ontext(text) {
      tokens.push({type: 'text', text})
    },
    onclosetag(name) {
      tokens.push({type: 'closeTag', name})
    }
  })
  parser.write(html)
  parser.end()
  return tokens
}

function createParseHTMLState(): ParseHTMLState {
  const doc: TextDoc = []
  return {doc, parents: [{doc}], markStack: []}
}

function processOpenTag(
  state: ParseHTMLState,
  name: string,
  node: ElementNode | undefined,
  mark: Mark | undefined
) {
  const parent = state.parents.at(-1)
  if (node) {
    parent?.doc?.push(node)
    state.parents.push({tag: name, doc: node.content})
  } else if (mark) {
    const target = parent?.doc
    if (!target) return
    state.markStack.push({
      tag: name,
      mark,
      doc: target,
      start: target.length
    })
  }
}

function processText(state: ParseHTMLState, text: string) {
  const parent = state.parents.at(-1)
  if (parent?.doc === state.doc && text.trim().length === 0) return
  parent?.doc?.push({_type: 'text', text})
}

function processCloseTag(state: ParseHTMLState, name: string) {
  const parent = state.parents.at(-1)
  if (parent?.tag === name) state.parents.pop()
  const match = findMark(name, state.markStack)
  if (match < 0) return
  const {mark, doc, start} = state.markStack[match]
  for (let i = start; i < doc.length; i++) applyMark(doc[i], mark)
  state.markStack.splice(match)
}

function findMark(tag: string, marks: Array<{tag: string}>) {
  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i].tag === tag) return i
  }
  return -1
}

function applyMark(node: Node, mark: Mark) {
  if (Node.isText(node)) {
    const marks: Array<Mark> = node.marks || (node.marks = [])
    if (!marks.some(current => sameMark(current, mark))) marks.unshift(mark)
    return
  }
  if ('content' in node && node.content) {
    for (const child of node.content) {
      if ('_type' in child) applyMark(child, mark)
    }
  }
}

function sameMark(a: Mark, b: Mark) {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (a[key as keyof Mark] !== b[key as keyof Mark]) return false
  }
  return true
}

function sameMarks(a?: Array<Mark>, b?: Array<Mark>) {
  if (!a?.length && !b?.length) return true
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!sameMark(a[i], b[i])) return false
  }
  return true
}

function concatTextNodes(doc: TextDoc) {
  for (let i = 0; i < doc.length; i++) {
    const node = doc[i]
    if (!Node.isText(node)) {
      if (Node.isElement(node) && node.content) concatTextNodes(node.content)
      continue
    }
    const next = doc[i + 1]
    if (!next || !Node.isText(next)) continue
    if (!sameMarks(node.marks, next.marks)) continue
    node.text = (node.text || '') + (next.text || '')
    doc.splice(i + 1, 1)
    i--
  }
}
