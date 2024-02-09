import {Entry} from 'alinea/core/Entry'
import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'
import {Picker} from 'alinea/core/Picker'
import {Reference} from 'alinea/core/Reference'
import {Type, type} from 'alinea/core/Type'
import {MediaFile} from 'alinea/core/media/MediaTypes'
import type {Condition} from 'alinea/core/pages/Expr'
import {Projection} from 'alinea/core/pages/Projection'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import {assign} from 'alinea/core/util/Objects'
import {EntryLinkReference} from './EntryReference.js'

export const entryFields = {
  i18nId: Entry.i18nId,
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

export interface EntryPickerOptions<Definition = {}> {
  hint: Hint
  selection: Projection
  defaultView?: 'row' | 'thumb'
  location?: {workspace: string; root: string}
  condition?: Condition
  withNavigation?: boolean
  showMedia?: boolean
  max?: number
  label?: string
  title?: Label
  fields?: Definition | Type<Definition>
}

export function entryPicker<Ref extends Reference, Fields>(
  options: EntryPickerOptions<Fields>
): Picker<Ref & Type.Infer<Fields>, EntryPickerOptions<Fields>> {
  const fieldType = Type.isType(options.fields)
    ? options.fields
    : options.fields && type({fields: options.fields as any})
  const extra = fieldType && Type.shape(fieldType)
  return {
    shape: new RecordShape('Entry', {
      entry: new ScalarShape('Entry')
    }).concat(extra),
    hint: fieldType
      ? Hint.Intersection(options.hint, Type.hint(fieldType))
      : options.hint,
    fields: fieldType,
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
