import {Schema, schema} from '@alinea/core'
import {list} from '@alinea/input.list'
import {TextBlockSchema} from './TextBlock.schema'

export const BlocksSchema = list('Body', {
  schema: schema({
    TextBlock: TextBlockSchema
  })
})

export type BlocksSchema = Schema.TypeOf<typeof BlocksSchema>
