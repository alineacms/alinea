import {Entry} from '#/core/Entry.js'
import type {WithoutLabel} from '#/core/Field.js'
import type {InferStoredValue} from '#/core/Infer.js'
import type {Label} from '#/core/Label.js'
import type {Type} from '#/core/Type.js'
import {imageExtensions} from '#/core/media/IsImage.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import type {ListRow} from '#/core/ListRow.js'
import {
  type LinkFieldOptions,
  createLink,
  createLinks
} from '#/field/link/LinkField.js'
import {type EntryPickerOptions, entryPicker} from '#/picker/entry.js'
import type {EntryReference} from '#/picker/entry/EntryReference.js'

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
    selection: {
      ...FileLink,
      root: Entry.root,
      workspace: Entry.workspace
    }
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
