import {metadata} from 'alinea/input/metadata'
import {PathField, path} from 'alinea/input/path'
import {tab, tabs} from 'alinea/input/tabs'
import {TextField, text} from 'alinea/input/text'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundShare} from 'alinea/ui/icons/IcRoundShare'
import {Label} from './Label.js'
import {Meta} from './Meta.js'
import {Type, TypeDefinition, type} from './Type.js'

type Document<Definition> = {
  title: TextField
  path: PathField
  metadata: ReturnType<typeof metadata>
} & Definition

export function document<Definition extends TypeDefinition>(
  label: Label,
  definition: Definition
): Type<Document<Definition>> {
  return type(label, {
    ...tabs(
      tab('Document', {
        title: text('Title', {required: true, width: 0.5}),
        path: path('Path', {required: true, width: 0.5}),
        ...definition,
        [Meta]: {
          icon: IcRoundInsertDriveFile
        }
      }),
      tab('Metadata', {
        metadata: metadata(),
        [Meta]: {
          icon: IcRoundShare
        }
      })
    ),
    [Meta]: definition[Meta]
  }) as any
}
