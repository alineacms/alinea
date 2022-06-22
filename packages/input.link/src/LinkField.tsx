import type {Pages} from '@alinea/backend'
import {
  Entry,
  Field,
  Label,
  Media,
  Reference,
  Shape,
  TypeConfig
} from '@alinea/core'
import {RecordShape} from '@alinea/core/shape/RecordShape'
import {Cursor, Expr, Functions, SelectionInput} from '@alinea/store'

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
  /** A default value */
  initialValue?: Array<Reference & T>
  /** The type of links, this will configure the options of the link picker */
  type?: LinkType | Array<LinkType>
  /** Show only entries matching this condition */
  condition?: Expr<boolean>
  /** Allow multiple links */
  multiple?: boolean
  /** Maximum amount of links that can be selected */
  max?: number
  /** Modify value returned when queried through `Pages` */
  transform?: <P>(
    field: Expr<Array<Reference & T>>,
    pages: Pages<P>
  ) => Expr<Q> | undefined
  /** Hide this link field */
  hidden?: boolean
}

/** Internal representation of a link field */
export interface LinkField<T, Q> extends Field.List<Reference & T, Q> {
  label: Label
  options: LinkOptions<T, Q>
}

export type LinkData = LinkData.Entry | LinkData.Url

export namespace LinkData {
  export type Entry = {
    id: string
    type: 'entry'
    entry: string
    entryType: string
    path: string
    url: string
    title: Label
  }
  export type Image = Entry & {
    src: string
    extension: string
    size: number
    hash: string
    width: number
    height: number
    averageColor: string
    blurHash: string
  }
  export type Url = {id: string; type: 'url'; url: string}
}

/** Create a link field configuration */
export function createLink<T, Q>(
  label: Label,
  options: LinkOptions<T, Q> = {}
): LinkField<T, Q> {
  const extra = options.fields?.shape
  return {
    shape: Shape.List(
      label,
      {
        entry: new RecordShape('Entry', {
          entry: Shape.Scalar('Entry')
        }).concat(extra),
        url: new RecordShape('Url', {
          url: Shape.Scalar('Url')
        }).concat(extra)
      },
      options.initialValue
    ),
    label,
    options,
    hidden: options.hidden,
    initialValue: options.initialValue,
    transform(field, pages): Expr<Q> {
      const row = field.each()
      const Link = Entry.as<Media.File>('Link')
      const cases: Record<string, SelectionInput> = {
        entry: Link.where(entry => entry.id.is(row.get('entry')))
          .first()
          .select(entry => {
            return row.fields
              .with({
                entryType: entry.type,
                path: entry.path,
                url: entry.url,
                title: entry.title
              })
              .with(
                Functions.iif(
                  LinkType.conditionOf(entry, 'image'),
                  {
                    src: entry.location,
                    extension: entry.extension,
                    size: entry.size,
                    hash: entry.hash,
                    width: entry.width,
                    height: entry.height,
                    averageColor: entry.averageColor,
                    blurHash: entry.blurHash
                  },
                  {}
                )
              )
          }),
        url: row
      }
      const cursor = row.select(row.get('type').case(cases, row.fields))
      if (!options.multiple) return cursor.first().toExpr()
      return cursor.toExpr()
    }
  }
}
