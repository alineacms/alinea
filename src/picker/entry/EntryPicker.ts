import {Entry} from 'alinea/core/Entry'
import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'
import {Reference} from 'alinea/core/Reference'
import {Shape} from 'alinea/core/Shape'
import {Type} from 'alinea/core/Type'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {Expr} from 'alinea/core/pages/Expr'
import {Projection} from 'alinea/core/pages/Projection'
import {assign} from 'alinea/core/util/Objects'
import {Picker} from 'alinea/editor/Picker'

export interface EntryLinkReference extends Reference {
  entry: string
}

export interface EntryReference extends EntryLinkReference {
  entryType: string
  path: string
  title: Label
  url: string
}

export const entryFields = {
  entryType: Entry.type,
  url: Entry.url,
  path: Entry.path,
  title: Entry.title
}

export namespace EntryReference {
  export function isEntryReference(value: any): value is EntryReference {
    return value && (value.type === 'entry' || value.ref === 'entry')
  }
}

export interface FileReference extends EntryLinkReference {
  src: string
  url: string
  extension: string
  size: number
}

export const fileFields = {
  title: Entry.title,
  url: MediaFile.location,
  extension: MediaFile.extension,
  size: MediaFile.size
}

export namespace FileReference {
  export function isFileReference(value: any): value is FileReference {
    return value && (value.type === 'file' || value.ref === 'file')
  }
}

export interface ImageReference extends EntryLinkReference {
  src: string
  extension: string
  size: number
  hash: string
  width: number
  height: number
  averageColor: string
  blurHash: string
}

export const imageFields = {
  title: Entry.title,
  src: MediaFile.location,
  extension: MediaFile.extension,
  size: MediaFile.size,
  hash: MediaFile.hash,
  width: MediaFile.width,
  height: MediaFile.height,
  averageColor: MediaFile.averageColor,
  thumbHash: MediaFile.thumbHash
}

export namespace ImageReference {
  export function isImageReference(value: any): value is ImageReference {
    return value && (value.type === 'image' || value.ref === 'image')
  }
}

export interface EntryPickerOptions<T = {}> {
  hint: Hint
  selection: Projection
  defaultView?: 'row' | 'thumb'
  condition?: Expr<boolean>
  max?: number
  showUploader?: boolean
  label?: Label
  title?: Label
  fields?: Type<T>
  initialValue?: Reference | Array<Reference>
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
    options,
    async postProcess(row, loader) {
      const link: EntryLinkReference = row as any
      if (!link.entry) return
      const linkIds = [link.entry]
      if (!options.selection) return
      const [fields] = await loader.resolveLinks(options.selection, linkIds)
      assign(row, fields)
    }
  }
}
