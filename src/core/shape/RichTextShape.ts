import type {LinkResolver} from 'alinea/core/db/LinkResolver'
import * as Y from 'yjs'
import {Entry} from '../Entry.js'
import type {Label} from '../Label.js'
import {MediaFile} from '../media/MediaTypes.js'
import type {Shape} from '../Shape.js'
import {
  BlockNode,
  ElementNode,
  LinkMark,
  Mark,
  Node,
  type TextDoc,
  TextNode
} from '../TextDoc.js'
import {entries, fromEntries, keys} from '../util/Objects.js'
import {RecordShape} from './RecordShape.js'
import {ScalarShape} from './ScalarShape.js'

export enum RichTextElements {
  h1 = 'h1',
  h2 = 'h2',
  h3 = 'h3',
  h4 = 'h4',
  h5 = 'h5',
  h6 = 'h6',
  p = 'p',
  b = 'b',
  i = 'i',
  ul = 'ul',
  ol = 'ol',
  li = 'li',
  a = 'a',
  blockquote = 'blockquote',
  hr = 'hr',
  br = 'br',
  small = 'small',
  sup = 'sup',
  sub = 'sub',
  table = 'table',
  tbody = 'tbody',
  td = 'td',
  th = 'th',
  tr = 'tr'
}

// Adapted from: https://github.com/yjs/y-prosemirror/blob/1c393fb3254cc1ed4933e8326b57c1316793122a/src/lib.js#L245
function serialize(
  item: Y.XmlElement | Y.XmlText | Y.XmlHook
): Node | Array<Node> {
  // Todo: what is this thing?
  if (item instanceof Y.XmlHook) {
    return []
  }
  if (item instanceof Y.XmlText) {
    const delta: Array<{insert: any; attributes: Record<string, any>}> =
      item.toDelta()
    return delta.map(d => {
      const text: TextNode = {
        [Node.type]: 'text',
        [TextNode.text]: d.insert
      }
      if (d.attributes) {
        text.marks = Object.keys(d.attributes).map(type => {
          const attrs = d.attributes[type]
          const mark: Mark = {[Mark.type]: type}
          if (attrs)
            for (const [key, value] of Object.entries(attrs)) {
              if (typeof value !== 'string') continue
              if (key.startsWith('data-'))
                mark[`_${key.slice('data-'.length)}`] = value
              else mark[key] = value
            }
          return mark
        })
      }
      return text
    })
  }
  const res: ElementNode = {[Node.type]: item.nodeName}
  if (typeof item.getAttributes !== 'function') return res
  const attrs = item.getAttributes()
  if (attrs && Object.keys(attrs).length) Object.assign(res, attrs)
  if (typeof item.toArray !== 'function') return res
  const children = item.toArray()
  if (children.length) {
    res.content = children.flatMap(serialize)
  }
  return res
}

function unserializeMarks(marks: Array<Mark>) {
  return Object.fromEntries(
    marks.map(mark => {
      const {[Mark.type]: type, ...attrs} = mark
      const res = Object.fromEntries(
        Object.entries(attrs).map(([key, value]) => {
          if (key.startsWith('_')) return [`data-${key.slice(1)}`, value]
          return [key, value]
        })
      )
      return [type, res]
    })
  )
}

function unserialize(nodes: Array<Node>): Array<Y.XmlText | Y.XmlElement> {
  const result = []
  for (const node of nodes) {
    if (Node.isText(node)) {
      const text = node[TextNode.text]
      const marks = node[TextNode.marks]
      const type = new Y.XmlText()
      if (text) type.insert(0, text, marks && unserializeMarks(marks))
      result.push(type)
    } else if (Node.isElement(node)) {
      const {[Node.type]: type, [ElementNode.content]: content, ...attrs} = node
      const element = new Y.XmlElement(type)
      for (const key in attrs) {
        const val = attrs[key]
        if (val) element.setAttribute(key, val)
      }
      if (content) element.insert(0, unserialize(content))
      result.push(element)
    } else if (Node.isBlock(node)) {
      const element = new Y.XmlElement(node[Node.type])
      element.setAttribute(BlockNode.id, node[BlockNode.id])
      result.push(element)
    }
  }
  return result
}

export type RichTextMutator<R> = {
  map: Y.Map<any>
  fragment: Y.XmlFragment
  insert: (id: string, block: string) => void
}

export interface TextDocStorage<Blocks> {
  doc: TextDoc<Blocks>
  linked: Array<string>
}

export interface TextDocSelected<Blocks> {
  doc: TextDoc<Blocks>
  linked: Array<{id: string; url: string}>
}

const linkInfoFields = {
  id: Entry.id,
  url: Entry.url,
  location: MediaFile.location
}

