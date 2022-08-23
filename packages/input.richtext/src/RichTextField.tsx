import type {Pages} from '@alinea/backend'
import {
  Entry,
  Field,
  Label,
  SchemaConfig,
  Shape,
  TextDoc,
  TextNode
} from '@alinea/core'
import {Expr, SelectionInput} from '@alinea/store'

/** Optional settings to configure a rich text field */
export type RichTextOptions<T, Q> = {
  /** Allow these blocks to be created between text fragments */
  blocks?: SchemaConfig<T>
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** A default value */
  initialValue?: TextDoc<T>
  /** Modify value returned when queried through `Pages` */
  transform?: (
    field: Expr<TextDoc<T>>,
    pages: Pages<any>
  ) => Expr<Q> | undefined
  /** Hide this rich text field */
  hidden?: boolean
}

/** Internal representation of a rich text field */
export interface RichTextField<T, Q = TextDoc<T>> extends Field.Text<T, Q> {
  label: Label
  options: RichTextOptions<T, Q>
}

function query<T, Q>(schema: SchemaConfig<T>) {
  return (field: Expr<TextDoc<T>>, pages: Pages<any>): Expr<Q> | undefined => {
    const row = field.each()
    const cases: Record<string, SelectionInput> = {}
    let isComputed = false
    for (const [key, type] of schema.configEntries()) {
      const selection = type.selection(row, pages)
      if (!selection) continue
      cases[key] = selection
      isComputed = true
    }
    if (!isComputed) return
    return row.select(row.get('type').case(cases, row.fields)).toExpr()
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
    const blocks = options.blocks
    const expr: Expr<TextDoc<any>> =
      (blocks && query(blocks)(field, pages)) || field
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
}

/** Create a rich text field configuration */
export function createRichText<T, Q = TextDoc<T>>(
  label: Label,
  options: RichTextOptions<T, Q> = {}
): RichTextField<T, Q> {
  return {
    shape: Shape.RichText(label, options.blocks?.shape, options.initialValue),
    label,
    options,
    transform: options.transform || transform<T, Q>(options),
    hidden: options.hidden
  }
}
