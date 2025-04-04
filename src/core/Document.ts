import {type MetadataField, metadata as createMetadata} from 'alinea/field/metadata'
import {type PathField, path as createPath} from 'alinea/field/path'
import {tab, tabs} from 'alinea/field/tabs'
import {type TextField, text} from 'alinea/field/text'
import {IcRoundDescription} from 'alinea/ui/icons/IcRoundDescription'
import {IcRoundShare} from 'alinea/ui/icons/IcRoundShare'
import {type FieldsDefinition, type Type, type TypeConfig, type} from './Type.js'

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
      icon: IcRoundDescription,
      fields: {title, path, ...fields}
    }),
    tab('Metadata', {
      icon: IcRoundShare,
      fields: {metadata}
    })
  )
  return type(label, {
    ...config,
    fields: fieldsWithMeta
  })
}
