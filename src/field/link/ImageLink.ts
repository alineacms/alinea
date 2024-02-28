import {Entry} from 'alinea/core/Entry'
import type {WithoutLabel} from 'alinea/core/Field'
import {Hint} from 'alinea/core/Hint'
import {InferStoredValue} from 'alinea/core/Infer'
import {Label} from 'alinea/core/Label'
import {Type} from 'alinea/core/Type'
import {imageExtensions} from 'alinea/core/media/IsImage'
import {MediaFile} from 'alinea/core/media/MediaTypes'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {
  LinkField,
  LinkFieldOptions,
  LinksField,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {EntryPickerOptions, entryPicker} from 'alinea/picker/entry'
import {EntryReference} from 'alinea/picker/entry/EntryReference'

export interface ImageLink<InferredFields = undefined> extends EntryReference {
  title: string
  src: string
  url: string
  extension: string
  size: number
  hash: string
  width: number
  height: number
  averageColor: string
  thumbHash: string
  focus: {x: number; y: number}
  fields: InferredFields
}

export namespace ImageLink {
  export const title = Entry.title
  export const src = MediaFile.location
  export const extension = MediaFile.extension
  export const size = MediaFile.size
  export const hash = MediaFile.hash
  export const width = MediaFile.width
  export const height = MediaFile.height
  export const averageColor = MediaFile.averageColor
  export const thumbHash = MediaFile.thumbHash
  export const focus = MediaFile.focus
}

export interface ImageField<Fields = undefined>
  extends LinkField<
    EntryReference & InferStoredValue<Fields>,
    ImageLink<Type.Infer<Fields>>
  > {}

const imageCondition = Entry.type
  .is('MediaFile')
  .and(MediaFile.extension.isIn(imageExtensions))

function imagePicker<Fields>(
  multiple: boolean,
  options: Omit<EntryPickerOptions<Fields>, 'hint' | 'selection'>
) {
  return entryPicker<EntryReference, Fields>({
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
    selection: ImageLink
  })
}

export interface ImageOptions<Fields>
  extends LinkFieldOptions<EntryReference & InferStoredValue<Fields>>,
    Omit<EntryPickerOptions<Fields>, 'label' | 'hint' | 'selection'> {}

export function image<Fields = undefined>(
  label: Label,
  options: WithoutLabel<ImageOptions<Fields>> = {}
): ImageField<Fields> {
  return createLink<
    EntryReference & InferStoredValue<Fields>,
    ImageLink<Type.Infer<Fields>>
  >(label, {
    ...options,
    pickers: {image: imagePicker(false, options)}
  })
}

export interface ImagesField<Fields = undefined>
  extends LinksField<
    EntryReference & ListRow & InferStoredValue<Fields>,
    ImageLink<Type.Infer<Fields>>
  > {}

export namespace image {
  export interface ImagesOptions<Fields>
    extends LinkFieldOptions<
        Array<EntryReference & ListRow & InferStoredValue<Fields>>
      >,
      Omit<EntryPickerOptions<Fields>, 'label' | 'hint' | 'selection'> {}

  export function multiple<Fields = undefined>(
    label: Label,
    options: WithoutLabel<ImagesOptions<Fields>> = {}
  ): ImagesField<Fields> {
    return createLinks<
      EntryReference & ListRow & InferStoredValue<Fields>,
      ImageLink<Type.Infer<Fields>>
    >(label, {
      ...options,
      pickers: {image: imagePicker(true, options)}
    })
  }
}
