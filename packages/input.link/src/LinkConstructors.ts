import {Entry, Label, Media} from '@alinea/core'
import {entryPicker} from '@alinea/picker.entry'
import {urlPicker} from '@alinea/picker.url'
import {LinkData, LinkField, LinkOptions} from './LinkField'

interface CreateLink {
  <T, Q>(label: Label, options?: LinkOptions<T, Q>): LinkField<T, Q>
}

const imageCondition = Entry.type
  .is(Media.Type.File)
  .and(Entry.get('extension').isIn(Media.imageExtensions))

function imagePicker(multiple: boolean) {
  return entryPicker({
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

function filePicker(multiple: boolean) {
  return entryPicker({
    max: multiple ? undefined : 1,
    label: 'File',
    title: multiple ? 'Select files' : 'Select a file',
    condition: fileCondition,
    showUploader: true,
    defaultView: 'thumb'
  })
}

export function linkConstructors(createLink: CreateLink) {
  /** Create a link field configuration */
  function link<T = {}, Q = LinkData & T>(
    label: Label,
    options: LinkOptions<T, Q>
  ): LinkField<T, Q> {
    const types = Array.isArray(options.type)
      ? options.type
      : options.type
      ? [options.type]
      : []
    const pickers =
      types.length === 0
        ? [entryPicker({max: 1}), urlPicker()]
        : types.map(type => {
            switch (type) {
              case 'entry':
                return entryPicker({
                  title: 'Select a page',
                  max: 1
                })
              case 'external':
                return urlPicker()
              case 'image':
                return imagePicker(false)
              case 'file':
                throw 'todo'
            }
          })
    return createLink(label, {...options, pickers, multiple: false})
  }

  function multiple<T = {}, Q = Array<LinkData & T>>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    const types = Array.isArray(options.type)
      ? options.type
      : options.type
      ? [options.type]
      : []
    const pickers =
      types.length === 0
        ? [entryPicker({}), urlPicker()]
        : types.map(type => {
            switch (type) {
              case 'entry':
                return entryPicker({title: 'Select pages'})
              case 'external':
                return urlPicker()
              case 'image':
                return imagePicker(true)
              case 'file':
                throw 'todo'
            }
          })
    return createLink(label, {...options, pickers, multiple: true})
  }

  function entry<T = {}, Q = LinkData.Entry & T>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    return createLink(label, {
      ...options,
      pickers: [
        entryPicker({
          title: 'Select a page',
          max: 1
        })
      ],
      multiple: false
    })
  }

  function multipleEntries<T = {}, Q = Array<LinkData.Entry & T>>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    return createLink(label, {
      ...options,
      pickers: [entryPicker({title: 'Select pages'})],
      multiple: true
    })
  }

  function image<T = {}, Q = LinkData.Image & T>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    return createLink(label, {
      ...options,
      pickers: [imagePicker(false)],
      multiple: false
    })
  }

  function multipleImages<T = {}, Q = Array<LinkData.Image & T>>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    return createLink(label, {
      ...options,
      pickers: [imagePicker(true)],
      multiple: true
    })
  }

  function file<T = {}, Q = LinkData.File & T>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    return createLink(label, {
      ...options,
      pickers: [filePicker(false)],
      multiple: false
    })
  }

  function multipleFiles<T = {}, Q = Array<LinkData.File & T>>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    return createLink(label, {
      ...options,
      pickers: [filePicker(true)],
      multiple: true
    })
  }

  return Object.assign(link, {
    multiple,
    entry: Object.assign(entry, {multiple: multipleEntries}),
    image: Object.assign(image, {multiple: multipleImages}),
    file: Object.assign(file, {multiple: multipleFiles})
  })
}
