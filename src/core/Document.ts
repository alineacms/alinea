import {metadata} from 'alinea/input/metadata'
import {PathField, path} from 'alinea/input/path'
import {tab, tabs} from 'alinea/input/tabs'
import {TextField, text} from 'alinea/input/text'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundShare} from 'alinea/ui/icons/IcRoundShare'
import {
  Type,
  TypeDefinition,
  TypeFields,
  TypeOptions,
  parseTypeParams,
  type
} from './Type.js'

type Document<Definition> = {
  title: TextField
  path: PathField
  metadata: ReturnType<typeof metadata>
} & Definition

export function document<Definition extends TypeFields>(
  label: string,
  definition: TypeOptions<Definition>
): Type<Document<Definition>>
/** @deprecated See https://github.com/alineacms/alinea/issues/373 */
export function document<Definition extends TypeDefinition>(
  label: string,
  definition: Definition
): Type<Document<Definition>>
export function document<Definition extends TypeDefinition>(
  label: string,
  definition: TypeOptions<Definition> | Definition
): Type<Document<Definition>> {
  const {definition: d, options} = parseTypeParams(definition)
  return type(label, {
    ...options,
    fields: {
      ...(tabs(
        tab('Document', {
          icon: IcRoundInsertDriveFile,
          fields: {
            title: text('Title', {required: true, width: 0.5}),
            path: path('Path', {required: true, width: 0.5}),
            ...d
          }
        }),
        tab('Metadata', {
          icon: IcRoundShare,
          fields: {
            metadata: metadata()
          }
        })
      ) as any) // Todo: Fix type
    }
  })
}
