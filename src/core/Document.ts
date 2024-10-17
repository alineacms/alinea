import {metadata as createMetadata} from 'alinea/field/metadata'
import {PathField, path as createPath} from 'alinea/field/path'
import {tab, tabs} from 'alinea/field/tabs'
import {TextField, text} from 'alinea/field/text'
import {IcRoundDescription} from 'alinea/ui/icons/IcRoundDescription'
import {IcRoundShare} from 'alinea/ui/icons/IcRoundShare'
import {FieldsDefinition, Type, TypeConfig, type} from './Type.js'

export interface Document {
  title: TextField
  path: PathField
  metadata: ReturnType<typeof createMetadata>
}

export namespace Document {
  export const title = text('Title', {required: true, width: 0.5})
  export const path = createPath('Path', {required: true, width: 0.5})
  export const metadata = createMetadata()
}

export function document<Fields extends FieldsDefinition>(
  label: string,
  {fields, ...config}: TypeConfig<Fields>
): Type<Document & Fields> {
  const fieldsWithMeta: Document & Fields = tabs(
    tab('Document', {
      icon: IcRoundDescription,
      fields: {
        title: Document.title,
        path: Document.path,
        ...fields
      }
    }),
    tab('Metadata', {
      icon: IcRoundShare,
      fields: {
        metadata: Document.metadata
      }
    })
  ) as any
  return type(label, {
    ...config,
    fields: fieldsWithMeta
  })
}
