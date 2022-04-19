import {Store} from '@alinea/store'
import {Pages} from '../../../.alinea/web'
import {BlocksSchema} from './Blocks.schema'
import {textBlockQuery} from './TextBlock.query'
import {TextBlockSchema} from './TextBlock.schema'
import {typesBlockQuery} from './TypesBlock.query'
import {TypesBlockSchema} from './TypesBlock.schema'

export async function blocksQuery(pages: Pages, blocks: BlocksSchema) {
  return Promise.all(
    blocks.map(async block => {
      switch (block.type) {
        case 'TextBlock':
          return textBlockQuery(pages, block as TextBlockSchema)
        case 'TypesBlock':
          return typesBlockQuery(pages, block as TypesBlockSchema)
        default:
          return block
      }
    })
  )
}

export type BlocksProps = Store.TypeOf<ReturnType<typeof blocksQuery>>
