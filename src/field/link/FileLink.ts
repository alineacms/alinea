import {Entry} from 'alinea/core/Entry'
import type {WithoutLabel} from 'alinea/core/Field'
import {InferStoredValue} from 'alinea/core/Infer'
import {Label} from 'alinea/core/Label'
import {Type} from 'alinea/core/Type'
import {imageExtensions} from 'alinea/core/media/IsImage'
import {MediaFile} from 'alinea/core/media/MediaTypes'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {
  LinkFieldOptions,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {EntryPickerOptions, entryPicker} from 'alinea/picker/entry'
import {EntryReference} from 'alinea/picker/entry/EntryReference'

export interface FileLink<InferredFields = undefined> extends EntryReference {
  title: string
  href: string
  extension: string
  size: number
  fields: InferredFields
}

export namespace FileLink {
  export const title = Entry.title
  export const url = MediaFile.location
  export const href = MediaFile.location
  export const extension = MediaFile.extension
  export const size = MediaFile.size
}

const fileCondition = {
  _type: 'MediaFile',
  extension: {notIn: imageExtensions}
}

export function filePicker<Fields>(
  multiple: boolean,
  options: Omit<EntryPickerOptions<Fields>, 'selection'>
) {
  return entryPicker<EntryReference, Fields>({
    ...options,
    max: multiple ? undefined : 1,
    label: 'File',
    title: multiple ? 'Select files' : 'Select a file',
    condition: {or: [fileCondition, {_type: 'MediaLibrary'}]},
    showMedia: true,
    defaultView: 'thumb',
    selection: FileLink
  })
}

export interface FileOptions<Fields>
  extends LinkFieldOptions<EntryReference & InferStoredValue<Fields>>,
    Omit<EntryPickerOptions<Fields>, 'label' | 'selection'> {}

export function file<Fields = undefined>(
  label: Label,
  options: WithoutLabel<FileOptions<Fields>> = {}
) {
  return createLink<
    EntryReference & InferStoredValue<Fields>,
    FileLink<Type.Infer<Fields>>
  >(label, {
    ...options,
    pickers: {file: filePicker(false, options)}
  })
}

export namespace file {
  export interface FilesOptions<Fields>
    extends LinkFieldOptions<
        Array<EntryReference & ListRow & InferStoredValue<Fields>>
      >,
      Omit<EntryPickerOptions<Fields>, 'label' | 'selection'> {}

  export function multiple<Fields = undefined>(
    label: Label,
    options: WithoutLabel<FilesOptions<Fields>> = {}
  ) {
    return createLinks<
      EntryReference & ListRow & InferStoredValue<Fields>,
      FileLink<Type.Infer<Fields>>
    >(label, {
      ...options,
      pickers: {file: filePicker(true, options)}
    })
  }
}
