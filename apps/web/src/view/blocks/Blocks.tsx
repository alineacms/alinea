import {unreachable} from '@alinea/core'
import {BlocksSchema} from './Blocks.schema'
import {ColumnsBlock} from './ColumnsBlock'
import {FeaturesBlock} from './FeaturesBlock'
import {ImageBlock} from './ImageBlock'
import {ImagetextBlock} from './ImagetextBlock'
import {TextBlock} from './TextBlock'
import {TypesBlock} from './TypesBlock'

export type BlocksViewProps = {
  blocks: BlocksSchema
}

export function Blocks({blocks}: BlocksViewProps) {
  return (
    <div>
      {blocks.map(block => {
        switch (block.type) {
          case 'TextBlock':
            return <TextBlock key={block.id} {...block} />
          case 'TypesBlock':
            return <TypesBlock key={block.id} {...block} />
          case 'ColumnsBlock':
            return <ColumnsBlock key={block.id} {...block} />
          case 'ImagetextBlock':
            return <ImagetextBlock key={block.id} {...block} />
          case 'ImageBlock':
            return <ImageBlock key={block.id} {...block} />
          case 'FeaturesBlock':
            return <FeaturesBlock key={block.id} {...block} />
          default:
            throw unreachable(block)
        }
      })}
    </div>
  )
}
