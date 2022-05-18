import {Label} from '@alinea/core/Label'
import {createLink, LinkData, LinkOptions} from './LinkField'
export * from './LinkField'

/** Create a link field configuration */
export function link<T = {}, Q = LinkData & T>(
  label: Label,
  options: LinkOptions<T, Q>
) {
  return createLink(label, {...options, multiple: false})
}

/** Create a link field which accepts multiple inputs */
export namespace link {
  export function multiple<T = {}, Q = Array<LinkData & T>>(
    label: Label,
    options: LinkOptions<T, Q>
  ) {
    return createLink(label, {...options, multiple: true})
  }

  export function image<T = {}, Q = LinkData.Image & T>(
    label: Label,
    options: LinkOptions<T, Q>
  ) {
    return createLink(label, {...options, type: 'image', multiple: false})
  }

  export namespace image {
    export function multiple<T = {}, Q = Array<LinkData.Image & T>>(
      label: Label,
      options: LinkOptions<T, Q>
    ) {
      return createLink(label, {...options, type: 'image', multiple: true})
    }
  }
}
