import {Schema, type} from '@alinea/core'
import {text} from '@alinea/input.text'
import {MdMergeType} from 'react-icons/md'

export const TypesBlockSchema = type('Types', {
  entryPoint: text('Entry point'),
  exports: text('Exports', {help: 'Comma separated list of types to document'})
}).configure({icon: MdMergeType})

export type TypesBlockSchema = Schema.TypeOf<typeof TypesBlockSchema> & {
  id: string
  type: 'TypesBlock'
}
