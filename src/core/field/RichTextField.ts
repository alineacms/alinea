import {Parser} from 'htmlparser2'
import {Field, type FieldMeta, type FieldOptions} from '../Field.js'
import {Schema} from '../Schema.js'
import type {ElementNode, Mark, TextDoc, TextNode} from '../TextDoc.js'
import {type RichTextMutator, RichTextShape} from '../shape/RichTextShape.js'

export class RichTextField<
  Blocks,
  Options extends FieldOptions<TextDoc<Blocks>> & {searchable?: boolean}
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
  let marks: Array<Mark> = []
  const parser = new Parser({
    onopentag(name, attributes) {
      const node = mapNode(name, attributes)
      const mark = mapMark(name, attributes)
      const parent = parents.at(-1)
      if (node) {
        parent?.doc?.push(node)
        parents.push({tag: name, doc: node?.content})
      } else if (mark) {
        marks.push(mark)
      }
    },
    ontext(text) {
      const parent = parents.at(-1)
      const node: TextNode = {_type: 'text', text}
      if (marks.length) node.marks = marks
      parent?.doc?.push(node)
      marks = []
    },
    onclosetag(name) {
      const parent = parents.at(-1)
      if (parent?.tag === name) parents.pop()
      else marks.pop()
    }
  })
  parser.write(html)
  parser.end()
  return doc
}
