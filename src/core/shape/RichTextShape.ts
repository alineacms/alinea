import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import * as Y from 'yjs'
import {Entry} from '../Entry.js'
import {Label} from '../Label.js'
import {Shape} from '../Shape.js'
import {TextDoc, TextNode} from '../TextDoc.js'
import type {Expr} from '../pages/Expr.js'
import {entries, fromEntries, keys} from '../util/Objects.js'
import {RecordShape} from './RecordShape.js'
import {ScalarShape} from './ScalarShape.js'

// Adapted from: https://github.com/yjs/y-prosemirror/blob/1c393fb3254cc1ed4933e8326b57c1316793122a/src/lib.js#L245
function serialize(
  item: Y.XmlElement | Y.XmlText | Y.XmlHook
): TextNode | Array<TextNode> {
  // Todo: what is this thing?
  if (item instanceof Y.XmlHook) {
    return []
  }
  if (item instanceof Y.XmlText) {
    const delta: Array<{insert: any; attributes: Record<string, any>}> =
      item.toDelta()
    return delta.map(d => {
      const text: TextNode.Text = {
        type: 'text',
        text: d.insert
      }
      if (d.attributes) {
        text.marks = Object.keys(d.attributes).map(type => {
          const attrs = d.attributes[type]
          const mark: TextNode.Mark = {type}
          if (attrs && Object.keys(attrs).length) mark.attrs = attrs
          return mark
        })
      }
      return text
    })
  }
  const res: TextNode.Element = {type: item.nodeName}
  const attrs = item.getAttributes()
  if (attrs && Object.keys(attrs).length) Object.assign(res, attrs)
  const children = item.toArray()
  if (children.length) {
    res.content = children.map(serialize).flat()
  }
  return res
}

function unserializeMarks(marks: Array<TextNode.Mark>) {
  return Object.fromEntries(marks.map(mark => [mark.type, {...mark.attrs}]))
}

function unserialize(node: TextNode): Y.XmlText | Y.XmlElement {
  switch (node.type) {
    case 'text': {
      const {text, marks} = node as TextNode.Text
      const type = new Y.XmlText()
      if (text) type.insert(0, text, marks && unserializeMarks(marks))
      return type
    }
    default: {
      const {type, content, ...attrs} = node as TextNode.Element
      const element = new Y.XmlElement(type)
      for (const key in attrs) {
        const val = attrs[key]
        if (val) element.setAttribute(key, val)
      }
      if (content) element.insert(0, content.map(unserialize))
      return element
    }
  }
}

