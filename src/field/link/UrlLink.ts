import type {WithoutLabel} from '#/core/Field.js'
import type {InferStoredValue} from '#/core/Infer.js'
import type {Label} from '#/core/Label.js'
import type {Type} from '#/core/Type.js'
import type {ListRow} from '#/core/ListRow.js'
import {
  type LinkFieldOptions,
  createLink,
  createLinks
} from '#/field/link/LinkField.js'
import {type UrlPickerOptions, type UrlReference, urlPicker} from '#/picker/url.js'

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
