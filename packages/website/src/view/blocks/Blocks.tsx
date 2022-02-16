import {Schema, schema, unreachable} from '@alinea/core'
import {list} from '@alinea/input.list'
import {TextBlock, TextBlockView} from './TextBlock'

export const Blocks = list('Body', {
  schema: schema({
    TextBlock
  })
})

export type Blocks = Schema.TypeOf<typeof Blocks>

export type BlocksViewProps = {
  blocks: Blocks
}

export function BlocksView({blocks}: BlocksViewProps) {
  return (
    <div>
      {blocks.map(block => {
        switch (block.type) {
          case 'TextBlock':
            return <TextBlockView key={block.id} {...block} />
          default:
            throw unreachable(block.type)
        }
      })}
    </div>
  )
}
