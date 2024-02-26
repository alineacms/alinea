import {Entry} from 'alinea/core/Entry'
import type {WithoutLabel} from 'alinea/core/Field'
import {Hint} from 'alinea/core/Hint'
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
import {EntryPickerOptions, entryPicker, fileFields} from 'alinea/picker/entry'
import {FileReference} from 'alinea/picker/entry/EntryReference'

const fileCondition = Entry.type
  .is('MediaFile')
  .and(MediaFile.extension.isNotIn(imageExtensions))

export function filePicker<Fields>(
  multiple: boolean,
  options: Omit<EntryPickerOptions<Fields>, 'hint' | 'selection'>
) {
  return entryPicker<FileReference, Fields>({
    ...options,
    hint: Hint.Extern({
      name: 'FileReference',
      package: 'alinea/picker/entry'
    }),
    max: multiple ? undefined : 1,
    label: 'File',
    title: multiple ? 'Select files' : 'Select a file',
    condition: fileCondition.or(Entry.type.is('MediaLibrary')),
    showMedia: true,
    defaultView: 'thumb',
    selection: fileFields
  })
}

type Link<Fields> = FileReference & Type.Infer<Fields>

export interface FileOptions<Fields>
  extends LinkFieldOptions<Link<Fields>>,
    Omit<EntryPickerOptions<Fields>, 'label' | 'hint' | 'selection'> {}

export function file<Fields>(
  label: Label,
  options: WithoutLabel<FileOptions<Fields>> = {}
) {
  return createLink<Link<Fields>>(label, {
    ...options,
    pickers: {file: filePicker(false, options)}
  })
}

export namespace file {
  type Link<Fields> = FileReference & Type.Infer<Fields> & ListRow

  export interface FilesOptions<Fields>
    extends LinkFieldOptions<Array<Link<Fields>>>,
      Omit<EntryPickerOptions<Fields>, 'label' | 'hint' | 'selection'> {}

  export function multiple<Fields>(
    label: Label,
    options: WithoutLabel<FilesOptions<Fields>> = {}
  ) {
    return createLinks<Link<Fields>>(label, {
      ...options,
      pickers: {file: filePicker(true, options)}
    })
  }
}
