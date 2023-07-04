import {Media} from 'alinea/backend/Media'
import {Entry} from 'alinea/core/Entry'
import {Hint} from 'alinea/core/Hint'
import {Label} from 'alinea/core/Label'
import {Type} from 'alinea/core/Type'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {
  LinkField,
  LinkFieldOptions,
  LinksField,
  createLink,
  createLinks
} from 'alinea/input/link/LinkField'
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
  .and(MediaFile.extension.isIn(Media.imageExtensions))

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
    condition: imageCondition,
    showUploader: true,
    defaultView: 'thumb',
    selection: imageFields
  })
}

const fileCondition = Entry.type
  .is('MediaFile')
  .and(MediaFile.extension.isNotIn(Media.imageExtensions))

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
    condition: fileCondition,
    showUploader: true,
    defaultView: 'thumb',
    selection: fileFields
  })
}

type LinkData<Fields> =
  | (EntryReference & Type.Infer<Fields>)
  | (UrlReference & Type.Infer<Fields>)

export interface LinkOptions<Fields> extends LinkFieldOptions {
  fields?: Type<Fields>
}

export function link<Fields>(label: Label, options: LinkOptions<Fields>) {
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
      url: urlPicker<Fields>(options)
    }
  })
}

export namespace link {
  export function multiple<Fields>(label: Label, options: LinkOptions<Fields>) {
    return createLinks<
      | (EntryReference & Type.Infer<Fields>)
      | (UrlReference & Type.Infer<Fields>)
    >(label, {
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
        url: urlPicker<Fields>(options)
      }
    })
  }
}

export namespace link {
  export interface EntryOptions<Fields>
    extends LinkFieldOptions,
      Omit<EntryPickerOptions<Fields>, 'hint' | 'selection'> {}

  export function entry<Fields>(
    label: Label,
    options: EntryOptions<Fields>
  ): LinkField<EntryReference & Type.Infer<Fields>> {
    return createLink(label, {
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
        })
      }
    })
  }
}

export namespace link.entry {
  export function multiple<Fields>(
    label: Label,
    options: EntryOptions<Fields> = {}
  ): LinksField<EntryReference & Type.Infer<Fields>> {
    return createLinks(label, {
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
        })
      }
    })
  }
}

export namespace link {
  export interface UrlOptions<Fields>
    extends LinkFieldOptions,
      UrlPickerOptions<Fields> {}

  export function url<Fields>(
    label: Label,
    options: UrlOptions<Fields> = {}
  ): LinkField<UrlReference & Type.Infer<Fields>> {
    return createLink(label, {
      ...options,
      pickers: {url: urlPicker(options)}
    })
  }
}

export namespace link.url {
  export function multiple<Fields>(
    label: Label,
    options: UrlOptions<Fields> = {}
  ): LinksField<UrlReference & Type.Infer<Fields>> {
    return createLinks(label, {
      ...options,
      pickers: {url: urlPicker(options)}
    })
  }
}

export namespace link {
  export interface ImageOptions<Fields>
    extends LinkFieldOptions,
      Omit<EntryPickerOptions<Fields>, 'hint' | 'selection'> {}

  export function image<Fields = unknown>(
    label: Label,
    options: ImageOptions<Fields> = {}
  ): LinkField<ImageReference & Type.Infer<Fields>> {
    return createLink(label, {
      ...options,
      pickers: {entry: imagePicker(false, options)}
    })
  }
}

export namespace link.image {
  export function multiple<Fields>(
    label: Label,
    options: ImageOptions<Fields> = {}
  ): LinksField<ImageReference & Type.Infer<Fields>> {
    return createLinks(label, {
      ...options,
      pickers: {entry: imagePicker(true, options)}
    })
  }
}

export namespace link {
  export interface FileOptions<Fields>
    extends LinkFieldOptions,
      Omit<EntryPickerOptions<Fields>, 'hint' | 'selection'> {}

  export function file<Fields>(
    label: Label,
    options: FileOptions<Fields> = {}
  ): LinkField<FileReference & Type.Infer<Fields>> {
    return createLink(label, {
      ...options,
      pickers: {file: filePicker(false, options)}
    })
  }
}

export namespace link.file {
  export function multiple<Fields>(
    label: Label,
    options: FileOptions<Fields> = {}
  ): LinksField<FileReference & Type.Infer<Fields>> {
    return createLinks(label, {
      ...options,
      pickers: {file: filePicker(true, options)}
    })
  }
}
