import {
  Field,
  ListShape,
  RichTextRaw,
  RichTextShape,
  Shape,
  TextDoc,
  TextNode,
  Type
} from 'alinea/core'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {entries, fromEntries} from 'alinea/core/util/Objects'

export interface EntryData {
  [key: string]: any
}

function iterMarks(doc: TextDoc<any>, fn: (mark: TextNode.Mark) => void) {
  for (const row of doc) {
    if (row.marks) row.marks.forEach(fn)
    if (!TextNode.isElement(row)) continue
    if (row.content) iterMarks(row.content, fn)
  }
}

function transformValue(shape: Shape, raw: any): any {
  switch (true) {
    case shape instanceof ListShape:
      const listShape = shape as ListShape<any>
      if (!Array.isArray(raw)) return
      return raw
        .map((item, index) => {
          const {type} = item
          if (!type) return
          const subType = listShape.values[type]
          if (!subType) return
          return transformValue(subType, item)
        })
        .filter(Boolean)
    case shape instanceof RecordShape:
      const recordShape = shape as RecordShape<any>
      if (typeof raw !== 'object') return
      return fromEntries(
        entries(recordShape.properties).map(([key, field]) => {
          return [key, transformValue(field, raw[key])]
        })
      )
    case shape instanceof RichTextShape:
      const richTextShape = shape as RichTextShape<any>
      if (!Array.isArray(raw)) return
      const linked = new Set<string>()
      iterMarks(raw, mark => {
        if (mark.type !== 'link') return
        const id = mark.attrs!['data-entry']
        if (id) linked.add(id)
      })
      const doc = raw.map(row => {
        const subType = richTextShape.values?.[row.type]
        if (!subType) return row
        return transformValue(subType, row)
      })
      return {
        doc,
        linked: Array.from(linked)
      } satisfies RichTextRaw<any>
    default:
      return raw
  }
}

// Produces the data structure which is stored in a json column in the database
export function entryData(type: Type, input: Record<string, any>): EntryData {
  const output: EntryData = {}
  for (const [key, field] of entries(type)) {
    output[key] = transformValue(Field.shape(field), input[key])
  }
  return output
}
