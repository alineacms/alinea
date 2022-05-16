// Todo: extract interface and place it in core
import type {Pages} from '@alinea/backend/Pages'
import {
  Entry,
  Field,
  Label,
  Reference,
  Type,
  TypeConfig,
  Value
} from '@alinea/core'
import {RecordValue} from '@alinea/core/value/RecordValue'
import {Expr, ExprData} from '@alinea/store/Expr'
import {SelectionInput} from '@alinea/store/Selection'

export type LinkType = 'entry' | 'image' | 'file' | 'external'

/** Optional settings to configure a link field */
export type LinkOptions<T, Q> = {
  /** Add extra fields to each link */
  fields?: TypeConfig<T>
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** The type of links, this will configure the options of the link picker */
  type?: LinkType | Array<LinkType>
  /** Maximum amount of links that can be selected */
  max?: number
  /** Modify value returned when queried */
  query?: <P>(field: Expr<Array<Reference & T>>, pages: Pages<P>) => Expr<Q>
}

/** Internal representation of a link field */
export interface LinkField<T, Q> extends Field.List<Reference & T, Q> {
  label: Label
  options: LinkOptions<T, Q>
}

type LinkData =
  | {
      id: string
      type: 'entry'
      entry: string
      path: string
      url: string
      title: Label
    }
  | {id: string; type: 'url'; url: string}

/** Create a link field configuration */
export function createLink<T = {}, Q = Array<LinkData & T>>(
  label: Label,
  options: LinkOptions<T, Q> = {}
): LinkField<T, Q> {
  const extra = options.fields && Type.shape(options.fields)
  return {
    type: Value.List(label, {
      entry: new RecordValue('Entry', {
        entry: Value.Scalar('Entry')
      }).concat(extra),
      url: new RecordValue('Url', {
        url: Value.Scalar('Url')
      }).concat(extra)
    }),
    label,
    options,
    query(field, pages): Expr<Q> {
      const row = field.each()
      const Link = Entry.as('Link')
      const cases: Record<string, SelectionInput> = {
        entry: Link.where(entry => entry.id.is(row.get('entry')))
          .first()
          .select(entry => {
            return row.fields.with({
              id: row.get('id'),
              type: row.get('type'),
              entry: entry.id,
              path: entry.path,
              url: entry.url,
              title: entry.title
            })
          }),
        url: row
      }
      return new Expr(ExprData.create(row.select(row.get('type').case(cases))))
    }
  }
}
