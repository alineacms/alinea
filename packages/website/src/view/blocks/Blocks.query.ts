import {Expr} from '@alinea/store'
import {BlocksSchema} from './Blocks.schema'

export function blocksQuery(blocks: Expr<BlocksSchema>) {
  const Block = blocks.each()
  return /*Block.get('type').case(
    {
      TextBlock: textBlockQuery(Block)
    },
    Block
  )*/
}
