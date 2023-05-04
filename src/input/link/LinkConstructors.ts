import {Entry, Label, Media} from 'alinea/core'
import {
  EntryReference,
  FileReference,
  ImageReference,
  entryPicker
} from 'alinea/picker/entry'
import {UrlReference, urlPicker} from 'alinea/picker/url'
import {LinkField, LinkOptions} from './LinkField.js'

interface CreateLink {
  <T>(label: Label, options?: LinkOptions<T>): LinkField<T>
}

const imageCondition = Entry.type
  .is(Media.Type.File)
  .and(Entry.get('extension').isIn(Media.imageExtensions))

export function imagePicker(multiple: boolean) {
  return entryPicker({
    type: 'image',
    max: multiple ? undefined : 1,
    label: 'Image',
    title: multiple ? 'Select images' : 'Select an image',
    condition: imageCondition,
    showUploader: true,
    defaultView: 'thumb'
  })
}

const fileCondition = Entry.type
  .is(Media.Type.File)
  .and(Entry.get('extension').isNotIn(Media.imageExtensions))

export function filePicker(multiple: boolean) {
  return entryPicker({
    type: 'file',
    max: multiple ? undefined : 1,
    label: 'File',
    title: multiple ? 'Select files' : 'Select a file',
    condition: fileCondition,
    showUploader: true,
    defaultView: 'thumb'
  })
}

type LinkData = EntryReference | UrlReference | FileReference

export function linkConstructors(createLink: CreateLink) {
  /** Create a link field configuration */
  function link<T = {}, Q = LinkData & T>(
    label: Label,
    options: LinkOptions<T> = {}
  ): LinkField<T> {
    const pickerOptions = {fields: options.fields, condition: options.condition}
    const types = Array.isArray(options.type)
      ? options.type
      : options.type
      ? [options.type]
      : []
    const pickers =
      types.length === 0
        ? [
            entryPicker({
              ...pickerOptions,
              type: 'entry',
              title: 'Select a page',
              max: 1
            }),
            urlPicker(pickerOptions),
            filePicker(false)
          ]
        : types.map(type => {
            switch (type) {
              case 'entry':
                return entryPicker({
                  type: 'entry',
                  title: 'Select a page',
                  max: 1,
                  ...pickerOptions
                })
              case 'external':
                return urlPicker(pickerOptions)
              case 'image':
                return imagePicker(false)
              case 'file':
                return filePicker(false)
            }
          })
    return createLink(label, {...options, pickers, multiple: false})
  }

  function multiple<T = {}, Q = Array<LinkData & T>>(
    label: Label,
    options: LinkOptions<T> = {}
  ): LinkField<T> {
    const pickerOptions = {fields: options.fields, condition: options.condition}
    const types = Array.isArray(options.type)
      ? options.type
      : options.type
      ? [options.type]
      : []
    const pickers =
      types.length === 0
        ? [
            entryPicker({type: 'entry', ...pickerOptions}),
            urlPicker(pickerOptions)
          ]
        : types.map(type => {
            switch (type) {
              case 'entry':
                return entryPicker({
                  type: 'entry',
                  ...pickerOptions,
                  title: 'Select pages'
                })
              case 'external':
                return urlPicker(pickerOptions)
              case 'image':
                return imagePicker(true)
              case 'file':
                throw 'todo'
            }
          })
    return createLink(label, {...options, pickers, multiple: true})
  }

  function entry<T = {}, Q = EntryReference & T>(
    label: Label,
    options: LinkOptions<T> = {}
  ): LinkField<T> {
    return createLink(label, {
      ...options,
      pickers: [
        entryPicker({
          ...options,
          type: 'entry',
          title: 'Select a page',
          max: 1
        })
      ],
      multiple: false
    })
  }

  function multipleEntries<T = {}, Q = Array<EntryReference & T>>(
    label: Label,
    options: LinkOptions<T> = {}
  ): LinkField<T> {
    return createLink(label, {
      ...options,
      pickers: [
        entryPicker({
          ...options,
          type: 'entry',
          title: 'Select pages'
        })
      ],
      multiple: true
    })
  }

  function url<T = {}, Q = UrlReference & T>(
    label: Label,
    options: LinkOptions<T> = {}
  ): LinkField<T> {
    return createLink(label, {
      ...options,
      pickers: [
        urlPicker({
          ...options
        })
      ],
      multiple: false
    })
  }

  function multipleUrls<T = {}, Q = Array<UrlReference & T>>(
    label: Label,
    options: LinkOptions<T> = {}
  ): LinkField<T> {
    return createLink(label, {
      ...options,
      pickers: [urlPicker({...options})],
      multiple: true
    })
  }

  function image<T = {}, Q = ImageReference & T>(
    label: Label,
    options: LinkOptions<T> = {}
  ): LinkField<T> {
    return createLink(label, {
      ...options,
      pickers: [imagePicker(false)],
      multiple: false
    })
  }

  function multipleImages<T = {}, Q = Array<ImageReference & T>>(
    label: Label,
    options: LinkOptions<T> = {}
  ): LinkField<T> {
    return createLink(label, {
      ...options,
      pickers: [imagePicker(true)],
      multiple: true
    })
  }

  function file<T = {}, Q = FileReference & T>(
    label: Label,
    options: LinkOptions<T> = {}
  ): LinkField<T> {
    return createLink(label, {
      ...options,
      pickers: [filePicker(false)],
      multiple: false
    })
  }

  function multipleFiles<T = {}, Q = Array<FileReference & T>>(
    label: Label,
    options: LinkOptions<T> = {}
  ): LinkField<T> {
    return createLink(label, {
      ...options,
      pickers: [filePicker(true)],
      multiple: true
    })
  }

  return Object.assign(link, {
    multiple,
    entry: Object.assign(entry, {multiple: multipleEntries}),
    url: Object.assign(url, {multiple: multipleUrls}),
    image: Object.assign(image, {multiple: multipleImages}),
    file: Object.assign(file, {multiple: multipleFiles})
  })
}