export class RichTextShape<Blocks>
  implements Shape<TextDoc<Blocks>, RichTextMutator<Blocks>>
{
  blocks: Record<string, RecordShape>
  constructor(
    public label: Label,
    public shapes?: Record<string, RecordShape>,
    public initialValue?: TextDoc<Blocks>,
    public searchable?: boolean
  ) {
    this.blocks = shapes
      ? fromEntries(
          entries(shapes).map(([key, value]) => {
            return [
              key,
              new RecordShape(value.label, {
                [Node.type]: new ScalarShape('Type'),
                [BlockNode.id]: new ScalarShape('Id'),
                ...value.shapes
              })
            ]
          })
        )
      : {}
  }
  create() {
    return this.initialValue ?? ([] as TextDoc<Blocks>)
  }
  toXml(rows: TextDoc<Blocks>) {
    return unserialize(rows)
  }
  toV1(value: any): TextDoc<Blocks> {
    if (!Array.isArray(value)) return []
    return value.map(this.normalizeRow)
  }
  private normalizeRow = (row: Node) => {
    if (Node.type in row) return row
    const {type, ...data} = row as any
    if (type === 'text') {
      const updated = {[Node.type]: 'text', [TextNode.text]: data.text}
      if (!data.marks) return updated
      return {
        ...updated,
        [TextNode.marks]: data.marks.map((mark: any) => {
          const {type, attrs} = mark
          if (type !== 'link') return {[Mark.type]: type, ...attrs}
          const {
            'data-id': id,
            'data-entry': entry,
            'data-type': link,
            ...rest
          } = attrs
          const res: Record<string, string> = {}
          if (type) res[Mark.type] = type
          if (id) res[LinkMark.id] = id
          if (entry) res[LinkMark.entry] = entry
          if (link) res[LinkMark.link] = link
          for (const [key, value] of entries(rest))
            if (typeof value === 'string') res[key] = rest[key]
          return res
        })
      }
    }

    const shape = this.blocks[type]
    if (shape) {
      return {
        [Node.type]: type,
        [BlockNode.id]: data.id,
        ...shape.toV1(data)
      }
    }
    const {content, ...rest} = data
    if (type === 'heading' && rest.textAlign === 'left')
      rest.textAlign = undefined
    const res = {[Node.type]: type, ...rest}
    if (content) res[ElementNode.content] = content.map(this.normalizeRow)
    return res
  }
  toY(value: TextDoc<Blocks>) {
    const map = new Y.Map()
    const text = new Y.XmlFragment()
    map.set('$text', text)
    const types = this.blocks
    if (!Array.isArray(value)) return map
    for (const node of value) {
      if (!Node.isBlock(node)) continue
      const type = types[node[Node.type]]
      map.set(node[BlockNode.id], type.toY(node))
    }
    text.insert(0, this.toXml(value))
    return map
  }
  fromY(map: Y.Map<any>): TextDoc<Blocks> {
    if (!map) return []
    const text: Y.XmlFragment = map.get('$text')
    const types = this.blocks ?? {}
    const content = text?.toArray()?.flatMap(serialize) || []
    const [first] = content
    const isEmpty =
      content.length === 1 &&
      Node.isElement(first) &&
      first[Node.type] === 'paragraph' &&
      first[ElementNode.content]?.length === 0
    if (isEmpty) return []
    return content.map((node): Node => {
      if (Node.isBlock(node)) {
        const shape = types[node[Node.type]]
        if (shape)
          return {
            [Node.type]: node[Node.type],
            [BlockNode.id]: node[BlockNode.id],
            ...shape.fromY(map.get(node[BlockNode.id]))
          } satisfies BlockNode
      }
      if (Node.isElement(node)) {
        if (node[Node.type] === 'heading') {
          if (node.textAlign === 'left') node.textAlign = undefined
        }
      }
      return node
    })
  }
  applyY(value: TextDoc<Blocks>, parent: Y.Map<any>, key: string): void {
    // Sync blocks
    const current: Y.Map<any> | undefined = parent.get(key)
    if (!current || !value) return void parent.set(key, this.toY(value))
    const blocks = value.filter(Node.isBlock)
    const currentKeys = new Set(
      [...current.keys()].filter(key => key !== '$text')
    )
    const valueKeys = new Set(blocks.map(row => row[BlockNode.id]))
    const removed = [...currentKeys].filter(key => !valueKeys.has(key))
    const added = [...valueKeys].filter(key => !currentKeys.has(key))
    const changed = [...valueKeys].filter(key => currentKeys.has(key))
    for (const id of removed) current.delete(id)
    for (const id of added) {
      const row = blocks.find(row => row[BlockNode.id] === id)
      if (!row) continue
      const type = row[Node.type]
      const rowType = this.blocks[type]
      if (!rowType) continue
      current.set(id, rowType.toY(row))
    }
    for (const id of changed) {
      const row = blocks.find(row => row[BlockNode.id] === id)
      if (!row) continue
      const type = row[Node.type]
      const currentRow = current.get(id)
      if (!currentRow) continue
      const currentType = currentRow.get(Node.type)
      // This shouldn't normally happen unless we manually change the type
      if (currentType !== type) {
        current.delete(id)
        current.set(id, this.blocks[type].toY(row))
        continue
      }
      const rowType = this.blocks[type]
      if (!rowType) continue
      rowType.applyY(row, current, id)
    }

    // Sync text by simply matching each row.
    // Todo: This must be improved by diffing to enable continuous editing
    // during deploys without losing all text context
    function syncText(source: Y.XmlText, target: TextNode) {
      const {text = '', marks = []} = target
      const str = Y.Text.prototype.toString.call(source)
      if (text === str) {
        source.format(0, source.length, unserializeMarks(marks))
      } else {
        source.delete(0, source.length)
        source.insert(0, text, unserializeMarks(marks))
      }
    }
    const syncElement = (source: Y.XmlElement, target: ElementNode) => {
      const {[Node.type]: type, content, ...attrs} = target
      const keysToHandle = keys(attrs)
      for (const key of keys(attrs))
        source.setAttribute(key, attrs[key] as string)
      for (const key of keys(source.getAttributes()))
        if (!keysToHandle.includes(key)) source.removeAttribute(key)
      syncNodes(source, content ?? [])
    }
    const syncBlock = (source: Y.XmlElement, target: BlockNode) => {
      source.setAttribute(BlockNode.id, target[BlockNode.id])
    }
    const syncNodes = (source: Y.XmlElement, value: TextDoc<any>) => {
      let i = 0
      for (; i < value.length; i++) {
        const row = value[i]
        const node = source.get(i)
        if (!node) {
          source.insert(i, this.toXml([row]))
          continue
        }
        const typeA = node instanceof Y.XmlText ? 'text' : node.nodeName
        const typeB = row[Node.type]
        if (typeA !== typeB) {
          source.delete(i)
          source.insert(i, this.toXml([row]))
          continue
        }
        if (Node.isText(row)) {
          syncText(node as Y.XmlText, row)
        } else if (Node.isElement(row)) {
          syncElement(node as Y.XmlElement, row)
        } else if (Node.isBlock(row)) {
          syncBlock(node as Y.XmlElement, row)
        }
      }
      while (source.length > i) source.delete(i)
    }
    syncNodes(current.get('$text'), value)
  }
  init(parent: Y.Map<any>, key: string): void {
    if (!parent.has(key)) parent.set(key, this.toY(this.create()))
  }
  watch(parent: Y.Map<any>, key: string) {
    const map: Y.Map<any> = parent.get(key)
    return (fun: () => void) => {
      const listener = (events: Array<Y.YEvent<any>>, tx: Y.Transaction) => {
        if (tx.origin === 'self') return
        fun()
      }
      map.observeDeep(listener)
      return () => map.unobserveDeep(listener)
    }
  }
  mutator(parent: Y.Map<any>, key: string) {
    const map = parent.get(key)
    return {
      map,
      fragment: map.get('$text'),
      insert: (id: string, block: string) => {
        if (!this.blocks) throw new Error('No types defined')
        const shape = this.blocks[block]
        map.set(
          id,
          shape.toY({
            ...shape.create(),
            [Node.type]: block,
            [BlockNode.id]: id
          })
        )
      }
    }
  }
  async applyLinks(doc: TextDoc<Blocks>, loader: LinkResolver): Promise<void> {
    if (!Array.isArray(doc)) return
    const links = new Map<Mark, string>()
    iterMarks(doc, mark => {
      if (mark[Mark.type] !== 'link') return
      const entryId = mark[LinkMark.entry]
      if (typeof entryId === 'string') links.set(mark, entryId)
    })
    async function loadLinks() {
      const linkIds = Array.from(new Set(links.values()))
      const entries = await loader.resolveLinks(linkInfoFields, linkIds)
      const info = new Map(
        entries.map(entry => {
          return [entry.id, entry]
        })
      )
      for (const [mark, entryId] of links) {
        const type = mark![LinkMark.link] as 'entry' | 'file' | undefined
        const data = info.get(entryId)
        if (data) mark!.href = type === 'file' ? data.location : data.url
      }
    }
    await Promise.all(
      [loadLinks()].concat(
        doc.flatMap(row => {
          if (!this.blocks || !Node.isBlock(row)) return []
          const shape = this.blocks[row[Node.type]]
          if (!shape) return []
          return [shape.applyLinks(row, loader)]
        })
      )
    )
  }

  searchableText(value: TextDoc<Blocks>): string {
    const res = ''
    if (!this.searchable) return res
    if (!Array.isArray(value)) return res
    return value.reduce((acc, node) => {
      return acc + this.textOf(node)
    }, '')
  }

  textOf(node: Node): string {
    if (Node.isText(node)) {
      return node.text ? ` ${node.text}` : ''
    }
    if (Node.isElement(node) && node.content) {
      return node.content.reduce((acc, node) => {
        return acc + this.textOf(node)
      }, '')
    }
    if (Node.isBlock(node)) {
      const shape = this.blocks[node[Node.type]]
      if (shape) return shape.searchableText(node)
    }
    return ''
  }
}

function iterMarks(doc: TextDoc<any>, fn: (mark: Mark) => void) {
  for (const row of doc) {
    if (Node.isText(row)) row.marks?.forEach(fn)
    else if (Node.isElement(row) && row.content) iterMarks(row.content, fn)
  }
}
