import * as Y from 'yjs'
import {createError} from '../ErrorWithCode'
import {Hint} from '../Hint'
import {Label} from '../Label'
import {Shape} from '../Shape'
import {TextDoc, TextNode} from '../TextDoc'
import {RecordShape} from './RecordShape'

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
  // map: Y.Map<any>
  fragment: Y.XmlFragment
  insert: (id: string, block: string) => void
}

export class RichTextShape<T> implements Shape<TextDoc<T>, RichTextMutator<T>> {
  values?: Record<string, RecordShape>
  constructor(
    public label: Label,
    public shapes?: Record<string, RecordShape>,
    public initialValue?: TextDoc<T>
  ) {
    this.values =
      shapes &&
      Object.fromEntries(
        Object.entries(shapes).map(([key, value]) => {
          return [
            key,
            new RecordShape(value.label, {
              type: Shape.Scalar('Type'),
              ...value.properties
            })
          ]
        })
      )
  }
  innerTypes(parents: Array<string>) {
    if (!this.shapes) return []
    return Object.entries(this.shapes).flatMap(([name, shape]) => {
      const info = {name, shape, parents}
      const inner = shape.innerTypes(parents.concat(name))
      if (Hint.isDefinitionName(name)) return [info, ...inner]
      return inner
    })
  }
  create() {
    return this.initialValue || ([] as TextDoc<T>)
  }
  typeOfChild<C>(yValue: Y.Map<any>, child: string): Shape<C> {
    const block = yValue.get(child)
    const type = block && block.get('type')
    const value = type && this.values && this.values[type]
    if (value) return value as unknown as Shape<C>
    throw createError(`Type of block "${child}" not found`)
  }
  toY(value: TextDoc<T>) {
    const map = new Y.Map()
    const text = new Y.XmlFragment()
    map.set('$text', text)
    const types = this.values
    if (!Array.isArray(value)) return map
    if (types)
      for (const node of value) {
        const type = types[node.type]
        if (type && 'id' in node) map.set(node.id, type.toY(node as any))
      }
    text.insert(0, value.map(unserialize))
    return map
  }
  fromY(value: Y.Map<any>): TextDoc<T> {
    if (!value) return []
    const text: Y.XmlFragment = value.get('$text')
    const types = this.values || {}
    const content = text?.toArray()?.map(serialize)?.flat() || []
    const isEmpty =
      content.length === 1 &&
      content[0].type === 'paragraph' &&
      !content[0].content
    if (isEmpty) return []
    return content.map((node): TextNode<T> => {
      const type = types[node.type]
      if (type && 'id' in node) {
        return {
          id: node.id,
          type: node.type,
          ...type.fromY(value.get(node.id))
        } as TextNode.Element<T>
      }
      return node as TextNode<T>
    })
  }
  watch(parent: Y.Map<any>, key: string) {
    // There's no watching involved, the editor should handle all rendering
    return () => {}
  }
  mutator(parent: Y.Map<any>, key: string) {
    const map = parent.get(key)
    return {
      // map: parent.get(key),
      fragment: map.get('$text'),
      insert: (id: string, block: string) => {
        if (!this.values) throw new Error('No types defined')
        const shape = this.values[block]
        const row = {...shape.create(), id, type: block}
        map.set(id, shape.toY(row))
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
