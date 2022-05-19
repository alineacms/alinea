import {Schema, type} from '@alinea/core'
import {text} from '@alinea/input.text'
import {IcRoundHdrStrong} from '@alinea/ui/icons/IcRoundHdrStrong'
import {transformTypes} from './TypesBlock.query'

export const TypesBlockSchema = type('Types', {
  types: text('Types', {help: 'Comma separated list of types to document'})
}).configure({
  icon: IcRoundHdrStrong,
  transform: transformTypes
})

export type TypesBlockSchema = Schema.TypeOf<typeof TypesBlockSchema> & {
  id: string
  type: 'TypesBlock'
}
