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
import {EntryPickerOptions, entryPicker, imageFields} from 'alinea/picker/entry'
import {ImageReference} from 'alinea/picker/entry/EntryReference'

const imageCondition = Entry.type
  .is('MediaFile')
  .and(MediaFile.extension.isIn(imageExtensions))

function imagePicker<Fields>(
  multiple: boolean,
  options: Omit<EntryPickerOptions<Fields>, 'hint' | 'selection'>
) {
  return entryPicker<ImageReference, Fields>({
    ...options,
    hint: Hint.Extern({
      name: 'ImageReference',
      package: 'alinea/picker/entry'
    }),
    max: multiple ? undefined : 1,
    label: 'Image',
    title: multiple ? 'Select images' : 'Select an image',
    condition: imageCondition.or(Entry.type.is('MediaLibrary')),
    showMedia: true,
    defaultView: 'thumb',
    selection: imageFields
  })
}

type Link<Fields> = ImageReference & Type.Infer<Fields>

export interface ImageOptions<Fields>
  extends LinkFieldOptions<Link<Fields>>,
    Omit<EntryPickerOptions<Fields>, 'label' | 'hint' | 'selection'> {}

export function image<Fields>(
  label: Label,
  options: WithoutLabel<ImageOptions<Fields>> = {}
) {
  return createLink<Link<Fields>>(label, {
    ...options,
    pickers: {image: imagePicker(false, options)}
  })
}

export namespace image {
  type Link<Fields> = ImageReference & Type.Infer<Fields> & ListRow

  export interface ImagesOptions<Fields>
    extends LinkFieldOptions<Array<Link<Fields>>>,
      Omit<EntryPickerOptions<Fields>, 'label' | 'hint' | 'selection'> {}

  export function multiple<Fields>(
    label: Label,
    options: WithoutLabel<ImagesOptions<Fields>> = {}
  ) {
    return createLinks<Link<Fields>>(label, {
      ...options,
      pickers: {image: imagePicker(true, options)}
    })
  }
}
