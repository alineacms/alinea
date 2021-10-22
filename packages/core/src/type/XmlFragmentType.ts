import * as Y from 'yjs'
import {Type} from '../Type'

namespace Node {
  export type Mark = {type: string; attrs?: Record<string, string>}
  export type Text = {
    type: 'text'
    text: string
    marks?: Array<Mark>
  }
  export type Element = {
    type: string
    attrs?: Record<string, any>
    content?: Array<Node>
  }
}

type Node = Node.Text | Node.Element
type Doc = {type: 'doc'; content: Array<Node>}

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
      const text: Node.Text = {
        type: 'text',
        text: d.insert
      }
      if (d.attributes) {
        text.marks = Object.keys(d.attributes).map(type => {
          const attrs = d.attributes[type]
          const mark: Node.Mark = {type}
          if (attrs && Object.keys(attrs).length) mark.attrs = attrs
          return mark
        })
      }
      return text
    })
  }
  const res: Node.Element = {type: item.nodeName}
  const attrs = item.getAttributes()
  if (attrs && Object.keys(attrs).length) res.attrs = attrs
  const children = item.toArray()
  if (children.length) {
    res.content = children.map(serialize).flat()
  }
  return res
}

function unserializeMarks(marks: Array<Node.Mark>) {
  return Object.fromEntries(marks.map(mark => [mark.type, mark.attrs]))
}

function unserialize(node: Node): Y.XmlText | Y.XmlElement {
  switch (node.type) {
    case 'text': {
      const {text, marks} = node as Node.Text
      const type = new Y.XmlText()
      type.insert(0, text, marks && unserializeMarks(marks))
      return type
    }
    default: {
      const {attrs, content} = node as Node.Element
      const type = new Y.XmlElement(node.type)
      for (const key in attrs) {
        const val = attrs[key]
        if (val !== null) type.setAttribute(key, val)
      }
      if (content) type.insert(0, content.map(unserialize))
      return type
    }
  }
}

export class XmlFragmentType implements Type<Node> {
  static inst = new XmlFragmentType()
  toY(value: Doc) {
    const fragment = new Y.XmlFragment()
    const content = value?.content
    if (!content) return fragment
    fragment.insert(0, content.map(unserialize))
    return fragment
  }
  fromY(value: Y.XmlFragment): Doc {
    return {
      type: 'doc',
      content: value.toArray().map(serialize).flat()
    }
  }
  watch(parent: Y.Map<any>, key: string) {
    // There's no watching involved, the editor should handle all rendering
    return () => {}
  }
  mutator(parent: Y.Map<any>, key: string) {
    return parent.get(key)
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
