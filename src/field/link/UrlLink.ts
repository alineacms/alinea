import type {WithoutLabel} from 'alinea/core/Field'
import type {InferStoredValue} from 'alinea/core/Infer'
import type {Label} from 'alinea/core/Label'
import type {Type} from 'alinea/core/Type'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {
  type LinkFieldOptions,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {type UrlPickerOptions, type UrlReference, urlPicker} from 'alinea/picker/url'

export interface UrlLink<InferredFields = undefined> extends UrlReference {
  href: string
  title: string
  target: string
  fields: InferredFields
}

export namespace UrlLink {
  /*export const title = 'title'
  export const href = 'href'
  export const target = 'target'*/
}

export interface UrlOptions<Fields>
  extends LinkFieldOptions<UrlReference & InferStoredValue<Fields>>,
    UrlPickerOptions<Fields> {}

export function url<Fields>(
  label: Label,
  options: WithoutLabel<UrlOptions<Fields>> = {}
) {
  return createLink<
    UrlReference & InferStoredValue<Fields>,
    UrlLink<Type.Infer<Fields>>
  >(label, {
    ...options,
    pickers: {url: urlPicker(options)}
  })
}

export namespace url {
  type UrlRows<Fields> = UrlLink<Type.Infer<Fields>> & ListRow

  export interface UrlOptions<Fields>
    extends LinkFieldOptions<
        Array<UrlReference & ListRow & InferStoredValue<Fields>>
      >,
      UrlPickerOptions<Fields> {}

  export function multiple<Fields>(
    label: Label,
    options: WithoutLabel<UrlOptions<Fields>> = {}
  ) {
    return createLinks<
      UrlReference & ListRow & InferStoredValue<Fields>,
      UrlRows<Fields>
    >(label, {
      ...options,
      pickers: {url: urlPicker(options)}
    })
  }
}
