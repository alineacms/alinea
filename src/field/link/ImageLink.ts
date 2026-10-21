import {Entry} from '#/core/Entry.js'
import type {WithoutLabel} from '#/core/Field.js'
import type {InferStoredValue} from '#/core/Infer.js'
import type {Label} from '#/core/Label.js'
import type {Type} from '#/core/Type.js'
import {FileData} from '#/core/media/MediaTypes.js'
import type {ListRow} from '#/core/ListRow.js'
import {
  type LinkField,
  type LinkFieldOptions,
  type LinksField,
  createLink,
  createLinks,
  type LinkFields
} from '#/field/link/LinkField.js'
import {type EntryPickerOptions, entryPicker} from '#/picker/entry.js'
import type {EntryReference} from '#/picker/entry/EntryReference.js'

export interface ImageLink<InferredFields = {}> extends EntryReference {
  title: string
  alt?: string
  /** Public url of the image file, versioned by its hash */
  src: string
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
  export const alt = FileData.alt
  export const src = Entry.url
  export const extension = FileData.extension
  export const size = FileData.size
  export const hash = FileData.hash
  export const width = FileData.width
  export const height = FileData.height
  export const averageColor = FileData.averageColor
  export const thumbHash = FileData.thumbHash
  export const focus = FileData.focus
}

export interface ImageField<Fields = undefined> extends LinkField<
  EntryReference & InferStoredValue<Fields>,
  ImageLink<LinkFields<Type.Infer<Fields>>>
> {}

function imagePicker<Fields>(
  multiple: boolean,
  options: Omit<EntryPickerOptions<Fields>, 'selection'>
) {
  return entryPicker<EntryReference, Fields>({
    ...options,
    max: multiple ? undefined : 1,
    label: 'Image',
    title: multiple ? 'Select images' : 'Select an image',
    // The images of every file type, see Config.fileCondition
    files: 'image',
    defaultView: 'thumb',
    selection: {
      ...ImageLink,
      root: Entry.root,
      workspace: Entry.workspace
    }
  })
}

export interface ImageOptions<Fields>
  extends
    LinkFieldOptions<EntryReference & InferStoredValue<Fields>>,
    Omit<EntryPickerOptions<Fields>, 'label' | 'selection'> {}

export function image<Fields = undefined>(
  label: Label,
  options: WithoutLabel<ImageOptions<Fields>> = {}
): ImageField<Fields> {
  return createLink<
    EntryReference & InferStoredValue<Fields>,
    ImageLink<LinkFields<Type.Infer<Fields>>>
  >(label, {
    ...options,
    pickers: {image: imagePicker(false, options)}
  })
}

export interface ImagesField<Fields = undefined> extends LinksField<
  EntryReference & ListRow & InferStoredValue<Fields>,
  ImageLink<LinkFields<Type.Infer<Fields>>>
> {}

export interface ImagesOptions<Fields>
  extends
    LinkFieldOptions<
      Array<EntryReference & ListRow & InferStoredValue<Fields>>
    >,
    Omit<EntryPickerOptions<Fields>, 'label' | 'selection'> {}

export namespace image {
  export function multiple<Fields = undefined>(
    label: Label,
    options: WithoutLabel<ImagesOptions<Fields>> = {}
  ): ImagesField<Fields> {
    return createLinks<
      EntryReference & ListRow & InferStoredValue<Fields>,
      ImageLink<LinkFields<Type.Infer<Fields>>>
    >(label, {
      ...options,
      pickers: {image: imagePicker(true, options)}
    })
  }
}
