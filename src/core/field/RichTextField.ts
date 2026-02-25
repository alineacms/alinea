import {Parser} from 'htmlparser2'
import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {Schema} from '../Schema.js'
import {type RichTextMutator, RichTextShape} from '../shape/RichTextShape.js'
import {
  type ElementNode,
  type Mark,
  Node,
  type TextDoc,
  type TextNode
} from '../TextDoc.js'

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
    super({
      shape: new RichTextShape(
        meta.options.label,
        schema && Schema.shapes(schema),
        meta.options.initialValue,
        meta.options.searchable
      ),
      referencedViews: schema ? Schema.referencedViews(schema) : [],
      ...meta
    })
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
