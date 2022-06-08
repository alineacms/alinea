import { Schema, schema } from '@alinea/core'
import { list } from '@alinea/input.list'
import { ImagetextBlockSchema } from './ImagetextBlock.schema'
import { TextBlockSchema } from './TextBlock.schema'
import { TypesBlockSchema } from './TypesBlock.schema'

export const BlocksSchema = list('Body', {
  schema: schema({
    TextBlock: TextBlockSchema,
    TypesBlock: TypesBlockSchema,
    ImagetextBlock: ImagetextBlockSchema
  })
})

export type BlocksSchema = Schema.TypeOf<typeof BlocksSchema>
