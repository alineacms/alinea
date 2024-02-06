import {RichTextMutator, RichTextShape} from 'alinea/core'
import {Parser} from 'htmlparser2'
import {Field, FieldMeta, FieldOptions} from '../Field.js'
import {TextDoc} from '../TextDoc.js'
import {RecordShape} from '../shape/RecordShape.js'

export class RichTextField<
  Blocks,
  Options extends FieldOptions<TextDoc<Blocks>> & {searchable?: boolean}
> extends Field<TextDoc<Blocks>, RichTextMutator<Blocks>, Options> {
  constructor(
    shape: {[key: string]: RecordShape<any>} | undefined,
    meta: FieldMeta<TextDoc<Blocks>, RichTextMutator<Blocks>, Options>
  ) {
    super({
      shape: new RichTextShape(
        meta.options.label,
        shape,
        meta.options.initialValue,
        meta.options.searchable
      ),
      ...meta
    })
  }
}

export class RichTextEditor<Blocks> {
  constructor(private doc: TextDoc<Blocks> = []) {}

  addHtml(html: string) {
    throw new Error(`Element types need to be mapped`)
    this.doc.push(...parseHTML(html.trim()))
    return this
  }

  value() {
    return this.doc
  }
}

export function parseHTML(html: string): TextDoc<any> {
  const doc: TextDoc<any> = []
  if (typeof html !== 'string') return doc
  let parents: Array<TextDoc<any>> = [doc]
  const parser = new Parser({
    onopentag(name, attributes) {
      const node = {type: name, ...attributes, content: []}
      const parent = parents[parents.length - 1]
      parent.push(node)
      parents.push(node.content)
    },
    ontext(text) {
      const parent = parents[parents.length - 1]
      parent.push({type: 'text', text})
    },
    onclosetag() {
      parents.pop()
    }
  })
  parser.write(html)
  parser.end()
  return doc
}
