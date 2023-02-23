import {type} from 'alinea/core'
import {text} from 'alinea/input/text'
import {IcRoundHdrStrong} from 'alinea/ui/icons/IcRoundHdrStrong'
import {transformTypes} from './TypesBlock.server'

export const TypesBlockSchema = type('Types', {
  types: text('Types', {help: 'Comma separated list of types to document'})
}).configure({
  icon: IcRoundHdrStrong,
  transform: transformTypes
})
