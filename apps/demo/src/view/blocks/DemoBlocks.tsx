import css from './DemoBlocks.module.scss'

import {unreachable} from '@alinea/core'
import {fromModule} from '@alinea/ui'
import {ComponentType} from 'react'
import {DemoBlocksSchema} from './DemoBlocks.schema'
import {DemoColumnsBlock} from './DemoColumnsBlock'
import {DemoImagetextBlock} from './DemoImagetextBlock'
import {DemoTextBlock} from './DemoTextBlock'

const styles = fromModule(css)

export type DemoBlocksViewProps = {
  blocks: DemoBlocksSchema
  container?: ComponentType
}

export function DemoBlocks({blocks, container}: DemoBlocksViewProps) {
  return (
    <div className={styles.root()}>
      {blocks.map(block => {
        switch (block.type) {
          case 'DemoTextBlock':
            return (
              <DemoTextBlock key={block.id} container={container} {...block} />
            )
          case 'DemoColumnsBlock':
            return (
              <DemoColumnsBlock
                key={block.id}
                container={container}
                {...block}
              />
            )
          case 'DemoImagetextBlock':
            return (
              <DemoImagetextBlock
                key={block.id}
                container={container}
                {...block}
              />
            )
          default:
            throw unreachable(block)
        }
      })}
    </div>
  )
}
