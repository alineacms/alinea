import {metadata} from 'alinea/input'
import {tab, tabs} from 'alinea/input/tabs'
import {Label} from './Label.js'
import {Type, TypeDefinition, type} from './Type.js'

export function document<Definition extends TypeDefinition>(
  label: Label,
  definition: Definition
): Type<Definition> {
  return type(label, {
    ...tabs(
      tab('Document', definition),
      tab('Metadata', {
        metadata: metadata()
      })
    )
  } as any) as any
}
