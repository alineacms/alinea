import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'
import {Reference} from 'alinea/core/Reference'
import {Shape} from 'alinea/core/Shape'
import {Type} from 'alinea/core/Type'
import {Expr} from 'alinea/core/pages/Expr'
import {Picker} from 'alinea/editor/Picker'

export interface EntryReference extends Reference {
  entry: string
  entryType: string
  path: string
  title: Label
  url: string
}

export interface FileReference extends Reference {
  src: string
  url: string
  extension: string
  size: number
}

export interface ImageReference extends Reference {
  src: string
  extension: string
  size: number
  hash: string
  width: number
  height: number
  averageColor: string
  blurHash: string
}

export interface EntryPickerOptions<T = {}> {
  hint: Hint
  defaultView?: 'row' | 'thumb'
  condition?: Expr<boolean>
  max?: number
  showUploader?: boolean
  label?: Label
  title?: Label
  fields?: Type<T>
}

export function entryPicker<Ref extends Reference, Fields>(
  options: EntryPickerOptions<Fields>
): Picker<Ref & Type.Infer<Fields>, EntryPickerOptions<Fields>> {
  const extra = options.fields && Type.shape(options.fields)
  /*const hint = Hint.Extern({
    name: externType[options.type],
    package: 'alinea/picker/entry'
  })*/
  return {
    shape: Shape.Record('Entry', {
      entry: Shape.Scalar('Entry')
    }).concat(extra),
    hint: options.fields
      ? Hint.Intersection(options.hint, Type.hint(options.fields))
      : options.hint,
    fields: options.fields,
    label: options.label || 'Page link',
    handlesMultiple: true,
    options
    /*select(row) {
      const Link = Entry.as<Media.File>('Link')
      // Todo: in time this does not need to check a condition but simply the
      // type that was passed
      return Link.where(entry => entry.id.is(row.get('entry')))
        .first()
        .select(entry => {
          return row.fields
            .with({
              entryType: entry.type,
              url: entry.url,
              path: entry.path,
              title: entry.title,
              alinea: entry.alinea
            })
            .with(
              Functions.iif(
                LinkType.conditionOf(entry, 'file'),
                {
                  src: entry.location,
                  url: entry.location,
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
        })
    }*/
  }
}
