import {Entry} from 'alinea/core/Entry'
import type {WithoutLabel} from 'alinea/core/Field'
import type {InferStoredValue} from 'alinea/core/Infer'
import type {Label} from 'alinea/core/Label'
import type {Type} from 'alinea/core/Type'
import {imageExtensions} from 'alinea/core/media/IsImage'
import {MediaFile} from 'alinea/core/media/MediaTypes'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {
  type LinkField,
  type LinkFieldOptions,
  type LinksField,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {type EntryPickerOptions, entryPicker} from 'alinea/picker/entry'
import type {EntryReference} from 'alinea/picker/entry/EntryReference'

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

const imageCondition = {
  _type: 'MediaFile',
  extension: {
    in: [
      ...imageExtensions,
      ...imageExtensions.map(e => e.toUpperCase()) //Fix for historic files with case-insensitive extensions
    ]
  }
}

function imagePicker<Fields>(
  multiple: boolean,
  options: Omit<EntryPickerOptions<Fields>, 'selection'>
) {
  return entryPicker<EntryReference, Fields>({
    ...options,
    max: multiple ? undefined : 1,
    label: 'Image',
    title: multiple ? 'Select images' : 'Select an image',
    condition: imageCondition,

    showMedia: true,
    defaultView: 'thumb',
    selection: {
      ...ImageLink,
      filePath: Entry.filePath,
      previewUrl: MediaFile.previewUrl
    }
  })
}

export interface ImageOptions<Fields>
  extends LinkFieldOptions<EntryReference & InferStoredValue<Fields>>,
    Omit<EntryPickerOptions<Fields>, 'label' | 'selection'> {}

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
      Omit<EntryPickerOptions<Fields>, 'label' | 'selection'> {}

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
