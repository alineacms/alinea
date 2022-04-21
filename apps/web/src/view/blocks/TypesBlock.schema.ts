import {Schema, type} from '@alinea/core'
import {text} from '@alinea/input.text'
import {MdHdrStrong} from 'react-icons/md'

export const TypesBlockSchema = type('Types', {
  types: text('Types', {help: 'Comma separated list of types to document'})
}).configure({icon: MdHdrStrong})

export type TypesBlockSchema = Schema.TypeOf<typeof TypesBlockSchema> & {
  id: string
  type: 'TypesBlock'
}
