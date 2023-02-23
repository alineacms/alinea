import {
  Entry,
  Field,
  Hint,
  Label,
  Media,
  Reference,
  Shape,
  TypeConfig
} from 'alinea/core'
import type {Picker} from 'alinea/editor/Picker'
import {Cursor, Expr, SelectionInput} from 'alinea/store'

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
export type LinkOptions<T, Q> = {
  /** The type of links, this will configure the options of the link picker */
  type?: LinkType | Array<LinkType>
  /** Show only entries matching this condition */
  condition?: Expr<boolean>
  /** Add extra fields to each link */
  fields?: TypeConfig<any, T>
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
  initialValue?: Array<Reference & T>
  /** Hide this link field */
  hidden?: boolean
  pickers?: Array<Picker<any, any>>
}

/** Internal representation of a link field */
export interface LinkField<T, Q> extends Field.List<Reference & T, Q> {
  label: Label
  options: LinkOptions<T, Q>
}

/** Create a link field configuration */
export function createLink<T, Q>(
  label: Label,
  options: LinkOptions<T, Q> = {}
): LinkField<T, Q> {
  const pickers = options.pickers || []
  const blocks = Object.fromEntries(
    pickers.map(picker => [
      picker.type,
      options.fields ? picker.shape.concat(options.fields.shape) : picker.shape
    ])
  )
  const hint =
    pickers.length === 1
      ? pickers[0].hint
      : Hint.Union(pickers.map(picker => picker.hint))
  return {
    shape: Shape.List(label, blocks, options.initialValue),
    hint: options.multiple ? Hint.Array(hint) : hint,
    label,
    options: {
      ...options,
      pickers
    },
    hidden: options.hidden,
    initialValue: options.initialValue,
    transform(field): Expr<Q> {
      const row = field.each() as unknown as Cursor<Reference>
      const cases: Record<string, SelectionInput> = {}
      for (const picker of pickers) cases[picker.type] = picker.select(row)
      const cursor = row.select(row.get('type').case(cases, row.fields))
      if (!options.multiple) return cursor.first().toExpr()
      return cursor.toExpr()
    }
  }
}
