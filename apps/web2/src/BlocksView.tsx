import {Infer} from 'alinea'
import {fromModule} from 'alinea/ui'
import {ComponentType} from 'react'
import css from './BlocksView.module.scss'
import {TextBlockView} from './blocks/TextBlockView'
import {Blocks} from './schema/blocks/Blocks'

const styles = fromModule(css)

export type BlocksViewProps = {
  blocks: Infer<typeof Blocks>
  container?: ComponentType
}

export function BlocksView({blocks, container}: BlocksViewProps) {
  return (
    <div className={styles.root()}>
      {blocks.map(block => {
        switch (block.type) {
          case 'TextBlock':
            return (
              <TextBlockView key={block.id} container={container} {...block} />
            )
          default:
            return null
        }
      })}
    </div>
  )
}
