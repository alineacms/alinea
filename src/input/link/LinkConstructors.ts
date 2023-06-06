import {Hint, Label, Media, Type} from 'alinea/core'
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
  EntryReference,
  FileReference,
  ImageReference,
  entryPicker
} from 'alinea/picker/entry'
import {UrlPickerOptions, UrlReference, urlPicker} from 'alinea/picker/url'

const imageCondition = MediaFile.extension.isIn(Media.imageExtensions)

export function imagePicker<Fields>(
  multiple: boolean,
  options: Omit<EntryPickerOptions<Fields>, 'hint'>
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
    defaultView: 'thumb'
  })
}

const fileCondition = MediaFile.extension.isNotIn(Media.imageExtensions)

export function filePicker<Fields>(
  multiple: boolean,
  options: Omit<EntryPickerOptions<Fields>, 'hint'>
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
    defaultView: 'thumb'
  })
}

export interface LinkOptions<Fields> extends LinkFieldOptions {
  fields?: Type<Fields>
}

export function link<Fields>(label: Label, options: LinkOptions<Fields>) {
  return createLink<(EntryReference & Fields) | (UrlReference & Fields)>(
    label,
    {
      ...options,
      pickers: {
        entry: entryPicker<EntryReference, Fields>({
          ...options,
          hint: Hint.Extern({
            name: 'EntryReference',
            package: 'alinea/picker/entry'
          }),
          title: 'Select a page',
          max: 1
        }),
        url: urlPicker<Fields>(options)
      }
    }
  )
}

export namespace link {
  export function multiple<Fields>(label: Label, options: LinkOptions<Fields>) {
    return createLinks<(EntryReference & Fields) | (UrlReference & Fields)>(
      label,
      {
        ...options,
        pickers: {
          entry: entryPicker<EntryReference, Fields>({
            ...options,
            hint: Hint.Extern({
              name: 'EntryReference',
              package: 'alinea/picker/entry'
            }),
            title: 'Select a page',
            max: 1
          }),
          url: urlPicker<Fields>(options)
        }
      }
    )
  }
}

export namespace link {
  export interface EntryOptions<Fields>
    extends LinkFieldOptions,
      Omit<EntryPickerOptions<Fields>, 'hint'> {}

  export function entry<Fields>(
    label: Label,
    options: EntryOptions<Fields>
  ): LinkField<EntryReference & Fields> {
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
          max: 1
        })
      }
    })
  }
}

export namespace link.entry {
  export function multiple<Fields>(
    label: Label,
    options: EntryOptions<Fields> = {}
  ): LinksField<EntryReference & Fields> {
    return createLinks(label, {
      ...options,
      pickers: {
        entry: entryPicker<EntryReference, Fields>({
          ...options,
          hint: Hint.Extern({
            name: 'EntryReference',
            package: 'alinea/picker/entry'
          }),
          title: 'Select a page'
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
  ): LinkField<UrlReference & Fields> {
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
  ): LinksField<UrlReference & Fields> {
    return createLinks(label, {
      ...options,
      pickers: {url: urlPicker(options)}
    })
  }
}

export namespace link {
  export interface ImageOptions<Fields>
    extends LinkFieldOptions,
      Omit<EntryPickerOptions<Fields>, 'hint'> {}

  export function image<Fields>(
    label: Label,
    options: ImageOptions<Fields> = {}
  ): LinkField<ImageReference & Fields> {
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
  ): LinksField<ImageReference & Fields> {
    return createLinks(label, {
      ...options,
      pickers: {entry: imagePicker(true, options)}
    })
  }
}

export namespace link {
  export interface FileOptions<Fields>
    extends LinkFieldOptions,
      Omit<EntryPickerOptions<Fields>, 'hint'> {}

  export function file<Fields>(
    label: Label,
    options: FileOptions<Fields> = {}
  ): LinkField<FileReference & Fields> {
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
  ): LinksField<FileReference & Fields> {
    return createLinks(label, {
      ...options,
      pickers: {file: filePicker(true, options)}
    })
  }
}