export type RichTextMutator<R> = {
  readOnly: boolean
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

let linkInfoFields = undefined! as {
  url: Expr<string>
  location: Expr<string>
}

export class RichTextShape<Blocks>
  implements Shape<TextDoc<Blocks>, RichTextMutator<Blocks>>
{
  values: Record<string, RecordShape>
  constructor(
    public label: Label,
    public shapes?: Record<string, RecordShape>,
    public initialValue?: TextDoc<Blocks>
  ) {
    this.values = shapes
      ? fromEntries(
          entries(shapes).map(([key, value]) => {
            return [
              key,
              new RecordShape(value.label, {
                type: new ScalarShape('Type'),
                ...value.properties
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
    const types = this.values
    return rows
      .map(row => {
        return row.type in types ? {type: row.type, id: (row as any).id} : row
      })
      .map(unserialize)
  }
  toY(value: TextDoc<Blocks>) {
    const map = new Y.Map()
    const text = new Y.XmlFragment()
    map.set('$text', text)
    const types = this.values
    if (!Array.isArray(value)) return map
    for (const node of value) {
      const type = types[node.type]
      if (type && 'id' in node) map.set(node.id, type.toY(node as any))
    }
    text.insert(0, this.toXml(value))
    return map
  }
  fromY(value: Y.Map<any>): TextDoc<Blocks> {
    if (!value) return []
    const text: Y.XmlFragment = value.get('$text')
    const types = this.values ?? {}
    const content = text?.toArray()?.map(serialize)?.flat() || []
    const isEmpty =
      content.length === 1 &&
      content[0].type === 'paragraph' &&
      content[0].content?.length === 0
    if (isEmpty) return []
    return content.map((node): TextNode<Blocks> => {
      const type = types[node.type]
      if (type && 'id' in node) {
        return {
          id: node.id,
          type: node.type,
          ...type.fromY(value.get(node.id))
        } as TextNode.Element<Blocks>
      }
      return node as TextNode<Blocks>
    })
  }
  applyY(value: TextDoc<Blocks>, parent: Y.Map<any>, key: string): void {
    // Sync blocks
    const current: Y.Map<any> | undefined = parent.get(key)
    if (!current || !value) return void parent.set(key, this.toY(value))
    const blocks = value.filter(
      row => this.values?.[row.type] && 'id' in row
    ) as Array<TextNode.Element<any>>
    const currentKeys = new Set(
      [...current.keys()].filter(key => key !== '$text')
    )
    const valueKeys = new Set(blocks.map(row => row.id))
    const removed = [...currentKeys].filter(key => !valueKeys.has(key))
    const added = [...valueKeys].filter(key => !currentKeys.has(key))
    const changed = [...valueKeys].filter(key => currentKeys.has(key))
    for (const id of removed) current.delete(id)
    for (const id of added) {
      const row = blocks.find(row => row.id === id)
      if (!row) continue
      const type = row.type
      const rowType = this.values[type]
      if (!rowType) continue
      current.set(id, rowType.toY(row))
    }
    for (const id of changed) {
      const row = blocks.find(row => row.id === id)
      if (!row) continue
      const type = row.type
      const currentRow = current.get(id)
      if (!currentRow) continue
      const currentType = currentRow.get('type')
      // This shouldn't normally happen unless we manually change the type
      if (currentType !== type) {
        current.delete(id)
        current.set(id, this.values[type].toY(row))
        continue
      }
      const rowType = this.values[type]
      if (!rowType) continue
      rowType.applyY(row, current, id)
    }

    // Sync text by simply matching each row.
    // Todo: This must be improved by diffing to enable continuous editing
    // during deploys without losing all text context
    function syncText(source: Y.XmlText, target: TextNode.Text) {
      const {text = '', marks = []} = target
      const str = Y.Text.prototype.toString.call(source)
      if (text === str) {
        source.format(0, source.length, unserializeMarks(marks))
      } else {
        source.delete(0, source.length)
        source.insert(0, text, unserializeMarks(marks))
      }
    }
    const syncElement = (
      source: Y.XmlElement,
      target: TextNode.Element<any>
    ) => {
      const {type, content, ...attrs} = target
      const isBlock = type in this.values
      const keysToHandle = isBlock ? ['id'] : keys(attrs)
      for (const key of keysToHandle)
        source.setAttribute(key, attrs[key] as string)
      if (isBlock) return
      for (const key of keys(source.getAttributes()))
        if (!keysToHandle.includes(key)) source.removeAttribute(key)
      syncNodes(source, content ?? [])
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
        const typeB = row.type
        if (typeA !== typeB) {
          source.delete(i)
          source.insert(i, this.toXml([row]))
          continue
        }
        if (typeA === 'text') {
          syncText(node as Y.XmlText, row as TextNode.Text)
          continue
        }
        syncElement(node as Y.XmlElement, row as TextNode.Element<any>)
      }
      while (source.length > i) source.delete(i)
    }
    syncNodes(current.get('$text'), value)
  }
  init(parent: Y.Map<any>, key: string): void {
    if (!parent.has(key)) parent.set(key, this.toY(this.create()))
  }
  watch(parent: Y.Map<any>, key: string) {
    // There's no watching of the fragment involved
    return () => () => {}
  }
  mutator(parent: Y.Map<any>, key: string, readOnly: boolean) {
    let map = parent.get(key)
    if (!map) {
      parent.set(key, this.toY([]))
      map = parent.get(key)
    }
    return {
      readOnly,
      map,
      fragment: map.get('$text'),
      insert: (id: string, block: string) => {
        if (!this.values) throw new Error('No types defined')
        const shape = this.values[block]
        const row = {...shape.create(), id, type: block}
        map.set(id, shape.toY(row))
      }
    }
  }
  async applyLinks(doc: TextDoc<Blocks>, loader: LinkResolver): Promise<void> {
    if (!Array.isArray(doc)) return
    const links = new Map<TextNode.Mark, string>()
    iterMarks(doc, mark => {
      if (mark.type !== 'link') return
      const id = mark.attrs!['data-entry']
      if (id) links.set(mark, id)
    })
    async function loadLinks() {
      const linkIds = Array.from(new Set(links.values()))
      linkInfoFields ??= {
        url: Entry.url,
        // This is MediaFile.location - but we're avoiding circular imports here
        location: (Entry.data as any).get('location')
      }
      const entries = await loader.resolveLinks(linkInfoFields, linkIds)
      const info = new Map(linkIds.map((id, i) => [id, entries[i]]))
      for (const [mark, id] of links) {
        const type = mark.attrs!['data-type'] as 'entry' | 'file' | undefined
        const data = info.get(id)
        if (data)
          mark.attrs!['href'] = type === 'file' ? data.location : data.url
      }
    }
    await Promise.all(
      [loadLinks()].concat(
        doc.flatMap(row => {
          const subType = this.values?.[row.type]
          if (!subType) return []
          return [subType.applyLinks(row, loader)]
        })
      )
    )
  }
}

function iterMarks(doc: TextDoc<any>, fn: (mark: TextNode.Mark) => void) {
  for (const row of doc) {
    if (row.marks) row.marks.forEach(fn)
    if (!TextNode.isElement(row)) continue
    if (row.content) iterMarks(row.content, fn)
  }
}

/*

HTML parser 

const fragment = new Y.XmlFragment()
if (typeof value !== 'string') return fragment
let parents: Array<Y.XmlFragment> = [fragment]
const parser = new Parser({
  onopentag(name, attributes) {
    const node = new Y.XmlElement(name)
    for (const key of Object.keys(attributes))
      node.setAttribute(key, attributes[key])
    const parent = parents[parents.length - 1]
    parent.insert(parent.length, [node])
    parents.push(node)
  },
  ontext(text) {
    const parent = parents[parents.length - 1]
    parent.insert(parent.length, [new Y.XmlText(text)])
  },
  onclosetag() {
    parents.pop()
  }
})
parser.write(value)
parser.end()
return fragment


*/
