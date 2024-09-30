import {Parser} from 'htmlparser2'
import {Field, FieldMeta, FieldOptions} from '../Field.js'
import {Schema} from '../Schema.js'
import {ElementNode, TextDoc} from '../TextDoc.js'
import {RichTextMutator, RichTextShape} from '../shape/RichTextShape.js'

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
    case 'h6':
      const type = 'heading'
      const level = Number(name.slice(1))
      return {_type: type, level, content: []}
    case 'p':
      return {_type: 'paragraph', content: []}
    case 'b':
    case 'strong':
      return {_type: 'bold', content: []}
    case 'i':
    case 'em':
      return {_type: 'italic', content: []}
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
    case 'small':
      return {_type: 'small', content: []}
    case 'a':
      // Todo: pick what we need
      return {_type: 'link', ...attributes, content: []}
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

export function parseHTML(html: string): TextDoc<any> {
  const doc: TextDoc<any> = []
  if (typeof html !== 'string') return doc
  let parents: Array<TextDoc<any> | undefined> = [doc]
  const parser = new Parser({
    onopentag(name, attributes) {
      const node = mapNode(name, attributes)
      const parent = parents[parents.length - 1]
      if (node) parent?.push(node)
      parents.push(node?.content)
    },
    ontext(text) {
      const parent = parents[parents.length - 1]
      parent?.push({_type: 'text', text})
    },
    onclosetag() {
      parents.pop()
    }
  })
  parser.write(html)
  parser.end()
  return doc
}
