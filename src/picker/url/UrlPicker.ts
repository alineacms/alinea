import {Hint} from 'alinea/core/Hint'
import {Picker} from 'alinea/core/Picker'
import {Reference} from 'alinea/core/Reference'
import {Type, type} from 'alinea/core/Type'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'

export interface UrlReference extends Reference {
  _type: 'url'
  _url: string
  _title: string
  _target: string
}

export namespace UrlReference {
  export const url = '_url' satisfies keyof UrlReference
  export const title = '_title' satisfies keyof UrlReference
  export const target = '_target' satisfies keyof UrlReference

  export function isUrl(value: any): value is UrlReference {
    return value && value[Reference.type] === 'url'
  }
}

export interface UrlPickerOptions<Definition> {
  fields?: Definition | Type<Definition>
}

export function urlPicker<Fields>(
  options: UrlPickerOptions<Fields>
): Picker<UrlReference & Type.Infer<Fields>> {
  const fieldType = Type.isType(options.fields)
    ? options.fields
    : options.fields && type({fields: options.fields as any})
  const extra = fieldType && Type.shape(fieldType)
  return {
    shape: new RecordShape('Url', {
      [Reference.id]: new ScalarShape('Id'),
      [Reference.type]: new ScalarShape('Type'),
      [UrlReference.url]: new ScalarShape('Url'),
      [UrlReference.title]: new ScalarShape('Title'),
      [UrlReference.target]: new ScalarShape('Target')
    }).concat(extra),
    hint: Hint.Extern({name: 'UrlReference', package: 'alinea/picker/url'}),
    label: 'External website',
    handlesMultiple: false,
    fields: fieldType,
    options /*,
    select(row) {
      return row.fields
    }*/
  }
}
