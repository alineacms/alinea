import * as Y from 'yjs'
import {Type} from '../Type'
import {RecordType} from './RecordType'

export namespace RichTextNode {
  export type Mark = {type: string; attrs?: Record<string, string>}
  export type Text = {
    type: 'text'
    text?: string
    marks?: Array<Mark>
  }
  export type Element = {
    type: string
    attrs?: Record<string, any>
    content?: Array<RichTextNode>
  }
}
export type RichTextNode<T = any> = RichTextNode.Text | RichTextNode.Element

export type TextDoc<T> = {
  type: 'doc'
  blocks: Record<string, Row & T>
  content: Array<RichTextNode<T>>
}

// Adapted from: https://github.com/yjs/y-prosemirror/blob/1c393fb3254cc1ed4933e8326b57c1316793122a/src/lib.js#L245
function serialize(
  item: Y.XmlElement | Y.XmlText | Y.XmlHook
): RichTextNode | Array<RichTextNode> {
  // Todo: what is this thing?
  if (item instanceof Y.XmlHook) {
    return []
  }
  if (item instanceof Y.XmlText) {
    const delta: Array<{insert: any; attributes: Record<string, any>}> =
      item.toDelta()
    return delta.map(d => {
      const text: RichTextNode.Text = {
        type: 'text',
        text: d.insert
      }
      if (d.attributes) {
        text.marks = Object.keys(d.attributes).map(type => {
          const attrs = d.attributes[type]
          const mark: RichTextNode.Mark = {type}
          if (attrs && Object.keys(attrs).length) mark.attrs = attrs
          return mark
        })
      }
      return text
    })
  }
  const res: RichTextNode.Element = {type: item.nodeName}
  const attrs = item.getAttributes()
  if (attrs && Object.keys(attrs).length) res.attrs = attrs
  const children = item.toArray()
  if (children.length) {
    res.content = children.map(serialize).flat()
  }
  return res
}

function unserializeMarks(marks: Array<RichTextNode.Mark>) {
  return Object.fromEntries(marks.map(mark => [mark.type, {...mark.attrs}]))
}

function unserialize(node: RichTextNode): Y.XmlText | Y.XmlElement {
  switch (node.type) {
    case 'text': {
      const {text, marks} = node as RichTextNode.Text
      const type = new Y.XmlText()
      if (text) type.insert(0, text, marks && unserializeMarks(marks))
      return type
    }
    default: {
      const {type, attrs, content} = node as RichTextNode.Element
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

type Row = {
  $id: string
  $channel: string
}

export class RichTextType<T> implements Type<TextDoc<Row & T>> {
  types?: Record<string, RecordType<Row & T>>
  constructor(protected shapes?: Record<string, RecordType<T>>) {
    this.types =
      shapes &&
      Object.fromEntries(
        Object.entries(shapes).map(([key, type]) => {
          return [
            key,
            new RecordType({
              $id: Type.Scalar,
              $channel: Type.Scalar,
              ...type.shape
            })
          ]
        })
      )
  }
  toY(value: TextDoc<Row & T>) {
    const map = new Y.Map()
    const doc = new Y.XmlFragment()
    map.set('$doc', doc)
    const types = this.types
    if (types && value.blocks)
      for (const [name, block] of Object.entries(value.blocks)) {
        map.set(name, types[block.$channel].toY(block))
      }
    const content = value?.content
    if (!content) return map
    doc.insert(0, content.map(unserialize))
    return map
  }
  fromY(value: Y.Map<any>): TextDoc<Row & T> {
    const doc: Y.XmlFragment = value.get('$doc')
    const types = this.types
    const blocks = types
      ? Object.fromEntries(
          Array.from(value.entries())
            // Todo: filter out unused blocks
            .filter(([key]) => key !== '$doc')
            .map(([key, item]) => {
              return [key, types[item.get('$channel')].fromY(item)]
            })
        )
      : undefined
    return {
      type: 'doc',
      blocks: blocks,
      content: doc?.toArray().map(serialize).flat() || []
    }
  }
  watch(parent: Y.Map<any>, key: string) {
    // There's no watching involved, the editor should handle all rendering
    return () => {}
  }
  mutator(parent: Y.Map<any>, key: string) {
    const map = parent.get(key)
    return {
      map: parent.get(key),
      fragment: map.get('$doc'),
      insert: (id: string, block: string) => {
        if (!this.types) throw new Error('No types defined')
        map.set(
          id,
          this.types[block].toY({
            $id: id,
            $channel: block
          } as any)
        )
      }
    }
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
