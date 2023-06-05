import {Label, Media} from 'alinea/core'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {
  LinkField,
  LinkFieldOptions,
  LinksField,
  createLink,
  createLinks
} from 'alinea/input/link2/LinkField'
import {
  EntryPickerOptions,
  EntryReference,
  FileReference,
  ImageReference,
  entryPicker
} from 'alinea/picker/entry'
import {UrlPickerOptions, UrlReference, urlPicker} from 'alinea/picker/url'

const imageCondition = MediaFile.extension.isIn(Media.imageExtensions)

export function imagePicker(multiple: boolean) {
  return entryPicker({
    max: multiple ? undefined : 1,
    label: 'Image',
    title: multiple ? 'Select images' : 'Select an image',
    condition: imageCondition,
    showUploader: true,
    defaultView: 'thumb'
  }) as any
}

const fileCondition = MediaFile.extension.isNotIn(Media.imageExtensions)

export function filePicker(multiple: boolean) {
  return entryPicker({
    max: multiple ? undefined : 1,
    label: 'File',
    title: multiple ? 'Select files' : 'Select a file',
    condition: fileCondition,
    showUploader: true,
    defaultView: 'thumb'
  }) as any
}

export namespace link {
  export interface EntryOptions<Fields>
    extends LinkFieldOptions,
      EntryPickerOptions<Fields> {}

  export function entry<Fields>(
    label: Label,
    options: EntryOptions<Fields>
  ): LinkField<EntryReference & Fields> {
    return createLink(label, {
      ...options,
      pickers: {
        entry: entryPicker({
          ...options,
          title: 'Select a page',
          max: 1
        }) as any
      }
    }) as any
  }
}

export namespace link.entry {
  export function multiple<Fields>(
    label: Label,
    options: EntryOptions<Fields>
  ): LinksField<EntryReference & Fields> {
    return createLinks(label, {
      ...options,
      pickers: {
        entry: entryPicker({
          ...options,
          title: 'Select a page'
        }) as any
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
    options: UrlOptions<Fields>
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
    options: UrlOptions<Fields>
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
      EntryPickerOptions<Fields> {}

  export function image<Fields>(
    label: Label,
    options: ImageOptions<Fields>
  ): LinkField<ImageReference & Fields> {
    return createLink(label, {
      ...options,
      pickers: {entry: imagePicker(false)}
    })
  }
}

export namespace link.image {
  export function multiple<Fields>(
    label: Label,
    options: ImageOptions<Fields>
  ): LinksField<ImageReference & Fields> {
    return createLinks(label, {
      ...options,
      pickers: {entry: imagePicker(true)}
    })
  }
}

export namespace link {
  export interface FileOptions<Fields>
    extends LinkFieldOptions,
      EntryPickerOptions<Fields> {}

  export function file<Fields>(
    label: Label,
    options: FileOptions<Fields>
  ): LinkField<FileReference & Fields> {
    return createLink(label, {
      ...options,
      pickers: {file: filePicker(false)}
    })
  }
}

export namespace link.file {
  export function multiple<Fields>(
    label: Label,
    options: FileOptions<Fields>
  ): LinksField<FileReference & Fields> {
    return createLinks(label, {
      ...options,
      pickers: {file: filePicker(true)}
    })
  }
}
