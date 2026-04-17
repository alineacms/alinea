import type {Picker} from '#/core/Picker.js'
import {Reference} from '#/core/Reference.js'
import {Type, type} from '#/core/Type.js'
import {ListRow} from '#/core/shape/ListShape.js'
import {RecordShape} from '#/core/shape/RecordShape.js'
import {ScalarShape} from '#/core/shape/ScalarShape.js'
import {keys} from '#/core/util/Objects.js'

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
): Picker<UrlReference> {
  const fieldType = Type.isType(options.fields)
    ? options.fields
    : options.fields && type('URL fields', {fields: options.fields as any})
  const extra = fieldType && Type.shape(fieldType)
  return {
    shape: new RecordShape('Url', {
      [Reference.id]: new ScalarShape('Id'),
      [Reference.type]: new ScalarShape('Type'),
      [UrlReference.url]: new ScalarShape('Url'),
      [UrlReference.title]: new ScalarShape('Title'),
      [UrlReference.target]: new ScalarShape('Target')
    }).concat(extra),
    label: 'External link',
    handlesMultiple: false,
    fields: fieldType,
    options,
    async postProcess(row: any, loader) {
      const {
        [Reference.id]: id,
        [Reference.type]: type,
        [UrlReference.url]: url,
        [UrlReference.title]: title,
        [UrlReference.target]: target,
        [ListRow.index]: index,
        ...fields
      } = row as UrlReference & ListRow
      const fieldKeys = keys(fields)
      for (const key of fieldKeys) delete row[key]
      row.url = url
      row.href = url
      row.title = title
      row.target = target
      row.fields = fields
    }
  }
}
