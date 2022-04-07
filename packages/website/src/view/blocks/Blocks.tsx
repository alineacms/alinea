import {unreachable} from '@alinea/core'
import {BlocksProps} from './Blocks.query'
import {TextBlock} from './TextBlock'

export type BlocksViewProps = {
  blocks: BlocksProps
}

export function Blocks({blocks}: BlocksViewProps) {
  return (
    <div>
      {blocks.map(block => {
        switch (block.type) {
          case 'TextBlock':
            return <TextBlock key={block.id} {...block} />
          default:
            throw unreachable(block.type)
        }
      })}
    </div>
  )
}
