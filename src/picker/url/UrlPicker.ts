import {Hint} from 'alinea/core/Hint'
import {Reference} from 'alinea/core/Reference'
import {Type} from 'alinea/core/Type'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import {Picker} from 'alinea/editor/Picker'

export interface UrlReference extends Reference {
  ref: 'url'
  url: string
  title: string
  target: string
}

export namespace UrlReference {
  export function isUrl(value: any): value is UrlReference {
    return value && (value.type === 'url' || value.ref === 'url')
  }
}

export interface UrlPickerOptions<T> {
  fields?: Type<T>
}

export function urlPicker<Fields>(
  options: UrlPickerOptions<Fields>
): Picker<UrlReference & Type.Infer<Fields>> {
  const extra = options.fields && Type.shape(options.fields)
  return {
    shape: new RecordShape('Url', {
      url: new ScalarShape('Url'),
      title: new ScalarShape('Title'),
      target: new ScalarShape('Target')
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
