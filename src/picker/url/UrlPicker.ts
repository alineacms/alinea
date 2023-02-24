import {Hint} from 'alinea/core/Hint'
import {Reference} from 'alinea/core/Reference'
import {Shape} from 'alinea/core/Shape'
import {TypeConfig} from 'alinea/core/Type'
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
  fields?: TypeConfig<any, T>
}

export function urlPicker<T>(
  options: UrlPickerOptions<T>
): Picker<UrlReference> {
  const extra = options.fields?.shape
  return {
    type: 'url',
    shape: Shape.Record('Url', {
      url: Shape.Scalar('Url'),
      description: Shape.Scalar('Description'),
      target: Shape.Scalar('Target')
    }).concat(extra),
    hint: Hint.Extern({name: 'UrlReference', package: 'alinea/picker/url'}),
    label: 'External website',
    handlesMultiple: false,
    options,
    select(row) {
      return row.fields
    }
  }
}
