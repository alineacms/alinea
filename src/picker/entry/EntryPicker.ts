import {Entry} from 'alinea/core/Entry'
import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'
import {Reference} from 'alinea/core/Reference'
import {Type} from 'alinea/core/Type'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {Expr} from 'alinea/core/pages/Expr'
import {Projection} from 'alinea/core/pages/Projection'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import {assign} from 'alinea/core/util/Objects'
import {Picker} from 'alinea/editor/Picker'
import {EntryLinkReference} from './EntryReference.js'

export const entryFields = {
  title: Entry.title,
  entryType: Entry.type,
  url: Entry.url,
  path: Entry.path
}

export const fileFields = {
  title: Entry.title,
  url: MediaFile.location,
  extension: MediaFile.extension,
  size: MediaFile.size
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
  thumbHash: MediaFile.thumbHash,
  focus: MediaFile.focus
}

export interface EntryPickerOptions<T = {}> {
  hint: Hint
  selection: Projection
  defaultView?: 'row' | 'thumb'
  condition?: Expr<boolean>
  showMedia?: boolean
  max?: number
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
    shape: new RecordShape('Entry', {
      entry: new ScalarShape('Entry')
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
