import {Entry, Field, Hint, Label, Media, Reference, Type} from 'alinea/core'
import type {Picker} from 'alinea/editor/Picker'
import {Cursor, Expr} from 'alinea/store'
import {linkConstructors} from './LinkConstructors'

export type LinkType = 'entry' | 'image' | 'file' | 'external'

export namespace LinkType {
  export function conditionOf(cursor: Cursor<Entry>, type: LinkType) {
    switch (type) {
      case 'entry':
        return cursor.type.isNot(Media.Type.File)
      case 'image':
        return cursor.type
          .is(Media.Type.File)
          .and(cursor.get('extension').isIn(Media.imageExtensions))
      case 'file':
        return cursor.type
          .is(Media.Type.File)
          .and(cursor.get('extension').isNotIn(Media.imageExtensions))
      case 'external':
        return Expr.value(true)
    }
  }
}

/** Optional settings to configure a link field */
export interface LinkOptions<Row> {
  /** The type of links, this will configure the options of the link picker */
  type?: LinkType | Array<LinkType>
  /** Show only entries matching this condition */
  condition?: Expr<boolean>
  /** Add extra fields to each link */
  fields?: Type<Row>
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** Allow multiple links */
  multiple?: boolean
  /** Maximum amount of links that can be selected */
  max?: number
  /** A default value */
  initialValue?: Array<Reference & Row>
  /** Hide this link field */
  hidden?: boolean
  pickers?: Array<Picker<any, any>>
}

/** Internal representation of a link field */
export class LinkField<Row> extends Field.List<
  Reference & Row,
  LinkOptions<Row>
> {}

/** Create a link field configuration */
export function createLink<Row>(
  label: Label,
  options: LinkOptions<Row> = {}
): LinkField<Row> {
  const pickers = options.pickers || []
  const blocks = Object.fromEntries(
    pickers.map(picker => [
      picker.type,
      options.fields
        ? picker.shape.concat(Type.shape(options.fields))
        : picker.shape
    ])
  )
  const hint =
    pickers.length === 1
      ? pickers[0].hint
      : Hint.Union(pickers.map(picker => picker.hint))
  return new LinkField(blocks, {
    hint: options.multiple ? Hint.Array(hint) : hint,
    label,
    options: {
      ...options,
      pickers
    },
    initialValue: options.initialValue
    /*transform(field): Expr<Q> {
      const row = field.each() as unknown as Cursor<Reference>
      const cases: Record<string, SelectionInput> = {}
      for (const picker of pickers) cases[picker.type] = picker.select(row)
      const cursor = row.select(row.get('type').case(cases, row.fields))
      if (!options.multiple) return cursor.first().toExpr()
      return cursor.toExpr()
    }*/
  })
}

export const link = linkConstructors(createLink)
