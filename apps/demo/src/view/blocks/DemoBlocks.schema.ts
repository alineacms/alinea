import {Schema, schema} from '@alinea/core'
import {list} from '@alinea/input.list'
import {DemoTextBlockSchema} from './DemoTextBlock.schema'

export const DemoBlocksSchema = list('Blocks', {
  schema: schema({
    DemoTextBlock: DemoTextBlockSchema
  })
})

export type DemoBlocksSchema = Schema.TypeOf<typeof DemoBlocksSchema>
