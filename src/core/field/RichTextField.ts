import {Parser} from 'htmlparser2'
import type {EntryReferenceTarget} from '../db/EntryReference.js'
import {referenceFieldPath} from '../db/EntryReference.js'
import {Entry} from '../Entry.js'
import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {MediaFile} from '../media/MediaTypes.js'
import {Schema} from '../Schema.js'
import {
  type ElementNode,
  LinkMark,
  Mark,
  Node,
  type TextDoc,
  type TextNode
} from '../TextDoc.js'
import {Type} from '../Type.js'
import {mediaLocationUrl} from '../util/EntryFilenames.js'
import {entries} from '../util/Objects.js'

export type RichTextMutator<R> = {
  insert: (id: string, block: string) => void
}

const linkInfoFields = {
  id: Entry.id,
  url: Entry.url,
  workspace: Entry.workspace,
  location: MediaFile.location
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
  const linkIds = Array.from(new Set(links.values()))
  const entries = await loader.resolveLinks(linkInfoFields, linkIds)
  const info = new Map(entries.map(entry => [entry.id, entry]))
  for (const [mark, entryId] of links) {
    const type = mark[LinkMark.link] as 'entry' | 'file' | undefined
    const data = info.get(entryId)
    if (!data) continue
    const href =
      type === 'file'
        ? mediaLocationUrl(loader.resolver.config, data.workspace, data.location)
        : data.url
    mark.href = applyUrlSuffix(href, mark[LinkMark.suffix])
  }
}

function applyUrlSuffix(url: string, suffix: string | undefined): string {
  const value = suffix?.trim()
  if (!value) return url
  return `${url}${value}`
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

export class RichTextEditor<Blocks> {
  constructor(private doc: TextDoc<Blocks> = []) {}

  addHtml(html: string) {
    this.doc.push(...parseHTML(html.trim()))
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

export function parseHTML(html: string): TextDoc<any> {
  const doc: TextDoc<any> = []
  if (typeof html !== 'string') return doc
  const parents: Array<{tag: string; doc?: TextDoc<any>}> = [
    {tag: undefined!, doc}
  ]
  const markStack: Array<{
    tag: string
    mark: Mark
    doc: TextDoc<any>
    start: number
  }> = []
  const parser = new Parser({
    onopentag(name, attributes) {
      const node = mapNode(name, attributes)
      const mark = mapMark(name, attributes)
      const parent = parents.at(-1)
      if (node) {
        parent?.doc?.push(node)
        parents.push({tag: name, doc: node?.content})
      } else if (mark) {
        const target = parent?.doc
        if (!target) return
        markStack.push({
          tag: name,
          mark,
          doc: target,
          start: target.length
        })
      }
    },
    ontext(text) {
      const parent = parents.at(-1)
      if (parent?.doc === doc && text.trim().length === 0) return
      parent?.doc?.push({_type: 'text', text})
    },
    onclosetag(name) {
      const parent = parents.at(-1)
      if (parent?.tag === name) parents.pop()
      const match = findMark(name, markStack)
      if (match < 0) return
      const {mark, doc, start} = markStack[match]
      for (let i = start; i < doc.length; i++) applyMark(doc[i], mark)
      markStack.splice(match)
    }
  })
  parser.write(html)
  parser.end()
  concatTextNodes(doc)
  return doc
}

function findMark(tag: string, marks: Array<{tag: string}>) {
  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i].tag === tag) return i
  }
  return -1
}

function applyMark(node: ElementNode | TextNode, mark: Mark) {
  if (node._type === 'text') {
    const marks: Array<Mark> = node.marks || (node.marks = [])
    if (!marks.some(current => sameMark(current, mark))) marks.unshift(mark)
    return
  }
  if ('content' in node && node.content) {
    for (const child of node.content) {
      if ('_type' in child) applyMark(child as ElementNode | TextNode, mark)
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

function concatTextNodes(doc: TextDoc<any>) {
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
