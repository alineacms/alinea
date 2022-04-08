import {Expr, Store} from '@alineacms/store'
import {Pages} from '../../../.alinea/web'
import {BlocksSchema} from './Blocks.schema'
import {textBlockQuery} from './TextBlock.query'
import {TextBlockSchema} from './TextBlock.schema'

export function blocksQuery(pages: Pages, blocks: Expr<BlocksSchema>) {
  return blocks.map(block => {
    return block.type.case(
      {
        TextBlock: textBlockQuery(pages, block as Expr<TextBlockSchema>)
      },
      block
    )
  })
}

export type BlocksProps = Store.TypeOf<ReturnType<typeof blocksQuery>>
