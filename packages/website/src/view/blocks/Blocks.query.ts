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
            text: {
              ...text,
              content: text.content.map(item => {
                switch (item.type) {
                  case 'ImageBlock':
                    const data = text.blocks[item.attrs!.id]
                    return data
                  default:
                    return item
                }
              })
            }
          }
        default:
          return block
      }
    })
  })
}

export type BlocksProps = Store.TypeOf<ReturnType<typeof blocksQuery>>
