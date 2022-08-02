import {Entry, Field, Label, Media} from '@alinea/core'
import {entryPicker} from '@alinea/picker.entry'
import {urlPicker} from '@alinea/picker.url'
import {createLink, LinkData, LinkField, LinkOptions} from './LinkField'
import {LinkInput} from './LinkInput'
export * from './LinkField'
export * from './LinkInput'

const createLinkInput = Field.withView(createLink, LinkInput)

const imageCondition = Entry.type
  .is(Media.Type.File)
  .and(Entry.get('extension').isIn(Media.imageExtensions))

export function imagePicker(multiple: boolean) {
  return entryPicker({
    max: multiple ? undefined : 1,
    label: 'Image',
    title: 'Select an image' + (multiple ? 's' : ''),
    condition: imageCondition,
    showUploader: true,
    defaultView: 'thumb'
  })
}

/** Create a link field configuration */
export function link<T = {}, Q = LinkData & T>(
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
  return createLinkInput(label, {...options, pickers, multiple: false})
}

/** Create a link field which accepts multiple inputs */
export namespace link {
  export function multiple<T = {}, Q = Array<LinkData & T>>(
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
        ? [entryPicker({max: 1}), urlPicker()]
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
    return createLinkInput(label, {...options, pickers, multiple: true})
  }

  export function entry<T = {}, Q = Array<LinkData.Entry & T>>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    return createLinkInput(label, {
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

  export namespace entry {
    export function multiple<T = {}, Q = Array<LinkData.Entry & T>>(
      label: Label,
      options: LinkOptions<T, Q> = {}
    ): LinkField<T, Q> {
      return createLinkInput(label, {
        ...options,
        pickers: [entryPicker({title: 'Select pages'})],
        multiple: true
      })
    }
  }

  export function image<T = {}, Q = Array<LinkData.Image & T>>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    return createLinkInput(label, {
      ...options,
      pickers: [imagePicker(false)],
      multiple: false
    })
  }

  export namespace image {
    export function multiple<T = {}, Q = Array<LinkData.Image & T>>(
      label: Label,
      options: LinkOptions<T, Q> = {}
    ): LinkField<T, Q> {
      return createLinkInput(label, {
        ...options,
        pickers: [imagePicker(true)],
        multiple: true
      })
    }
  }
}
