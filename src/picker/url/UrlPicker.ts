import {Hint} from 'alinea/core/Hint'
import {Reference} from 'alinea/core/Reference'
import {Shape} from 'alinea/core/Shape'
import {Type} from 'alinea/core/Type'
import {Picker} from 'alinea/editor/Picker'

export interface UrlReference extends Reference {
  type: 'url'
  url: string
  description: string
  target: string
}

export namespace UrlReference {
  export function isUrl(value: any): value is UrlReference {
    return value && value.type === 'url'
  }
}

export interface UrlPickerOptions<T> {
  fields?: Type<T>
}

export function urlPicker<Fields>(
  options: UrlPickerOptions<Fields>
): Picker<UrlReference & Fields> {
  const extra = options.fields && Type.shape(options.fields)
  return {
    shape: Shape.Record('Url', {
      url: Shape.Scalar('Url'),
      description: Shape.Scalar('Description'),
      target: Shape.Scalar('Target')
    }).concat(extra),
    hint: Hint.Extern({name: 'UrlReference', package: 'alinea/picker/url'}),
    label: 'External website',
    handlesMultiple: false,
    fields: options.fields,
    options /*,
    select(row) {
      return row.fields
    }*/
  }
}
