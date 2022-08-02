import {Entry, Field, Label, Media} from '@alinea/core'
import {entryPicker} from '@alinea/picker.entry'
import {createLink, LinkData, LinkField, LinkOptions} from './LinkField'
import {LinkInput} from './LinkInput'
export * from './LinkField'
export * from './LinkInput'

const createLinkInput = Field.withView(createLink, LinkInput)

/** Create a link field configuration */
export function link<T = {}, Q = LinkData & T>(
  label: Label,
  options: LinkOptions<T, Q>
): LinkField<T, Q> {
  return createLinkInput(label, {...options, multiple: false})
}

/** Create a link field which accepts multiple inputs */
export namespace link {
  export function multiple<T = {}, Q = Array<LinkData & T>>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    return createLinkInput(label, {...options, multiple: true})
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

  const imageCondition = Entry.type
    .is(Media.Type.File)
    .and(Entry.get('extension').isIn(Media.imageExtensions))

  export function image<T = {}, Q = Array<LinkData.Image & T>>(
    label: Label,
    options: LinkOptions<T, Q> = {}
  ): LinkField<T, Q> {
    return createLinkInput(label, {
      ...options,
      pickers: [
        entryPicker({
          max: 1,
          label: 'Image',
          title: 'Select an image',
          condition: imageCondition,
          showUploader: true
        })
      ],
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
        pickers: [
          entryPicker({
            label: 'Images',
            title: 'Select images',
            condition: imageCondition,
            showUploader: true
          })
        ],
        multiple: true
      })
    }
  }
}
