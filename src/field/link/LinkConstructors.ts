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
import {
  EntryPickerOptions,
  entryFields,
  entryPicker,
  fileFields,
  imageFields
} from 'alinea/picker/entry'
import {
  EntryReference,
  FileReference,
  ImageReference
} from 'alinea/picker/entry/EntryReference'
import {UrlPickerOptions, UrlReference, urlPicker} from 'alinea/picker/url'

const imageCondition = Entry.type
  .is('MediaFile')
  .and(MediaFile.extension.isIn(imageExtensions))

export function imagePicker<Fields>(
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

type LinkData<Fields> =
  | (EntryReference & Type.Infer<Fields>)
  | (UrlReference & Type.Infer<Fields>)
  | (FileReference & Type.Infer<Fields>)

export interface LinkOptions<Definition, Row> extends LinkFieldOptions<Row> {
  fields?: Definition | Type<Definition>
}

export function link<Fields>(
  label: Label,
  options: WithoutLabel<LinkOptions<Fields, LinkData<Fields>>> = {}
) {
  return createLink<LinkData<Fields>>(label, {
    ...options,
    pickers: {
      entry: entryPicker<EntryReference, Fields>({
        ...options,
        hint: Hint.Extern({
          name: 'EntryReference',
          package: 'alinea/picker/entry'
        }),
        title: 'Select a page',
        max: 1,
        selection: entryFields
      }),
      url: urlPicker<Fields>(options),
      file: filePicker(false, options)
    }
  })
}

export namespace link {
  type Link<Fields> =
    | (EntryReference & Type.Infer<Fields> & ListRow)
    | (UrlReference & Type.Infer<Fields> & ListRow)

  export function multiple<Fields>(
    label: Label,
    options: WithoutLabel<LinkOptions<Fields, Array<Link<Fields>>>> = {}
  ) {
    return createLinks<Link<Fields>>(label, {
      ...options,
      pickers: {
        entry: entryPicker<EntryReference, Fields>({
          ...options,
          hint: Hint.Extern({
            name: 'EntryReference',
            package: 'alinea/picker/entry'
          }),
          title: 'Select a page',
          selection: entryFields
        }),
        url: urlPicker<Fields>(options),
        file: filePicker(true, options)
      }
    })
  }
}

export namespace link {
  type Link<Fields> = EntryReference & Type.Infer<Fields>

  interface EntryOptions<Fields>
    extends LinkFieldOptions<Link<Fields>>,
      Omit<EntryPickerOptions<Fields>, 'label' | 'hint' | 'selection'> {}

  export function entry<Fields>(
    label: Label,
    options: WithoutLabel<EntryOptions<Fields>> = {}
  ) {
    return createLink<Link<Fields>>(label, {
      ...options,
      pickers: {
        entry: entryPicker<EntryReference, Fields>({
          ...options,
          withNavigation: !options.condition,
          hint: Hint.Extern({
            name: 'EntryReference',
            package: 'alinea/picker/entry'
          }),
          title: 'Select a page',
          max: 1,
          selection: entryFields
        })
      }
    } as any)
  }
}

export namespace link.entry {
  type Link<Fields> = EntryReference & Type.Infer<Fields> & ListRow

  interface EntryOptions<Fields>
    extends LinkFieldOptions<Array<Link<Fields>>>,
      Omit<EntryPickerOptions<Fields>, 'label' | 'hint' | 'selection'> {}

  export function multiple<Fields>(
    label: Label,
    options: WithoutLabel<EntryOptions<Fields>> = {}
  ) {
    return createLinks<Link<Fields>>(label, {
      ...options,
      pickers: {
        entry: entryPicker<EntryReference, Fields>({
          ...options,
          withNavigation: !options.condition,
          hint: Hint.Extern({
            name: 'EntryReference',
            package: 'alinea/picker/entry'
          }),
          title: 'Select a page',
          selection: entryFields
        })
      }
    })
  }
}

export namespace link {
  type Link<Fields> = UrlReference & Type.Infer<Fields>

  export interface UrlOptions<Fields>
    extends LinkFieldOptions<Link<Fields>>,
      UrlPickerOptions<Fields> {}

  export function url<Fields>(
    label: Label,
    options: WithoutLabel<UrlOptions<Fields>> = {}
  ) {
    return createLink<Link<Fields>>(label, {
      ...options,
      pickers: {url: urlPicker(options)}
    })
  }
}

export namespace link.url {
  type Link<Fields> = UrlReference & Type.Infer<Fields> & ListRow

  export interface UrlOptions<Fields>
    extends LinkFieldOptions<Array<Link<Fields>>>,
      UrlPickerOptions<Fields> {}

  export function multiple<Fields>(
    label: Label,
    options: WithoutLabel<UrlOptions<Fields>> = {}
  ) {
    return createLinks<Link<Fields>>(label, {
      ...options,
      pickers: {url: urlPicker(options)}
    })
  }
}

export namespace link {
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
}

export namespace link.image {
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

export namespace link {
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
}

export namespace link.file {
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
