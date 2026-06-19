import {
  type MetadataField,
  metadata as createMetadata
} from '#/field/metadata.js'
import {type PathField, path as createPath} from '#/field/path.js'
import {tab, tabs} from '#/field/tabs.js'
import {type TextField, text} from '#/field/text.js'
import {
  type FieldsDefinition,
  type Type,
  type TypeConfig,
  type
} from './Type.js'

const documentMarker = Symbol.for('@alinea.Document')

export type Document = {
  title: TextField
  path: PathField
  metadata: MetadataField
}

function documentFields() {
  return {
    title: text('Title', {required: true, width: 0.5}),
    path: createPath('Path', {required: true, width: 0.5}),
    metadata: createMetadata()
  }
}

export function document<Fields extends FieldsDefinition>(
  label: string,
  {fields, ...config}: TypeConfig<Fields>
): Type<Document & Fields> {
  const {title, path, metadata} = documentFields()
  const fieldsWithMeta: Document & Fields = <any>tabs(
    tab('Document', {
      fields: {title, path, ...fields}
    }),
    tab('Metadata', {
      fields: {metadata}
    })
  )
  const result = type(label, {
    ...config,
    fields: fieldsWithMeta
  })
  return Object.assign(result, {[documentMarker]: true})
}
