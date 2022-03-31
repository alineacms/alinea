import {Expr, Store} from '@alinea/store'
import {BlocksSchema} from './Blocks.schema'

export function blocksQuery(blocks: Expr<BlocksSchema>) {
  return blocks.process(blocks => {
    return blocks.map(block => {
      switch (block.type) {
        case 'TextBlock':
          const {text} = block
          return {
            ...block,
            text: text
          }
        default:
          return block
      }
    })
  })
}

export type BlocksProps = Store.TypeOf<ReturnType<typeof blocksQuery>>
