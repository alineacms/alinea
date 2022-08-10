import {Schema, schema} from '@alinea/core'
import {list} from '@alinea/input.list'
import {DemoColumnsBlockSchema} from './DemoColumnsBlock.schema'
import {DemoImagetextBlockSchema} from './DemoImagetextBlock.schema'
import {DemoTextBlockSchema} from './DemoTextBlock.schema'

export const DemoBlocksSchema = list('Blocks', {
  schema: schema({
    DemoTextBlock: DemoTextBlockSchema,
    DemoColumnsBlock: DemoColumnsBlockSchema,
    DemoImagetextBlock: DemoImagetextBlockSchema
  })
})

export type DemoBlocksSchema = Schema.TypeOf<typeof DemoBlocksSchema>
