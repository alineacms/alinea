import {Field, Label, Schema, TextDoc} from 'alinea/core'
import {richTextHint} from 'alinea/core/util/Hints'

/** Optional settings to configure a rich text field */
export interface RichTextOptions<Blocks> {
  /** Allow these blocks to be created between text fragments */
  schema?: Schema<Blocks>
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: TextDoc<Blocks>
  /** Hide this rich text field */
  hidden?: boolean
  /** Make this rich text field read-only */
  readonly?: boolean
}

/** Internal representation of a rich text field */
export class RichTextField<Blocks> extends Field.RichText<
  Blocks,
  RichTextOptions<Blocks>
> {}

/*function query<T, Q>(schema: Schema<T>) {
  return (field: Expr<TextDoc<T>>, pages: Pages<any>): Expr<Q> | undefined => {
    const row = field.each()
    const cases: Record<string, SelectionInput> = {}
    let isComputed = false
    for (const [key, type] of schema.configEntries()) {
      const selection = type.selection(row as any, pages)
      if (!selection) continue
      cases[key] = selection
      isComputed = true
    }
    if (!isComputed) return
    return row.select(row.get('type').case(cases, row.fields as any)).toExpr()
  }
}

function iterMarks(doc: TextDoc<any>, fn: (mark: TextNode.Mark) => void) {
  for (const row of doc) {
    if (row.marks) row.marks.forEach(fn)
    if (!TextNode.isElement(row)) continue
    if (row.content) iterMarks(row.content, fn)
  }
}

interface LinkMark {
  attrs: {
    'data-id'?: string
    'data-entry'?: string
    [key: string]: any
  }
}

function transform<T, Q>(options: RichTextOptions<T, Q>) {
  return (field: Expr<TextDoc<T>>, pages: Pages<any>): Expr<Q> | undefined => {
    const schema = options.schema || options.blocks
    const expr: Expr<TextDoc<any>> =
      (schema && query(schema)(field, pages)) || field
    return pages.process(expr, (doc): Q | Promise<Q> => {
      const links: Map<string, LinkMark> = new Map()
      iterMarks(doc, mark => {
        if (mark.type !== 'link') return
        const id = mark.attrs!['data-entry']
        if (id) links.set(id, mark as LinkMark)
      })
      const ids = Array.from(links.keys())
      if (ids.length === 0) return doc as any
      return pages
        .where(Entry.id.isIn(ids))
        .select({
          id: Entry.id,
          url: Entry.url
        })
        .then(entries => {
          for (const entry of entries) {
            const link = links.get(entry.id)
            if (!link) continue
            link.attrs['href'] = entry.url
          }
          return doc as any
        })
    })
  }
}*/

/** Create a rich text field configuration */
export function richText<Blocks>(
  label: Label,
  options: RichTextOptions<Blocks> = {}
): RichTextField<Blocks> {
  const shapes = options.schema && Schema.shapes(options.schema)
  return new RichTextField(shapes, {
    hint: richTextHint(options.schema),
    label,
    options,
    initialValue: options.initialValue
  })
}
