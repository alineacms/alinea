import {Schema, schema} from '@alineacms/core'
import {list} from '@alineacms/input.list'
import {TextBlockSchema} from './TextBlock.schema'

export const BlocksSchema = list('Body', {
  schema: schema({
    TextBlock: TextBlockSchema
  })
})

export type BlocksSchema = Schema.TypeOf<typeof BlocksSchema>
