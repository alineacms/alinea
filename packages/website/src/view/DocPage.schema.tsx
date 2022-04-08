import {Schema, type} from '@alineacms/core'
import {path} from '@alineacms/input.path'
import {text} from '@alineacms/input.text'
import {BlocksSchema} from './blocks/Blocks.schema'

export const DocPageSchema = type('Doc', {
  title: text('Title', {width: 0.5}),
  path: path('Path', {width: 0.5}),
  blocks: BlocksSchema
})

export type DocPageSchema = Schema.TypeOf<typeof DocPageSchema>
