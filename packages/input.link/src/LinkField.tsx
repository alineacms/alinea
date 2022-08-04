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
import type {Picker} from '@alinea/editor/Picker'
import {entryPicker} from '@alinea/picker.entry'
import {urlPicker} from '@alinea/picker.url'
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
  /** Modify value returned when queried through `Pages` */
  transform?: <P>(
    field: Expr<Array<Reference & T>>,
    pages: Pages<P>
  ) => Expr<Q> | undefined
  /** Hide this link field */
  hidden?: boolean
  pickers?: Array<Picker<any, any>>
}

/** Internal representation of a link field */
export interface LinkField<T, Q> extends Field.List<Reference & T, Q> {
  label: Label
  options: LinkOptions<T, Q>
}

export type LinkData = LinkData.Entry | LinkData.Url

export namespace LinkData {
  export interface Url extends Reference {
    type: 'url'
    url: string
    description: string
    target: string
  }
  export interface Entry extends Reference {
    type: 'entry'
    entry: string
    entryType: string
    path: string
    url: string
    title: Label
  }
  export interface File extends Reference {
    src: string
    extension: string
    size: number
  }
  export interface Image extends File {
    hash: string
    width: number
    height: number
    averageColor: string
    blurHash: string
  }
}

const defaultPickers = [
  entryPicker({max: 1}) as unknown,
  urlPicker({}) as unknown
] as Array<Picker>

/** Create a link field configuration */
export function createLink<T, Q>(
  label: Label,
  options: LinkOptions<T, Q> = {}
): LinkField<T, Q> {
  const pickers = options.pickers || defaultPickers
  const blocks = Object.fromEntries(
    pickers.map(picker => [picker.type, picker.shape])
  )
  return {
    shape: Shape.List(label, blocks, options.initialValue),
    label,
    options: {
      ...options,
      pickers
    },
    hidden: options.hidden,
    initialValue: options.initialValue,
    // Todo: move transform to the picker instances
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
                  LinkType.conditionOf(entry, 'file'),
                  {
                    src: entry.location,
                    extension: entry.extension,
                    size: entry.size
                  },
                  {}
                )
              )
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
