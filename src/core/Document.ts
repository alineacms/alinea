import {metadata as createMetadata} from 'alinea/field/metadata'
import {PathField, path as createPath} from 'alinea/field/path'
import {tab, tabs} from 'alinea/field/tabs'
import {TextField, text} from 'alinea/field/text'
import {IcRoundDescription} from 'alinea/ui/icons/IcRoundDescription'
import {IcRoundShare} from 'alinea/ui/icons/IcRoundShare'
import {Type, TypeFields, TypeOptions, parseTypeParams, type} from './Type.js'

export type Document<Definition> = {
  title: TextField
  path: PathField
  metadata: ReturnType<typeof createMetadata>
} & Definition

export namespace Document {
  export const title = text('Title', {required: true, width: 0.5})
  export const path = createPath('Path', {required: true, width: 0.5})
  export const metadata = createMetadata()
}

export function document<Definition extends TypeFields>(
  label: string,
  definition: TypeOptions<Definition>
): Type<Document<Definition>> {
  const {definition: d, options} = parseTypeParams(definition)
  return type(label, {
    ...options,
    fields: {
      ...(tabs(
        tab('Document', {
          icon: IcRoundDescription,
          fields: {
            title: Document.title,
            path: Document.path,
            ...d
          }
        }),
        tab('Metadata', {
          icon: IcRoundShare,
          fields: {
            metadata: Document.metadata as any
          }
        })
      ) as any) // Todo: Fix type
    }
  })
}
