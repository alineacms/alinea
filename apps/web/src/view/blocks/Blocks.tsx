import {unreachable} from '@alinea/core'
import {BlocksSchema} from './Blocks.schema'
import {FeaturesBlock} from './FeaturesBlock'
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
          case 'ImagetextBlock':
            return <ImagetextBlock key={block.id} {...block} />
          case 'FeaturesBlock':
            return <FeaturesBlock key={block.id} {...block} />
          default:
            throw unreachable(block)
        }
      })}
    </div>
  )
}
