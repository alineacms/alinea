import type {WithoutLabel} from 'alinea/core/Field'
import {Label} from 'alinea/core/Label'
import {Type} from 'alinea/core/Type'
import type {ListRow} from 'alinea/core/shape/ListShape'
import {
  LinkFieldOptions,
  createLink,
  createLinks
} from 'alinea/field/link/LinkField'
import {UrlPickerOptions, UrlReference, urlPicker} from 'alinea/picker/url'

type Link<Fields> = UrlReference & Type.Infer<Fields>

export interface UrlOptions<Fields>
  extends LinkFieldOptions<Link<Fields>>,
    UrlPickerOptions<Fields> {}

export function url<Fields>(
  label: Label,
  options: WithoutLabel<UrlOptions<Fields>> = {}
) {
  return createLink<Link<Fields>>(label, {
    ...options,
    pickers: {url: urlPicker(options)}
  })
}

export namespace url {
  type Link<Fields> = UrlReference & Type.Infer<Fields> & ListRow

  export interface UrlOptions<Fields>
    extends LinkFieldOptions<Array<Link<Fields>>>,
      UrlPickerOptions<Fields> {}

  export function multiple<Fields>(
    label: Label,
    options: WithoutLabel<UrlOptions<Fields>> = {}
  ) {
    return createLinks<Link<Fields>>(label, {
      ...options,
      pickers: {url: urlPicker(options)}
    })
  }
}
